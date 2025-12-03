import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      onGesture: (callback: (data: string) => void) => () => void
      onWebSocketState: (callback: (data: string) => void) => () => void
      getWebSocketState: () => Promise<string>
    }
  }
}
