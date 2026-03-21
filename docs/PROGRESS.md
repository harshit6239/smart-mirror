# Smart Mirror — Development Progress

> **Purpose:** Paste this file at the start of a new conversation to resume without losing context.
> Keep this updated as phases complete.

---

## Current Status

**Active phase:** Phase 7 — Layout Editor (Companion)
**Last completed:** Phase 6 — Companion Web App Shell

---

## Phase Completion

| #   | Phase                                 | Status  | Notes                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Config Foundation                     | ✅ Done | `electron-store`, `AppConfig` type, `config:get/set` IPC, `window.config` preload                                                                                                                                                                                                                                                           |
| 1   | WiFi Provisioning                     | ✅ Done | `WifiService` (nmcli, stubs on non-Linux), `CompanionServer` on :8080, `SetupPage.tsx` with QR, `App.tsx` routing                                                                                                                                                                                                                           |
| 2   | Page System                           | ✅ Done | `PageSystem`, `PageDots`, `useGesture` (arrow-key fallback), `useConfig`, default pages seeded                                                                                                                                                                                                                                              |
| 3   | Widget Grid Framework                 | ✅ Done | `WidgetGrid` (12×8 CSS grid), `WidgetWrapper` (ErrorBoundary + skeleton), `DummyWidget`, `widget-registry.ts`                                                                                                                                                                                                                               |
| —   | Cleanup                               | ✅ Done | Removed all user-written WS UI code (`ConnectionStatus`, `UI.tsx`, old IPC handlers)                                                                                                                                                                                                                                                        |
| 4   | Bundled Widgets: Clock + System Stats | ✅ Done | `ClockWidget` (setInterval, timezone/use24h config), `SystemStatsWidget` (polls `system:stats` IPC every 3 s, CPU+RAM+temp, graceful N/A on non-Pi), `window.system.getStats` preload, seeded on page 1                                                                                                                                     |
| 5   | Gesture ↔ WebSocket IPC              | ✅ Done | Full REST API + WebSocket at `/ws` (config-changed, page-change, notification events); `broadcastEvent` + `setCurrentPage`; `page:changed` IPC; `window.api.notifyPageChange` preload; `GestureWebSocketClient` wired in `main/index.ts` connecting to Python service on `ws://localhost:5001`                                              |
| 6   | Companion Web App Shell               | ✅ Done | React SPA (`react-router-dom`, routes `/` `/settings` `/wifi`); served from `out/companion/` via `CompanionServer`; built with `companion.vite.config.ts`; `HomePage` polls status + WS gesture events; `SystemSettings` full settings form → `PUT /api/settings`; `WifiSetupPage`; mirror applies theme in real-time via `config.onChange` |
| 7   | Layout Editor (Companion)             | ⏺ Next | Drag-to-place widgets on pages from phone                                                                                                                                                                                                                                                                                                   |
| 8   | Per-Widget Config UI                  | ⬜      | Auto-rendered form from widget `configSchema`                                                                                                                                                                                                                                                                                               |
| 9   | Companion API — Full REST             | ⬜      | All `/api/*` endpoints (pages, widgets, settings)                                                                                                                                                                                                                                                                                           |
| 10  | Widget: Weather                       | ⬜      | API key via companion config                                                                                                                                                                                                                                                                                                                |
| 11  | Widget: Calendar                      | ⬜      | `ical.js`, Google Calendar ICS                                                                                                                                                                                                                                                                                                              |
| 12  | Widget: News / Headlines              | ⬜      | RSS or API                                                                                                                                                                                                                                                                                                                                  |
| 13  | Widget: Spotify / Now Playing         | ⬜      |                                                                                                                                                                                                                                                                                                                                             |
| 14  | Widget: Stocks                        | ⬜      |                                                                                                                                                                                                                                                                                                                                             |
| 15  | Dynamic Widget Loader                 | ⬜      | `widget://` Electron protocol, fetch from registry                                                                                                                                                                                                                                                                                          |
| 16  | Widget Registry (online)              | ⬜      | GitHub-hosted manifest, download + hot-load                                                                                                                                                                                                                                                                                                 |
| 17  | Automation Service                    | ⬜      | `node-cron`, brightness schedule, wake/sleep                                                                                                                                                                                                                                                                                                |
| 18  | Polish                                | ⬜      | Transitions, night mode, user profiles                                                                                                                                                                                                                                                                                                      |

