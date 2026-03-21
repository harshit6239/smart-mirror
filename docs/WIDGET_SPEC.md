# Widget Specification

This document defines the contract for building widgets for Smart Mirror — both bundled widgets (compiled into the app) and registry widgets (downloaded at runtime).

---

## Widget Anatomy

A widget is a **React component** that:

1. Receives typed props (`WidgetProps`)
2. Renders its own UI, sized to fit its grid slot
3. Declares a **manifest** describing its metadata, config schema, and size constraints
4. Is exported as the **default export** of its bundle

---

## TypeScript Types

```ts
// lib/widget-types.ts

/** Grid position and size for a widget instance */
interface WidgetLayout {
  col: number // 1-based, 1–12
  row: number // 1-based
  colSpan: number // number of columns to occupy
  rowSpan: number // number of rows to occupy
}

/** A placed instance of a widget on a page */
interface WidgetInstance {
  id: string // unique instance UUID
  widgetId: string // e.g. 'clock', 'weather'
  version: string // semver, e.g. '1.0.0'
  config: Record<string, unknown> // current config values
  layout: WidgetLayout
  schedule?: WidgetScheduleEntry[]
}

/** Override config on a cron schedule */
interface WidgetScheduleEntry {
  cron: string // standard 5-field cron expression
  configOverride: Record<string, unknown>
}

/** Props passed to every widget component */
interface WidgetProps {
  instanceId: string
  config: Record<string, unknown> // current resolved config
  widgetApi: WidgetApi
}

/** Utilities provided by the mirror runtime */
interface WidgetApi {
  /** Subscribe to gesture events. Returns cleanup function. */
  onGesture: (handler: (gesture: GestureEvent) => void) => () => void
}

interface GestureEvent {
  gesture: string // e.g. 'SWIPE_LEFT'
  gesture_type: string // 'dynamic' | 'static'
  confidence?: number
}

/** A single config field definition */
interface ConfigField {
  type: 'string' | 'number' | 'boolean' | 'select'
  label: string
  default?: unknown
  /** For select type: list of string values */
  options?: string[]
  /** If true: stored encrypted, masked in companion UI, never returned in plaintext */
  secret?: boolean
  /** Hint text shown below the field */
  hint?: string
  /** Whether the field is required */
  required?: boolean
}

/** Widget manifest — defines metadata and capabilities */
interface WidgetManifest {
  id: string
  name: string
  version: string // semver
  description: string
  author?: string
  /** Minimum grid size the widget needs to be usable */
  minSize: {
    cols: number
    rows: number
  }
  /** Config schema — drives auto-generated companion form */
  configSchema: Record<string, ConfigField>
  /** URL to the ESM bundle (used in registry.json only) */
  bundleUrl?: string
}
```

---

## Widget Component Contract

```tsx
// Every widget must follow this shape

import type { WidgetProps } from '../../lib/widget-types'

export default function MyWidget({ config, instanceId, widgetApi }: WidgetProps) {
  // config values are typed as unknown — cast what you need
  const myValue = config.someKey as string

  return <div className="widget-root">{/* Your widget UI */}</div>
}

// The manifest is a named export on the same module (for bundled widgets)
// For registry widgets, the manifest lives in manifest.json alongside the bundle
export const manifest: WidgetManifest = {
  id: 'my-widget',
  name: 'My Widget',
  version: '1.0.0',
  description: 'Does something useful',
  minSize: { cols: 3, rows: 2 },
  configSchema: {
    apiKey: {
      type: 'string',
      label: 'API Key',
      secret: true,
      required: true
    },
    units: {
      type: 'select',
      label: 'Units',
      options: ['metric', 'imperial'],
      default: 'metric'
    }
  }
}
```

---

## Styling Rules

