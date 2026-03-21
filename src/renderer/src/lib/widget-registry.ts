import type { WidgetProps } from './widget-types'
import DummyWidget from '../widgets/dummy/DummyWidget'
import ClockWidget from '../widgets/clock/index'
import SystemStatsWidget from '../widgets/system-stats/index'

/**
 * All widgets bundled with the app.
 * Key = widgetId as stored in WidgetInstance.widgetId
 */
export const BUNDLED_WIDGETS: Record<string, React.ComponentType<WidgetProps>> = {
  dummy: DummyWidget,
  clock: ClockWidget,
  'system-stats': SystemStatsWidget
}
