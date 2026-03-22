import { useState, useEffect } from 'react'
import type { WidgetProps } from '../../lib/widget-types'

interface WApiCondition {
  text: string
  icon: string
}

interface WApiLocation {
  name: string
  region: string
  country: string
}

interface WApiCurrent {
  temp_c: number
  temp_f: number
  feelslike_c: number
  feelslike_f: number
  humidity: number
  wind_kph: number
  wind_mph: number
  condition: WApiCondition
}

interface WApiForecastDay {
  date: string
  day: {
    maxtemp_c: number
    maxtemp_f: number
    mintemp_c: number
    mintemp_f: number
    condition: WApiCondition
  }
}

interface WeatherData {
  location: WApiLocation
  current: WApiCurrent
  forecast: { forecastday: WApiForecastDay[] }
}

function iconUrl(src: string): string {
  return src.startsWith('//') ? `https:${src}` : src
}

function shortDay(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
}

export default function WeatherWidget({ config }: WidgetProps): React.JSX.Element {
  const apiKey = (config.apiKey as string) || ''
  const lat = (config.lat as number) ?? 0
  const lon = (config.lon as number) ?? 0
  const units = (config.units as string) || 'metric'
  const imperial = units === 'imperial'

  const [data, setData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!apiKey) return

    let cancelled = false

    async function fetchWeather(): Promise<void> {
      if (cancelled) return
      setLoading(true)
      setError(null)
      try {
        const q = encodeURIComponent(`${lat},${lon}`)
        const url =
          `https://api.weatherapi.com/v1/forecast.json` +
          `?key=${encodeURIComponent(apiKey)}&q=${q}&days=4&aqi=no&alerts=no`
        const res = await fetch(url)
        if (!res.ok) throw new Error(`${res.status}`)
        const json = (await res.json()) as WeatherData
        if (!cancelled) {
          setData(json)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message)
          setLoading(false)
        }
      }
    }

    fetchWeather()
    const id = setInterval(fetchWeather, 600_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [apiKey, lat, lon, units])

  if (!apiKey || (lat === 0 && lon === 0)) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="text-white/40 text-sm">
          ⚙ Configure API key &amp; location in companion
        </span>
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="flex h-full w-full animate-pulse flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded bg-white/10" />
          <div className="flex flex-col gap-2">
            <div className="h-9 w-24 rounded bg-white/10" />
            <div className="h-3 w-20 rounded bg-white/10" />
          </div>
        </div>
        <div className="flex gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 w-12 rounded bg-white/10" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="text-white/40 text-sm">Weather unavailable</span>
      </div>
    )
  }

  if (!data) return <></>

  const { location, current, forecast } = data
  const temp = imperial ? current.temp_f : current.temp_c
  const feelsLike = imperial ? current.feelslike_f : current.feelslike_c
  const wind = imperial ? current.wind_mph : current.wind_kph
  const unit = imperial ? '°F' : '°C'
  const wUnit = imperial ? 'mph' : 'km/h'
  const forecastDays = forecast.forecastday.slice(1, 4)

  return (
    <div className="flex h-full w-full flex-col justify-between p-3">
      {/* Current conditions */}
      <div className="flex items-start gap-3">
        <img
          src={iconUrl(current.condition.icon)}
          alt={current.condition.text}
          className="h-12 w-12"
        />
        <div className="flex flex-col">
          <span className="text-4xl font-light tabular-nums text-white">
            {Math.round(temp)}
            {unit}
          </span>
          <span className="text-sm text-white/60">{current.condition.text}</span>
          <span className="text-xs text-white/40">
            {location.name}, {location.country}
          </span>
        </div>
      </div>

      {/* Secondary details */}
      <div className="flex gap-4 text-xs text-white/50">
        <span>
          Feels {Math.round(feelsLike)}
          {unit}
        </span>
        <span>💧 {current.humidity}%</span>
        <span>
          💨 {wind.toFixed(1)}&nbsp;{wUnit}
        </span>
      </div>

      {/* 3-day forecast */}
      <div className="flex gap-3">
        {forecastDays.map((day) => (
          <div key={day.date} className="flex flex-col items-center gap-0.5">
            <span className="text-xs text-white/50">{shortDay(day.date)}</span>
            <img
              src={iconUrl(day.day.condition.icon)}
              alt={day.day.condition.text}
              className="h-8 w-8"
            />
            <span className="tabular-nums text-xs text-white">
              {Math.round(imperial ? day.day.maxtemp_f : day.day.maxtemp_c)}
              {unit}
            </span>
            <span className="tabular-nums text-xs text-white/40">
              {Math.round(imperial ? day.day.mintemp_f : day.day.mintemp_c)}
              {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
