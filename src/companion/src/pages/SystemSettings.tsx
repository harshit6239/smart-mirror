import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { THEMES } from '../lib/themes'

interface Settings {
  theme: string
  wakeTimeoutMs: number
  brightnessDay: number
  brightnessNight: number
  brightnessSchedule: { dayStart: string; nightStart: string }
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function SystemSettings(): React.JSX.Element {
  const [form, setForm] = useState<Settings | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  useEffect(() => {
    api
      .get<Settings>('/api/settings')
      .then(setForm)
      .catch(() => {})
  }, [])

  const set = <K extends keyof Settings>(key: K, value: Settings[K]): void =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  const setSchedule = (key: keyof Settings['brightnessSchedule'], value: string): void =>
    setForm((f) =>
      f ? { ...f, brightnessSchedule: { ...f.brightnessSchedule, [key]: value } } : f
    )

  const save = async (): Promise<void> => {
    if (!form) return
    setSaveState('saving')
    try {
      await api.put('/api/settings', form)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 3000)
    }
  }

  if (!form) return <p className="text-slate-400">Loading…</p>

  const saveLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? '✓ Saved'
        : saveState === 'error'
          ? 'Error — try again'
          : 'Save'

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">System Settings</h1>

      <Field label="Theme">
        <select
          value={form.theme}
          onChange={(e) => set('theme', e.target.value)}
          className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm"
        >
          {THEMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label={`Wake timeout — ${Math.round(form.wakeTimeoutMs / 60_000)} min`}>
        <input
          type="range"
          min={60_000}
          max={1_800_000}
          step={60_000}
          value={form.wakeTimeoutMs}
          onChange={(e) => set('wakeTimeoutMs', Number(e.target.value))}
          className="w-full accent-sky-500"
        />
      </Field>

      <Field label={`Brightness (day) — ${form.brightnessDay}%`}>
        <input
          type="range"
          min={10}
          max={100}
          value={form.brightnessDay}
          onChange={(e) => set('brightnessDay', Number(e.target.value))}
          className="w-full accent-sky-500"
        />
      </Field>

      <Field label={`Brightness (night) — ${form.brightnessNight}%`}>
        <input
          type="range"
          min={5}
          max={70}
          value={form.brightnessNight}
          onChange={(e) => set('brightnessNight', Number(e.target.value))}
          className="w-full accent-sky-500"
        />
      </Field>

      <Field label="Day starts at">
        <input
          type="time"
          value={form.brightnessSchedule.dayStart}
          onChange={(e) => setSchedule('dayStart', e.target.value)}
          className="bg-slate-700 rounded-lg px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Night starts at">
        <input
          type="time"
          value={form.brightnessSchedule.nightStart}
          onChange={(e) => setSchedule('nightStart', e.target.value)}
          className="bg-slate-700 rounded-lg px-3 py-2 text-sm"
        />
      </Field>

      <button
        onClick={save}
        disabled={saveState === 'saving'}
        className="w-full py-3 bg-sky-500 text-white font-semibold rounded-xl disabled:opacity-50 active:scale-95 transition-transform"
      >
        {saveLabel}
      </button>
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
