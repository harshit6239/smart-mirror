# Smart Mirror UI — Phased Implementation Plan

> **Philosophy:** Each phase is small enough to implement in a single session, individually testable before moving to the next, and has a clear "done" condition. Phases are topologically ordered — nothing in a later phase depends on something not yet built.

---

## Repository Structure (Clean-Slate)

```
src/
  main/
    index.ts
    config/
      ipc.config.ts
      app-config.ts                 ← electron-store schema & typed getters/setters
    services/
      websocket.service.ts          ← existing (keep as-is)
      companion-server.service.ts   ← replaces setup-server.service.ts
      wifi.service.ts               ← nmcli wrapper
      automation.service.ts         ← wake/sleep, display brightness
      widget-registry.service.ts    ← GitHub registry fetch + disk cache
    protocol/
      widget-protocol.ts            ← widget:// custom Electron protocol

  preload/
    index.ts
    index.d.ts                      ← extended with new IPC channel types

  renderer/                         ← mirror screen (fullscreen, gesture-only)
    index.html
    src/
      main.tsx
      App.tsx
      env.d.ts
      assets/
      pages/
        SetupPage.tsx               ← WiFi provisioning screen
        MirrorPage.tsx              ← the actual mirror
      ui/
        PageSystem/
          PageSystem.tsx
          PageDots.tsx
        WidgetGrid/
          WidgetGrid.tsx
          WidgetWrapper.tsx         ← error boundary + Suspense
        NotificationOverlay.tsx
        ThemeProvider.tsx
      widgets/                      ← all bundled widgets
        clock/
        weather/
        calendar/
        news/
        spotify/
        system-stats/
        todo/
        stocks/
      hooks/
        useWidget.ts
        useGesture.ts
        useConfig.ts
      lib/
        themes.ts
        widget-types.ts             ← WidgetManifest, WidgetProps, WidgetInstance

  companion/                        ← phone config web app (second Vite entry)
    index.html
    src/
      main.tsx
      App.tsx
      pages/
        HomePage.tsx
        LayoutEditor.tsx
        WidgetStore.tsx
        WidgetConfig.tsx
        SystemSettings.tsx
        NotificationsPage.tsx
        WifiSetupPage.tsx
      components/
        WidgetConfigForm.tsx        ← auto-renders from widget configSchema
        GridEditor.tsx
      lib/
        api.ts                      ← typed fetch wrapper for CompanionServer

docs/
  PLAN.md                           ← this file
  ARCHITECTURE.md                   ← system design
  WIDGET_SPEC.md                    ← widget authoring contract
```

---

## Package Additions

| Package             | Added in Phase |
| ------------------- | -------------- |
| `electron-store`    | P0             |
| `react-router-dom`  | P6             |
| `react-grid-layout` | P7             |
| `node-cron`         | P14            |
| `ical.js`           | P12            |

---

## Implementation Phases

> **Parallelism notes:** P1 and P2 can be worked simultaneously (P2 does not require a Pi). P11 widgets (weather, news, stocks) can all be built in parallel with each other.

---

### Phase 0 — Config Foundation

**Unblocks:** Everything

**Build:**

- Install `electron-store`
- Define `AppConfig` TypeScript type:
  ```ts
  {
    wifi: { configured: boolean },
    pages: Page[],
    widgetInstances: Record<string, WidgetInstance>,
    installedWidgets: InstalledWidget[],
    settings: { theme: string, wakeTimeoutMs: number, brightnessDay: number, brightnessNight: number, brightnessSchedule: { dayStart: string, nightStart: string } }
  }
  ```
- `app-config.ts` — typed `getConfig()`, `setConfig()`, `onConfigChange(key, cb)` wrappers
- IPC handlers: `config:get`, `config:set`, `config:subscribe`
- Preload exposes `window.config.get()`, `window.config.set()`, `window.config.onChange()`

**Done when:** Renderer writes a value via preload, hard-refreshes, reads it back — value persisted to disk.

---

### Phase 1 — WiFi Provisioning

**Depends on:** P0

**Build:**

- `wifi.service.ts` wrapping `nmcli`:
  - `isConnected(): Promise<boolean>`
  - `startHotspot(ssid, password): Promise<void>` — uses `nmcli device wifi hotspot`
  - `stopHotspot(): Promise<void>`
  - `scanNetworks(): Promise<{ ssid, signal }[]>`
  - `connectToNetwork(ssid, password): Promise<boolean>`
- `CompanionServer` (minimal): HTTP on port 8080, endpoints:
  - `GET /api/wifi/status`
  - `GET /api/wifi/scan`
  - `POST /api/wifi/connect` → `{ ssid, password }`
