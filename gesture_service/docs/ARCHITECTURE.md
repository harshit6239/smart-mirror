# System Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SMART MIRROR SYSTEM                          │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐          ┌──────────────────────────────┐
│   GESTURE SERVICE        │          │      ELECTRON APP            │
│   (Python)               │          │      (TypeScript/React)      │
│                          │          │                              │
│  ┌────────────────────┐  │          │  ┌────────────────────────┐  │
│  │  Camera Manager    │  │          │  │   Main Process         │  │
│  │  - OpenCV          │  │          │  │   - WebSocket Client   │  │
│  │  - Frame capture   │  │          │  │   - IPC Handler        │  │
│  └──────────┬─────────┘  │          │  └───────────┬────────────┘  │
│             │             │          │              │               │
│             ▼             │          │              │               │
│  ┌────────────────────┐  │          │              │               │
│  │  Gesture Detector  │  │          │              ▼               │
│  │  - MediaPipe       │  │          │  ┌────────────────────────┐  │
│  │  - Hand tracking   │  │          │  │   Renderer Process     │  │
│  └──────────┬─────────┘  │          │  │   - React Components   │  │
│             │             │          │  │   - UI Updates         │  │
│             ▼             │          │  │   - Gesture Handling   │  │
│  ┌────────────────────┐  │          │  └────────────────────────┘  │
│  │ Gesture Recognizer │  │          │                              │
│  │  - Pattern match   │  │          │  ┌────────────────────────┐  │
│  │  - Custom gestures │  │          │  │   Widgets              │  │
│  └──────────┬─────────┘  │          │  │   - Clock              │  │
│             │             │          │  │   - Weather            │  │
│             ▼             │          │  │   - ...                │  │
│  ┌────────────────────┐  │  WebSocket  │  └────────────────────────┘  │
│  │  WebSocket Server  │◄─┼──────────►│                              │
│  │  - Broadcast       │  │  ws://...  │                              │
│  │  - Multi-client    │  │   :5001    │                              │
│  └────────────────────┘  │          │                              │
└──────────────────────────┘          └──────────────────────────────┘
```

## Data Flow

```
1. Camera Capture
   Camera → CameraManager.read_frame() → np.ndarray (frame)

2. Gesture Detection
   Frame → GestureDetector.process_frame() → (frame, gesture_data)

3. Gesture Recognition
   Landmarks → GestureRecognizer.recognize() → gesture_name

4. WebSocket Broadcast
   gesture_data → WebSocketServer.broadcast_gesture() → JSON

5. Electron Reception
   JSON → WebSocketService.onmessage() → IPC Event

6. UI Update
   IPC Event → React Component → UI Change
```

## Module Dependencies

```
main.py
  └── src/app.py (GestureServiceApp)
        ├── src/config.py (AppConfig)
        │     ├── CameraConfig
        │     ├── WebSocketConfig
        │     └── GestureConfig
        │
        ├── src/core/camera.py (CameraManager)
        │     └── src/utils/logger.py
        │
        ├── src/core/detector.py (GestureDetector)
        │     ├── src/gestures/recognizer.py (GestureRecognizer)
        │     ├── src/config.py
        │     └── src/utils/logger.py
        │
        └── src/core/websocket_server.py (WebSocketServer)
              ├── src/config.py
              └── src/utils/logger.py
```

## WebSocket Message Flow

```
┌──────────────┐                              ┌──────────────┐
│   Python     │                              │   Electron   │
│   Service    │                              │     App      │
└──────┬───────┘                              └───────┬──────┘
       │                                              │
       │◄─────── Connect ──────────────────────────────┤
       │                                              │
       ├────────── { type: "subscribed" } ──────────►│
       │                                              │
       │                                              │
       │── { type: "gesture", name: "swipe_left" } ─►│
       │                                              │
       │                                              │
       │◄────────── { type: "ping" } ─────────────────┤
       │                                              │
       ├────────── { type: "pong" } ─────────────────►│
       │                                              │
```

## Component Responsibilities

### Python Gesture Service

| Component           | Responsibility                                                                     |
| ------------------- | ---------------------------------------------------------------------------------- |
| `CameraManager`     | - Open/close camera<br>- Capture frames<br>- Apply mirror flip                     |
| `GestureDetector`   | - Process frames with MediaPipe<br>- Draw landmarks<br>- Cooldown management       |
| `GestureRecognizer` | - Analyze hand landmarks<br>- Recognize gesture patterns<br>- Return gesture names |
| `WebSocketServer`   | - Accept connections<br>- Broadcast messages<br>- Handle client subscriptions      |
| `AppConfig`         | - Centralized settings<br>- Type-safe configuration                                |

### Electron App

| Component          | Responsibility                                                                 |
| ------------------ | ------------------------------------------------------------------------------ |
| `WebSocketService` | - Connect to Python service<br>- Handle reconnection<br>- Forward to renderers |
| `Main Process`     | - Manage app lifecycle<br>- IPC communication                                  |
| `Renderer Process` | - Display UI<br>- Handle gesture events<br>- Update widgets                    |

## Extension Points

### 1. Add New Gestures

```python
# In src/gestures/recognizer.py
def recognize(self, hand_landmarks, hand_label):
    # Add your gesture logic
    if your_condition:
        return "your_gesture_name"
```

### 2. Add New Detectors

```python
# Create src/gestures/face_detector.py
class FaceDetector:
    def detect(self, frame):
        # Your face detection logic
        pass

# Use in src/app.py
self.face_detector = FaceDetector()
```

### 3. Custom Configuration

```python
# In src/config.py
@dataclass
class CustomConfig:
    feature_enabled: bool = True
    threshold: float = 0.5
```

### 4. Additional WebSocket Events

```python
# In src/core/websocket_server.py
async def broadcast_custom_event(self, data):
    message = {"type": "custom", "data": data}
    await self.broadcast_gesture(message)
```

## Performance Characteristics

| Metric                    | Value                 |
| ------------------------- | --------------------- |
| Frame processing          | ~30 FPS               |
| Gesture detection latency | ~50-100ms             |
| WebSocket latency         | ~10-20ms              |
| Total end-to-end latency  | ~70-150ms             |
| CPU usage                 | ~15-25% (single core) |
| Memory usage              | ~200-300 MB           |

## Error Handling

```
Camera Error
  └── Log error → Try to reconnect → Graceful degradation

WebSocket Error
  └── Log error → Keep detecting → Buffer gestures

Gesture Detection Error
  └── Log warning → Skip frame → Continue with next frame

Unhandled Exception
  └── Log critical → Cleanup resources → Exit gracefully
```
