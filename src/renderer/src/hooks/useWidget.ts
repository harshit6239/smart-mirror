import { useState, useEffect } from 'react'
import type { WidgetProps } from '../lib/widget-types'
import { BUNDLED_WIDGETS } from '../lib/widget-registry'

/** Cache of already-loaded dynamic widget modules. Persists for the app lifetime. */
const dynamicWidgetCache = new Map<string, React.ComponentType<WidgetProps>>()

export type WidgetLoadState =
  | { status: 'ready'; Component: React.ComponentType<WidgetProps> }
  | { status: 'loading' }
  | { status: 'error'; message: string }

/**
 * Resolves a widget component by ID + version.
 *
 * - Bundled widgets (in BUNDLED_WIDGETS) are returned synchronously on the first
 *   render — no loading flash.
 * - Dynamic widgets are imported from `widget://<id>/<version>/bundle.esm.js`
 *   (served by the widget:// Electron protocol from userData/widgets/) and cached
 *   in memory so subsequent renders and re-mounts are free.
 */
export function useWidget(widgetId: string, version: string): WidgetLoadState {
  const [state, setState] = useState<WidgetLoadState>(() => {
    // Fast-path for bundled and already-cached widgets so the first render
    // shows the widget immediately without a loading skeleton flash.
    const bundled = BUNDLED_WIDGETS[widgetId]
    if (bundled) return { status: 'ready', Component: bundled }

    const cached = dynamicWidgetCache.get(`${widgetId}@${version}`)
    if (cached) return { status: 'ready', Component: cached }

    return { status: 'loading' }
  })

  useEffect(() => {
    // Sync fast-path for bundled widgets (handles widgetId changes after mount).
    const bundled = BUNDLED_WIDGETS[widgetId]
    if (bundled) {
      setState({ status: 'ready', Component: bundled })
      return
    }

    // Already cached from a previous load.
    const cacheKey = `${widgetId}@${version}`
    const cached = dynamicWidgetCache.get(cacheKey)
    if (cached) {
      setState({ status: 'ready', Component: cached })
      return
    }

    // Dynamic widget: reset to loading and fetch from widget:// protocol.
    setState({ status: 'loading' })

    let cancelled = false
    const url = `widget://${widgetId}/${version}/bundle.esm.js`

    // @vite-ignore tells Vite not to try to analyse or bundle this runtime import.
    import(/* @vite-ignore */ url)
      .then((mod: { default?: React.ComponentType<WidgetProps> }) => {
        if (cancelled) return
        const Component = mod.default
        if (typeof Component !== 'function') {
          throw new Error(`Widget bundle '${widgetId}' has no default export`)
        }
        dynamicWidgetCache.set(cacheKey, Component)
        setState({ status: 'ready', Component })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({ status: 'error', message: String(err) })
      })

    return () => {
      cancelled = true
    }
  }, [widgetId, version]) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}