- `SetupPage.tsx`:
  - Displays AP SSID + password as text
  - Renders QR code (using `qrcode` — already installed) pointing to `http://10.42.0.1:8080`
  - Listens for `wifi-connected` IPC event → transitions to blank `MirrorPage`
- `App.tsx` checks `config.wifi.configured` on startup to route to `SetupPage` vs `MirrorPage`
- Companion `WifiSetupPage.tsx`: scan list, password field, submit

**WiFi AP Flow (end-to-end):**

1. App starts → `wifi.isConnected()` returns false
2. Main calls `wifi.startHotspot('SmartMirror-Setup', 'mirror1234')`
3. Pi creates `10.42.0.1` subnet; `CompanionServer` listens on `0.0.0.0:8080`
4. Mirror renders `SetupPage` with QR code → `http://10.42.0.1:8080`
5. Phone joins `SmartMirror-Setup` hotspot, scans QR, opens companion in browser
6. User picks home WiFi from scan list, enters password, submits
7. `CompanionServer` calls `wifi.connectToNetwork(ssid, pass)`
8. On success: `wifi.stopHotspot()`, `config.set('wifi.configured', true)`, broadcast IPC `wifi-connected`
9. Renderer receives `wifi-connected` → navigate to `MirrorPage`

**Done when:** On Pi, cold-start with no WiFi config → setup screen with QR, phone scans → companion opens → enter home WiFi → mirror transitions to blank white page.

---

### Phase 2 — Page System

**Depends on:** P0  
**Parallel with:** P1 (does not require Pi)

**Build:**

- Remove old `UI.tsx` counter debug code
- `useGesture.ts` hook — wraps `window.api.onGesture`, exposes typed gesture stream
- `PageSystem.tsx`:
  - Reads `pages[]` from config store
  - `useGesture` listens for `SWIPE_LEFT` (next page) / `SWIPE_RIGHT` (prev page)
  - Clamped navigation (no wrap-around)
  - CSS slide transition between pages
- `PageDots.tsx` — bottom center indicator dots, highlights active
- Default config bootstraps 3 empty named pages on first run if `pages` is empty
- `MirrorPage.tsx` renders `<PageSystem />`

**Done when:** 3 pages exist, swiping left/right cycles through them with a slide animation, dots update, current page persists across renderer reload (stored in config).

---

### Phase 3 — Widget Grid Framework

**Depends on:** P2

**Build:**

- `widget-types.ts`:
  ```ts
  interface WidgetInstance {
    id: string // unique instance ID
    widgetId: string // e.g. 'clock'
    version: string // e.g. '1.0.0'
    config: Record<string, unknown>
    layout: { col: number; row: number; colSpan: number; rowSpan: number }
  }
  ```
- `WidgetGrid.tsx` — 12-column CSS grid; maps `page.widgetInstanceIds[]` to positioned `WidgetWrapper` slots
- `WidgetWrapper.tsx`:
  - React `ErrorBoundary` — catches widget crashes, renders fallback skeleton
  - `React.Suspense` — shows loading skeleton while widget bundle loads
  - Passes `{ config, instanceId }` props to widget component
- Hardcode one dummy component (`DummyWidget` — just renders `<div>Hello from {instanceId}</div>`) placed at `col:1, row:1, colSpan:3, rowSpan:2` on page 1

**Done when:** Dummy widget appears at the correct grid position. Throw an error inside it → fallback skeleton renders, rest of UI unaffected.

---

### Phase 4 — Bundled Widgets: Clock + System Stats

**Depends on:** P3

**Build:**

- `BUNDLED_WIDGETS` map in `widget-types.ts` — `Record<string, React.ComponentType<WidgetProps>>`
- `WidgetWrapper` resolves bundled widgets from this map (no dynamic import yet)
- `widgets/clock/index.tsx`:
  - Live time with `setInterval` every second
  - Config: `{ timezone: string, use24h: boolean }`
  - Reads from `config` prop
- `widgets/system-stats/index.tsx`:
  - Polls IPC `system:stats` every 3 seconds
  - Main process handler reads `/proc/stat`, `/proc/meminfo`, `/sys/class/thermal/thermal_zone0/temp`
  - Gracefully skips temp if not available (non-Pi)
- Add both to page 1 defaults in AppConfig bootstrap

**Done when:** Clock ticks live. System stats update every 3s. On dev machine, clock works and stats show CPU/RAM (temp shows N/A gracefully).

---

### Phase 5 — Companion Server: Full REST + WebSocket

