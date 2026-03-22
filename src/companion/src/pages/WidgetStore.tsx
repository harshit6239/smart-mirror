import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

// ─── Types (mirror WidgetManifest from main process) ─────────────────────────

type WidgetManifest = {
  id: string
  name: string
  description: string
  version: string
  bundleUrl: string
  author?: string
  tags?: string[]
}

type InstalledWidget = {
  id: string
  name: string
  version: string
  source: string
}

type RegistryResponse = {
  available: WidgetManifest[]
  installed: InstalledWidget[]
}

type InstallState = 'idle' | 'installing' | 'done' | 'error'

// ─── Component ────────────────────────────────────────────────────────────────

export default function WidgetStore(): React.JSX.Element {
  const [available, setAvailable] = useState<WidgetManifest[]>([])
  const [installed, setInstalled] = useState<InstalledWidget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [installStates, setInstallStates] = useState<Record<string, InstallState>>({})
  const [installErrors, setInstallErrors] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<RegistryResponse>('/api/widgets/registry')
      setAvailable(data.available)
      setInstalled(data.installed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load registry')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const installedMap = new Map(installed.map((w) => [w.id, w]))

  const install = async (widget: WidgetManifest): Promise<void> => {
    setInstallStates((s) => ({ ...s, [widget.id]: 'installing' }))
    setInstallErrors((e) => ({ ...e, [widget.id]: '' }))
    try {
      await api.post('/api/widgets/install', {
        id: widget.id,
        name: widget.name,
        version: widget.version,
        bundleUrl: widget.bundleUrl
      })
      setInstallStates((s) => ({ ...s, [widget.id]: 'done' }))
      // Refresh list so the installed badge + uninstall button appear
      await refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Install failed'
      setInstallStates((s) => ({ ...s, [widget.id]: 'error' }))
      setInstallErrors((prev) => ({ ...prev, [widget.id]: msg }))
    }
  }

  const uninstall = async (widgetId: string): Promise<void> => {
    setInstallStates((s) => ({ ...s, [widgetId]: 'installing' }))
    try {
      await api.delete(`/api/widgets/${encodeURIComponent(widgetId)}`)
      setInstallStates((s) => ({ ...s, [widgetId]: 'idle' }))
      await refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Uninstall failed'
      setInstallStates((s) => ({ ...s, [widgetId]: 'error' }))
      setInstallErrors((prev) => ({ ...prev, [widgetId]: msg }))
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Widget Store</h1>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="text-xs text-sky-400 disabled:opacity-50"
        >
          {loading ? 'Loading…' : '↺ Refresh'}
        </button>
      </div>

      {/* No registry URL configured */}
      {!loading && !error && available.length === 0 && installed.length === 0 && (
        <div className="rounded-xl border border-slate-700 p-4 space-y-2 text-sm text-slate-400">
          <p className="font-medium text-white">No registry configured</p>
          <p>
            Go to{' '}
            <a href="/settings" className="text-sky-400 underline">
              Settings
            </a>{' '}
            and enter a Widget Registry URL pointing to a{' '}
            <code className="text-xs bg-slate-800 px-1 rounded">registry.json</code> file.
          </p>
          <p className="text-xs text-slate-500">
            Format:{' '}
            <code className="text-xs bg-slate-800 px-1 rounded">
              {'{ "widgets": [{ "id", "name", "description", "version", "bundleUrl" }] }'}
            </code>
          </p>
        </div>
      )}

      {/* Error fetching registry */}
      {error && (
        <p className="text-sm text-red-400 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3">
          {error}
        </p>
      )}

      {/* Installed dynamic widgets (not in the online registry — orphaned) */}
      {installed.filter((w) => !available.find((a) => a.id === w.id)).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
            Installed
          </h2>
          {installed
            .filter((w) => !available.find((a) => a.id === w.id))
            .map((w) => (
              <WidgetCard
                key={w.id}
                id={w.id}
                name={w.name}
                description={`v${w.version} · installed`}
                version={w.version}
                bundleUrl={w.source}
                isInstalled
                installState={installStates[w.id] ?? 'idle'}
                installError={installErrors[w.id]}
                onInstall={() => {}}
                onUninstall={() => void uninstall(w.id)}
              />
            ))}
        </section>
      )}

      {/* Online registry widgets */}
      {available.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
            Available
          </h2>
          {available.map((w) => {
            const inst = installedMap.get(w.id)
            const isInstalled = !!inst
            const hasUpdate = isInstalled && inst.version !== w.version
            return (
              <WidgetCard
                key={w.id}
                id={w.id}
                name={w.name}
                description={w.description}
                version={w.version}
                bundleUrl={w.bundleUrl}
                author={w.author}
                tags={w.tags}
                isInstalled={isInstalled}
                hasUpdate={hasUpdate}
                installState={installStates[w.id] ?? 'idle'}
                installError={installErrors[w.id]}
                onInstall={() => void install(w)}
                onUninstall={() => void uninstall(w.id)}
              />
            )
          })}
        </section>
      )}
    </div>
  )
}

// ─── Widget card sub-component ────────────────────────────────────────────────

type CardProps = {
  id: string
  name: string
  description: string
  version: string
  bundleUrl: string
  author?: string
  tags?: string[]
  isInstalled: boolean
  hasUpdate?: boolean
  installState: InstallState
  installError?: string
  onInstall: () => void
  onUninstall: () => void
}

function WidgetCard({
  name,
  description,
  version,
  author,
  tags,
  isInstalled,
  hasUpdate,
  installState,
  installError,
  onInstall,
  onUninstall
}: CardProps): React.JSX.Element {
  const busy = installState === 'installing'

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 space-y-2">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{name}</span>
            <span className="text-xs text-slate-500">v{version}</span>
            {isInstalled && !hasUpdate && (
              <span className="text-xs bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded font-medium">
                Installed
              </span>
            )}
            {hasUpdate && (
              <span className="text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-medium">
                Update available
              </span>
            )}
          </div>
          {author && <p className="text-xs text-slate-500 mt-0.5">by {author}</p>}
        </div>

        {/* Action button */}
        <div className="shrink-0">
          {isInstalled && !hasUpdate ? (
            <button
              onClick={onUninstall}
              disabled={busy}
              className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 text-red-400 hover:bg-red-400/10 disabled:opacity-40 transition-colors"
            >
              {busy ? '…' : 'Uninstall'}
            </button>
          ) : (
            <button
              onClick={onInstall}
              disabled={busy}
              className="px-3 py-1.5 text-xs rounded-lg bg-sky-500 text-white hover:bg-sky-400 disabled:opacity-40 transition-colors active:scale-95"
            >
              {busy ? 'Installing…' : hasUpdate ? 'Update' : 'Install'}
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-400 leading-snug">{description}</p>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <span key={t} className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Error */}
      {installError && (
        <p className="text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded px-2 py-1">
          {installError}
        </p>
      )}
    </div>
  )
}
