import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { readFileSync } from 'fs'
import os from 'os'
import https from 'https'
import http from 'http'
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

// ── Utility: fetch a URL server-side (follows redirects, bypasses renderer CORS) ──
// Blocks private/loopback hosts to prevent SSRF against the local companion API or LAN devices.
const SSRF_BLOCKED_HOST =
  /^(localhost|127(\.[0-9]+){3}|0\.0\.0\.0|10(\.[0-9]+){3}|172\.(1[6-9]|2[0-9]|3[01])(\.[0-9]+){2}|192\.168(\.[0-9]+){2}|::1|\[::1\])$/i

function fetchUrlText(url: string, redirectsLeft = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false
    const done = {
      ok: (v: string) => {
        if (!settled) {
          settled = true
          resolve(v)
        }
      },
      err: (e: Error) => {
        if (!settled) {
          settled = true
          reject(e)
        }
      }
    }

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      done.err(new Error('Invalid URL'))
      return
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      done.err(new Error('Only http/https URLs are allowed'))
      return
    }
    if (SSRF_BLOCKED_HOST.test(parsed.hostname)) {
      done.err(new Error('URL target is not allowed'))
      return
    }
    const mod = parsed.protocol === 'https:' ? https : http
    const req = mod.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirectsLeft <= 0) {
          done.err(new Error('Too many redirects'))
          return
        }
        // Resolve relative Location headers against the original URL
        let nextUrl: string
        try {
          nextUrl = new URL(res.headers.location, url).href
        } catch {
          nextUrl = res.headers.location
        }
        void fetchUrlText(nextUrl, redirectsLeft - 1).then(done.ok, done.err)
        return
      }
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        // Drain the body so we can include the API's error message in the thrown Error.
        let errBody = ''
        res.on('data', (chunk: Buffer) => {
          errBody += chunk.toString('utf-8').slice(0, 512)
        })
        res.on('end', () => {
          let detail = errBody.trim()
          // Try to extract a human-readable message from JSON error bodies (e.g. NewsAPI)
          try {
            const parsed = JSON.parse(detail) as Record<string, unknown>
            if (typeof parsed.message === 'string') detail = parsed.message
          } catch {
            /* not JSON, keep raw text */
          }
          done.err(new Error(`HTTP ${res.statusCode}${detail ? ': ' + detail : ''}`))
        })
        res.on('error', (e) => done.err(e))
        return
      }
      let data = ''
      let size = 0
      const MAX_SIZE = 2 * 1024 * 1024 // 2 MB
      res.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_SIZE) {
          req.destroy()
          done.err(new Error('Response too large'))
          return
        }
        data += chunk.toString('utf-8')
      })
      res.on('end', () => done.ok(data))
      res.on('error', (e) => done.err(e))
    })
    req.on('error', (e) => done.err(e))
    req.setTimeout(15000, () => {
      req.destroy()
      done.err(new Error('Timeout'))
    })
  })
}

// ── Spotify types ───────────────────────────────────────────────────────────
interface SpotifyTrack {
  name: string
  artists: string[]
  albumName: string
  albumArtUrl: string | null
  durationMs: number
  progressMs: number
}
type SpotifyResult =
  | { status: 'playing' | 'paused'; track: SpotifyTrack }
  | { status: 'idle' | 'no-token' }
  | { status: 'error'; message: string }

// ── Spotify API helpers ──────────────────────────────────────────────────────
function spotifyApiGet(
  path: string,
  accessToken: string
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.spotify.com',
        path,
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
      },
      (res) => {
        let body = ''
        res.on('data', (chunk: Buffer) => {
          body += chunk.toString('utf-8')
        })
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body }))
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.setTimeout(10000, () => {
      req.destroy()
      reject(new Error('Spotify API timeout'))
    })
    req.end()
  })
}

function spotifyRefreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }).toString()
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const req = https.request(
      {
        hostname: 'accounts.spotify.com',
        path: '/api/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${auth}`,
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString('utf-8')
        })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data) as { access_token?: string }
            resolve(parsed.access_token ?? null)
          } catch {
            resolve(null)
          }
        })
        res.on('error', () => resolve(null))
      }
    )
    req.on('error', () => resolve(null))
    req.write(body)
    req.end()
  })
}

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

  // ── Companion URL IPC ─────────────────────────────────────────────────────
  ipcMain.handle('companion:url', () => {
    const nets = os.networkInterfaces()
    for (const ifaces of Object.values(nets)) {
      for (const iface of ifaces ?? []) {
        if (!iface.internal && iface.family === 'IPv4') {
          return `http://${iface.address}:8080`
        }
      }
    }
    return 'http://localhost:8080'
  })

  // ── Page change IPC (renderer → main → companion WS) ──────────────────────
  ipcMain.on('page:changed', (_event, pageIndex: number) => {
    companionServer.setCurrentPage(pageIndex)
  })

  // ── Calendar iCal proxy (bypasses renderer CORS restrictions) ────────────
  ipcMain.handle('calendar:fetch-ical', (_event, url: string) => fetchUrlText(url))

  // ── News headlines proxy (NewsAPI blocks browser CORS, so proxy via main) ──
  ipcMain.handle('news:fetch-headlines', (_event, url: string) => fetchUrlText(url))

  // ── Spotify: Now Playing (handles token refresh automatically) ────────────
  ipcMain.handle(
    'spotify:now-playing',
    async (_event, instanceId: string): Promise<SpotifyResult> => {
      const instances = getConfig().widgetInstances
      const instance = instances[instanceId]
      if (!instance) return { status: 'error', message: 'Instance not found' }

      const accessToken = (instance.config.accessToken as string | undefined) || ''
      const refreshToken = (instance.config.refreshToken as string | undefined) || ''
      const clientId = (instance.config.clientId as string | undefined) || ''
      const clientSecret = (instance.config.clientSecret as string | undefined) || ''

      if (!accessToken) return { status: 'no-token' }

      function parseResponse(statusCode: number, body: string): SpotifyResult | null {
        if (statusCode === 204 || (statusCode === 200 && !body.trim())) return { status: 'idle' }
        if (statusCode === 401) return null // signals token expired — caller will refresh
        if (statusCode !== 200) return { status: 'error', message: `Spotify HTTP ${statusCode}` }
        try {
          const data = JSON.parse(body) as {
            is_playing: boolean
            progress_ms: number | null
            currently_playing_type: string
            item: {
              name: string
              duration_ms: number
              artists: { name: string }[]
              album: { name: string; images: { url: string; width: number }[] }
            } | null
          }

          const item = data.item
          if (!item || data.currently_playing_type !== 'track') return { status: 'idle' }
          const sorted = [...(item.album.images ?? [])].sort((a, b) => b.width - a.width)
          const artUrl = sorted.find((i) => i.width >= 64)?.url ?? sorted[0]?.url ?? null
          return {
            status: data.is_playing ? 'playing' : 'paused',
            track: {
              name: item.name,
              artists: item.artists.map((a) => a.name),
              albumName: item.album.name,
              albumArtUrl: artUrl,
              durationMs: item.duration_ms,
              progressMs: data.progress_ms ?? 0
            }
          }
        } catch {
          return { status: 'error', message: 'Failed to parse Spotify response' }
        }
      }

      let resp = await spotifyApiGet('/v1/me/player/currently-playing', accessToken)
      let result = parseResponse(resp.statusCode, resp.body)

      // Token expired → refresh and retry once
      if (result === null && refreshToken && clientId && clientSecret) {
        const newToken = await spotifyRefreshAccessToken(refreshToken, clientId, clientSecret)
        if (newToken) {
          // Persist the new access token so subsequent polls use it
          setConfig('widgetInstances', {
            ...getConfig().widgetInstances,
            [instanceId]: {
              ...getConfig().widgetInstances[instanceId],
              config: { ...getConfig().widgetInstances[instanceId].config, accessToken: newToken }
            }
          })
          resp = await spotifyApiGet('/v1/me/player/currently-playing', newToken)
          result = parseResponse(resp.statusCode, resp.body)
        }
      }

      return result ?? { status: 'error', message: 'Re-authentication required' }
    }
  )

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
      ...getConfig().widgetInstances, // preserve any user-placed widgets
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
// Clean up services before the process exits (important on Linux/Pi where app.quit() is synchronous)
app.on('before-quit', () => {
  gestureClient.stop()
  void companionServer.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
