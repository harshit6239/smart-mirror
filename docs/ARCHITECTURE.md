# Smart Mirror — System Architecture

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Raspberry Pi                                 │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Electron Process                           │   │
│  │                                                              │   │
│  │  ┌─────────────────┐        ┌──────────────────────────┐    │   │
│  │  │   Main Process  │◄──IPC──│   Renderer Process       │    │   │
│  │  │                 │        │   (Mirror UI)             │    │   │
│  │  │  AppConfig      │──IPC──►│                          │    │   │
│  │  │  WiFiService    │        │   PageSystem              │    │   │
│  │  │  CompanionSvr   │        │   WidgetGrid              │    │   │
│  │  │  WidgetRegistry │        │   NotificationOverlay     │    │   │
│  │  │  AutomationSvc  │        │   ThemeProvider           │    │   │
│  │  │  Scheduler      │        │                          │    │   │
│  │  │                 │        │  Bundled widgets          │    │   │
│  │  │  widget://      │        │  + Dynamic widgets via    │    │   │
│  │  │  protocol       │        │    widget:// imports      │    │   │
│  │  └────────┬────────┘        └──────────────────────────┘    │   │
│  │           │                                                   │   │
│  │           │ WebSocket client                                  │   │
│  └───────────┼───────────────────────────────────────────────────┘  │
│              │                                                       │
│              ▼                                                       │
│  ┌───────────────────────┐      ┌────────────────────────────────┐  │
│  │   Gesture Service     │      │  CompanionServer  :8080        │  │
│  │   (Python)            │      │                                │  │
│  │                       │      │  REST API  /api/*              │  │
│  │  Hand tracking        │      │  WebSocket /ws                 │  │
│  │  Gesture detection    │      │  Static    / (Companion SPA)   │  │
│  │  WebSocket server     │      │  Widgets   /widgets/:id/...    │  │
│  └───────────────────────┘      └─────────────────┬──────────────┘  │
│                                                   │                  │
└───────────────────────────────────────────────────┼──────────────────┘
                                                    │ HTTP / WebSocket
                                                    │ (local WiFi)
                                                    ▼
                                       ┌────────────────────────┐
                                       │  Phone Browser         │
                                       │  Companion SPA         │
                                       │                        │
                                       │  Layout Editor         │
                                       │  Widget Store          │
                                       │  Widget Config         │
                                       │  System Settings       │
                                       │  Notifications         │
                                       └────────────────────────┘
```

---

## Process Architecture

### Main Process (`src/main/`)

The Electron main process is the backbone. It owns all I/O and system access:

| Service                 | Responsibility                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AppConfig`             | Typed `electron-store` wrapper. Single source of truth for all persistent state.                                                                       |
| `WebSocketService`      | Client WebSocket that connects to the Python gesture service. Broadcasts gesture events to renderer via IPC. Auto-reconnects with exponential backoff. |
| `CompanionServer`       | HTTP/WebSocket server for phone companion app. Handles REST API + real-time push.                                                                      |
| `WiFiService`           | Wraps `nmcli` via `child_process.exec`. Manages hotspot mode on first launch and home WiFi connection.                                                 |
| `AutomationService`     | Tracks last gesture timestamp → sleep display after timeout. Time-based brightness control.                                                            |
| `WidgetRegistryService` | Fetches widget manifest from GitHub, caches to disk, downloads widget bundles on install.                                                              |
| `Scheduler`             | Loads `node-cron` jobs for widget schedules. Merges config overrides at cron time.                                                                     |
| `widget://` protocol    | Custom Electron protocol handler. Serves `userData/widgets/<id>/<version>/bundle.esm.js` to renderer for dynamic import.                               |

### Renderer Process (`src/renderer/`)

The mirror fullscreen UI. Receives data via IPC, never makes direct system calls.

```
App.tsx
  ├── SetupPage.tsx        (shown if wifi.configured = false)
  └── MirrorPage.tsx
        ├── ThemeProvider  (CSS custom properties on :root)
        ├── PageSystem
        │     ├── PageDots
        │     └── [ActivePage]
        │           └── WidgetGrid
        │                 └── WidgetWrapper   (× N widgets)
        │                       └── <Widget component>
        └── NotificationOverlay
```

### Companion Process (`src/companion/`)

A second Vite renderer entry, served as static files by `CompanionServer`. Runs entirely in the phone's browser — no Electron APIs. Communicates only via HTTP REST and WebSocket to `CompanionServer`.

---

## Data Flow

### Gesture → Page Navigation

```
Camera (Pi)
  → gesture_service (Python, hand tracking + ML)
  → WebSocket message { type: "gesture", gesture: "SWIPE_LEFT" }
  → WebSocketService (main process, receives message)
  → IPC broadcast "gesture-event" to renderer
  → useGesture() hook (renderer)
  → PageSystem.tsx updates active page
  → writes new page index to AppConfig
  → config-changed IPC event
  → CompanionServer WebSocket broadcasts to phone
  → Companion HomePage updates active page indicator
```

### Companion Config Change → Mirror Update

```
Companion SPA (phone browser)
  → PUT /api/settings { theme: 'dark-blue' }
  → CompanionServer (main process)
  → AppConfig.set('settings.theme', 'dark-blue')
  → onConfigChange callback fires
  → IPC "config-changed" to renderer
  → ThemeProvider applies new CSS custom properties
  → CompanionServer WebSocket broadcasts { type: 'config-changed' } to all WS clients
```

### Widget Install Flow

```
Companion WidgetStore
  → POST /api/widgets/install { widgetId: 'todo', version: '1.2.0' }
  → CompanionServer → WidgetRegistryService.installWidget()
  → Fetch bundle from GitHub Release asset URL
  → Save to userData/widgets/todo/1.2.0/bundle.esm.js
  → AppConfig.installedWidgets.push({ id: 'todo', version: '1.2.0', manifest })
  → IPC broadcast "widget-installed"
  → Renderer receives event (no reload needed)
  → Widget now available in useWidget() hook via widget:// protocol
  → User adds widget via companion layout editor
  → WidgetWrapper renders it via dynamic import
```

---

## Storage Layout

All persistent data lives in `app.getPath('userData')`:

```
userData/
  config.json             ← electron-store (AppConfig)
  registry-cache.json     ← GitHub registry, refreshed every 1h
  widgets/
    clock/
      1.0.0/
        bundle.esm.js
        manifest.json
    todo/
      1.2.0/
        bundle.esm.js
        manifest.json
```

`AppConfig` shape (TypeScript):

```ts
interface AppConfig {
  wifi: {
    configured: boolean
  }
  pages: Array<{
    id: string
    name: string
    widgetInstanceIds: string[]
  }>
  widgetInstances: Record<
    string,
    {
      id: string
      widgetId: string
      version: string
      config: Record<string, unknown>
      layout: { col: number; row: number; colSpan: number; rowSpan: number }
      schedule?: Array<{ cron: string; configOverride: Record<string, unknown> }>
    }
  >
  installedWidgets: Array<{
    id: string
    version: string
    manifest: WidgetManifest
  }>
  settings: {
    theme: string
    wakeTimeoutMs: number // 0 = disabled
    brightnessDay: number // 0–255
    brightnessNight: number
    brightnessSchedule: {
      dayStart: string // "HH:MM"
      nightStart: string
    }
  }
}
```

---

## IPC Channel Reference

| Channel             | Direction                | Payload                 | Description                               |
| ------------------- | ------------------------ | ----------------------- | ----------------------------------------- |
| `gesture-event`     | main → renderer          | `string` (JSON)         | Raw gesture data from gesture service     |
| `config:get`        | renderer → main          | `string` (key path)     | Read a config value                       |
| `config:set`        | renderer → main          | `{ key, value }`        | Write a config value                      |
| `config:subscribe`  | renderer → main          | `string` (key path)     | Subscribe to config changes               |
| `config-changed`    | main → renderer          | `{ key, value }`        | Fired when config changes                 |
| `wifi-connected`    | main → renderer          | —                       | WiFi setup complete, transition to mirror |
| `send-notification` | main → renderer          | `Notification`          | Display overlay notification              |
| `system:stats`      | renderer → main (invoke) | —                       | Returns `{ cpu, ram, temp }`              |
| `widget-installed`  | main → renderer          | `{ widgetId, version }` | New widget available                      |
| `update-available`  | main → renderer          | `{ version }`           | OTA update detected                       |

---

## CompanionServer REST API

Base: `http://<mirror-ip>:8080`

All responses are JSON. Error responses: `{ error: string }`.

### System

| Method | Path                  | Description                                           |
| ------ | --------------------- | ----------------------------------------------------- |
| `GET`  | `/api/status`         | Mirror status: gesture connection, current page, WiFi |
| `POST` | `/api/system/restart` | Relaunch Electron app                                 |

### WiFi

| Method | Path                | Description                |
| ------ | ------------------- | -------------------------- |
| `GET`  | `/api/wifi/status`  | Current connection status  |
| `GET`  | `/api/wifi/scan`    | Available networks         |
| `POST` | `/api/wifi/connect` | Body: `{ ssid, password }` |

### Layout & Config

| Method | Path                             | Description                           |
| ------ | -------------------------------- | ------------------------------------- |
| `GET`  | `/api/layouts`                   | All pages + widget instance positions |
| `PUT`  | `/api/layouts`                   | Replace full layout                   |
| `GET`  | `/api/widget-config/:instanceId` | Widget instance config values         |
| `PUT`  | `/api/widget-config/:instanceId` | Update widget instance config         |
| `GET`  | `/api/settings`                  | App settings                          |
| `PUT`  | `/api/settings`                  | Update app settings                   |

### Widget Registry

| Method   | Path                    | Description                   |
| -------- | ----------------------- | ----------------------------- |
| `GET`    | `/api/widgets/registry` | Full widget registry (cached) |
| `POST`   | `/api/widgets/install`  | Body: `{ widgetId, version }` |
| `DELETE` | `/api/widgets/:id`      | Uninstall widget              |

### Notifications

| Method | Path                 | Description                                |
| ------ | -------------------- | ------------------------------------------ |
| `POST` | `/api/notifications` | Body: `{ type, title, body, durationMs? }` |

---

## CompanionServer WebSocket Events

Connect to: `ws://<mirror-ip>:8080/ws`

### Server → Client

```ts
{ type: 'gesture', gesture: string, gesture_type: string }
{ type: 'page-change', pageIndex: number, pageId: string }
{ type: 'config-changed', key: string, value: unknown }
{ type: 'notification', notification: Notification }
{ type: 'widget-installed', widgetId: string, version: string }
{ type: 'update-available', version: string }
```

### Client → Server

```ts
{
  type: 'ping'
} // keepalive
```

---

## Widget Loading Strategy

Widgets are loaded in two ways:

### 1. Bundled Widgets

Compiled into the renderer bundle at build time. Registered in a static `BUNDLED_WIDGETS` map:

```ts
const BUNDLED_WIDGETS: Record<string, React.ComponentType<WidgetProps>> = {
  clock: ClockWidget,
  'system-stats': SystemStatsWidget
  // ...
}
```

`WidgetWrapper` checks this map first — if found, renders directly (no dynamic import).

### 2. Installed Widgets

Downloaded from the widget registry at runtime. Stored in `userData/widgets/`.

The `widget://` Electron protocol maps:

```
widget://todo/1.2.0/bundle.esm.js
  → userData/widgets/todo/1.2.0/bundle.esm.js
```

`useWidget()` hook calls:

```ts
const mod = await import('widget://todo/1.2.0/bundle.esm.js')
// mod.default is the React component
```

Bundles are cached in a module-level `Map` after first load. No restart required after install.

### Widget Bundle Format

Each bundle is a self-contained ESM file:

- Default export: a React component
- React is **not** bundled — bundles should mark `react` as external and rely on the renderer's React instance
- Bundle should be built with `rollup` or `vite build --lib`

---

## WiFi Provisioning Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  App Cold Start                                                  │
│                                                                  │
│  config.wifi.configured?                                         │
│       │                                                          │
│      NO                                YES                       │
│       │                                 │                        │
│       ▼                                 ▼                        │
│  wifi.startHotspot()              Normal Mirror UI               │
│  "SmartMirror-Setup" / "mirror1234"                              │
│       │                                                          │
│  SetupPage renders                                               │
│  QR → http://10.42.0.1:8080                                      │
│       │                                                          │
│  Phone joins AP, opens URL                                       │
│       │                                                          │
│  Companion WifiSetupPage                                         │
│  → scan list → enter password                                    │
│  → POST /api/wifi/connect                                        │
│       │                                                          │
│  CompanionServer calls                                           │
│  wifi.connectToNetwork(ssid, pass)                               │
│       │                                                          │
│  Success?                                                        │
│   YES → wifi.stopHotspot()                                       │
│       → config.set('wifi.configured', true)                      │
│       → IPC broadcast 'wifi-connected'                           │
│       → Renderer: navigate to MirrorPage                         │
│   NO  → Return error → Companion shows retry message             │
└──────────────────────────────────────────────────────────────────┘
```

**NetworkManager / nmcli commands used:**

```bash
# Create hotspot
nmcli device wifi hotspot ssid SmartMirror-Setup password mirror1234

# Scan networks
nmcli -t -f SSID,SIGNAL device wifi list

# Connect to home network
nmcli device wifi connect <SSID> password <PASSWORD>

# Stop hotspot (disconnect the hotspot connection)
nmcli connection delete SmartMirror-Setup
```

---

## Theme System

Themes are defined as CSS custom property sets in `lib/themes.ts`:

```ts
interface Theme {
  id: string
  name: string
  vars: {
    '--color-bg': string
    '--color-surface': string
    '--color-text': string
    '--color-text-muted': string
    '--color-accent': string
    '--color-border': string
    '--font-sans': string
    '--radius': string
  }
}
```

`ThemeProvider` applies the active theme's vars to `:root` as a `<style>` tag. Swapping themes is instant — no re-render of widget components required.

---

## Security Notes

- CompanionServer is HTTP-only on the local network (no TLS). This is acceptable for a local-only device.
- Auth middleware slot exists in `CompanionServer` — swap in PIN middleware without touching routes.
- `secret: true` config fields are stored encrypted in `electron-store` (AES-256 via `safeStorage`) and never returned in plaintext from the API after being set.
- The `widget://` protocol serves only from `userData/widgets/` — no path traversal is possible by construction (Electron's `protocol.handle` callback validates the path prefix).
- Widget bundles from your own GitHub registry are trusted. Third-party registry support (if added later) should sandbox widgets in iframes.
