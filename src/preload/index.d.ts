import { ElectronAPI } from '@electron-toolkit/preload'
import type { AppConfig } from '../main/config/app-config'

/** Track data returned from the spotify:now-playing IPC handler */
export interface SpotifyTrack {
  name: string
  artists: string[]
  albumName: string
  albumArtUrl: string | null
  durationMs: number
  progressMs: number
}

export type SpotifyNowPlayingResult =
  | { status: 'playing' | 'paused'; track: SpotifyTrack }
  | { status: 'idle' | 'no-token' }
  | { status: 'error'; message: string }

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      onGesture: (callback: (data: { gesture_type: string; gesture: string }) => void) => () => void
      onWifiConnected: (cb: () => void) => () => void
      notifyPageChange: (pageIndex: number) => void
      getCompanionUrl: () => Promise<string>
      onNotification: (
        cb: (note: { type?: string; title: string; body: string; durationMs?: number }) => void
      ) => () => void
      fetchIcal: (url: string) => Promise<string>
      fetchHeadlines: (url: string) => Promise<string>
      spotifyNowPlaying: (instanceId: string) => Promise<SpotifyNowPlayingResult>
    }
    config: {
      get: () => Promise<AppConfig>
      set: (key: string, value: unknown) => Promise<void>
      onChange: (cb: (newConfig: AppConfig) => void) => () => void
    }
    system: {
      getStats: () => Promise<{
        cpuPercent: number | null
        memPercent: number | null
        tempC: number | null
      }>
    }
  }
}
