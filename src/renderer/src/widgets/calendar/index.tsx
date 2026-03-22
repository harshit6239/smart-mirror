import { useState, useEffect, useCallback } from 'react'
import ICAL from 'ical.js'
import type { WidgetProps } from '../../lib/widget-types'

interface CalEvent {
  title: string
  start: Date
  isAllDay: boolean
}

function parseIcal(icalText: string): CalEvent[] {
  const parsed = ICAL.parse(icalText)
  const comp = new ICAL.Component(parsed)
  const vevents = comp.getAllSubcomponents('vevent')

  const now = new Date()
  const windowEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000) // 60 days ahead

  const events: CalEvent[] = []

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent)
    const title = event.summary ?? '(No title)'

    if (event.isRecurring()) {
      const iter = event.iterator()
      let next: ICAL.Time | null
      let guard = 0
      while ((next = iter.next()) && guard < 200) {
        guard++
        const startJs = next.toJSDate()
        if (startJs > windowEnd) break
        if (startJs >= now) {
          events.push({ title, start: startJs, isAllDay: next.isDate })
        }
      }
    } else {
      const startJs = event.startDate.toJSDate()
      if (startJs >= now) {
        events.push({ title, start: startJs, isAllDay: event.startDate.isDate })
      }
    }
  }

  events.sort((a, b) => a.start.getTime() - b.start.getTime())
  return events
}

function formatDateLabel(date: Date): string {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

// Build a 6-row × 7-col grid for the given year/month
function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  // Sunday = 0 ... Saturday = 6
  const startOffset = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

function MonthGrid({
  year,
  month,
  eventDays
}: {
  year: number
  month: number
  eventDays: Set<string>
}): React.JSX.Element {
  const today = new Date()
  const cells = buildMonthGrid(year, month)

  function key(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  }

  return (
    <div className="w-full">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[10px] text-white/30 font-medium">
            {d}
          </div>
        ))}
      </div>
      {/* Date cells */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((date, i) => {
          if (!date) return <div key={i} />
          const isToday = date.toDateString() === today.toDateString()
          const hasEvent = eventDays.has(key(date))
          const isPast = date < today && !isToday
          return (
            <div key={i} className="flex flex-col items-center">
              <div
                className={[
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums',
                  isToday
                    ? 'bg-white text-black font-semibold'
                    : isPast
                      ? 'text-white/25'
                      : 'text-white/80'
                ].join(' ')}
              >
                {date.getDate()}
              </div>
              {/* Event dot */}
              <div
                className={[
                  'h-1 w-1 rounded-full',
                  hasEvent ? 'bg-white/60' : 'bg-transparent'
                ].join(' ')}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CalendarWidget({ config }: WidgetProps): React.JSX.Element {
  const icalUrl = (config.icalUrl as string) || ''

  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tick state forces a re-render at each midnight so year/month/today stay current
  const [, setMidnightTick] = useState(0)

  useEffect(() => {
    let id: ReturnType<typeof setTimeout>
    function scheduleMidnight(): void {
      const now = new Date()
      const msToMidnight =
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()
      id = setTimeout(() => {
        setMidnightTick((t) => t + 1)
        scheduleMidnight()
      }, msToMidnight)
    }
    scheduleMidnight()
    return () => clearTimeout(id)
  }, [])

  // Computed fresh every render — safe because midnight tick ensures renders happen
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const fetchAndParse = useCallback(async () => {
    if (!icalUrl) return
    setLoading(true)
    setError(null)
    try {
      const raw = await window.api.fetchIcal(icalUrl)
      setEvents(parseIcal(raw))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [icalUrl])

  useEffect(() => {
    fetchAndParse()
    const id = setInterval(fetchAndParse, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchAndParse])

  // Build set of day keys that have events (for dots)
  const eventDays = new Set<string>(
    events
      .filter((e) => e.start.getFullYear() === year && e.start.getMonth() === month)
      .map((e) => `${e.start.getFullYear()}-${e.start.getMonth()}-${e.start.getDate()}`)
  )

  const upcoming = events.slice(0, 4)

  if (!icalUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="text-white/40 text-sm">⚙ Configure iCal URL in companion</span>
      </div>
    )
  }

  if (loading && events.length === 0) {
    return (
      <div className="flex h-full w-full animate-pulse flex-col gap-2.5 p-4">
        <div className="h-40 w-full rounded bg-white/10" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 w-12 rounded bg-white/10" />
            <div className="h-3 w-32 rounded bg-white/10" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="text-white/40 text-sm">Calendar unavailable</span>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col gap-2 p-3">
      {/* Month header */}
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium text-white">{MONTH_NAMES[month]}</span>
        <span className="text-xs text-white/40">{year}</span>
      </div>

      {/* Month grid */}
      <MonthGrid year={year} month={month} eventDays={eventDays} />

      {/* Divider */}
      <div className="h-px w-full bg-white/10" />

      {/* Upcoming events */}
      {upcoming.length === 0 ? (
        <span className="text-xs text-white/30">No upcoming events</span>
      ) : (
        <div className="flex flex-col gap-1">
          {upcoming.map((ev, i) => (
            <div key={i} className="flex items-baseline gap-2">
              <span className="w-16 shrink-0 text-xs text-white/40">
                {formatDateLabel(ev.start)}
              </span>
              <span className="flex-1 truncate text-xs text-white">{ev.title}</span>
              <span className="shrink-0 tabular-nums text-[10px] text-white/50">
                {ev.isAllDay ? 'All day' : formatTime(ev.start)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
