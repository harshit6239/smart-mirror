import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import ipcConfig from './config/ipc.config'
import { CompanionServer } from './services/companion-server.service'
import { WifiService } from './services/wifi.service'
import { GestureWebSocketClient } from './services/websocket.service'
import { store, getConfig, setConfig, type Page, type WidgetInstance } from './config/app-config'

const DEFAULT_PAGES: Page[] = [
  { id: 'page-home', name: 'Home', widgetIds: [] },
  { id: 'page-media', name: 'Media', widgetIds: [] },
  { id: 'page-info', name: 'Info', widgetIds: [] }
]

const wifiService = new WifiService()
const companionServer = new CompanionServer(wifiService)
const gestureClient = new GestureWebSocketClient('ws://localhost:5001')

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    // Open DevTools in development
    if (is.dev) {
      mainWindow.webContents.openDevTools()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC configuration
  ipcConfig(ipcMain)

  // ── Config IPC ────────────────────────────────────────────────────────────
  ipcMain.handle('config:get', () => getConfig())

  ipcMain.handle('config:set', (_event, key: string, value: unknown) => {
    setConfig(key, value)
  })

  // ── System Stats IPC ──────────────────────────────────────────────────────
  ipcMain.handle('system:stats', async () => {
    if (process.platform !== 'linux') {
      return { cpuPercent: null, memPercent: null, tempC: null }
    }

    const readCpuNums = (): number[] => {
      const line = readFileSync('/proc/stat', 'utf-8').split('\n')[0]
      return line.split(/\s+/).slice(1).map(Number)
    }

    let cpuPercent: number | null = null
    try {
      const before = readCpuNums()
      await new Promise((r) => setTimeout(r, 200))
      const after = readCpuNums()
      const idleDiff = after[3] - before[3]
      const totalDiff = after.reduce((a, b) => a + b, 0) - before.reduce((a, b) => a + b, 0)
      cpuPercent = totalDiff === 0 ? 0 : Math.round(100 * (1 - idleDiff / totalDiff))
    } catch {
      /* leave null */
    }

    let memPercent: number | null = null
    try {
      const memInfo = readFileSync('/proc/meminfo', 'utf-8')
      const getVal = (key: string): number => {
        const m = memInfo.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'))
        return m ? parseInt(m[1]) : 0
      }
      const total = getVal('MemTotal')
      const available = getVal('MemAvailable')
      memPercent = total === 0 ? 0 : Math.round(100 * (1 - available / total))
    } catch {
      /* leave null */
    }

    let tempC: number | null = null
    try {
      const raw = readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf-8')
      tempC = Math.round(parseInt(raw.trim()) / 1000)
    } catch {
      /* not available on non-Pi */
    }

    return { cpuPercent, memPercent, tempC }
  })

  // Broadcast any store change to renderer windows AND companion WebSocket clients
  store.onDidAnyChange((newValue) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('config:changed', newValue)
    })
    companionServer.broadcastEvent('config-changed', newValue)
  })

  // ── Page change IPC (renderer → main → companion WS) ──────────────────────
  ipcMain.on('page:changed', (_event, pageIndex: number) => {
    companionServer.setCurrentPage(pageIndex)
  })

  createWindow()

  // ── Seed default pages on first run ──────────────────────────────────────
  if (getConfig().pages.length === 0) {
    setConfig('pages', DEFAULT_PAGES)
  }

  // ── Seed Phase 4 widget instances (clock + system-stats) ─────────────────
  if (!getConfig().widgetInstances['instance-clock-1']) {
    const clockInstance: WidgetInstance = {
      id: 'instance-clock-1',
      widgetId: 'clock',
      version: '1.0.0',
      config: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, use24h: true },
      layout: { col: 1, row: 1, colSpan: 7, rowSpan: 3 }
    }
    const statsInstance: WidgetInstance = {
      id: 'instance-stats-1',
      widgetId: 'system-stats',
      version: '1.0.0',
      config: {},
      layout: { col: 9, row: 1, colSpan: 4, rowSpan: 3 }
    }
    setConfig('widgetInstances', {
      'instance-clock-1': clockInstance,
      'instance-stats-1': statsInstance
    })
    const pages = getConfig().pages
    if (pages.length > 0) {
      const updated = pages.map((p, i) =>
        i === 0 ? { ...p, widgetIds: ['instance-clock-1', 'instance-stats-1'] } : p
      )
      setConfig('pages', updated)
    }
  }

  // ── WiFi provisioning ────────────────────────────────────────────────────
  // On non-Linux dev machines, skip provisioning so the app loads directly.
  if (process.platform !== 'linux' && !getConfig().wifi.configured) {
    setConfig('wifi.configured', true)
  }

  void companionServer.start()
  gestureClient.start()
  gestureClient.onGesture = (payload) => companionServer.broadcastEvent('gesture', payload)
  companionServer.setGestureStatusProvider(() => gestureClient.connected)

  if (!getConfig().wifi.configured) {
    void wifiService.startHotspot()
  }

  companionServer.setOnWifiConnected(() => {
    void wifiService.stopHotspot()
    setConfig('wifi.configured', true)
    BrowserWindow.getAllWindows().forEach((win) => win.webContents.send('wifi-connected'))
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
  gestureClient.stop()
  void companionServer.stop()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
