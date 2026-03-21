import './index.d'
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { AppConfig } from '../main/config/app-config'

// Custom APIs for renderer
const api = {
  onGesture: (callback: (payload) => void) => {
    const listener = (_: unknown, data: string): void => {
      callback(JSON.parse(data))
    }
    ipcRenderer.on('gesture-event', listener)
    return () => ipcRenderer.removeListener('gesture-event', listener)
  },
  onWifiConnected: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('wifi-connected', listener)
    return () => ipcRenderer.removeListener('wifi-connected', listener)
  },
  notifyPageChange: (pageIndex: number): void => {
    ipcRenderer.send('page:changed', pageIndex)
  }
}

const config = {
  /** Returns the full persisted config snapshot */
  get: (): Promise<AppConfig> => ipcRenderer.invoke('config:get'),

  /** Set a key (supports dot-notation for nested paths, e.g. 'wifi.configured') */
  set: (key: string, value: unknown): Promise<void> => ipcRenderer.invoke('config:set', key, value),

  /**
   * Subscribe to any config change.
   * `cb` is called with the full new config whenever a value is persisted.
   * Returns an unsubscribe function.
   */
  onChange: (cb: (newConfig: AppConfig) => void): (() => void) => {
    const listener = (_: unknown, newConfig: AppConfig): void => cb(newConfig)
    ipcRenderer.on('config:changed', listener)
    return () => ipcRenderer.removeListener('config:changed', listener)
  }
}

const system = {
  getStats: (): Promise<{
    cpuPercent: number | null
    memPercent: number | null
    tempC: number | null
  }> => ipcRenderer.invoke('system:stats')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('config', config)
    contextBridge.exposeInMainWorld('system', system)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
  window.config = config
}