**Depends on:** P0, P1

**Build:**

- Expand `CompanionServer` with complete API:
  - `GET  /api/status` — `{ connectedToGesture, currentPage, wifiConfigured }`
  - `GET  /api/layouts` — all pages + widget instances
  - `PUT  /api/layouts` — replace full layout, triggers IPC → renderer re-renders
  - `GET  /api/widget-config/:instanceId`
  - `PUT  /api/widget-config/:instanceId`
  - `GET  /api/settings`
  - `PUT  /api/settings`
  - `POST /api/notifications` — `{ type, title, body, durationMs? }`
  - `GET  /api/widgets/registry` — proxy/cached registry from GitHub
  - `POST /api/widgets/install` — `{ widgetId, version }`
  - `DELETE /api/widgets/:id`
  - `POST /api/system/restart`
- WebSocket at `ws://<host>:8080/ws`:
  - Server → client events: `gesture`, `page-change`, `config-changed`, `notification`, `widget-installed`
- Auth middleware slot: `server.use(authMiddleware)` — passthrough now, swappable later without breaking routes

**Done when:** `curl http://<mirror-ip>:8080/api/status` returns JSON. Connect to `/ws` with a WebSocket client (e.g. `wscat`), swipe on mirror → event appears in client.

---

### Phase 6 — Companion SPA: Shell + System Settings

**Depends on:** P5

**Build:**

- Configure second Vite entry in `electron.vite.config.ts` for `src/companion/` → `out/companion/`
- `CompanionServer` serves `out/companion/` as static root at `/`
- Companion app:
  - `react-router-dom` — routes: `/`, `/settings`, `/wifi`
  - `lib/api.ts` — typed `get<T>()`, `put<T>()`, `post<T>()` helpers; base URL = `window.location.origin`
  - `HomePage.tsx` — connection status badge, current active page name, last gesture display; polls `/api/status` every 2s
  - `SystemSettings.tsx` — theme dropdown (options from `themes.ts`), wake timeout slider, brightness day/night controls + time pickers → `PUT /api/settings`; mirror applies via config change subscription

**Done when:** Open companion on phone browser from same WiFi. Change theme → mirror skin changes in real-time (via WebSocket push + config subscription). Settings persist across mirror restart.

---

### Phase 7 — Companion SPA: Layout Editor

**Depends on:** P6, P3

**Build:**

- Install `react-grid-layout`
- Companion routes: `/layout`
- `LayoutEditor.tsx`:
  - Page tabs (add/remove/rename pages)
  - Grid preview of current page (12 cols × 8 rows)
  - Sidebar: list of installed + bundled widgets to drop in
  - Drag-and-drop resize + reposition
  - Save button → `PUT /api/layouts`
- Mirror receives `config-changed` WebSocket event → `PageSystem` re-renders live
- Mirror: add small persistent QR code widget (bottom-right corner) showing companion URL so phone can always find it

**Done when:** From phone companion, drag Clock to page 2, resize it, save → mirror reflects change live without restart. QR widget visible on mirror screen.

---

### Phase 8 — Dynamic Widget Protocol

**Depends on:** P3

**Build:**

- Register `widget://` Electron protocol in `main/index.ts` via `protocol.handle`:
  - `widget://<id>/<version>/bundle.esm.js` → serves file from `userData/widgets/<id>/<version>/bundle.esm.js`
- `widget-protocol.ts` — registration helper + type definitions
- `useWidget(id, version)` hook in `hooks/useWidget.ts`:
  - If `id` in `BUNDLED_WIDGETS` → return it directly
  - Else → `dynamic import('widget://<id>/<version>/bundle.esm.js')`
  - Caches loaded modules in module-level `Map`
- Migrate `WidgetWrapper` to use `useWidget` hook — bundled widgets still resolve identically
- Manually drop a minimal test widget bundle at `userData/widgets/test-widget/0.1.0/bundle.esm.js`:
  ```js
  export default function TestWidget() {
    return React.createElement('div', null, 'Dynamic Widget Works!')
  }
  ```

**Done when:** Test widget loads from `userData/` without restart. Clock and System Stats still work (regression check). Loading a non-existent widget shows Suspense skeleton then error fallback.

---

### Phase 9 — Widget Registry + Install

**Depends on:** P8, P5

**Build:**

- `widget-registry.service.ts`:
  - Fetches `registry.json` from your GitHub (configurable URL in `app-config.ts`)
  - Caches result in `userData/registry-cache.json`, refreshes every 1 hour
  - `listWidgets(): Promise<WidgetManifest[]>`
  - `installWidget(id, version): Promise<void>` — downloads bundle URL, saves to `userData/widgets/`, updates `installedWidgets` in config
  - `uninstallWidget(id): Promise<void>` — removes from disk + config
