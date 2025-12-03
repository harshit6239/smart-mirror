import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import ipcConfig from './config/ipc.config'
import { WebSocketService } from './services/websocket.service'

const wsService = new WebSocketService(import.meta.env.MAIN_VITE_WS_URL)

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

  // Send current WebSocket state when renderer is ready
  mainWindow.webContents.on('did-finish-load', () => {
    const state = wsService.getConnectionState()
    mainWindow.webContents.send(
      'websocket-state',
      JSON.stringify({
        state,
        attempts: 0,
        nextRetryIn: 0
      })
    )
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
  ipcConfig(ipcMain, wsService)

  // Handle request for current WebSocket state
  ipcMain.handle('get-websocket-state', () => {
    const state = wsService.getConnectionState()
    return JSON.stringify({
      state,
      attempts: 0,
      nextRetryIn: 0
    })
  })

  createWindow()

  // Initialize WebSocket service after window is created
  // This ensures the renderer can receive state updates
  setTimeout(() => {
    wsService.connect()
  }, 100)

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
  wsService.disconnect()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