---

## Key Decisions Made

| Topic                | Decision                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Background           | Always pure `#000000` — mirror glass constraint. See `docs/UI_DESIGN_RULES.md`            |
| Text                 | Always white / `text-white/[opacity]`. No slate/gray backgrounds on mirror UI             |
| QR code colours      | `dark: #000000`, `light: #ffffff` — functional requirement                                |
| Page navigation      | SWIPE_LEFT = next (content slides left). Clamped, no wrap-around                          |
| Boot page            | Always page 0 on startup (no persistence of last active page)                             |
| Page dots            | Always visible, bottom-centre                                                             |
| Arrow keys           | Dev fallback for gestures (←→↑↓ map to SWIPE_LEFT/RIGHT/UP/DOWN)                          |
| WiFi non-Linux       | `wifi.configured` auto-set `true` on non-Linux — app skips setup screen in dev            |
| Default pages        | Home / Media / Info seeded in main process on first run                                   |
| Widget grid          | 12 columns × 8 rows CSS grid, layout stored as `{ col, row, colSpan, rowSpan }`           |
| `ignoreDeprecations` | Must stay `"6.0"` in `tsconfig.web.json` — do not change                                  |
| Typecheck web        | Run as `npx tsc --noEmit -p tsconfig.web.json --composite false --ignoreDeprecations 5.0` |

---

## File Map (what was added/changed per phase)

### Main Process (`src/main/`)

