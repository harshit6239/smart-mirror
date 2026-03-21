import { BrowserWindow } from 'electron'
import WebSocket from 'ws'

/** Matches GesturePayload from the Python gesture service */
interface GestureMessage {
  type: 'gesture'
  gesture_type: 'dynamic' | 'static'
  gesture: string
  confidence: number
  timestamp: string
}

const INITIAL_RECONNECT_MS = 3_000
const MAX_RECONNECT_MS = 30_000
const RECONNECT_DECAY = 1.5

export class GestureWebSocketClient {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private nextReconnectMs = INITIAL_RECONNECT_MS
  private stopped = false

  /** Optional callback invoked for every validated gesture, before renderer broadcast. */
  onGesture: ((payload: GestureMessage) => void) | null = null

  constructor(private readonly url: string) {}

  get connected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  start(): void {
    this.stopped = false
    this.nextReconnectMs = INITIAL_RECONNECT_MS
    this.connect()
  }

  stop(): void {
    this.stopped = true
    this.clearReconnectTimer()
    this.closeSocket()
  }

  private connect(): void {
    if (this.stopped) return

    console.log(`[gesture-ws] Connecting to ${this.url}`)

    const ws = new WebSocket(this.url)
    this.ws = ws

    ws.once('open', () => {
      console.log('[gesture-ws] Connected')
      this.nextReconnectMs = INITIAL_RECONNECT_MS
    })

    ws.on('message', (raw) => {
      let msg: unknown
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      if (!isGestureMessage(msg)) return
      const serialised = JSON.stringify(msg)
      this.broadcastToRenderers(serialised)
      this.onGesture?.(msg)
    })

    // 'close' always fires after 'error', so schedule reconnect only here
    ws.once('close', () => {
      this.ws = null
      if (!this.stopped) {
        console.log(`[gesture-ws] Disconnected — retrying in ${this.nextReconnectMs}ms`)
        this.scheduleReconnect()
      }
    })

    ws.once('error', (err) => {
      // Just log — 'close' fires immediately after and handles the reconnect
      console.error(`[gesture-ws] Error: ${err.message}`)
    })
  }

  private broadcastToRenderers(payload: string): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('gesture-event', payload)
      }
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer()
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.nextReconnectMs = Math.min(this.nextReconnectMs * RECONNECT_DECAY, MAX_RECONNECT_MS)
      this.connect()
    }, this.nextReconnectMs)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private closeSocket(): void {
    if (this.ws !== null) {
      this.ws.removeAllListeners()
      this.ws.terminate()
      this.ws = null
    }
  }
}

function isGestureMessage(msg: unknown): msg is GestureMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as Record<string, unknown>)['type'] === 'gesture'
  )
}
