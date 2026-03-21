import type { WidgetInstance } from '../../../main/config/app-config'

/** Props passed to every widget component */
export type WidgetProps = {
  instanceId: string
  config: WidgetInstance['config']
}

/** Metadata a widget bundle exposes */
export type WidgetManifest = {
  id: string
  name: string
  version: string
  description: string
  defaultConfig: Record<string, unknown>
  defaultLayout: WidgetInstance['layout']
}
