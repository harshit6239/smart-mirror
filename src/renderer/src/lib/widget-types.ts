import type { WidgetInstance } from '../../../main/config/app-config'

/** A single config field definition — drives the auto-generated companion form. */
export type ConfigField = {
  type: 'string' | 'number' | 'boolean' | 'select'
  label: string
  default?: unknown
  /** Available options (select type only) */
  options?: string[]
  /** Render as password input — value never shown in plaintext after save */
  secret?: boolean
  /** Hint shown as placeholder (string type) or below the field */
  hint?: string
  required?: boolean
}

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
  /** Maps config key → field definition. Drives the companion WidgetConfig form. */
  configSchema: Record<string, ConfigField>
}
