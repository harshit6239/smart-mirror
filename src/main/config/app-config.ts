import Store from 'electron-store'

// ─── Domain Types ────────────────────────────────────────────────────────────

export type Page = {
  id: string
  name: string
  widgetIds: string[]
}

export type WidgetInstance = {
  id: string
  widgetId: string
  version: string
  config: Record<string, unknown>
  layout: { col: number; row: number; colSpan: number; rowSpan: number }
}

export type InstalledWidget = {
  id: string
  name: string
  version: string
  source: string // bundle download URL
}

export type AppConfig = {
  wifi: { configured: boolean }
  pages: Page[]
  widgetInstances: Record<string, WidgetInstance>
  installedWidgets: InstalledWidget[]
  settings: {
    theme: string
    wakeTimeoutMs: number
    brightnessDay: number
    brightnessNight: number
    brightnessSchedule: { dayStart: string; nightStart: string }
    registryUrl: string // URL to the registry.json manifest (GitHub raw URL)
  }
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const defaults: AppConfig = {
  wifi: { configured: false },
  pages: [],
  widgetInstances: {},
  installedWidgets: [],
  settings: {
    theme: 'dark',
    wakeTimeoutMs: 300_000,
    brightnessDay: 100,
    brightnessNight: 30,
    brightnessSchedule: { dayStart: '07:00', nightStart: '22:00' },
    registryUrl: ''
  }
}

// ─── Store instance ───────────────────────────────────────────────────────────

export const store = new Store<AppConfig>({ defaults })

// ─── Typed accessors ─────────────────────────────────────────────────────────

/** Returns the full config snapshot */
export function getConfig(): AppConfig {
  return store.store
}

/**
 * Set a top-level key or a nested dot-notation path.
 * Examples:
 *   setConfig('wifi', { configured: true })
 *   setConfig('wifi.configured', true)
 */
export function setConfig(key: string, value: unknown): void {
  store.set(key, value)
}

/**
 * Subscribe to changes on a top-level key.
 * Returns an unsubscribe function.
 */
export function onConfigChange<K extends keyof AppConfig>(
  key: K,
  cb: (newValue: AppConfig[K], oldValue: AppConfig[K] | undefined) => void
): () => void {
  return store.onDidChange(key, cb as Parameters<typeof store.onDidChange<K>>[1])
}
