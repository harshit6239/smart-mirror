# Smart Mirror — Codebase Reference

> Quick-reference for all IPC channels, window APIs, config schema, and file purposes.
> Update this file when adding new IPC channels or API surface.

---

## Project Structure at a Glance

```
src/
  main/
    index.ts                          ← Entry: creates window, wires services + IPC
    config/
      app-config.ts                   ← AppConfig type + electron-store singleton
      ipc.config.ts                   ← Stub (gesture IPC pending P5)
    services/
      wifi.service.ts                 ← nmcli wrapper; stubs on non-Linux
      companion-server.service.ts     ← HTTP :8080 — setup page + REST API
      websocket.service.ts            ← WS client → Python gesture service
  preload/
    index.ts                          ← contextBridge — exposes window.config + window.api
    index.d.ts                        ← TypeScript types for renderer globals
  renderer/src/
    App.tsx                           ← Routes: SetupPage | MirrorPage
    pages/
      SetupPage.tsx                   ← WiFi provisioning UI (mirror side)
      MirrorPage.tsx                  ← Renders <PageSystem />
    hooks/
      useGesture.ts                   ← GestureType events + arrow-key dev fallback
      useConfig.ts                    ← Reactive slice of AppConfig
    ui/
      PageSystem/
        PageSystem.tsx                ← Slide animation, gesture navigation
        PageDots.tsx                  ← Always-visible page indicator
      WidgetGrid/
        WidgetGrid.tsx                ← 12×8 CSS grid host
        WidgetWrapper.tsx             ← ErrorBoundary + CSS grid placement
    lib/
      widget-types.ts                 ← WidgetProps, WidgetManifest interfaces
      widget-registry.ts             ← BUNDLED_WIDGETS map
    widgets/
      dummy/DummyWidget.tsx           ← Dev placeholder widget
      clock/Clock.tsx                 ← User-written clock (pre-existing, needs P4 integration)
docs/
  PLAN.md                             ← Phased implementation plan
  PROGRESS.md                         ← Active progress tracker (this file's sibling)
  ARCHITECTURE.md                     ← System architecture diagram
  WIDGET_SPEC.md                      ← Widget authoring contract
  UI_DESIGN_RULES.md                  ← Black bg / white text constraints
  CODEBASE.md                         ← This file
```

---

## AppConfig Schema

Defined in `src/main/config/app-config.ts`:

```ts
interface AppConfig {
  wifi: {
    configured: boolean // false = show SetupPage
    ssid: string | null
  }
  pages: Page[]
  widgetInstances: Record<string, WidgetInstance>
  installedWidgets: Record<string, InstalledWidget>
}

interface Page {
  id: string
  name: string
  widgetIds: string[] // ordered list of WidgetInstance IDs on this page
}

interface WidgetInstance {
  id: string
  widgetId: string // key into BUNDLED_WIDGETS / installedWidgets
  version: string
  config: Record<string, unknown> // widget-specific settings (pass to WidgetProps.config)
  layout: {
    col: number // 1-based, CSS grid-column-start
    row: number // 1-based, CSS grid-row-start
    colSpan: number // how many columns wide
    rowSpan: number // how many rows tall
  }
}

interface InstalledWidget {
  id: string
  name: string
  version: string
  entryPoint: string // path to widget bundle
}
```

Default seed (main process, first run):

- 3 pages: `{ id: 'home', name: 'Home' }`, `{ id: 'media', name: 'Media' }`, `{ id: 'info', name: 'Info' }`
- 1 widget instance: `instance-dummy-1` — `widgetId: 'dummy'`, placed on page `home`

---

## IPC Channel Reference

All channels use Electron `ipcMain` / `ipcRenderer`.

### Config Channels (bidirectional)

| Channel          | Direction              | Payload                      | Notes                                    |
| ---------------- | ---------------------- | ---------------------------- | ---------------------------------------- |
| `config:get`     | renderer→main (invoke) | `key: keyof AppConfig \| ''` | Returns full config if key is `''`       |
| `config:set`     | renderer→main (invoke) | `{ key, value }`             | Deep-set using `store.set`               |
| `config:changed` | main→renderer (send)   | `Partial<AppConfig>`         | Pushed whenever any config value changes |

### WiFi Channels

