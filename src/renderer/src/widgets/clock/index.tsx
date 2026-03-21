import { useState, useEffect } from 'react'
import type { WidgetProps } from '../../lib/widget-types'

export default function ClockWidget({ config }: WidgetProps): React.JSX.Element {
  const timezone = (config.timezone as string) || Intl.DateTimeFormat().resolvedOptions().timeZone
  const use24h = (config.use24h as boolean) ?? true

  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const timeStr = now.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour12: !use24h,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  const dateStr = now.toLocaleDateString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1">
      <span className="text-white text-5xl font-light tabular-nums tracking-tight">{timeStr}</span>
      <span className="text-white/50 text-sm">{dateStr}</span>
    </div>
  )
}
