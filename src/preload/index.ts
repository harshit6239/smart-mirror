import './index.d'
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  onGesture: (callback: (payload) => void) => {
    const listener = (_: unknown, data: string): void => {
      callback(JSON.parse(data))
    }
    ipcRenderer.on('gesture-event', listener)
    return () => ipcRenderer.removeListener('gesture-event', listener)
  },
  onWebSocketState: (callback: (data: string) => void) => {
    const listener = (_: unknown, data: string): void => {
      callback(data) // Pass raw string, let component parse it
    }
    ipcRenderer.on('websocket-state', listener)
    return () => ipcRenderer.removeListener('websocket-state', listener)
  },
  getWebSocketState: () => {
    return ipcRenderer.invoke('get-websocket-state')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
