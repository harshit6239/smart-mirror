import http from 'http'
import { existsSync, readFileSync } from 'fs'
import { join, extname, resolve as resolvePath } from 'path'
import { WebSocketServer, WebSocket } from 'ws'
import { app, BrowserWindow } from 'electron'
import type { WifiService } from './wifi.service'
import { getConfig, setConfig, type AppConfig } from '../config/app-config'

export const COMPANION_PORT = 8080

export class CompanionServer {
  private server: http.Server | null = null
  private wss: WebSocketServer | null = null
  private onWifiConnected: (() => void) | null = null
  private currentPageIndex = 0
  private gestureStatusProvider: (() => boolean) | null = null

  constructor(private readonly wifi: WifiService) {}

  setOnWifiConnected(cb: () => void): void {
    this.onWifiConnected = cb
  }

  /** Supply a function that returns the current gesture connection state. */
  setGestureStatusProvider(fn: () => boolean): void {
    this.gestureStatusProvider = fn
  }

  /** Called by main process whenever the active page changes in the renderer. */
  setCurrentPage(index: number): void {
    this.currentPageIndex = index
    this.broadcastEvent('page-change', { pageIndex: index })
  }

  /** Broadcast a typed event to all connected companion WebSocket clients. */
  broadcastEvent(event: string, data: unknown): void {
    if (!this.wss) return
    const msg = JSON.stringify({ event, data })
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg)
      }
    }
  }

  async start(): Promise<void> {
    if (this.server) return

    this.server = http.createServer((req, res) => {
      void this.handleRequest(req, res)
    })

    // Attach WebSocket server to the same HTTP server at /ws
    this.wss = new WebSocketServer({ server: this.server, path: '/ws' })
    this.wss.on('connection', (ws) => {
      // Send current state immediately on connect
      ws.send(
        JSON.stringify({
          event: 'connected',
          data: {
            pageIndex: this.currentPageIndex,
            wifiConfigured: getConfig().wifi.configured
          }
        })
      )
    })

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(COMPANION_PORT, '0.0.0.0', resolve)
      this.server!.on('error', reject)
    })
    console.log(`[companion] Listening on 0.0.0.0:${COMPANION_PORT}`)
  }

  async stop(): Promise<void> {
    this.wss?.close()
    this.wss = null
    if (!this.server) return
    await new Promise<void>((resolve) => this.server!.close(() => resolve()))
    this.server = null
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // ── Auth middleware slot (passthrough — swap for real auth without touching routes) ──
    if (!this.auth()) return

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = req.url ?? '/'
    const method = req.method ?? 'GET'

    // ── GET /api/status ──────────────────────────────────────────────────────
    if (url === '/api/status' && method === 'GET') {
      this.sendJson(res, {
        connectedToGesture: this.gestureStatusProvider?.() ?? false,
        currentPage: this.currentPageIndex,
        wifiConfigured: getConfig().wifi.configured
      })
      return
    }

    // ── GET /api/layouts ─────────────────────────────────────────────────────
    if (url === '/api/layouts' && method === 'GET') {
      const { pages, widgetInstances } = getConfig()
      this.sendJson(res, { pages, widgetInstances })
      return
    }

    // ── PUT /api/layouts ─────────────────────────────────────────────────────
    if (url === '/api/layouts' && method === 'PUT') {
      const body = await this.readBody(req)
      try {
        const payload = JSON.parse(body) as Partial<Pick<AppConfig, 'pages' | 'widgetInstances'>>
        if (payload.pages) setConfig('pages', payload.pages)
        if (payload.widgetInstances) setConfig('widgetInstances', payload.widgetInstances)
        this.sendJson(res, { success: true })
      } catch {
        this.badRequest(res, 'Invalid JSON body')
      }
      return
    }

    // ── GET|PUT /api/widget-config/:instanceId ───────────────────────────────
    const widgetConfigMatch = url.match(/^\/api\/widget-config\/([^?]+)$/)
    if (widgetConfigMatch) {
      const instanceId = decodeURIComponent(widgetConfigMatch[1])
      const instances = getConfig().widgetInstances

      if (method === 'GET') {
        const instance = instances[instanceId]
        if (!instance) {
          this.notFound(res)
          return
        }
        this.sendJson(res, instance)
        return
      }

      if (method === 'PUT') {
        const body = await this.readBody(req)
        try {
          const patch = JSON.parse(body) as Partial<AppConfig['widgetInstances'][string]>
          const existing = instances[instanceId]
          if (!existing) {
            this.notFound(res)
            return
          }
          setConfig('widgetInstances', {
            ...instances,
            [instanceId]: { ...existing, ...patch, id: instanceId }
          })
          this.sendJson(res, { success: true })
        } catch {
          this.badRequest(res, 'Invalid JSON body')
        }
        return
      }
    }

    // ── GET /api/settings ────────────────────────────────────────────────────
    if (url === '/api/settings' && method === 'GET') {
      this.sendJson(res, getConfig().settings)
      return
    }

    // ── PUT /api/settings ────────────────────────────────────────────────────
    if (url === '/api/settings' && method === 'PUT') {
      const body = await this.readBody(req)
      try {
        const patch = JSON.parse(body) as Partial<AppConfig['settings']>
        setConfig('settings', { ...getConfig().settings, ...patch })
        this.sendJson(res, { success: true })
      } catch {
        this.badRequest(res, 'Invalid JSON body')
      }
      return
    }

    // ── POST /api/notifications ──────────────────────────────────────────────
    if (url === '/api/notifications' && method === 'POST') {
      const body = await this.readBody(req)
      try {
        const note = JSON.parse(body) as {
          type?: string
          title: string
          body: string
          durationMs?: number
        }
        this.broadcastEvent('notification', note)
        BrowserWindow.getAllWindows().forEach((win) => win.webContents.send('notification', note))
        this.sendJson(res, { success: true })
      } catch {
        this.badRequest(res, 'Invalid JSON body')
      }
      return
    }

    // ── GET /api/widgets/registry ────────────────────────────────────────────
    if (url === '/api/widgets/registry' && method === 'GET') {
      this.sendJson(res, getConfig().installedWidgets)
      return
    }

    // ── POST /api/widgets/install ────────────────────────────────────────────
    if (url === '/api/widgets/install' && method === 'POST') {
      res.writeHead(501, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({ error: 'Not implemented — dynamic widget loading wired in Phase 8' })
      )
      return
    }

    // ── DELETE /api/widgets/:id ──────────────────────────────────────────────
    const widgetDeleteMatch = url.match(/^\/api\/widgets\/([^/?]+)$/)
    if (widgetDeleteMatch && method === 'DELETE') {
      const widgetId = decodeURIComponent(widgetDeleteMatch[1])
      const instances = { ...getConfig().widgetInstances }
      const removedIds: string[] = []
      for (const [id, inst] of Object.entries(instances)) {
        if (inst.widgetId === widgetId) {
          delete instances[id]
          removedIds.push(id)
        }
      }
      setConfig('widgetInstances', instances)
      setConfig(
        'pages',
        getConfig().pages.map((p) => ({
          ...p,
          widgetIds: p.widgetIds.filter((id) => !removedIds.includes(id))
        }))
      )
      this.sendJson(res, { success: true, removed: removedIds.length })
      return
    }

    // ── POST /api/system/restart ─────────────────────────────────────────────
    if (url === '/api/system/restart' && method === 'POST') {
      this.sendJson(res, { success: true })
      setTimeout(() => {
        app.relaunch()
        app.exit(0)
      }, 200)
      return
    }

    // ── WiFi (existing) ──────────────────────────────────────────────────────
    if (url === '/api/wifi/status' && method === 'GET') {
      const connected = await this.wifi.isConnected()
      this.sendJson(res, { connected })
      return
    }

    if (url === '/api/wifi/scan' && method === 'GET') {
      const networks = await this.wifi.scanNetworks()
      this.sendJson(res, networks)
      return
    }

    if (url === '/api/wifi/connect' && method === 'POST') {
      const body = await this.readBody(req)
      try {
        const parsed = JSON.parse(body) as unknown
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          typeof (parsed as Record<string, unknown>).ssid !== 'string' ||
          typeof (parsed as Record<string, unknown>).password !== 'string'
        ) {
          this.badRequest(res, 'ssid and password are required strings')
          return
        }
        const { ssid, password } = parsed as { ssid: string; password: string }
        const ok = await this.wifi.connectToNetwork(ssid, password)
        if (ok) {
          this.sendJson(res, { success: true })
          setTimeout(() => this.onWifiConnected?.(), 500)
        } else {
          res.writeHead(400)
          res.end(JSON.stringify({ success: false, error: 'Connection failed. Check password.' }))
        }
      } catch {
        this.badRequest(res, 'Invalid JSON body')
      }
      return
    }

    // Serve companion SPA (falls back to built-in setup page if not yet built)
    await this.serveStatic(req, res)
  }

  // ── Auth middleware slot ───────────────────────────────────────────────────
  // Passthrough now — replace with real token check later without touching routes
  private auth(): boolean {
    return true
  }

  // ── Static file serving ───────────────────────────────────────────────────

  private static readonly MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf'
  }

  private async serveStatic(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const companionDir = join(app.getAppPath(), 'out', 'companion')
    const indexPath = join(companionDir, 'index.html')

    // Fall back to built-in setup page when companion hasn't been built yet
    if (!existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(this.buildSetupPage())
      return
    }

    const rawPath = (req.url ?? '/').split('?')[0]
    const relative = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '')
    const targetPath = resolvePath(join(companionDir, relative))

    // Security: reject path traversal attempts
    if (!targetPath.startsWith(companionDir)) {
      res.writeHead(403)
      res.end()
      return
    }

    if (existsSync(targetPath)) {
      const mime =
        CompanionServer.MIME[extname(targetPath).toLowerCase()] ?? 'application/octet-stream'
      try {
        res.writeHead(200, { 'Content-Type': mime })
        res.end(readFileSync(targetPath))
      } catch {
        res.writeHead(500)
        res.end()
      }
      return
    }

    // SPA fallback — return index.html for client-side routes
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(readFileSync(indexPath))
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      let body = ''
      req.on('data', (chunk: Buffer) => (body += chunk.toString()))
      req.on('end', () => resolve(body))
    })
  }

  private sendJson(res: http.ServerResponse, data: unknown): void {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }

  private badRequest(res: http.ServerResponse, error: string): void {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error }))
  }

  private notFound(res: http.ServerResponse): void {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  }

  private buildSetupPage(): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Smart Mirror — WiFi Setup</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .card { background: #1e293b; border-radius: 16px; padding: 1.75rem; width: min(480px, 100%); box-shadow: 0 20px 40px rgba(0,0,0,.4); }
    h1 { font-size: 1.4rem; margin-bottom: .25rem; }
    .sub { color: #94a3b8; font-size: .875rem; margin-bottom: 1.5rem; }
    label { display: block; font-size: .8rem; color: #94a3b8; margin-bottom: .35rem; text-transform: uppercase; letter-spacing: .04em; }
    select, input[type=password] { width: 100%; padding: .625rem .75rem; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; font-size: .95rem; margin-bottom: 1.25rem; outline: none; }
    select:focus, input[type=password]:focus { border-color: #38bdf8; }
    select option { background: #1e293b; }
    .refresh { background: none; border: none; color: #38bdf8; font-size: .8rem; cursor: pointer; float: right; margin-top: -1.6rem; margin-bottom: .5rem; }
    button.primary { width: 100%; padding: .75rem; background: #38bdf8; color: #0b1220; font-weight: 700; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; }
    button.primary:disabled { opacity: .45; cursor: not-allowed; }
    .status { margin-top: 1rem; font-size: .875rem; text-align: center; min-height: 1.2rem; }
    .ok { color: #4ade80; } .err { color: #f87171; }
  </style>
</head>
<body>
  <div class="card">
    <h1>WiFi Setup</h1>
    <p class="sub">Connect your Smart Mirror to your home network.</p>
    <label for="ssid">Network <button class="refresh" onclick="loadNetworks()">↺ Rescan</button></label>
    <select id="ssid"><option value="">Scanning…</option></select>
    <label for="pw">Password</label>
    <input type="password" id="pw" placeholder="Enter WiFi password" autocomplete="current-password" />
    <button class="primary" id="btn" onclick="connect()">Connect</button>
    <p class="status" id="status"></p>
  </div>
  <script>
    async function loadNetworks() {
      const sel = document.getElementById('ssid');
      sel.innerHTML = '<option value="">Scanning…</option>';
      try {
        const nets = await (await fetch('/api/wifi/scan')).json();
        sel.innerHTML = nets.length
          ? nets.map(n => '<option value="' + n.ssid + '">' + n.ssid + ' (' + n.signal + '%)</option>').join('')
          : '<option value="">No networks found</option>';
      } catch { sel.innerHTML = '<option value="">Scan failed</option>'; }
    }
    async function connect() {
      const ssid = document.getElementById('ssid').value;
      const password = document.getElementById('pw').value;
      const btn = document.getElementById('btn');
      const status = document.getElementById('status');
      if (!ssid) return;
      btn.disabled = true;
      status.className = 'status'; status.textContent = 'Connecting…';
      try {
        const res = await fetch('/api/wifi/connect', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ssid, password })
        });
        const data = await res.json();
        if (data.success) {
          status.className = 'status ok';
          status.textContent = '✓ Connected! Mirror is now online.';
        } else {
          status.className = 'status err';
          status.textContent = data.error || 'Connection failed. Check password.';
          btn.disabled = false;
        }
      } catch {
        status.className = 'status err';
        status.textContent = 'Network error. Try again.';
        btn.disabled = false;
      }
    }
    loadNetworks();
  </script>
</body>
</html>`
  }
}
