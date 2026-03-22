import https from 'https'
import http from 'http'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { getConfig, setConfig } from '../config/app-config'

// ─── Types ────────────────────────────────────────────────────────────────────

export type WidgetManifest = {
  id: string
  name: string
  description: string
  version: string
  bundleUrl: string
  author?: string
  tags?: string[]
}

type RegistryFile = { widgets: WidgetManifest[] }
type DiskCache = { widgets: WidgetManifest[]; fetchedAt: number }

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const MAX_BUNDLE_SIZE = 2 * 1024 * 1024 // 2 MB

// Same SSRF blocklist as fetchUrlText in main/index.ts
const SSRF_BLOCKED =
  /^(localhost|127(\.[0-9]+){3}|0\.0\.0\.0|10(\.[0-9]+){3}|172\.(1[6-9]|2[0-9]|3[01])(\.[0-9]+){2}|192\.168(\.[0-9]+){2}|::1|\[::1\])$/i

// ─── Service ──────────────────────────────────────────────────────────────────

export class WidgetRegistryService {
  private cacheFile: string
  private memCache: DiskCache | null = null

  constructor() {
    this.cacheFile = join(app.getPath('userData'), 'registry-cache.json')
    this.loadCacheFromDisk()
  }

  // ── Cache helpers ────────────────────────────────────────────────────────

  private loadCacheFromDisk(): void {
    try {
      if (existsSync(this.cacheFile)) {
        const raw = readFileSync(this.cacheFile, 'utf-8')
        const parsed = JSON.parse(raw) as DiskCache
        if (parsed && Array.isArray(parsed.widgets)) this.memCache = parsed
      }
    } catch {
      /* ignore corrupt cache */
    }
  }

  private saveCacheToDisk(): void {
    try {
      if (this.memCache) writeFileSync(this.cacheFile, JSON.stringify(this.memCache), 'utf-8')
    } catch {
      /* non-fatal */
    }
  }

  // ── SSRF-safe fetch helper ───────────────────────────────────────────────

  private fetch(url: string, redirectsLeft = 5, maxBytes = MAX_BUNDLE_SIZE): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      let parsed: URL
      try {
        parsed = new URL(url)
      } catch {
        reject(new Error('Invalid URL'))
        return
      }
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        reject(new Error('Only https/http URLs are allowed'))
        return
      }
      if (SSRF_BLOCKED.test(parsed.hostname)) {
        reject(new Error('URL target is not allowed'))
        return
      }
      const mod = parsed.protocol === 'https:' ? https : http
      const req = mod.get(url, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          if (redirectsLeft <= 0) {
            reject(new Error('Too many redirects'))
            return
          }
          let next: string
          try {
            next = new URL(res.headers.location, url).href
          } catch {
            next = res.headers.location
          }
          this.fetch(next, redirectsLeft - 1, maxBytes).then(resolve, reject)
          return
        }
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > maxBytes) {
            req.destroy()
            reject(new Error('Response too large'))
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      })
      req.on('error', reject)
      req.setTimeout(15000, () => {
        req.destroy()
        reject(new Error('Timeout'))
      })
    })
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Fetch the online registry manifest.
   * Returns cached result if fresh (< 1 h old), fetches otherwise.
   * Falls back to stale cache or [] if the network is unreachable.
   */
  async listWidgets(): Promise<WidgetManifest[]> {
    const registryUrl = getConfig().settings.registryUrl
    if (!registryUrl) return this.memCache?.widgets ?? []

    const now = Date.now()
    if (this.memCache && now - this.memCache.fetchedAt < CACHE_TTL_MS) {
      return this.memCache.widgets
    }

    try {
      const buf = await this.fetch(registryUrl, 5, 512 * 1024) // registry.json max 512 KB
      const parsed = JSON.parse(buf.toString('utf-8')) as RegistryFile
      if (!Array.isArray(parsed.widgets)) throw new Error('Invalid registry format')
      this.memCache = { widgets: parsed.widgets, fetchedAt: now }
      this.saveCacheToDisk()
      return this.memCache.widgets
    } catch {
      // Network unavailable — return stale cache or empty
      return this.memCache?.widgets ?? []
    }
  }

  /** Force-refresh the registry cache on next listWidgets() call. */
  invalidateCache(): void {
    if (this.memCache) this.memCache.fetchedAt = 0
  }

  /**
   * Download a widget bundle from `bundleUrl` and save it under
   * `<userData>/widgets/<id>/<version>/bundle.esm.js`.
   * Updates `installedWidgets` in the app config.
   */
  async installWidget(id: string, name: string, version: string, bundleUrl: string): Promise<void> {
    // Sanitise id so it can never escape the widgets directory
    const safeId = id.replace(/[^a-z0-9-_]/gi, '')
    if (!safeId || safeId !== id) throw new Error('Invalid widget ID')

    const buf = await this.fetch(bundleUrl, 5, MAX_BUNDLE_SIZE)

    // Rudimentary content check — block HTML error pages masquerading as JS
    const preview = buf.toString('utf-8', 0, 128)
    if (/^<!doctype|^<html/i.test(preview.trim())) {
      throw new Error('Downloaded file does not appear to be a JavaScript bundle')
    }

    const destDir = join(app.getPath('userData'), 'widgets', safeId, version)
    mkdirSync(destDir, { recursive: true })
    writeFileSync(join(destDir, 'bundle.esm.js'), buf)

    // Upsert in installedWidgets config
    const existing = getConfig().installedWidgets.filter((w) => w.id !== id)
    setConfig('installedWidgets', [...existing, { id, name, version, source: bundleUrl }])
  }

  /**
   * Remove an installed widget from disk and config.
   * Does NOT remove widget instances from pages — the caller handles that.
   */
  uninstallWidget(id: string): void {
    const dirPath = join(app.getPath('userData'), 'widgets', id)
    try {
      if (existsSync(dirPath)) rmSync(dirPath, { recursive: true, force: true })
    } catch {
      /* non-fatal — still purge from config */
    }
    setConfig(
      'installedWidgets',
      getConfig().installedWidgets.filter((w) => w.id !== id)
    )
  }
}
