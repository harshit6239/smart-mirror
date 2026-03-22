import type { ConfigField } from '../lib/widgets-catalog'

type Props = {
  schema: Record<string, ConfigField>
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}

export default function WidgetConfigForm({ schema, values, onChange }: Props): React.JSX.Element {
  const entries = Object.entries(schema)

  if (entries.length === 0) {
    return (
      <p className="text-slate-400 text-sm py-6 text-center">
        This widget has no configurable options.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {entries.map(([key, field]) => {
        const raw = key in values ? values[key] : field.default

        return (
          <div key={key}>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              {field.label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>

            {field.type === 'boolean' ? (
              <button
                type="button"
                onClick={() => onChange(key, !raw)}
                aria-pressed={!!raw}
                aria-label={field.label}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                  raw ? 'bg-sky-500' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    raw ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            ) : field.type === 'select' ? (
              <select
                value={String(raw ?? '')}
                onChange={(e) => onChange(key, e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              >
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : field.type === 'number' ? (
              <input
                type="number"
                value={Number(raw ?? 0)}
                onChange={(e) => {
                  const n = e.target.valueAsNumber
                  if (!isNaN(n)) onChange(key, n)
                }}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            ) : (
              /* string */
              <input
                type={field.secret ? 'password' : 'text'}
                value={String(raw ?? '')}
                onChange={(e) => onChange(key, e.target.value)}
                placeholder={!field.secret ? field.hint : undefined}
                autoComplete={field.secret ? 'off' : undefined}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            )}

            {/* Show hint below for non-string types or secret string fields */}
            {field.hint && (field.type !== 'string' || field.secret) && (
              <p className="mt-1 text-xs text-slate-500">{field.hint}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
