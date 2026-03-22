import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

interface Status {
  connectedToGesture: boolean
  currentPage: number
  wifiConfigured: boolean
}

interface SystemInfo {
  uptime: number
  platform: string
  arch: string
  nodeVersion: string
  electronVersion: string
  appVersion: string
  hostname: string
  cpuModel: string
  cpuCount: number
  freeMemMb: number
  totalMemMb: number
}

interface WsEvent {
  event: string
  data: unknown
}

export default function HomePage(): React.JSX.Element {
  const [status, setStatus] = useState<Status | null>(null)
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null)
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

  // Fetch system info once on mount
  useEffect(() => {
    api
      .get<SystemInfo>('/api/system/info')
      .then(setSysInfo)
      .catch(() => {})
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
          <div className="grid grid-cols-2 gap-3">
            <InfoCard label="Active Page" value={String(status.currentPage)} />
            <InfoCard label="Last Gesture" value={lastGesture ?? '—'} />
          </div>
        </>
      ) : (
        <p className="text-slate-400">Connecting…</p>
      )}

      {sysInfo && (
        <>
          <h2 className="text-base font-semibold text-slate-300 pt-2">System</h2>
          <div className="bg-slate-800 rounded-xl p-4 space-y-3 text-sm">
            <SysRow label="Hostname" value={sysInfo.hostname} />
            <SysRow label="Uptime" value={formatUptime(sysInfo.uptime)} />
            <SysRow
              label="Memory"
              value={`${sysInfo.freeMemMb} MB free / ${sysInfo.totalMemMb} MB`}
            />
            <MemBar freeMemMb={sysInfo.freeMemMb} totalMemMb={sysInfo.totalMemMb} />
            <SysRow label="CPU" value={`${sysInfo.cpuModel} ×${sysInfo.cpuCount}`} />
            <SysRow label="Platform" value={`${sysInfo.platform} (${sysInfo.arch})`} />
            <SysRow label="App version" value={`v${sysInfo.appVersion}`} />
            <SysRow label="Electron" value={sysInfo.electronVersion} />
            <SysRow label="Node" value={sysInfo.nodeVersion} />
          </div>
        </>
      )}
    </div>
  )
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function InfoCard({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="bg-slate-800 rounded-xl p-4">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-xl font-semibold truncate">{value}</p>
    </div>
  )
}

function SysRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="text-right text-slate-200 truncate">{value}</span>
    </div>
  )
}

function MemBar({
  freeMemMb,
  totalMemMb
}: {
  freeMemMb: number
  totalMemMb: number
}): React.JSX.Element {
  const usedPct = Math.round(((totalMemMb - freeMemMb) / totalMemMb) * 100)
  const color = usedPct > 85 ? 'bg-red-500' : usedPct > 65 ? 'bg-yellow-500' : 'bg-sky-500'
  return (
    <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
      <div className={`${color} h-full rounded-full`} style={{ width: `${usedPct}%` }} />
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