- Use only **Tailwind utility classes** or **inline styles**
- Do **not** import `.css` files (they won't be bundled correctly for dynamic widgets)
- The grid cell constrains size — widgets should fill their container:
  ```tsx
  <div className="w-full h-full flex items-center justify-center">...</div>
  ```
- Use CSS custom properties for theme-aware colors:
  ```tsx
  <div style={{ color: 'var(--color-text)', background: 'var(--color-surface)' }}>
  ```
- Available CSS variables: `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-border`, `--font-sans`, `--radius`

---

## Config Schema Reference

| Field             | Description                                                          |
| ----------------- | -------------------------------------------------------------------- |
| `type: 'string'`  | Single-line text input                                               |
| `type: 'number'`  | Number input                                                         |
| `type: 'boolean'` | Toggle / checkbox                                                    |
| `type: 'select'`  | Dropdown, requires `options: string[]`                               |
| `secret: true`    | Stored encrypted; masked in companion; not returned in API responses |
| `required: true`  | Companion form enforces non-empty before saving                      |
| `default`         | Used when no value has been configured yet                           |
| `hint`            | Helper text shown below the input in companion                       |

### Example Schema

```ts
configSchema: {
  city: {
    type: 'string',
    label: 'City Name',
    default: 'New York',
    hint: 'Used for time zone lookup'
  },
  apiKey: {
    type: 'string',
    label: 'OpenWeather API Key',
    secret: true,
    required: true,
    hint: 'Get a free key at openweathermap.org'
  },
  units: {
    type: 'select',
    label: 'Temperature Units',
    options: ['metric', 'imperial'],
    default: 'metric'
  },
  showForecast: {
    type: 'boolean',
    label: 'Show 3-day forecast',
    default: true
  }
}
```

---

## Widget API (`widgetApi`)

The `widgetApi` prop provides controlled access to mirror features:

### `widgetApi.onGesture(handler)`

Subscribe to gesture events. Call from inside `useEffect`:

```tsx
useEffect(() => {
  const cleanup = widgetApi.onGesture((event) => {
    if (event.gesture === 'SWIPE_LEFT') {
      // next track, next slide, etc.
    }
  })
  return cleanup // cleanup on unmount
}, [widgetApi])
```

> **Note:** Gesture events are shared across all widgets on the active page. Only handle gestures that make sense for your widget, and only when your widget is in a state where the gesture should apply.

---

## Registry Widget Bundle Format

Registry widgets are distributed as **pre-built ESM bundles**.

### Build Requirements

- Bundle format: **ESM** (`.esm.js` or `.mjs`)
- React must be marked as **external** — the mirror runtime provides it
- No CSS file imports
- Single output file (no code splitting / chunks)

### Example Vite Build Config for a Registry Widget

```ts
// vite.config.ts (in your widget's own repo)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.tsx',
      formats: ['es'],
      fileName: () => 'bundle.esm.js'
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React'
        }
      }
    }
  },
  plugins: [react()]
})
```

### Output Structure

Your widget repo's release should contain:

```
bundle.esm.js    ← the component bundle
manifest.json    ← the widget manifest (same shape as WidgetManifest type)
```

---

## registry.json Format

This file lives in your widget registry GitHub repo and is fetched by the mirror.

```json
{
  "version": "1",
  "updatedAt": "2026-03-21T00:00:00Z",
  "widgets": [
    {
      "id": "weather",
      "name": "Weather",
      "version": "1.2.0",
      "description": "Current conditions and 3-day forecast from OpenWeather",
      "author": "your-github-username",
      "minSize": { "cols": 4, "rows": 3 },
      "bundleUrl": "https://github.com/your-org/smart-mirror-widgets/releases/download/weather-v1.2.0/bundle.esm.js",
      "manifestUrl": "https://github.com/your-org/smart-mirror-widgets/releases/download/weather-v1.2.0/manifest.json",
      "configSchema": {
        "apiKey": {
          "type": "string",
          "label": "OpenWeather API Key",
          "secret": true,
          "required": true
        },
        "lat": { "type": "number", "label": "Latitude", "required": true },
        "lon": { "type": "number", "label": "Longitude", "required": true },
        "units": {
          "type": "select",
          "label": "Units",
          "options": ["metric", "imperial"],
          "default": "metric"
        }
      }
    }
  ]
}
```

---

## Bundled Widgets

Bundled widgets are part of `src/renderer/src/widgets/` and compiled into the Electron bundle. They follow the same component contract but are registered in `lib/widget-types.ts`:

```ts
// src/renderer/src/lib/widget-types.ts
import ClockWidget, { manifest as clockManifest } from '../widgets/clock'
import SystemStatsWidget, { manifest as systemStatsManifest } from '../widgets/system-stats'

export const BUNDLED_WIDGETS: Record<
  string,
  {
    component: React.ComponentType<WidgetProps>
    manifest: WidgetManifest
  }
> = {
  clock: { component: ClockWidget, manifest: clockManifest },
  'system-stats': { component: SystemStatsWidget, manifest: systemStatsManifest }
}
```

`WidgetWrapper` checks `BUNDLED_WIDGETS[widgetId]` before attempting a `widget://` dynamic import.

---

## Widget Checklist

Before publishing a registry widget:

- [ ] Default export is a valid React component accepting `WidgetProps`
- [ ] `manifest.json` is valid and matches the `WidgetManifest` schema
- [ ] `minSize` is set to the actual minimum usable size
- [ ] React is external in build config (not bundled)
- [ ] No CSS file imports
- [ ] All config fields have a `label`
- [ ] Secret fields (`secret: true`) are not logged or displayed in the widget UI
- [ ] Component is wrapped in `w-full h-full` or equivalent sizing
- [ ] Theme CSS variables used for colors (not hardcoded hex)
- [ ] `useEffect` gesture subscriptions return the cleanup function
- [ ] Component does not crash on empty/undefined config values (use `?? default` guards)
