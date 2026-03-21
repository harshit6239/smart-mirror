import { ElectronAPI } from '@electron-toolkit/preload'
import type { AppConfig } from '../main/config/app-config'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      onGesture: (callback: (data: { gesture_type: string; gesture: string }) => void) => () => void
      onWifiConnected: (cb: () => void) => () => void
      notifyPageChange: (pageIndex: number) => void
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
