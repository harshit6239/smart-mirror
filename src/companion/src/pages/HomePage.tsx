import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

interface Status {
  connectedToGesture: boolean
  currentPage: number
  wifiConfigured: boolean
}

interface WsEvent {
  event: string
  data: unknown
}

export default function HomePage(): React.JSX.Element {
  const [status, setStatus] = useState<Status | null>(null)
  const [lastGesture, setLastGesture] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Poll /api/status every 2 s
  useEffect(() => {
    const poll = (): void => {
      api
        .get<Status>('/api/status')
        .then(setStatus)
        .catch(() => {})
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [])

  // Connect to companion WebSocket for real-time events
  useEffect(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws`)
    wsRef.current = ws

    ws.onmessage = (e): void => {
      try {
        const msg = JSON.parse(e.data as string) as WsEvent
        if (msg.event === 'gesture') {
          const g = (msg.data as { gesture: string }).gesture
          setLastGesture(g)
        }
        if (msg.event === 'page-change') {
          const idx = (msg.data as { pageIndex: number }).pageIndex
          setStatus((s) => (s ? { ...s, currentPage: idx } : s))
        }
      } catch {
        // ignore malformed messages
      }
    }

    return () => ws.close()
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Mirror Status</h1>
      {status ? (
        <>
          <StatusRow label="Gesture Service" active={status.connectedToGesture} />
          <StatusRow label="WiFi Configured" active={status.wifiConfigured} />
          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-sm text-slate-400 mb-1">Active Page</p>
            <p className="text-2xl font-semibold">{status.currentPage}</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-sm text-slate-400 mb-1">Last Gesture</p>
            <p className="text-2xl font-semibold">{lastGesture ?? '—'}</p>
          </div>
        </>
      ) : (
        <p className="text-slate-400">Connecting…</p>
      )}
    </div>
  )
}

function StatusRow({ label, active }: { label: string; active: boolean }): React.JSX.Element {
  return (
    <div className="bg-slate-800 rounded-xl p-4 flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <span
        className={`text-xs font-semibold px-2 py-1 rounded-full ${
          active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}
      >
        {active ? 'Online' : 'Offline'}
      </span>
    </div>
  )
}
