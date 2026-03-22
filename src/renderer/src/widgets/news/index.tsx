import { useState, useEffect } from 'react'
import type { WidgetProps } from '../../lib/widget-types'

interface GNewsArticle {
  source: { name: string; url: string }
  title: string
  description: string | null
  publishedAt: string
}

interface GNewsResponse {
  totalArticles: number
  articles: GNewsArticle[]
}

/** How long each headline is shown (ms) before cycling to the next. */
const CYCLE_MS = 12000
/** GNews free tier max is 10 per request. */
const MAX_ARTICLES = 10
/** Refresh headlines every 15 minutes. */
const REFRESH_MS = 15 * 60 * 1000

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NewsWidget({ config }: WidgetProps): React.JSX.Element {
  const apiKey = (config.apiKey as string) || ''
  const country = (config.country as string) || 'in'
  const category = (config.category as string) || 'general'
  const lang = (config.lang as string) || 'en'

  const [articles, setArticles] = useState<GNewsArticle[]>([])
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Fade state: true = visible, false = fading out before advancing
  const [visible, setVisible] = useState(true)

  // ── Fetch headlines ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!apiKey) return
    let cancelled = false

    async function fetchNews(): Promise<void> {
      if (cancelled) return
      setLoading(true)
      setError(null)
      try {
        // GNews API — https://gnews.io/docs/v4
        // Free tier: 100 req/day, 10 articles/request, supports country=in
        const url =
          `https://gnews.io/api/v4/top-headlines` +
          `?country=${encodeURIComponent(country)}` +
          `&category=${encodeURIComponent(category)}` +
          `&lang=${encodeURIComponent(lang)}` +
          `&max=${MAX_ARTICLES}` +
          `&apikey=${encodeURIComponent(apiKey)}`
        const raw = await window.api.fetchHeadlines(url)
        const data = JSON.parse(raw) as GNewsResponse
        const filtered = data.articles.filter((a) => a.title)
        if (!cancelled) {
          setArticles(filtered)
          setIdx(0)
          setVisible(true)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message)
          setLoading(false)
        }
      }
    }

    fetchNews()
    const id = setInterval(fetchNews, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [apiKey, country, category, lang])

  // ── Auto-cycle through headlines with fade transition ────────────────────
  useEffect(() => {
    if (articles.length <= 1) return
    const id = setInterval(() => {
      // Fade out, advance, fade in
      setVisible(false)
      setTimeout(() => {
        setIdx((i) => (i + 1) % articles.length)
        setVisible(true)
      }, 350)
    }, CYCLE_MS)
    return () => clearInterval(id)
  }, [articles.length])

  // ── Render states ────────────────────────────────────────────────────────
  if (!apiKey) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="text-white/40 text-sm">⚙ Configure API key in companion</span>
      </div>
    )
  }

  if (loading && articles.length === 0) {
    return (
      <div className="flex h-full w-full animate-pulse flex-col gap-3 p-4">
        <div className="h-2.5 w-28 rounded bg-white/10" />
        <div className="h-4 w-full rounded bg-white/10" />
        <div className="h-4 w-4/5 rounded bg-white/10" />
        <div className="h-4 w-3/5 rounded bg-white/10" />
        <div className="h-2.5 w-20 rounded bg-white/10" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <span className="text-white/40 text-xs text-center">News unavailable: {error}</span>
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="text-white/40 text-sm">No headlines found</span>
      </div>
    )
  }

  const article = articles[idx]
  const dotCount = Math.min(articles.length, 10)

  return (
    <div
      className="flex h-full w-full flex-col justify-between p-4"
      style={{ transition: 'opacity 350ms ease', opacity: visible ? 1 : 0 }}
    >
      {/* Headline content */}
      <div className="flex flex-col gap-1.5 overflow-hidden">
        {/* Category + source row */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
            {category !== 'general' ? category : 'News'}
          </span>
          <span className="text-white/20 text-xs">·</span>
          <span className="text-xs text-white/40 truncate">{article.source.name}</span>
        </div>

        {/* Headline text */}
        <p
          className="text-sm font-semibold leading-snug text-white"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 5,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {article.title}
        </p>

        {/* Time ago */}
        <span className="text-xs text-white/30">{formatTimeAgo(article.publishedAt)}</span>
      </div>

      {/* Pagination dots */}
      {articles.length > 1 && (
        <div className="flex items-center gap-1 pt-2">
          {Array.from({ length: dotCount }).map((_, i) => {
            const active = i === idx % dotCount
            return (
              <div
                key={i}
                className="rounded-full transition-all duration-300 bg-white"
                style={{
                  height: active ? 6 : 4,
                  width: active ? 16 : 4,
                  opacity: active ? 0.6 : 0.2
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
