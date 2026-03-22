import { useState } from 'react'
import { api } from '../lib/api'

const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'error'] as const
type NotifType = (typeof NOTIFICATION_TYPES)[number]

interface RecentItem {
  type: NotifType
  title: string
  body: string
  durationMs: number
  time: string
}

function typeStyle(type: NotifType): string {
  switch (type) {
    case 'success':
      return 'bg-green-500/20 text-green-400'
    case 'warning':
      return 'bg-yellow-500/20 text-yellow-400'
    case 'error':
      return 'bg-red-500/20 text-red-400'
    default:
      return 'bg-sky-500/20 text-sky-400'
  }
}

export default function NotificationsPage(): React.JSX.Element {
  const [type, setType] = useState<NotifType>('info')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [durationMs, setDurationMs] = useState(4000)
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [recent, setRecent] = useState<RecentItem[]>([])

  const send = async (): Promise<void> => {
    if (!title.trim()) return
    setSendState('sending')
    try {
      await api.post('/api/notifications', {
        type,
        title: title.trim(),
        body: body.trim(),
        durationMs
      })
      setRecent((prev) => [
        {
          type,
          title: title.trim(),
          body: body.trim(),
          durationMs,
          time: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 4)
      ])
      setSendState('sent')
      setTimeout(() => setSendState('idle'), 2000)
    } catch {
      setSendState('error')
      setTimeout(() => setSendState('idle'), 3000)
    }
  }

  const sendLabel =
    sendState === 'sending'
      ? 'Sending…'
      : sendState === 'sent'
        ? '✓ Sent!'
        : sendState === 'error'
          ? 'Error — retry'
          : 'Send to Mirror'

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Send Notification</h1>
      <p className="text-sm text-slate-400">
        Push a notification overlay to the mirror. The mirror will display it briefly, then
        auto-dismiss.
      </p>

      <Field label="Type">
        <div className="flex gap-2 flex-wrap">
          {NOTIFICATION_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${
                type === t ? typeStyle(t) + ' ring-1 ring-current' : 'bg-slate-700 text-slate-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Meeting in 5 minutes"
          maxLength={80}
          className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-sky-500"
        />
      </Field>

      <Field label="Message (optional)">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Additional details…"
          maxLength={200}
          className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm placeholder:text-slate-500 resize-none outline-none focus:ring-1 focus:ring-sky-500"
        />
      </Field>

      <Field label={`Duration — ${(durationMs / 1000).toFixed(1)}s`}>
        <input
          type="range"
          min={1000}
          max={15000}
          step={500}
          value={durationMs}
          onChange={(e) => setDurationMs(Number(e.target.value))}
          className="w-full accent-sky-500"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>1s</span>
          <span>15s</span>
        </div>
      </Field>

      <button
        onClick={send}
        disabled={!title.trim() || sendState === 'sending'}
        className="w-full py-3 bg-sky-500 text-white font-semibold rounded-xl disabled:opacity-50 active:scale-95 transition-transform"
      >
        {sendLabel}
      </button>

      {recent.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
            Sent this session
          </h2>
          {recent.map((n, i) => (
            <div
              key={i}
              className="bg-slate-800 rounded-xl px-4 py-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeStyle(n.type)}`}
                  >
                    {n.type}
                  </span>
                  <span className="text-sm font-medium truncate">{n.title}</span>
                </div>
                {n.body && <p className="text-xs text-slate-400 truncate">{n.body}</p>}
                <p className="text-xs text-slate-500 mt-0.5">{(n.durationMs / 1000).toFixed(1)}s</p>
              </div>
              <span className="text-xs text-slate-500 shrink-0">{n.time}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      <label className="block text-sm text-slate-400">{label}</label>
      {children}
    </div>
  )
}
