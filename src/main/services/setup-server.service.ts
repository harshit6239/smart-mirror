import http from 'http'
import os from 'os'
import { AddressInfo } from 'net'

export class SetupServer {
  private server: http.Server | null = null
  private setupUrl: string | null = null

  async start(): Promise<string> {
    if (this.server && this.setupUrl) {
      return this.setupUrl
    }

    const handler: http.RequestListener = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(this.buildPlaceholderPage())
    }

    this.server = http.createServer(handler)

    await new Promise<void>((resolve, reject) => {
      this.server?.listen(0, '0.0.0.0', () => resolve())
      this.server?.on('error', (err) => reject(err))
    })

    const address = this.server.address() as AddressInfo | null
    const host = this.getLocalAddress()
    const port = address?.port ?? 0
    this.setupUrl = `http://${host}:${port}/setup`

    return this.setupUrl
  }

  async stop(): Promise<void> {
    if (!this.server) return
    await new Promise<void>((resolve) => this.server?.close(() => resolve()))
    this.server = null
    this.setupUrl = null
  }

  private getLocalAddress(): string {
    const interfaces = os.networkInterfaces()
    for (const key of Object.keys(interfaces)) {
      const items = interfaces[key]
      if (!items) continue
      for (const iface of items) {
        if (iface.family === 'IPv4' && !iface.internal && iface.address) {
          return iface.address
        }
      }
    }
    return '127.0.0.1'
  }

  private buildPlaceholderPage(): string {
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Smart Mirror Setup</title>
  <style>
    body { font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
    .card { background: #1e293b; padding: 24px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.35); width: min(520px, 92vw); }
    h1 { margin: 0 0 12px; font-size: 24px; }
    p { line-height: 1.5; color: #cbd5e1; }
    .placeholder { margin-top: 16px; padding: 16px; border: 1px dashed #334155; border-radius: 8px; background: #0b1220; }
    label { display: block; margin-bottom: 8px; color: #94a3b8; }
    input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; }
    button { margin-top: 14px; padding: 10px 14px; border-radius: 8px; border: none; background: #38bdf8; color: #0b1220; font-weight: 600; cursor: pointer; }
    button:hover { background: #0ea5e9; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Smart Mirror Setup</h1>
    <p>This is a placeholder configuration page. Wire up real settings here.</p>
    <div class="placeholder">
      <label>Mirror Name</label>
      <input placeholder="Living Room" />
      <label style="margin-top:12px;">Wi-Fi SSID</label>
      <input placeholder="MyNetwork" />
      <label style="margin-top:12px;">Notes</label>
      <input placeholder="Any notes" />
      <button disabled>Save (placeholder)</button>
    </div>
  </div>
</body>
</html>`
    return html
  }
}
