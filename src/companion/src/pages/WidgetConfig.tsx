import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { WIDGET_CATALOG } from '../lib/widgets-catalog'
import WidgetConfigForm from '../components/WidgetConfigForm'

type LocalInstance = {
  id: string
  widgetId: string
  version: string
  config: Record<string, unknown>
  layout: { col: number; row: number; colSpan: number; rowSpan: number }
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function WidgetConfig(): React.JSX.Element {
  const { instanceId } = useParams<{ instanceId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  // Spotify OAuth result: 'connected' | 'error' | null
  const spotifyOAuthResult = searchParams.get('spotify')
  // LayoutEditor passes the full instance as location state so we have a fallback
  // if the GET fails (e.g. instance not yet persisted when navigating from a fresh drop).
  const stateInstance = (location.state as { instance?: LocalInstance } | null)?.instance

  const [instance, setInstance] = useState<LocalInstance | null>(null)
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!instanceId) return
    api
      .get<LocalInstance>(`/api/widget-config/${encodeURIComponent(instanceId)}`)
      .then((inst) => {
        setInstance(inst)
        setConfig(inst.config)
      })
      .catch(() => {
        // Fall back to the instance passed via location state (new widget, not yet persisted)
        if (stateInstance) {
          setInstance(stateInstance)
          setConfig(stateInstance.config)
        } else {
          setLoadError(true)
        }
      })
  }, [instanceId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (key: string, value: unknown): void => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const save = async (): Promise<void> => {
    if (!instanceId) return
    setSaveState('saving')
    try {
      // Include the full instance so the server can upsert if it was never persisted.
      await api.put(`/api/widget-config/${encodeURIComponent(instanceId)}`, {
        config,
        _instance: instance
      })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 3000)
    }
  }

  if (loadError) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-red-400 text-sm">Failed to load widget config.</p>
        <button
          onClick={() => navigate('/layout')}
          className="text-sky-400 text-sm hover:underline"
        >
          ← Back to Layout
        </button>
      </div>
    )
  }

  if (!instance) {
    return <p className="text-slate-400 py-8 text-center">Loading…</p>
  }

  const catalogEntry = WIDGET_CATALOG.find((w) => w.widgetId === instance.widgetId)
  const schema = catalogEntry?.configSchema ?? {}
  const widgetName = catalogEntry?.name ?? instance.widgetId
  const hasFields = Object.keys(schema).length > 0

  const isSpotify = instance.widgetId === 'spotify'
  // clientId must be saved (i.e. present in the loaded instance, not just local state)
  const savedClientId = (instance.config.clientId as string | undefined) || ''
  const hasAccessToken = Boolean(
    (config.accessToken as string | undefined) ||
      (instance.config.accessToken as string | undefined)
  )

  const saveLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? '✓ Saved'
        : saveState === 'error'
          ? 'Error — retry'
          : 'Save Config'

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/layout')}
          className="text-slate-400 hover:text-white text-sm transition-colors px-1"
          aria-label="Back to layout"
        >
          ←
        </button>
        <h1 className="text-xl font-bold">{widgetName}</h1>
        <span className="text-slate-500 text-sm">Config</span>
      </div>

      <WidgetConfigForm schema={schema} values={config} onChange={handleChange} />

      {/* ── Spotify OAuth section ── */}
      {isSpotify && (
        <div className="rounded-xl border border-white/10 bg-slate-800/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Spotify Connection</span>
            {hasAccessToken ? (
              <span className="text-green-400 text-xs font-medium">● Connected</span>
            ) : (
              <span className="text-slate-500 text-xs">● Not connected</span>
            )}
          </div>

          {spotifyOAuthResult === 'connected' && (
            <p className="text-green-400 text-xs bg-green-900/20 rounded-lg px-3 py-2">
              ✓ Successfully connected to Spotify!
            </p>
          )}
          {spotifyOAuthResult === 'error' && (
            <p className="text-red-400 text-xs bg-red-900/20 rounded-lg px-3 py-2">
              Connection failed. Check your Client ID and Secret are correct, then try again.
            </p>
          )}

          <div className="text-xs text-slate-400 space-y-1">
            <p className="font-medium text-slate-300">Setup instructions:</p>
            <ol className="list-decimal list-inside space-y-1 text-slate-400">
              <li>
                Go to <span className="text-sky-400">developer.spotify.com/dashboard</span>
              </li>
              <li>Create an app → copy Client ID and Client Secret above</li>
              <li>
                In your Spotify app settings, add this exact Redirect URI:
                <span className="ml-1 font-mono text-amber-400 break-all">
                  http://127.0.0.1:8080/spotify/callback
                </span>
              </li>
              <li>Save the config above, then click Connect Spotify</li>
              <li className="text-slate-500">
                ⚠ The Connect step must be done from a browser on the mirror device
                <span className="font-mono">http://127.0.0.1:8080</span> locally) — phone browsers
                cannot receive the redirect.
              </li>
            </ol>
          </div>

          {savedClientId ? (
            <a
              href={`/spotify/auth?instanceId=${encodeURIComponent(instanceId ?? '')}`}
              className="block w-full py-2.5 text-center font-semibold text-sm rounded-xl transition-colors"
              style={{ backgroundColor: '#1DB954', color: '#000' }}
            >
              {hasAccessToken ? 'Re-connect Spotify' : 'Connect Spotify'}
            </a>
          ) : (
            <p className="text-slate-500 text-xs text-center border border-white/5 rounded-lg py-2">
              Save your Client ID and Secret first, then the Connect button will appear.
            </p>
          )}
        </div>
      )}

      {hasFields && (
        <button
          onClick={save}
          disabled={saveState === 'saving'}
          className={`w-full py-3 font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 ${
            saveState === 'saved'
              ? 'bg-green-600 text-white'
              : saveState === 'error'
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-sky-500 text-white hover:bg-sky-400'
          }`}
        >
          {saveLabel}
        </button>
      )}
    </div>
  )
}
