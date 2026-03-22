import { useState, useEffect } from 'react'
import type { WidgetProps } from '../../lib/widget-types'

const FONT_SIZE_CLASS: Record<string, string> = {
  sm: 'text-2xl',
  md: 'text-3xl',
  lg: 'text-4xl',
  xl: 'text-5xl',
  '2xl': 'text-6xl'
}

export default function ClockWidget({ config }: WidgetProps): React.JSX.Element {
  const timezone = (config.timezone as string) || Intl.DateTimeFormat().resolvedOptions().timeZone
  const use24h = (config.use24h as boolean) ?? true
  const showSeconds = (config.showSeconds as boolean) ?? true
  const showDate = (config.showDate as boolean) ?? true
  const showDayOfWeek = (config.showDayOfWeek as boolean) ?? true
  const dateFormat = (config.dateFormat as string) || 'long'
  const fontSize = (config.fontSize as string) || 'xl'

  const [now, setNow] = useState(new Date())

  useEffect(() => {
    // If seconds are hidden, polling once per minute is enough
    const interval = showSeconds ? 1000 : 60_000
    const id = setInterval(() => setNow(new Date()), interval)
    return () => clearInterval(id)
  }, [showSeconds])

  const timeStr = now.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour12: !use24h,
    hour: '2-digit',
    minute: '2-digit',
    ...(showSeconds ? { second: '2-digit' } : {})
  })

  const dateFormatMap: Record<string, Intl.DateTimeFormatOptions['month']> = {
    long: 'long',
    short: 'short',
    numeric: 'numeric'
  }

  const dateStr = now.toLocaleDateString('en-US', {
    timeZone: timezone,
    ...(showDayOfWeek ? { weekday: dateFormat === 'numeric' ? 'short' : 'long' } : {}),
    year: 'numeric',
    month: dateFormatMap[dateFormat] ?? 'long',
    day: 'numeric'
  })

  const timeClass = FONT_SIZE_CLASS[fontSize] ?? FONT_SIZE_CLASS['xl']

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1">
      <span className={`text-white ${timeClass} font-light tabular-nums tracking-tight`}>
        {timeStr}
      </span>
      {showDate && <span className="text-white/50 text-sm">{dateStr}</span>}
    </div>
  )
}
