import { useState, useEffect } from 'react'

type SystemStats = {
  cpuPercent: number | null
  memPercent: number | null
  tempC: number | null
}

function StatBar({ label, value }: { label: string; value: number | null }): React.JSX.Element {
  const display = value === null ? 'N/A' : `${value}%`
  const pct = value ?? 0

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-between text-xs">
        <span className="text-white/60">{label}</span>
        <span className="text-white/80 tabular-nums">{display}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-white/50 transition-all duration-500"
          style={{ width: value === null ? '0%' : `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function SystemStatsWidget(): React.JSX.Element {
  const [stats, setStats] = useState<SystemStats>({
    cpuPercent: null,
    memPercent: null,
    tempC: null
  })

  useEffect(() => {
    let active = true

    const poll = async (): Promise<void> => {
      try {
        const result = await window.system.getStats()
        if (active) setStats(result)
      } catch {
        // IPC failed — leave previous values
      }
    }

    void poll()
    const id = setInterval(() => void poll(), 3000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  const tempDisplay = stats.tempC === null ? 'N/A' : `${stats.tempC}°C`

  return (
    <div className="flex h-full w-full flex-col justify-center gap-3 px-3 py-2">
      <span className="text-white/40 text-xs uppercase tracking-widest">System</span>
      <StatBar label="CPU" value={stats.cpuPercent} />
      <StatBar label="RAM" value={stats.memPercent} />
      <div className="flex justify-between text-xs">
        <span className="text-white/60">Temp</span>
        <span className="text-white/80 tabular-nums">{tempDisplay}</span>
      </div>
    </div>
  )
}
