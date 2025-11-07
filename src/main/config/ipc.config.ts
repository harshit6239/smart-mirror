import { WebSocketService } from '../services/websocket.service'

export default function ipcConfig(ipcMain: Electron.IpcMain, wsService: WebSocketService): void {
  ipcMain.on('ping', () => {
    console.log('pong')
  })

  ipcMain.on('send-gesture', (_event, gestureData: string) => {
    console.log('Gesture data received from renderer:', gestureData)
    wsService.sendMessage(gestureData)
  })
}