- IPC handlers: `registry:list`, `registry:install`, `registry:uninstall`
- `CompanionServer` routes already exist (P5) — wire them to registry service
- Companion `WidgetStore.tsx`:
  - Fetches `GET /api/widgets/registry`
  - Grid of widget cards with name, description, version, install/uninstall button
  - Installed badge on already-installed widgets
  - Install triggers progress → success → widget available in layout editor immediately

**Done when:** Publish a test widget to your GitHub registry → companion shows it in store → install completes → widget appears in `LayoutEditor` sidebar → drag to page → see it render on mirror.

---

### Phase 10 — Widget Config System

**Depends on:** P9, P6

**Build:**

- `WidgetConfigForm.tsx` — auto-generates form inputs from `configSchema`:
  - `type: 'string'` → text input
  - `type: 'number'` → number input
  - `type: 'boolean'` → toggle
  - `type: 'select'` → dropdown from `options[]`
  - `secret: true` → `<input type="password">`, value never shown in plaintext after save
- Companion `WidgetConfig.tsx` page:
  - Route `/widget-config/:instanceId`
  - Loads schema from installed widget manifest + current values from `GET /api/widget-config/:instanceId`
  - Renders `WidgetConfigForm`, submit → `PUT /api/widget-config/:instanceId`
- `WidgetWrapper` pre-fetches `config` from store and passes it as prop; subscribes to config changes → re-renders widget with new config live
- Layout editor: each widget card has a gear icon → link to `/widget-config/:instanceId`

**Done when:** Clock widget gains a `timezone` entry in its `configSchema`. Change timezone from companion → clock immediately shows correct time for new timezone. `secret` fields are masked.

---

### Phase 11 — API Widgets: Weather + News + Stocks

**Depends on:** P10  
**All three parallel**

**Build:**

- `widgets/weather/index.tsx`:
  - OpenWeather One Call API; current conditions + 3-day forecast
  - `configSchema: { apiKey: { type: 'string', secret: true }, lat: { type: 'number' }, lon: { type: 'number' }, units: { type: 'select', options: ['metric', 'imperial'] } }`
- `widgets/news/index.tsx`:
  - NewsAPI `/top-headlines`
  - `configSchema: { apiKey: { type: 'string', secret: true }, country: { type: 'string', default: 'us' }, category: { type: 'select', options: ['general','technology','science','health','sports','entertainment','business'] } }`
  - Auto-scrolling or swipeable headlines
- `widgets/stocks/index.tsx`:
  - CoinGecko free API (no key required)
  - `configSchema: { symbols: { type: 'string', label: 'Comma-separated coins, e.g. bitcoin,ethereum' } }`
  - Price + 24h % change

**Done when:** Configure API keys per-widget-instance from companion → each widget shows live data.

---

### Phase 12 — Calendar + Spotify Widgets

**Depends on:** P10 (Calendar), P5 (Spotify needs companion OAuth relay)

**Build:**

- `widgets/calendar/index.tsx`:
  - Install `ical.js`
  - Fetch iCal URL (works with Google Calendar "secret iCal address"), parse events
  - Show next 5 upcoming events with time + title
  - `configSchema: { icalUrl: { type: 'string', label: 'iCal URL (e.g. Google Calendar secret address)' } }`
- `widgets/spotify/index.tsx`:
  - OAuth flow via companion: phone opens Spotify login → companion catches redirect → stores `access_token` + `refresh_token` in widget config
  - Token refresh handled by main process on expiry
  - Mirror widget polls `/v1/me/player/currently-playing` every 5s
  - `configSchema: { accessToken: { type: 'string', secret: true }, refreshToken: { type: 'string', secret: true } }`
  - Companion `WidgetConfig` page for Spotify shows "Connect Spotify" button → launches OAuth

**Done when:** Add Google Calendar iCal URL → events appear. Spotify OAuth flow on phone completes → mirror shows currently playing track.

---

### Phase 13 — Wake/Sleep + Display Brightness

**Depends on:** P0, P5

**Build:**

- `automation.service.ts`:
  - Tracks last gesture event timestamp (subscribes to gesture IPC)
  - Timer checks every 30s if `Date.now() - lastGesture > wakeTimeoutMs`
  - If timed out: `vcgencmd display_power 0` (Pi only; no-op elsewhere)
  - On any gesture: `vcgencmd display_power 1`
  - Brightness automation: every minute, compare current time against `brightnessSchedule`; writes to `/sys/class/backlight/*/brightness` (finds the path dynamically)
