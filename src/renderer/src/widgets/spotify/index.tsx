import { useState, useEffect, useRef, useCallback } from 'react'
import type { SpotifyNowPlayingResult, SpotifyTrack } from '../../../../preload/index.d'
import type { WidgetProps } from '../../lib/widget-types'

/** How often to poll the Spotify API (ms). */
const POLL_MS = 5000

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function SpotifyIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  )
}

function PauseIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  )
}

/** Lightweight client-side progress interpolation between API polls. */
function useProgressInterpolation(track: SpotifyTrack | null, isPlaying: boolean): number {
  const [progressMs, setProgressMs] = useState(0)
  // Store the reference point: { wallClockAtSync, progressAtSync }
  const syncRef = useRef<{ wallClock: number; progress: number } | null>(null)

  // Sync reference whenever new API data arrives
  useEffect(() => {
    if (!track) {
      syncRef.current = null
      return
    }
    syncRef.current = { wallClock: Date.now(), progress: track.progressMs }
    setProgressMs(track.progressMs)
  }, [track?.progressMs, track?.durationMs]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tick every 500ms while playing
  useEffect(() => {
    if (!isPlaying || !track) return
    const id = setInterval(() => {
      if (!syncRef.current || !track) return
      const elapsed = Date.now() - syncRef.current.wallClock
      setProgressMs(Math.min(syncRef.current.progress + elapsed, track.durationMs))
    }, 500)
    return () => clearInterval(id)
  }, [isPlaying, track?.durationMs]) // eslint-disable-line react-hooks/exhaustive-deps

  return progressMs
}

export default function SpotifyWidget({ instanceId }: WidgetProps): React.JSX.Element {
  const [result, setResult] = useState<SpotifyNowPlayingResult | null>(null)

  const poll = useCallback(async (): Promise<void> => {
    try {
      const res = await window.api.spotifyNowPlaying(instanceId)
      setResult(res)
    } catch (e) {
      setResult({ status: 'error', message: (e as Error).message })
    }
  }, [instanceId])

  useEffect(() => {
    void poll()
    const id = setInterval(() => void poll(), POLL_MS)
    return () => clearInterval(id)
  }, [poll])

  const track =
    result && (result.status === 'playing' || result.status === 'paused') ? result.track : null
  const isPlaying = result?.status === 'playing'
  const progressMs = useProgressInterpolation(track, isPlaying)
  const pct = track && track.durationMs > 0 ? (progressMs / track.durationMs) * 100 : 0

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="flex h-full w-full animate-pulse flex-col gap-3 p-4">
        <div className="flex gap-3 items-center">
          <div className="h-14 w-14 rounded-lg bg-white/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 rounded bg-white/10" />
            <div className="h-2.5 w-1/2 rounded bg-white/10" />
          </div>
        </div>
        <div className="h-1 w-full rounded-full bg-white/10" />
      </div>
    )
  }

  // ── No token configured ──────────────────────────────────────────────────
  if (result.status === 'no-token') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4">
        <SpotifyIcon className="w-8 h-8 text-white/30" />
        <span className="text-white/40 text-sm text-center">Connect Spotify in companion</span>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (result.status === 'error') {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <span className="text-white/30 text-xs text-center">Spotify: {result.message}</span>
      </div>
    )
  }

  // ── Nothing playing ──────────────────────────────────────────────────────
  if (result.status === 'idle') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4">
        <SpotifyIcon className="w-7 h-7 text-white/20" />
        <span className="text-white/25 text-sm">Nothing playing</span>
      </div>
    )
  }

  // ── Now playing / paused ─────────────────────────────────────────────────
  return (
    <div className="flex h-full w-full flex-col p-3 gap-2">
      {/* Art + info row */}
      <div className="flex gap-3 items-center flex-1 min-h-0">
        {track!.albumArtUrl ? (
          <img
            src={track!.albumArtUrl}
            alt={track!.albumName}
            className="h-14 w-14 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div className="h-14 w-14 rounded-lg bg-white/10 shrink-0 flex items-center justify-center">
            <SpotifyIcon className="w-7 h-7 text-white/20" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-snug truncate">{track!.name}</p>
          <p className="text-white/60 text-xs leading-snug truncate mt-0.5">
            {track!.artists.join(', ')}
          </p>
          <p className="text-white/35 text-xs leading-snug truncate mt-0.5">{track!.albumName}</p>
        </div>

        {/* Pause indicator */}
        {result.status === 'paused' && <PauseIcon className="w-5 h-5 text-white/35 shrink-0" />}
      </div>

      {/* Progress bar + timestamps */}
      <div className="space-y-1">
        <div className="h-0.5 w-full rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-full rounded-full bg-white/65 transition-all duration-500 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-white/25 text-[10px] tabular-nums">
          <span>{formatMs(progressMs)}</span>
          <span>{formatMs(track!.durationMs)}</span>
        </div>
      </div>
    </div>
  )
}