| Channel          | Direction            | Payload            | Notes                                 |
| ---------------- | -------------------- | ------------------ | ------------------------------------- |
| `wifi:connected` | main→renderer (send) | `{ ssid: string }` | Sent when WiFi provisioning completes |

### Gesture Channels _(planned — Phase 5)_

| Channel            | Direction            | Payload                 | Notes                                 |
| ------------------ | -------------------- | ----------------------- | ------------------------------------- |
| `gesture:detected` | main→renderer (send) | `{ type: GestureType }` | `websocket.service.ts` will send this |

---

## window.config API (renderer-side)

Exposed via `contextBridge` in preload:

```ts
window.config = {
  get: (key?: string) => Promise<any>
  set: (key: string, value: unknown) => Promise<void>
  onChange: (cb: (config: Partial<AppConfig>) => void) => () => void  // returns unsub fn
}
```

Usage example:

```ts
const pages = await window.config.get('pages')
await window.config.set('wifi.configured', true)
const unsub = window.config.onChange((cfg) => console.log(cfg))
// later: unsub()
```

---

## window.api API (renderer-side)

```ts
window.api = {
  onGesture: (cb: (gesture: { type: GestureType }) => void) => () => void
  onWifiConnected: (cb: (data: { ssid: string }) => void) => () => void
}
```

`GestureType = 'SWIPE_LEFT' | 'SWIPE_RIGHT' | 'SWIPE_UP' | 'SWIPE_DOWN'`

---

## useConfig Hook

```ts
const [value, setValue] = useConfig<T>('pages')
// setValue triggers config:set IPC + local state update
```

Hook listens to `config:changed` automatically — always live.

---

## useGesture Hook

```ts
useGesture((gestureType) => {
  // 'SWIPE_LEFT' | 'SWIPE_RIGHT' | 'SWIPE_UP' | 'SWIPE_DOWN'
})
```

In dev (no IPC), arrow keys fire the equivalent gesture.

---

## Widget Authoring Contract

Full spec in `docs/WIDGET_SPEC.md`. Summary:

```ts
// A widget is a React component:
export const MyWidget: React.FC<WidgetProps> = ({ instanceId, config }) => { ... }

// WidgetProps:
interface WidgetProps {
  instanceId: string
  config: Record<string, unknown>
}
```

Register it in `src/renderer/src/lib/widget-registry.ts`:

```ts
export const BUNDLED_WIDGETS: Record<string, React.ComponentType<WidgetProps>> = {
  dummy: DummyWidget,
  clock: ClockWidget // ← add here
}
```

Widget layout comes from `WidgetInstance.layout` — no layout logic in the widget itself.
Widgets must: use `bg-transparent`, place text on `text-white` or `text-white/[opacity]`, never use a colored background.

---

## Companion Server Endpoints

Base URL (from phone on hotspot): `http://10.42.0.1:8080`

| Method | Path                | Description                                              |
| ------ | ------------------- | -------------------------------------------------------- |
| GET    | `/`                 | Mobile WiFi setup HTML page                              |
| GET    | `/api/wifi/status`  | `{ connected: bool, ssid: string \| null }`              |
| GET    | `/api/wifi/scan`    | `{ networks: Array<{ ssid, signal, security }> }`        |
| POST   | `/api/wifi/connect` | Body: `{ ssid, password }` → `{ success: bool, error? }` |

---

## WebSocket Service (Gesture)

`src/main/services/websocket.service.ts` — **intact, not yet wired to gesture IPC**

- Connects to `process.env.MAIN_VITE_WS_URL` (default `ws://localhost:8765`)
- Reconnects on disconnect
- Current state: parses gestures, broadcasts via `BrowserWindow.getAllWindows()` but channel name not yet set up in preload/renderer — **Phase 5 work**

---

## Environment Variables

| Variable           | Used in                | Default               | Notes                         |
| ------------------ | ---------------------- | --------------------- | ----------------------------- |
| `MAIN_VITE_WS_URL` | `websocket.service.ts` | `ws://localhost:8765` | Python gesture service WS URL |

---

## Typecheck Commands

```bash
# Main + preload
npm run typecheck:node

# Renderer (override tsconfig.web.json "ignoreDeprecations": "6.0" — intentional, do not change file)
npx tsc --noEmit -p tsconfig.web.json --composite false --ignoreDeprecations 5.0
```