- System Settings companion page gains: wake timeout slider (0 = disabled), brightness sliders for day/night + time pickers (built as stubs in P6, wired here)

**Done when:** On Pi: set 10s timeout for testing → hand idle → display off → wave hand → display on. Change brightness schedule → display dim/bright at configured times.

---

### Phase 14 — Widget Schedules

**Depends on:** P9

**Build:**

- Install `node-cron`
- Extend `WidgetInstance` config: `schedule?: Array<{ cron: string, configOverride: Partial<Record<string, unknown>> }>`
- `scheduler.service.ts`:
  - On init: load all widget instances, register cron jobs for each scheduled instance
  - When cron fires: merge `configOverride` into active config → IPC to renderer → widget re-renders
  - Separate cron to revert at end of window (or apply a different override)
  - Listens for `config-changed` to re-register jobs dynamically
- Companion `WidgetConfig` page: schedule section — add cron rows with time picker, config field overrides

**Done when:** Schedule Clock widget to switch to `use24h: false` at a 1-minute cron for testing → observe format change → revert job fires → format switches back.

---

### Phase 15 — Push Notifications

**Depends on:** P5

**Build:**

- `POST /api/notifications` already exists (P5 stub) — implement fully
- IPC `send-notification` → renderer `NotificationOverlay.tsx`:
  - Slides in from top, semi-transparent banner
  - Auto-dismisses after `durationMs` (default 5000ms)
  - Any gesture also dismisses
  - Queues multiple notifications
- Companion `NotificationsPage.tsx`:
  - Form: type (info / warning / alert), title, body, duration
  - Send button → `POST /api/notifications`

**Done when:** Send a notification from companion → mirror shows overlay → auto-dismisses. Gesture dismisses it. Second notification queues correctly after first.

---

### Phase 16 — OTA Updates

**Depends on:** P5

**Build:**

- Wire `electron-updater` (already in `package.json`) in `main/index.ts`:
  - `autoUpdater.setFeedURL(...)` pointed at your GitHub releases
  - `autoUpdater.checkForUpdatesAndNotify()` on startup
  - IPC events: `update-available`, `update-downloaded`
- On `update-available`: CompanionServer WebSocket broadcasts `{ type: 'update-available', version }`
- Companion `HomePage.tsx` shows "Update available — v{version}" banner with "Restart to apply" button
- `POST /api/system/restart` → `app.relaunch()`

**Done when:** Publish a GitHub release with bumped version → mirror detects it on next startup (or manual check) → companion shows banner → tap Restart → mirror restarts with new version.

---

## Gesture Mapping

Current gesture set:

| Gesture       | Action                                       |
| ------------- | -------------------------------------------- |
| `SWIPE_LEFT`  | Next page                                    |
| `SWIPE_RIGHT` | Previous page                                |
| `SWIPE_UP`    | _(available — assign in companion settings)_ |
| `SWIPE_DOWN`  | _(available — assign in companion settings)_ |

Future gestures (add to gesture service as needed):

- Pinch → dismiss notification / go back
- Open palm (hold) → toggle wake state
- Pinch + hold → enter page selector mode

Gesture → action mapping will be configurable from companion app System Settings.

---

## Testing Checklist (per phase)

Run these after each phase before starting the next:

| #   | Check                                                             |
| --- | ----------------------------------------------------------------- |
| P0  | Config value persists across renderer refresh                     |
| P1  | WiFi: setup page → AP → companion → connect → mirror transitions  |
| P2  | 3 pages, swipe cycles them, dots update, survives page reload     |
| P3  | Dummy widget in grid, error in widget → isolated fallback         |
| P4  | Clock ticks, stats update, no crash on non-Pi                     |
| P5  | `curl /api/status`, WebSocket receives gesture events             |
| P6  | Theme change from companion applies to mirror in real-time        |
| P7  | Layout editor: drag widget to new page → mirror reflects          |
| P8  | Test widget loads from userData, bundled widgets still work       |
| P9  | Registry install flow, widget in layout editor, renders on mirror |
| P10 | Config change from companion → widget re-renders with new value   |
| P11 | Each API widget shows live data with configured keys              |
| P12 | Calendar events appear, Spotify OAuth → now playing shows         |
| P13 | Display sleep/wake on Pi, brightness changes at scheduled time    |
| P14 | Scheduled config override fires and reverts on cron               |
| P15 | Notification overlay shows, auto-dismisses, queues correctly      |
| P16 | OTA update detected, companion banner, restart applies update     |
