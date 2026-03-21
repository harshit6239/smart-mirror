# Smart Mirror — UI Design Rules

> These apply to **all mirror-side renderer UI** (everything in `src/renderer/`).
> The companion web app (phone interface) is exempt — it runs on a phone screen.

---

## Core Constraints

- **Background is always pure black (`#000000` / `bg-black`)** — the mirror glass shows the screen through a half-silvered coating; any non-black area is visible as a lit region on the mirror surface.
- **Text and icons are always white or near-white** — use `text-white`, `text-white/80`, `text-white/60` for hierarchy. Avoid slate/gray background tints.
- **No coloured backgrounds on any container** — cards, panels, overlays must use `bg-black` or `bg-white/[opacity]` (frosted glass style) only.
- **No drop shadows that create brightness halos** — shadows bleed light on the physical mirror.
- **Minimal UI surface area** — only render what is needed; empty mirror space is intentional and desirable.

---

## Typography

- Base text: `text-white`
- Secondary text: `text-white/60`
- Accent / highlight: prefer white with different weight/size over colour
- Avoid coloured text except for brief status indicators (e.g. a small green dot for "connected")

---

## Colour Usage

| Use                | Allowed                                                      |
| ------------------ | ------------------------------------------------------------ |
| Background         | `#000000` only                                               |
| Text primary       | `#ffffff`                                                    |
| Text secondary     | `rgba(255,255,255,0.6)`                                      |
| Accent/status dots | Small coloured dots only (≤ 8px)                             |
| QR code background | White fill (functional requirement — QR codes need contrast) |
| Widget borders     | `border-white/10` subtle, or no border                       |

---

## Layout

- Use `min-h-screen` with `bg-black` at the root level.
- Content should be **vertically and horizontally centred** or **grid-anchored** (no floating top-left content).
- Widgets use the full screen as a canvas — no persistent chrome (no nav bars, no headers).

---

## Animations

- Transitions should be **slow and smooth** (300–500 ms) — mirrors are typically viewed from a distance.
- No abrupt cuts; prefer `transition-opacity` or `transition-transform`.
- Pulse/blink indicators: keep subtle (`opacity-50` min), never bright flashing.

---

## QR Code Styling (SetupPage specific)

- QR foreground: `#000000` (dark modules)
- QR background: `#ffffff` (light modules) — pure white, functional requirement
- Wrap QR in a white `rounded` container so it's scannable and visually contained against the black screen.
