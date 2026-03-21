import { Component } from 'react'
import type { WidgetInstance } from '../../../../main/config/app-config'
import { BUNDLED_WIDGETS } from '../../lib/widget-registry'

// ─── Error Boundary ───────────────────────────────────────────────────────────

type BoundaryState = { crashed: boolean }

class WidgetErrorBoundary extends Component<React.PropsWithChildren, BoundaryState> {
  state: BoundaryState = { crashed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { crashed: true }
  }

  render(): React.ReactNode {
    if (this.state.crashed) {
      return (
        <div className="flex h-full w-full items-center justify-center rounded border border-white/10">
          <span className="text-white/30 text-xs">widget error</span>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function WidgetSkeleton(): React.JSX.Element {
  return <div className="h-full w-full animate-pulse rounded bg-white/5" />
}

// ─── WidgetWrapper ───────────────────────────────────────────────────────────

type WidgetWrapperProps = {
  instance: WidgetInstance
}

export default function WidgetWrapper({ instance }: WidgetWrapperProps): React.JSX.Element {
  const { col, row, colSpan, rowSpan } = instance.layout

  const Widget = BUNDLED_WIDGETS[instance.widgetId]

  return (
    <div
      className="overflow-hidden"
      style={{
        gridColumn: `${col} / span ${colSpan}`,
        gridRow: `${row} / span ${rowSpan}`
      }}
    >
      <WidgetErrorBoundary>
        {Widget ? <Widget instanceId={instance.id} config={instance.config} /> : <WidgetSkeleton />}
      </WidgetErrorBoundary>
    </div>
  )
}
