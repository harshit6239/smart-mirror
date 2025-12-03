import { BrowserWindow } from 'electron'
import WebSocket from 'ws'

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'retrying'

export class WebSocketService {
  private ws: WebSocket | null = null
  private url: string
  private reconnectInterval = 3000 // 3 seconds
  private maxReconnectInterval = 30000 // 30 seconds
  private reconnectDecay = 1.5
  private currentReconnectInterval = this.reconnectInterval
  private reconnectTimer: NodeJS.Timeout | null = null
  private isIntentionalDisconnect = false
  private connectionState: ConnectionState = 'disconnected'
  private reconnectAttempts = 0

  constructor(url: string) {
    this.url = url
  }

  connect(): void {
    this.isIntentionalDisconnect = false
    this.reconnectAttempts = 0
    this.currentReconnectInterval = this.reconnectInterval
    this.attemptConnection()
  }

  private attemptConnection(): void {
    if (this.isIntentionalDisconnect) {
      return
    }

    this.updateConnectionState('connecting')
    console.log(`Attempting to connect to WebSocket server at ${this.url}...`)

    try {
      // Clean up existing connection if any
      if (this.ws) {
        this.ws.onopen = null
        this.ws.onclose = null
        this.ws.onerror = null
        this.ws.onmessage = null
        this.ws.close()
        this.ws = null
      }

      this.ws = new WebSocket(this.url)

      this.ws.onopen = (): void => {
        console.log('✓ WebSocket connection established')
        this.reconnectAttempts = 0
        this.currentReconnectInterval = this.reconnectInterval
        this.updateConnectionState('connected')
      }

      this.ws.onmessage = (event): void => {
        const gestureData = event.data.toString()
        console.log('Gesture data received:', gestureData)
        this.broadcastToRenderers('gesture-event', gestureData)
      }

      this.ws.onclose = (event): void => {
        console.log('WebSocket connection closed', event.code, event.reason)
        this.ws = null

        if (!this.isIntentionalDisconnect && !this.reconnectTimer) {
          // Only reconnect if not already scheduled
          this.updateConnectionState('retrying')
          this.scheduleReconnect()
        } else if (this.isIntentionalDisconnect) {
          this.updateConnectionState('disconnected')
        }
      }

      this.ws.onerror = (error): void => {
        console.error('WebSocket error:', error)
        this.updateConnectionState('error')
        // Close the connection manually to ensure onclose is called
        // In some cases, onclose might not fire automatically after onerror
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.close()
        } else if (!this.isIntentionalDisconnect && !this.reconnectTimer) {
          // If connection never opened, schedule reconnect directly
          this.scheduleReconnect()
        }
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      this.updateConnectionState('error')
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.reconnectAttempts++

    // Update state to retrying before scheduling
    this.updateConnectionState('retrying')

    console.log(
      `Reconnecting in ${this.currentReconnectInterval / 1000}s (attempt ${this.reconnectAttempts})...`
    )

    // Broadcast the retry state with the interval
    this.broadcastToRenderers(
      'websocket-state',
      JSON.stringify({
        state: 'retrying',
        attempts: this.reconnectAttempts,
        nextRetryIn: this.currentReconnectInterval
      })
    )

    this.reconnectTimer = setTimeout(() => {
      // Increase reconnect interval with exponential backoff for next time
      this.currentReconnectInterval = Math.min(
        this.currentReconnectInterval * this.reconnectDecay,
        this.maxReconnectInterval
      )
      this.attemptConnection()
    }, this.currentReconnectInterval)
  }

  private updateConnectionState(state: ConnectionState): void {
    this.connectionState = state
    console.log(`Connection state: ${state} (attempt ${this.reconnectAttempts})`)

    // Always broadcast state changes
    this.broadcastToRenderers(
      'websocket-state',
      JSON.stringify({
        state,
        attempts: this.reconnectAttempts,
        nextRetryIn: state === 'retrying' ? this.currentReconnectInterval : 0
      })
    )
  }

  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  sendMessage(message: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message)
    } else {
      console.warn('Cannot send message: WebSocket not connected')
    }
  }

  private broadcastToRenderers(channel: string, data: string): void {
    const windows = BrowserWindow.getAllWindows()
    console.log(`Broadcasting to ${windows.length} window(s):`, channel, data)

    windows.forEach((win) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    })
  }

  disconnect(): void {
    this.isIntentionalDisconnect = true

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.onopen = null
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      this.ws.close()
      this.ws = null
    }

    this.updateConnectionState('disconnected')
  }
}
