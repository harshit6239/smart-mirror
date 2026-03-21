import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface Network {
  ssid: string
  signal: number
}

export default function WifiSetupPage(): React.JSX.Element {
  const [networks, setNetworks] = useState<Network[]>([])
  const [scanning, setScanning] = useState(false)
  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [connecting, setConnecting] = useState(false)

  const scan = async (): Promise<void> => {
    setScanning(true)
    try {
      const nets = await api.get<Network[]>('/api/wifi/scan')
      setNetworks(nets)
      if (nets.length > 0 && !ssid) setSsid(nets[0].ssid)
    } catch {
      // leave list empty
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    void scan()
  }, [])

  const connect = async (): Promise<void> => {
    if (!ssid) return
    setConnecting(true)
    setStatus(null)
    try {
      await api.post('/api/wifi/connect', { ssid, password })
      setStatus({ ok: true, msg: '✓ Connected! Mirror is now online.' })
    } catch (e) {
      setStatus({ ok: false, msg: e instanceof Error ? e.message : 'Connection failed' })
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">WiFi Setup</h1>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-slate-400">Network</label>
          <button
            onClick={scan}
            disabled={scanning}
            className="text-xs text-sky-400 disabled:opacity-50"
          >
            {scanning ? 'Scanning…' : '↺ Rescan'}
          </button>
        </div>
        {networks.length > 0 ? (
          <select
            value={ssid}
            onChange={(e) => setSsid(e.target.value)}
            className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm"
          >
            {networks.map((n) => (
              <option key={n.ssid} value={n.ssid}>
                {n.ssid} ({n.signal}%)
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-slate-500">{scanning ? 'Scanning…' : 'No networks found'}</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-slate-400">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter WiFi password"
          autoComplete="current-password"
          className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <button
        onClick={connect}
        disabled={connecting || !ssid}
        className="w-full py-3 bg-sky-500 text-white font-semibold rounded-xl disabled:opacity-50 active:scale-95 transition-transform"
      >
        {connecting ? 'Connecting…' : 'Connect'}
      </button>

      {status && (
        <p className={`text-sm text-center ${status.ok ? 'text-green-400' : 'text-red-400'}`}>
          {status.msg}
        </p>
      )}
    </div>
  )
}
