import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      onGesture: (callback: (data) => void) => () => void
    }
  }
}
