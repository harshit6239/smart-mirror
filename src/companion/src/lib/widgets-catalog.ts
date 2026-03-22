/** A single widget config field definition — drives the auto-generated companion form. */
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

export type CatalogEntry = {
  widgetId: string
  name: string
  defaultConfig: Record<string, unknown>
  defaultLayout: { col: number; row: number; colSpan: number; rowSpan: number }
  /** Drives the WidgetConfig form in the companion. Empty = no configurable options. */
  configSchema: Record<string, ConfigField>
}

/** Catalog of bundled widgets available to place in the layout editor. */
export const WIDGET_CATALOG: CatalogEntry[] = [
  {
    widgetId: 'clock',
    name: 'Clock',
    defaultConfig: {
      timezone: 'UTC',
      use24h: true,
      showSeconds: true,
      showDate: true,
      showDayOfWeek: true,
      dateFormat: 'long',
      fontSize: 'xl'
    },
    defaultLayout: { col: 1, row: 1, colSpan: 7, rowSpan: 3 },
    configSchema: {
      timezone: {
        type: 'string',
        label: 'Timezone',
        default: 'UTC',
        hint: 'IANA timezone name — e.g. America/New_York, Europe/London'
      },
      use24h: {
        type: 'boolean',
        label: '24-hour format',
        default: true
      },
      showSeconds: {
        type: 'boolean',
        label: 'Show seconds',
        default: true
      },
      showDate: {
        type: 'boolean',
        label: 'Show date',
        default: true
      },
      showDayOfWeek: {
        type: 'boolean',
        label: 'Show day of week',
        default: true
      },
      dateFormat: {
        type: 'select',
        label: 'Date format',
        options: ['long', 'short', 'numeric'],
        default: 'long',
        hint: 'long = "January 1, 2025" · short = "Jan 1, 2025" · numeric = "1/1/2025"'
      },
      fontSize: {
        type: 'select',
        label: 'Time font size',
        options: ['sm', 'md', 'lg', 'xl', '2xl'],
        default: 'xl',
        hint: 'sm = smallest · 2xl = largest'
      }
    }
  },
  {
    widgetId: 'system-stats',
    name: 'System Stats',
    defaultConfig: {},
    defaultLayout: { col: 9, row: 1, colSpan: 4, rowSpan: 3 },
    configSchema: {}
  },
  {
    widgetId: 'dummy',
    name: 'Dummy',
    defaultConfig: {},
    defaultLayout: { col: 1, row: 1, colSpan: 3, rowSpan: 2 },
    configSchema: {}
  },
  {
    widgetId: 'weather',
    name: 'Weather',
    defaultConfig: { apiKey: '', lat: 51.5074, lon: -0.1278, units: 'metric' },
    defaultLayout: { col: 1, row: 4, colSpan: 6, rowSpan: 3 },
    configSchema: {
      apiKey: {
        type: 'string',
        secret: true,
        label: 'WeatherAPI Key',
        hint: 'Get a free key at weatherapi.com — free tier includes 1 M calls/month',
        required: true
      },
      lat: {
        type: 'number',
        label: 'Latitude',
        default: 51.5074,
        hint: 'Decimal degrees — e.g. 51.5074 for London'
      },
      lon: {
        type: 'number',
        label: 'Longitude',
        default: -0.1278,
        hint: 'Decimal degrees — e.g. -0.1278 for London'
      },
      units: {
        type: 'select',
        label: 'Units',
        options: ['metric', 'imperial'],
        default: 'metric',
        hint: 'metric = °C, m/s · imperial = °F, mph'
      }
    }
  },
  {
    widgetId: 'calendar',
    name: 'Calendar',
    defaultConfig: { icalUrl: '' },
    defaultLayout: { col: 7, row: 4, colSpan: 6, rowSpan: 4 },
    configSchema: {
      icalUrl: {
        type: 'string',
        label: 'iCal URL',
        hint: 'Google Calendar: Settings → your calendar → "Secret address in iCal format"',
        required: true
      }
    }
  },
  {
    widgetId: 'news',
    name: 'News / Headlines',
    defaultConfig: { apiKey: '', country: 'in', category: 'general', lang: 'en' },
    defaultLayout: { col: 1, row: 6, colSpan: 6, rowSpan: 3 },
    configSchema: {
      apiKey: {
        type: 'string',
        secret: true,
        label: 'GNews API Key',
        hint: 'Get a free key at gnews.io — free tier: 100 req/day, supports country=in for India',
        required: true
      },
      country: {
        type: 'string',
        label: 'Country code',
        default: 'in',
        hint: 'ISO 3166-1 alpha-2 — e.g. in, us, gb, ca, au, de, fr'
      },
      category: {
        type: 'select',
        label: 'Category',
        options: [
          'general',
          'world',
          'nation',
          'business',
          'technology',
          'entertainment',
          'sports',
          'science',
          'health'
        ],
        default: 'general'
      },
      lang: {
        type: 'select',
        label: 'Language',
        options: [
          'en',
          'hi',
          'ar',
          'zh',
          'de',
          'es',
          'fr',
          'it',
          'ja',
          'ko',
          'ml',
          'mr',
          'pt',
          'ru',
          'ta',
          'te'
        ],
        default: 'en',
        hint: 'en=English · hi=Hindi · ta=Tamil · te=Telugu · ml=Malayalam · mr=Marathi'
      }
    }
  },
  {
    widgetId: 'spotify',
    name: 'Spotify Now Playing',
    // accessToken and refreshToken are managed by the OAuth flow, not entered manually.
    // They live in defaultConfig so they persist in the store but are not in configSchema
    // (so WidgetConfigForm never renders them — the Connect Spotify button manages them).
    defaultConfig: { clientId: '', clientSecret: '', accessToken: '', refreshToken: '' },
    defaultLayout: { col: 1, row: 5, colSpan: 6, rowSpan: 3 },
    configSchema: {
      clientId: {
        type: 'string',
        label: 'Client ID',
        hint: 'From your Spotify Developer App — developer.spotify.com/dashboard',
        required: true
      },
      clientSecret: {
        type: 'string',
        secret: true,
        label: 'Client Secret',
        hint: 'From your Spotify Developer App',
        required: true
      }
    }
  }
]
