import { BrowserWindow } from 'electron'
import { exit } from 'process'

export class WebSocketService {
  private ws: WebSocket | null = null
  private url: string

  constructor(url: string) {
    this.url = url
  }

  connect(): void {
    console.log('Connecting to WebSocket server at', this.url)

    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      console.log('WebSocket connection established in main process')
    }

    this.ws.onmessage = (event) => {
      const gestureData = event.data
      console.log('Gesture data received in main process:', gestureData)
      this.broadcastToRenderers(gestureData)
    }

    this.ws.onclose = () => {
      console.log('WebSocket connection closed in main process')
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error in main process:', error)
      exit(1)
    }
  }

  sendMessage(message: string): void {
    if (this.ws) {
      this.ws.send(message)
    }
  }

  private broadcastToRenderers(data: string): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      console.log('Sending gesture data to renderer window:', data)
      win.webContents.send('gesture-event', data)
    })
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}
