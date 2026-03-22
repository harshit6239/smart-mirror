import type { WidgetProps } from './widget-types'
import DummyWidget from '../widgets/dummy/DummyWidget'
import ClockWidget from '../widgets/clock/index'
import SystemStatsWidget from '../widgets/system-stats/index'
import WeatherWidget from '../widgets/weather/index'
import CalendarWidget from '../widgets/calendar/index'
import NewsWidget from '../widgets/news/index'
import SpotifyWidget from '../widgets/spotify/index'
import StocksWidget from '../widgets/stocks/index'

/**
 * All widgets bundled with the app.
 * Key = widgetId as stored in WidgetInstance.widgetId
 */
export const BUNDLED_WIDGETS: Record<string, React.ComponentType<WidgetProps>> = {
  dummy: DummyWidget,
  clock: ClockWidget,
  'system-stats': SystemStatsWidget,
  weather: WeatherWidget,
  calendar: CalendarWidget,
  news: NewsWidget,
  spotify: SpotifyWidget,
  stocks: StocksWidget
}
