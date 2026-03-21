import type { WidgetProps } from '../../lib/widget-types'

export default function DummyWidget({ instanceId }: WidgetProps): React.JSX.Element {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <span className="text-white/40 text-xs font-mono">{instanceId}</span>
    </div>
  )
}
