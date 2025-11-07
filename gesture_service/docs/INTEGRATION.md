# Integration Examples

## Python Gesture Service ↔ Electron Integration

### 1. Start the Python Gesture Service

```bash
cd gesture_service
uv run main.py
```

The service will start on `ws://localhost:5001`

### 2. Electron Main Process (Already Configured)

Your existing `websocket.service.ts` will receive gesture events:

```typescript
// In your main process
import { WebSocketService } from './services/websocket.service'

const wsService = new WebSocketService('ws://localhost:5001')
wsService.connect()

// The service automatically broadcasts to all renderer windows
// via the 'gesture-event' channel
```

### 3. Electron Renderer Process

Listen for gesture events in your React components:

```typescript
// In your renderer (React component)
import { useEffect } from 'react'

function App() {
  useEffect(() => {
    // Listen for gesture events from main process
    window.electron.ipcRenderer.on('gesture-event', (event, data) => {
      const gestureData = JSON.parse(data)
      console.log('Gesture received:', gestureData)

      handleGesture(gestureData)
    })

    return () => {
      window.electron.ipcRenderer.removeAllListeners('gesture-event')
    }
  }, [])

  const handleGesture = (gesture: any) => {
    switch (gesture.name) {
      case 'swipe_left':
        // Navigate to previous view
        console.log('Swipe left detected')
        break

      case 'swipe_right':
        // Navigate to next view
        console.log('Swipe right detected')
        break

      case 'swipe_up':
        // Scroll up or show menu
        console.log('Swipe up detected')
        break

      case 'swipe_down':
        // Scroll down or hide menu
        console.log('Swipe down detected')
        break

      case 'open_palm':
        // Show main menu or pause
        console.log('Open palm detected')
        break

      case 'fist':
        // Close menu or select
        console.log('Fist detected')
        break

      case 'point':
        // Point to select
        console.log('Point detected')
        break

      case 'peace':
        // Take screenshot
        console.log('Peace sign detected')
        break

      case 'thumbs_up':
        // Like or confirm
        console.log('Thumbs up detected')
        break

      default:
        console.log('Unknown gesture:', gesture.name)
    }
  }

  return <div>Your app content</div>
}
```

### 4. Example: Gesture-Controlled Clock Widget

```typescript
import { useEffect, useState } from 'react'

function ClockWidget() {
  const [brightness, setBrightness] = useState(100)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    window.electron.ipcRenderer.on('gesture-event', (event, data) => {
      const gesture = JSON.parse(data)

      // Control clock with gestures
      switch (gesture.name) {
        case 'swipe_up':
          // Increase brightness
          setBrightness(prev => Math.min(100, prev + 10))
          break

        case 'swipe_down':
          // Decrease brightness
          setBrightness(prev => Math.max(10, prev - 10))
          break

        case 'fist':
          // Toggle visibility
          setVisible(prev => !prev)
          break
      }
    })

    return () => {
      window.electron.ipcRenderer.removeAllListeners('gesture-event')
    }
  }, [])

  return (
    <div style={{ opacity: visible ? brightness / 100 : 0 }}>
      {/* Clock content */}
    </div>
  )
}
```

### 5. Advanced: Custom Gesture Feedback

Send acknowledgment back to Python service:

```typescript
// In Electron main process
wsService.sendMessage(
  JSON.stringify({
    type: 'gesture_received',
    gesture: 'swipe_left',
    timestamp: Date.now()
  })
)
```

## Testing the Integration

### 1. Test WebSocket Connection

```typescript
// In browser console or Electron renderer
const ws = new WebSocket('ws://localhost:5001')

ws.onopen = () => console.log('Connected!')
ws.onmessage = (event) => console.log('Message:', event.data)

// Subscribe to gesture events
ws.send(JSON.stringify({ type: 'subscribe' }))
```

### 2. Simulate Gestures

Perform gestures in front of your camera and watch for:

- Console output in Python service (terminal)
- Gesture events in Electron main process
- UI updates in renderer process

## Gesture Event Structure

```typescript
interface GestureEvent {
  type: 'gesture'
  name: string // e.g., 'swipe_left', 'open_palm', 'fist'
  hand: 'Left' | 'Right'
  timestamp: number
}
```

## Tips for Smart Mirror

1. **Use swipes for navigation** between widgets/views
2. **Use open palm** to show/hide menu
3. **Use fist** to select or confirm
4. **Use point** for cursor-like interactions
5. **Use thumbs up/down** for like/dislike or volume control
6. **Use specific finger counts** (two_fingers, three_fingers) for shortcuts

## Debugging

Enable debug mode in Python to see camera feed with hand landmarks:

```python
# In gesture_service/src/config.py
config.debug = True
```

This will show a window with the camera feed and detected hand landmarks.