| File                                   | Phase         | Notes                                                                                                                                                                                                        |
| -------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config/app-config.ts`                 | P0            | `AppConfig`, `Page`, `WidgetInstance`, `InstalledWidget` types; `electron-store` instance; `getConfig`, `setConfig`, `onConfigChange`                                                                        |
| `services/wifi.service.ts`             | P1            | `isConnected`, `startHotspot`, `stopHotspot`, `scanNetworks`, `connectToNetwork`                                                                                                                             |
| `services/companion-server.service.ts` | P1–P5         | Full REST API: `/api/status`, `/api/layouts`, `/api/widget-config/:id`, `/api/settings`, `/api/notifications`, `/api/widgets/*`, `/api/system/restart`; WebSocket at `/ws`; auth middleware slot             |
| `services/websocket.service.ts`        | P5 fixup + P6 | `GestureWebSocketClient` — WS client connecting to Python gesture service (`ws://localhost:5001`); exponential backoff reconnect; `onGesture` callback + `connected` getter added in P6                      |
| `services/companion-server.service.ts` | P1–P6         | Added static SPA serving from `out/companion/` with SPA fallback + MIME types; `setGestureStatusProvider()`; `/api/status` now returns real gesture connection state                                         |
| `services/setup-server.service.ts`     | —             | Old — superseded by `companion-server.service.ts`, kept for reference                                                                                                                                        |
| `config/ipc.config.ts`                 | P3 cleanup    | Cleared — gesture IPC to be added in P5                                                                                                                                                                      |
| `index.ts`                             | P0–P5         | Seeds pages + widget instances; `config:get/set` IPC; wifi provisioning; `system:stats` IPC handler (P4); `page:changed` IPC + WS broadcast wiring (P5); `gestureClient.start()` on ready, `.stop()` on quit |

### Preload (`src/preload/`)

| File         | Phase | Notes                                                                                                                               |
| ------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`   | P0–P5 | `window.config.get/set/onChange`; `window.api.onGesture`, `onWifiConnected`, `notifyPageChange` (P5); `window.system.getStats` (P4) |
| `index.d.ts` | P0–P5 | Types for `window.config`, `window.api` (incl. `notifyPageChange`), `window.system`                                                 |

### Renderer (`src/renderer/src/`)

| File                              | Phase   | Notes                                                                                          |
| --------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `App.tsx`                         | P1      | Routes to `SetupPage` or `MirrorPage` based on `wifi.configured`                               |
| `pages/SetupPage.tsx`             | P1      | QR code, AP instructions, black bg, white text                                                 |
| `pages/MirrorPage.tsx`            | P2      | Renders `<PageSystem />`                                                                       |
| `hooks/useGesture.ts`             | P2      | Typed gesture hook + arrow-key fallback                                                        |
| `hooks/useConfig.ts`              | P2      | Reactive config slice hook                                                                     |
| `ui/PageSystem/PageSystem.tsx`    | P2–P5   | Slide animation, gesture nav, renders `WidgetGrid` per page; notifies page change via IPC (P5) |
| `ui/PageSystem/PageDots.tsx`      | P2      | Active dot = pill, inactive = small; always visible                                            |
| `ui/WidgetGrid/WidgetGrid.tsx`    | P3      | 12×8 CSS grid, maps `widgetIds` → `WidgetWrapper`                                              |
| `ui/WidgetGrid/WidgetWrapper.tsx` | P3      | `ErrorBoundary` + grid placement via CSS `gridColumn/Row`                                      |
| `lib/widget-types.ts`             | P3      | `WidgetProps`, `WidgetManifest`                                                                |
| `lib/widget-registry.ts`          | P3–P4   | `BUNDLED_WIDGETS` map; added `clock`, `system-stats`                                           |
| `widgets/dummy/DummyWidget.tsx`   | P3      | Test widget — renders instance ID                                                              |
| `widgets/clock/index.tsx`         | P4      | Live clock; `setInterval` 1 s; config: `timezone`, `use24h`                                    |
| `widgets/system-stats/index.tsx`  | P4      | CPU/RAM/temp bars; polls `window.system.getStats()` every 3 s                                  |
| `components/ConnectionStatus.tsx` | cleanup | Null stub — original deleted                                                                   |
| `components/UI.tsx`               | cleanup | Null stub — original deleted                                                                   |
| `App.tsx`                         | P6      | Added `config.onChange` theme subscription — sets `data-theme` on `<html>` in real-time        |

### Companion (`src/companion/`)

| File                           | Phase | Notes                                                                                                                  |
| ------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| `index.html`                   | P6    | SPA entry point                                                                                                        |
| `src/main.tsx`                 | P6    | React DOM mount                                                                                                        |
| `src/index.css`                | P6    | `@import "tailwindcss"` via `@tailwindcss/vite`                                                                        |
| `src/App.tsx`                  | P6    | `BrowserRouter` + sticky nav; routes: `/`, `/settings`, `/wifi`                                                        |
| `src/lib/api.ts`               | P6    | `api.get/put/post` typed fetch wrappers; relative paths (served from same origin as API)                               |
| `src/lib/themes.ts`            | P6    | `THEMES` constant array + `ThemeValue` type — shared source of truth for theme options                                 |
| `src/pages/HomePage.tsx`       | P6    | Polls `/api/status` every 2 s; connects to `/ws` for real-time gesture + page-change events                            |
| `src/pages/SystemSettings.tsx` | P6    | Full settings form: theme dropdown, wake timeout, brightness day/night sliders, schedule pickers → `PUT /api/settings` |
| `src/pages/WifiSetupPage.tsx`  | P6    | Network scan list + password field → `POST /api/wifi/connect`                                                          |

### Build / Config

| File                       | Phase | Notes                                                                       |
| -------------------------- | ----- | --------------------------------------------------------------------------- |
| `companion.vite.config.ts` | P6    | Vite config for companion SPA; root `src/companion`, outDir `out/companion` |

---

## Dev Workflow Notes

- `npm run dev` — starts Electron with HMR
- `npm run typecheck:node` — check main + preload
- `npx tsc --noEmit -p tsconfig.web.json --composite false --ignoreDeprecations 5.0` — check renderer
- To force WiFi setup screen: `await window.config.set('wifi.configured', false)` in DevTools, reload
- To reset widget state: `await window.config.set('widgetInstances', {})`, `await window.config.set('pages', [])`, reload
- `npm run build:companion` — build companion SPA to `out/companion/`
- `npm run dev:companion` — watch-build companion SPA alongside `npm run dev`
- Gesture service runs independently; Electron connects to it at `ws://localhost:5001` (Python default port in `gesture_service/src/backend/config.py`)

---

| Gesture WS client | `GestureWebSocketClient` in `websocket.service.ts`; connects to `ws://localhost:5001`; single `close` handler drives reconnect; no state broadcasts to renderer |

- Register both in `BUNDLED_WIDGETS`
- Seed them as real instances replacing the dummy widget
- Both must follow `UI_DESIGN_RULES.md` — black bg, white text
