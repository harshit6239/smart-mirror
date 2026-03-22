import { useState, useEffect } from 'react'
import type { WidgetProps } from '../../lib/widget-types'

interface CoinData {
  id: string
  symbol: string
  name: string
  current_price: number
  price_change_percentage_24h: number | null
}

/** Refresh every 5 minutes — well within CoinGecko free-tier limits. */
const REFRESH_MS = 5 * 60 * 1000

const CURRENCY_SYMBOLS: Record<string, string> = {
  usd: '$',
  eur: '€',
  gbp: '£',
  inr: '₹',
  jpy: '¥',
  cad: 'CA$',
  aud: 'A$'
}

function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toLowerCase()] ?? currency.toUpperCase() + ' '
}

function formatPrice(price: number, sym: string): string {
  if (price >= 1_000_000) return `${sym}${(price / 1_000_000).toFixed(2)}M`
  if (price >= 1000) return `${sym}${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (price >= 1) return `${sym}${price.toFixed(2)}`
  // Sub-$1 coins: 4 significant figures
  return `${sym}${price.toPrecision(4)}`
}

function formatChange(pct: number | null): React.JSX.Element {
  if (pct === null) return <span className="text-white/30 text-xs"> — </span>
  const positive = pct >= 0
  const arrow = positive ? '▲' : '▼'
  const abs = Math.abs(pct).toFixed(2)
  return (
    <span
      className={`text-xs tabular-nums font-medium ${positive ? 'text-green-400/80' : 'text-red-400/80'}`}
    >
      {arrow} {abs}%
    </span>
  )
}

export default function StocksWidget({ config }: WidgetProps): React.JSX.Element {
  const rawCoins = (config.coins as string) || 'bitcoin,ethereum,solana'
  const currency = ((config.currency as string) || 'usd').toLowerCase()
  const apiKey = (config.apiKey as string) || ''

  // Parse and deduplicate coin list, ignore blank entries
  const coinIds = rawCoins
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12) // hard cap — API max per_page

  const [coins, setCoins] = useState<CoinData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  useEffect(() => {
    if (coinIds.length === 0) return
    let cancelled = false

    async function fetchPrices(): Promise<void> {
      if (cancelled) return
      setLoading(true)
      setError(null)
      try {
        const url =
          `https://api.coingecko.com/api/v3/coins/markets` +
          `?vs_currency=${encodeURIComponent(currency)}` +
          `&ids=${encodeURIComponent(coinIds.join(','))}` +
          `&order=market_cap_desc` +
          `&per_page=${coinIds.length}` +
          `&sparkline=false` +
          `&price_change_percentage=24h`

        const headers: Record<string, string> = {}
        if (apiKey) headers['x-cg-demo-api-key'] = apiKey

        const res = await fetch(url, { headers })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as CoinData[]
        if (!cancelled) {
          // Re-sort to match user's configured order, not market cap
          const order = coinIds
          data.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
          setCoins(data)
          setLastUpdated(Date.now())
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message)
          setLoading(false)
        }
      }
    }

    fetchPrices()
    const id = setInterval(fetchPrices, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawCoins, currency, apiKey])

  const sym = currencySymbol(currency)

  // ── No coins configured ──────────────────────────────────────────────────
  if (coinIds.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="text-white/40 text-sm">⚙ Configure coins in companion</span>
      </div>
    )
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading && coins.length === 0) {
    return (
      <div className="flex h-full w-full animate-pulse flex-col gap-2 p-3">
        <div className="h-2.5 w-24 rounded bg-white/10" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-10 rounded bg-white/10" />
            <div className="flex-1 h-3 rounded bg-white/10" />
            <div className="h-3 w-14 rounded bg-white/10" />
          </div>
        ))}
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <span className="text-white/35 text-xs text-center">Prices unavailable: {error}</span>
      </div>
    )
  }

  if (coins.length === 0) return <></>

  // Relative last-updated label
  let updatedLabel = ''
  if (lastUpdated) {
    const mins = Math.floor((Date.now() - lastUpdated) / 60_000)
    updatedLabel = mins < 1 ? 'just now' : `${mins}m ago`
  }

  // ── Coin rows ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full flex-col p-3 gap-1.5">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="text-white/50 text-[11px] uppercase tracking-wider font-medium">
          Crypto
        </span>
        {updatedLabel && <span className="text-white/20 text-[10px]">{updatedLabel}</span>}
      </div>

      {/* Coin list */}
      <div className="flex flex-col gap-1 flex-1 justify-evenly">
        {coins.map((coin) => (
          <div key={coin.id} className="flex items-baseline justify-between gap-2">
            {/* Symbol */}
            <span className="text-white/70 text-xs font-medium uppercase w-12 shrink-0 tabular-nums">
              {coin.symbol}
            </span>

            {/* Price — grows to fill space, right-aligned */}
            <span className="flex-1 text-right text-white text-sm font-semibold tabular-nums">
              {formatPrice(coin.current_price, sym)}
            </span>

            {/* 24h change */}
            <span className="w-18 text-right shrink-0">
              {formatChange(coin.price_change_percentage_24h)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
