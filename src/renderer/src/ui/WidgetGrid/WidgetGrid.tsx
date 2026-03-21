import { useConfig } from '../../hooks/useConfig'
import WidgetWrapper from './WidgetWrapper'

type WidgetGridProps = {
  pageId: string
  widgetIds: string[]
}

const COLS = 12
const ROWS = 8

export default function WidgetGrid({ widgetIds }: WidgetGridProps): React.JSX.Element {
  const [widgetInstances] = useConfig('widgetInstances')

  if (!widgetInstances) return <></>

  const instances = widgetIds.map((id) => widgetInstances[id]).filter(Boolean)

  return (
    <div
      className="h-full w-full p-2"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        gap: '0.5rem'
      }}
    >
      {instances.map((instance) => (
        <WidgetWrapper key={instance.id} instance={instance} />
      ))}
    </div>
  )
}
