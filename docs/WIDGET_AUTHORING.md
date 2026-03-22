# Smart Mirror — Widget Authoring Guide

> **Who this is for:** Anyone adding a new bundled widget to the mirror — whether porting an existing React component or building one from scratch.
> This guide covers the full lifecycle: writing the component, adding config fields, registering it in both the renderer and the companion, and verifying it works end-to-end.

---

## Table of Contents

1. [What is a Widget?](#1-what-is-a-widget)
2. [The Widget Contract](#2-the-widget-contract)
3. [Step 1 — Create the Component File](#3-step-1--create-the-component-file)
4. [Step 2 — Implement the Component](#4-step-2--implement-the-component)
5. [Step 3 — Make it Configurable](#5-step-3--make-it-configurable)
6. [Step 4 — Register in the Renderer](#6-step-4--register-in-the-renderer)
7. [Step 5 — Register in the Companion Catalog](#7-step-5--register-in-the-companion-catalog)
8. [Step 6 — Seed a Default Instance (Optional)](#8-step-6--seed-a-default-instance-optional)
9. [Grid Sizing Rules](#9-grid-sizing-rules)
10. [Styling Rules](#10-styling-rules)
11. [Polling IPC (System Stats Pattern)](#11-polling-ipc-system-stats-pattern)
12. [Real-World Example A — Annotated Clock Widget](#12-real-world-example-a--annotated-clock-widget)
13. [Real-World Example B — Quote of the Day Widget (from scratch)](#13-real-world-example-b--quote-of-the-day-widget-from-scratch)
14. [Real-World Example C — API Widget with Secret Key](#14-real-world-example-c--api-widget-with-secret-key)
15. [Porting an Existing React Component](#15-porting-an-existing-react-component)
16. [Config Field Reference](#16-config-field-reference)
17. [End-to-End Checklist](#17-end-to-end-checklist)
18. [Common Mistakes](#18-common-mistakes)

---

## 1. What is a Widget?

A widget is a **React component** that lives inside a grid cell on the mirror screen. It:

- Receives a `config` object whose shape you define
- Renders itself to **fill 100% of the cell it is placed in**
- Has a **companion-side catalog entry** so the Layout Editor can add it and the Config page can show its settings form
- Is registered in `BUNDLED_WIDGETS` so the renderer knows how to resolve it by ID

The grid is **12 columns × 8 rows**. Each cell is `~42 px` tall. A widget can span multiple columns and rows.

```
┌────────────────────────────────────────────────────────────┐  row 1
│   Clock (colSpan=7, rowSpan=3)    │ Stats (col=9, cs=4)    │
│                                   │                         │  row 3
├───────────────────────────────────┴─────────────────────────┤
│                                                              │  row 4
│          Free space                                          │
│                                                              │  row 8
└──────────────────────────────────────────────────────────────┘
  col 1                                                  col 12
```

---

## 2. The Widget Contract

### Types (from `src/renderer/src/lib/widget-types.ts`)

```ts
/** Props every widget receives */
export type WidgetProps = {
  instanceId: string // unique ID of this placed instance
  config: Record<string, unknown> // current config values (cast what you need)
}
```

Your component **must**:

- Be the **default export** of its file
- Accept `WidgetProps` as its only prop
- Render inside a container that fills `w-full h-full`

### Config values are `unknown`

The `config` object is typed as `Record<string, unknown>` to support dynamic loading. You must **cast each value** you use:

```ts
const label = (config.label as string) ?? 'Default' // string with fallback
const count = (config.count as number) ?? 5 // number with fallback
const enabled = (config.enabled as boolean) ?? true // boolean with fallback
```

Always provide a **safe fallback** (the `??` part). Config can be missing if the widget was just placed and hasn't been configured yet, or if the user cleared their data.

---

## 3. Step 1 — Create the Component File

Create a new folder under `src/renderer/src/widgets/<your-widget-id>/` and an `index.tsx` inside it.

```
src/renderer/src/widgets/
  clock/
    index.tsx        ← already exists
  system-stats/
    index.tsx        ← already exists
  my-new-widget/
    index.tsx        ← ← ← you create this
```

**Convention:** the folder name is the `widgetId` — use kebab-case, e.g. `quote-of-the-day`, `weather`, `news-ticker`.

---

## 4. Step 2 — Implement the Component

Minimal skeleton:

```tsx
// src/renderer/src/widgets/my-new-widget/index.tsx

import type { WidgetProps } from '../../lib/widget-types'

export default function MyNewWidget({ config, instanceId }: WidgetProps): React.JSX.Element {
  // instanceId is useful if you need to namespace localStorage keys or debug logs

  return (
    <div className="w-full h-full flex items-center justify-center">
      <span className="text-white text-lg">Hello from {instanceId}</span>
    </div>
  )
}
```

Key rules for the root element:

- Always `w-full h-full` — the WidgetWrapper constrains size via the grid, your component fills it
- Black background is the mirror glass — **never add a background color** of your own
- All text must be white or `text-white/<opacity>`

---

## 5. Step 3 — Make it Configurable

### 5a. Read config values in the component

Each config field is read from the `config` prop with a cast and a fallback:

```tsx
export default function MyWidget({ config }: WidgetProps): React.JSX.Element {
  const title = (config.title as string) ?? 'Untitled'
  const count = (config.count as number) ?? 5
  const enabled = (config.enabled as boolean) ?? true
  const mode = (config.mode as string) ?? 'compact'
  // ...
}
```

### 5b. Define the configSchema in `widgets-catalog.ts`

This is what drives the auto-generated form in the companion. Open:

```
src/companion/src/lib/widgets-catalog.ts
```

Add your catalog entry to the `WIDGET_CATALOG` array. The `configSchema` maps each config key to a `ConfigField` descriptor:

```ts
{
  widgetId: 'my-new-widget',
  name: 'My New Widget',
  defaultConfig: {
    title: 'Hello',
    count: 5,
    enabled: true,
    mode: 'compact'
  },
  defaultLayout: { col: 1, row: 5, colSpan: 4, rowSpan: 2 },
  configSchema: {
    title: {
      type: 'string',
      label: 'Title text',
      default: 'Hello',
      hint: 'Displayed at the top of the widget'
    },
    count: {
      type: 'number',
      label: 'Item count',
      default: 5
    },
    enabled: {
      type: 'boolean',
      label: 'Enabled',
      default: true
    },
    mode: {
      type: 'select',
      label: 'Display mode',
      options: ['compact', 'detailed', 'minimal'],
      default: 'compact',
      hint: 'compact = single line · detailed = full info'
    }
  }
}
```

### 5c. How it flows — end to end

```
widgets-catalog.ts (companion)
        │  configSchema describes fields
        ▼
WidgetConfigForm.tsx — renders form inputs per field type
        │  user fills in form, clicks Save
        ▼
PUT /api/widget-config/:instanceId
        │  CompanionServer writes config into electron-store
        ▼
store.onDidAnyChange → broadcasts 'config:changed' IPC to renderer
        │
        ▼
useConfig('widgetInstances') — re-renders WidgetGrid
        │  fresh config prop passed to widget component
        ▼
Widget re-renders with new values  ← live, no restart needed
```

---

## 6. Step 4 — Register in the Renderer

Open `src/renderer/src/lib/widget-registry.ts` and add your import + map entry:

```ts
// BEFORE
import ClockWidget from '../widgets/clock/index'
import SystemStatsWidget from '../widgets/system-stats/index'

export const BUNDLED_WIDGETS: Record<string, React.ComponentType<WidgetProps>> = {
  clock: ClockWidget,
  'system-stats': SystemStatsWidget
}

// AFTER — add your widget
import ClockWidget from '../widgets/clock/index'
import SystemStatsWidget from '../widgets/system-stats/index'
import MyNewWidget from '../widgets/my-new-widget/index' // ← add

export const BUNDLED_WIDGETS: Record<string, React.ComponentType<WidgetProps>> = {
  clock: ClockWidget,
  'system-stats': SystemStatsWidget,
  'my-new-widget': MyNewWidget // ← add
}
```

The **key** in this map must exactly match the `widgetId` you used in the catalog.

When the renderer encounters an instance with `widgetId: 'my-new-widget'` in the config store, `WidgetWrapper` looks it up here. If it is missing, `WidgetWrapper` shows a loading skeleton.

---

## 7. Step 5 — Register in the Companion Catalog

You already did this in Step 3b by adding the entry to `WIDGET_CATALOG`. This makes the widget:

1. **Appear in the Layout Editor sidebar** — so the user can drag/add it to a page
2. **Have a config form** — the ⚙ gear icon appears on the widget tile if `configSchema` has at least one field

The companion also uses `defaultConfig` when creating a fresh instance, and `defaultLayout` to pick the initial grid position (which `findFreeSlot` may override if that position is occupied).

---

## 8. Step 6 — Seed a Default Instance (Optional)

If you want your widget pre-placed on a page on first run, add it to the seeding block in `src/main/index.ts`. This only runs once (guarded by checking if the instance ID already exists):

```ts
// In app.whenReady() → after page seeding

if (!getConfig().widgetInstances['instance-my-new-widget-1']) {
  const myInstance: WidgetInstance = {
    id: 'instance-my-new-widget-1',
    widgetId: 'my-new-widget',
    version: '1.0.0',
    config: { title: 'Hello', count: 5, enabled: true, mode: 'compact' },
    layout: { col: 1, row: 5, colSpan: 4, rowSpan: 2 }
  }
  setConfig('widgetInstances', {
    ...getConfig().widgetInstances,
    'instance-my-new-widget-1': myInstance
  })
  // Also add its ID to the target page's widgetIds array
  const pages = getConfig().pages
  const updated = pages.map((p, i) =>
    i === 0 // page index 0 = first page
      ? { ...p, widgetIds: [...p.widgetIds, 'instance-my-new-widget-1'] }
      : p
  )
  setConfig('pages', updated)
}
```

If you **don't** seed it, users can still add it manually from the companion's Layout Editor.

---

## 9. Grid Sizing Rules

The mirror grid is **12 columns × 8 rows**. Column 1 starts at the left edge.

| Attribute | Range | Notes                            |
| --------- | ----- | -------------------------------- |
| `col`     | 1–12  | 1-based left edge                |
| `row`     | 1–8   | 1-based top edge                 |
| `colSpan` | 1–12  | `col + colSpan - 1` must be ≤ 12 |
| `rowSpan` | 1–8   | `row + rowSpan - 1` must be ≤ 8  |

**Recommended minimum sizes** for common widget types:

| Widget type           | Min colSpan | Min rowSpan |
| --------------------- | ----------- | ----------- |
| Single stat / badge   | 2           | 1           |
| Text list (3–5 items) | 4           | 2           |
| Clock / time          | 5           | 2           |
| Weather card          | 5           | 3           |
| Graph / chart         | 6           | 3           |
| Full-width banner     | 12          | 2           |

Each row is `~42 px` tall. Each column is `(total-width − margins) / 12`.

---

## 10. Styling Rules

These rules exist because the mirror is a physical reflective surface — a non-black background causes visible glare.

| Rule                                  | Why                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| **Never add a background color**      | Pure `#000` shows through mirror glass. Any fill breaks the illusion           |
| **All text: white**                   | Use `text-white`, `text-white/80`, `text-white/50`, etc.                       |
| **No slate/gray fills**               | `bg-slate-800` etc. are fine in the companion UI, never on the mirror renderer |
| **Use `w-full h-full`** on root       | The grid cell constrains size                                                  |
| **Tailwind only** — no `.css` imports | Dynamic widgets won't have CSS files bundled                                   |
| **No layout shift after mount**       | Reserve space for loading states with a fixed-height placeholder               |

Good practice for loading states:

```tsx
if (loading) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <span className="text-white/20 text-sm">Loading…</span>
    </div>
  )
}
```

---

## 11. Polling IPC (System Stats Pattern)

If your widget needs data from the main process (OS-level info, file system, hardware), you can define an IPC handler in `src/main/index.ts` and call it from the renderer via the preload.

**Step 1 — Add main process handler** (`src/main/index.ts`):

```ts
ipcMain.handle('my-widget:data', async () => {
  return { value: 42 }
})
```

**Step 2 — Expose in preload** (`src/preload/index.ts`):

```ts
const myWidget = {
  getData: (): Promise<{ value: number }> => ipcRenderer.invoke('my-widget:data')
}
// Add to contextBridge.exposeInMainWorld('myWidget', myWidget)
```

**Step 3 — Declare type** (`src/preload/index.d.ts`):

```ts
interface Window {
  myWidget: {
    getData(): Promise<{ value: number }>
  }
}
```

**Step 4 — Poll in the widget**:

```tsx
export default function MyWidget(): React.JSX.Element {
  const [value, setValue] = useState<number | null>(null)

  useEffect(() => {
    let active = true

    const poll = async (): Promise<void> => {
      try {
        const data = await window.myWidget.getData()
        if (active) setValue(data.value)
      } catch {
        // IPC failed — leave previous value, don't crash
      }
    }

    void poll() // immediate first call
    const id = setInterval(() => void poll(), 5000) // then every 5s

    return () => {
      active = false // prevent stale setState after unmount
      clearInterval(id)
    }
  }, [])

  return (
    <div className="w-full h-full flex items-center justify-center">
      <span className="text-white text-4xl">{value === null ? '—' : value}</span>
    </div>
  )
}
```

The `active` flag prevents a `setState` on an unmounted component when the widget is removed from the page.

---

## 12. Real-World Example A — Annotated Clock Widget

This is the actual widget at `src/renderer/src/widgets/clock/index.tsx`, annotated.

```tsx
import { useState, useEffect } from 'react'
import type { WidgetProps } from '../../lib/widget-types'

// ── Map config value 'sm'/'md'/'lg'/'xl'/'2xl' to Tailwind classes ────────────
// We do this at module level — object lookup is cheaper than a switch in render.
const FONT_SIZE_CLASS: Record<string, string> = {
  sm: 'text-2xl',
  md: 'text-3xl',
  lg: 'text-4xl',
  xl: 'text-5xl', // default
  '2xl': 'text-6xl'
}

export default function ClockWidget({ config }: WidgetProps): React.JSX.Element {
  // ── Read config with safe fallbacks ─────────────────────────────────────────
  // If config.timezone is undefined (fresh instance), fall back to the
  // system timezone so the widget still works before the user configures it.
  const timezone = (config.timezone as string) || Intl.DateTimeFormat().resolvedOptions().timeZone
  const use24h = (config.use24h as boolean) ?? true
  const showSeconds = (config.showSeconds as boolean) ?? true
  const showDate = (config.showDate as boolean) ?? true
  const showDayOfWeek = (config.showDayOfWeek as boolean) ?? true
  const dateFormat = (config.dateFormat as string) || 'long'
  const fontSize = (config.fontSize as string) || 'xl'

  const [now, setNow] = useState(new Date())

  useEffect(() => {
    // Optimization: if seconds are hidden, we only need to update once per minute.
    // Re-running this effect whenever showSeconds changes ensures the interval
    // is always set to the right frequency.
    const interval = showSeconds ? 1000 : 60_000
    const id = setInterval(() => setNow(new Date()), interval)
    return () => clearInterval(id) // cleanup on unmount or config change
  }, [showSeconds])

  // ── Format time string ───────────────────────────────────────────────────────
  // Spread operator lets us conditionally include 'second' only when needed.
  const timeStr = now.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour12: !use24h,
    hour: '2-digit',
    minute: '2-digit',
    ...(showSeconds ? { second: '2-digit' } : {})
  })

  // ── Format date string ───────────────────────────────────────────────────────
  const dateFormatMap: Record<string, Intl.DateTimeFormatOptions['month']> = {
    long: 'long', // "January"
    short: 'short', // "Jan"
    numeric: 'numeric' // "1"
  }

  const dateStr = now.toLocaleDateString('en-US', {
    timeZone: timezone,
    // showDayOfWeek: "Monday" for long/short, "Mon" for numeric format
    ...(showDayOfWeek ? { weekday: dateFormat === 'numeric' ? 'short' : 'long' } : {}),
    year: 'numeric',
    month: dateFormatMap[dateFormat] ?? 'long',
    day: 'numeric'
  })

  const timeClass = FONT_SIZE_CLASS[fontSize] ?? FONT_SIZE_CLASS['xl']

  return (
    // w-full h-full fills the grid cell. flex-col centers content vertically.
    <div className="flex h-full w-full flex-col items-center justify-center gap-1">
      <span className={`text-white ${timeClass} font-light tabular-nums tracking-tight`}>
        {timeStr}
      </span>
      {/* Conditionally render date line — when hidden, the time centers in the full cell */}
      {showDate && <span className="text-white/50 text-sm">{dateStr}</span>}
    </div>
  )
}
```

**Companion catalog entry** (`widgets-catalog.ts`):

```ts
{
  widgetId: 'clock',
  name: 'Clock',
  defaultConfig: {
    timezone: 'UTC',
    use24h: true,
    showSeconds: true,
    showDate: true,
    showDayOfWeek: true,
    dateFormat: 'long',
    fontSize: 'xl'
  },
  defaultLayout: { col: 1, row: 1, colSpan: 7, rowSpan: 3 },
  configSchema: {
    timezone: {
      type: 'string',
      label: 'Timezone',
      default: 'UTC',
      hint: 'IANA timezone name — e.g. America/New_York, Europe/London'
    },
    use24h:        { type: 'boolean', label: '24-hour format',   default: true },
    showSeconds:   { type: 'boolean', label: 'Show seconds',     default: true },
    showDate:      { type: 'boolean', label: 'Show date',        default: true },
    showDayOfWeek: { type: 'boolean', label: 'Show day of week', default: true },
    dateFormat: {
      type: 'select',
      label: 'Date format',
      options: ['long', 'short', 'numeric'],
      default: 'long',
      hint: 'long = "January 1, 2025"  ·  short = "Jan 1, 2025"  ·  numeric = "1/1/2025"'
    },
    fontSize: {
      type: 'select',
      label: 'Time font size',
      options: ['sm', 'md', 'lg', 'xl', '2xl'],
      default: 'xl',
      hint: 'sm = smallest · 2xl = largest'
    }
  }
}
```

**Registry** (`widget-registry.ts`):

```ts
import ClockWidget from '../widgets/clock/index'
// ...
export const BUNDLED_WIDGETS = {
  clock: ClockWidget
  // ...
}
```

---

## 13. Real-World Example B — Quote of the Day Widget (from scratch)

This example builds a complete widget that fetches a random quote from a public API on mount, shows the quote + author, and has a configurable refresh interval and text size.

### File: `src/renderer/src/widgets/quote/index.tsx`

```tsx
import { useState, useEffect, useCallback } from 'react'
import type { WidgetProps } from '../../lib/widget-types'

type Quote = { text: string; author: string }

export default function QuoteWidget({ config }: WidgetProps): React.JSX.Element {
  const refreshMinutes = (config.refreshMinutes as number) ?? 60
  const textSize = (config.textSize as string) ?? 'sm'
  const showAuthor = (config.showAuthor as boolean) ?? true

  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchQuote = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      // Replace with any quotes API endpoint you prefer
      const res = await fetch('https://api.quotable.io/random')
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      setQuote({ text: data.content, author: data.author })
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchQuote()
    const ms = Math.max(refreshMinutes, 1) * 60_000
    const id = setInterval(() => void fetchQuote(), ms)
    return () => clearInterval(id)
  }, [fetchQuote, refreshMinutes])

  const sizeClass = textSize === 'lg' ? 'text-base' : textSize === 'md' ? 'text-sm' : 'text-xs'

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-white/20 text-xs">Loading…</span>
      </div>
    )
  }

  if (error || !quote) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-white/30 text-xs">Quote unavailable</span>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-4 py-3">
      <p className={`text-white/80 ${sizeClass} text-center leading-relaxed italic`}>
        &ldquo;{quote.text}&rdquo;
      </p>
      {showAuthor && <p className="text-white/40 text-xs">— {quote.author}</p>}
    </div>
  )
}
```

### Catalog entry (`widgets-catalog.ts`)

```ts
{
  widgetId: 'quote',
  name: 'Quote of the Day',
  defaultConfig: {
    refreshMinutes: 60,
    textSize: 'sm',
    showAuthor: true
  },
  defaultLayout: { col: 1, row: 5, colSpan: 6, rowSpan: 3 },
  configSchema: {
    refreshMinutes: {
      type: 'number',
      label: 'Refresh every (minutes)',
      default: 60,
      hint: 'Minimum 1 minute'
    },
    textSize: {
      type: 'select',
      label: 'Text size',
      options: ['sm', 'md', 'lg'],
      default: 'sm'
    },
    showAuthor: {
      type: 'boolean',
      label: 'Show author',
      default: true
    }
  }
}
```

### Registry entry (`widget-registry.ts`)

```ts
import QuoteWidget from '../widgets/quote/index'

export const BUNDLED_WIDGETS = {
  // ...existing...
  quote: QuoteWidget
}
```

---

## 14. Real-World Example C — API Widget with Secret Key

This example shows how to handle `secret: true` config fields (e.g. API keys). Secret values are stored in `electron-store` just like any other config, but the companion form renders them as password inputs and never shows the stored value in plaintext after the initial save.

### File: `src/renderer/src/widgets/weather/index.tsx`

```tsx
import { useState, useEffect } from 'react'
import type { WidgetProps } from '../../lib/widget-types'

type WeatherData = {
  tempC: number
  description: string
  iconCode: string
}

export default function WeatherWidget({ config }: WidgetProps): React.JSX.Element {
  const apiKey = (config.apiKey as string) ?? ''
  const city = (config.city as string) ?? 'London'
  const units = (config.units as string) ?? 'metric'

  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!apiKey) {
      setError('No API key — configure in companion')
      return
    }

    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?q=${encodeURIComponent(city)}&appid=${apiKey}&units=${units}`

    let active = true

    const fetch_ = (): void => {
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (!active) return
          if (data.cod !== 200) throw new Error(data.message)
          setWeather({
            tempC: Math.round(data.main.temp),
            description: data.weather[0].description,
            iconCode: data.weather[0].icon
          })
          setError(null)
        })
        .catch((e: Error) => {
          if (active) setError(e.message)
        })
    }

    fetch_()
    const id = setInterval(fetch_, 10 * 60_000) // refresh every 10 min
    return () => {
      active = false
      clearInterval(id)
    }
  }, [apiKey, city, units])

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center px-3">
        <span className="text-white/30 text-xs text-center">{error}</span>
      </div>
    )
  }

  if (!weather) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-white/20 text-xs">Loading…</span>
      </div>
    )
  }

  const label = units === 'imperial' ? '°F' : '°C'

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1">
      <span className="text-white text-5xl font-light tabular-nums">
        {weather.tempC}
        {label}
      </span>
      <span className="text-white/50 text-sm capitalize">{weather.description}</span>
      <span className="text-white/30 text-xs">{city}</span>
    </div>
  )
}
```

### Catalog entry — note `secret: true`

```ts
{
  widgetId: 'weather',
  name: 'Weather',
  defaultConfig: {
    apiKey: '',
    city: 'London',
    units: 'metric'
  },
  defaultLayout: { col: 9, row: 4, colSpan: 4, rowSpan: 4 },
  configSchema: {
    apiKey: {
      type: 'string',
      label: 'OpenWeatherMap API Key',
      secret: true,           // ← renders as password input in companion
      required: true,
      hint: 'Get a free key at openweathermap.org'
    },
    city: {
      type: 'string',
      label: 'City',
      default: 'London',
      hint: 'City name, e.g. Tokyo or New York'
    },
    units: {
      type: 'select',
      label: 'Units',
      options: ['metric', 'imperial'],
      default: 'metric',
      hint: 'metric = °C  ·  imperial = °F'
    }
  }
}
```

**How `secret` works:**

- In `WidgetConfigForm.tsx`, `secret: true` → `<input type="password">`
- The API key is stored in `electron-store` in plaintext (on-device, not transmitted)
- The companion form never re-populates the field after save, so the key is not exposed in the HTML — the user must re-type it to change it

---

## 15. Porting an Existing React Component

If you have a React component built outside this project that you want to turn into a widget:

### Before (standalone component)

```tsx
// OldClock.tsx — standalone, has its own props
interface Props {
  timezone: string
  format: '12h' | '24h'
}

export default function OldClock({ timezone, format }: Props) {
  // ...
}
```

### After (widget-compatible)

```tsx
// src/renderer/src/widgets/old-clock/index.tsx
import type { WidgetProps } from '../../lib/widget-types'

export default function OldClockWidget({ config }: WidgetProps): React.JSX.Element {
  // 1. Map config Record → strongly typed locals
  const timezone = (config.timezone as string) ?? 'UTC'
  const format = (config.format as '12h' | '24h') ?? '12h'

  // 2. Copy the component body here — replace prop references with locals above
  // 3. Ensure the root element is w-full h-full

  return <div className="w-full h-full ...">{/* original JSX */}</div>
}
```

**Porting checklist:**

- [ ] Replace component props with `WidgetProps` + local casts
- [ ] Remove any `.css` file imports — convert to Tailwind or inline styles
- [ ] Replace hardcoded colors with `text-white` / opacity variants
- [ ] Remove any `background-color` from root element
- [ ] Wrap root element in `w-full h-full`
- [ ] Replace `props.children` patterns — widgets don't receive children
- [ ] Replace any `window.location` or `document` manipulations that affect the full page

---

## 16. Config Field Reference

All fields live in `configSchema` in `widgets-catalog.ts`.

| `type`      | Companion UI           | Value in `config`           | Notes                                                |
| ----------- | ---------------------- | --------------------------- | ---------------------------------------------------- |
| `'string'`  | Text input             | `string`                    | Set `secret: true` for passwords/API keys            |
| `'number'`  | Number input (spinbox) | `number`                    | Browser may return `NaN` for empty — always validate |
| `'boolean'` | Toggle switch          | `boolean`                   | Renders as an accessible on/off pill                 |
| `'select'`  | Dropdown               | `string` (one of `options`) | Must also provide `options: string[]`                |

### Full `ConfigField` type

```ts
type ConfigField = {
  type: 'string' | 'number' | 'boolean' | 'select'

  /** Label shown above the input in the companion form */
  label: string

  /** Applied when the key is missing from the instance config */
  default?: unknown

  /** select only: the list of values the user can pick */
  options?: string[]

  /**
   * string only: renders as <input type="password">
   * Value is NOT shown after save (user must re-type to change)
   */
  secret?: boolean

  /**
   * string type: shown as the input placeholder
   * other types: shown as a small hint line below the field
   */
  hint?: string

  /** Shows a red asterisk; companion does NOT validate — widget must handle empty value */
  required?: boolean
}
```

### Tips

- `required: true` is **decorative** — it adds a red `*` in the UI but the form does not block submission. Your widget component must handle a missing value gracefully (the catch-all fallback via `??`).
- For `number` fields, always check for `NaN` in your widget: `const n = Number(config.count); if (isNaN(n)) { ... }`
- `default` in `ConfigField` is used by `WidgetConfigForm` to pre-populate the field before the user has saved a value. It does **not** auto-populate the stored config — that comes from `defaultConfig` in the catalog entry, which is used when `addWidget` creates the instance.

---

## 17. End-to-End Checklist

Use this after building a new widget to make sure everything is wired up.

### Code

- [ ] `src/renderer/src/widgets/<id>/index.tsx` created
- [ ] Default export is a function accepting `WidgetProps`
- [ ] Root element uses `w-full h-full`
- [ ] All text uses `text-white` or `text-white/<opacity>`
- [ ] No background color on root
- [ ] All config reads have safe fallbacks (`?? value`)
- [ ] Cleanup functions returned from all `useEffect` hooks (clear intervals, cancel fetches)

### Registration

- [ ] Entry added to `BUNDLED_WIDGETS` in `src/renderer/src/lib/widget-registry.ts`
- [ ] Entry added to `WIDGET_CATALOG` in `src/companion/src/lib/widgets-catalog.ts`
  - [ ] `widgetId` matches the key in `BUNDLED_WIDGETS`
  - [ ] `defaultConfig` contains every key used in the component
  - [ ] `configSchema` has an entry for every user-configurable key

### Build

- [ ] `npx electron-vite build` exits 0 (no TypeScript errors in renderer)
- [ ] `npm run build:companion` exits 0 (no TypeScript errors in companion)

### Manual test — renderer

- [ ] Open app (`npm run dev`)
- [ ] Open DevTools → Console → paste:
  ```js
  await window.config.set('widgetInstances', {
    ...(await window.config.get().then((c) => c.widgetInstances)),
    'test-instance': {
      id: 'test-instance',
      widgetId: 'my-new-widget',
      version: '1.0.0',
      config: {
        /* your defaultConfig values */
      },
      layout: { col: 1, row: 5, colSpan: 4, rowSpan: 2 }
    }
  })
  await window.config.set(
    'pages',
    (await window.config.get()).pages.map((p, i) =>
      i === 0 ? { ...p, widgetIds: [...p.widgetIds, 'test-instance'] } : p
    )
  )
  ```
- [ ] Widget appears on page 1
- [ ] No error boundary / skeleton shown
- [ ] Widget renders correctly in its grid cell

### Manual test — companion config

- [ ] Open companion (`http://localhost:8080/layout`)
- [ ] Widget appears in sidebar → click `+ My New Widget` → placed without overlap
- [ ] ⚙ gear icon visible on the widget tile (if `configSchema` has fields)
- [ ] Click ⚙ → config page loads all fields correctly
- [ ] Change a value → Save → widget on mirror updates live (no restart)

---

## 18. Common Mistakes

| Mistake                                                   | Symptom                                                 | Fix                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Forgetting `w-full h-full` on root                        | Widget renders at 0px or wrong size                     | Add `className="w-full h-full"` to the outermost element                       |
| `widgetId` mismatch between registry and catalog          | Widget shows skeleton in editor tile; gear icon missing | Make the key in `BUNDLED_WIDGETS` exactly match `widgetId` in `WIDGET_CATALOG` |
| Missing fallback in config cast                           | Widget crashes on first placement (config is empty)     | Always use `?? defaultValue` when casting: `(config.x as string) ?? 'default'` |
| Not cleaning up intervals                                 | Memory / CPU leak when navigating pages                 | Return `() => clearInterval(id)` from `useEffect`                              |
| `useEffect` dependency missing                            | Stale closure — widget doesn't react to config changes  | Add all config-derived values that affect the effect to its dependency array   |
| Adding background color                                   | White/gray box visible on mirror                        | Remove `bg-*` from root — only `w-full h-full` and layout classes              |
| Importing a `.css` file                                   | Bundler error or styles missing in dynamic load         | Convert to Tailwind utilities or inline styles                                 |
| `defaultConfig` key differs from what the component reads | Config key is always undefined, fallback always fires   | Keep keys identical in both `defaultConfig` and the component's cast lines     |
| Missing entry in `WIDGET_CATALOG`                         | Widget can't be added from Layout Editor                | Add the entry — even with `configSchema: {}` for no-config widgets             |
