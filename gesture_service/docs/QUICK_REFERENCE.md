# Quick Reference Guide

## Common Tasks

### Starting the Service

```bash
# From gesture_service directory
uv run main.py
```

### Stopping the Service

- Press `Ctrl+C` in terminal
- Or close the camera window (in debug mode)

### Changing Configuration

Edit `src/config.py`:

```python
# Quick config changes
config.camera.device_id = 0        # Change camera
config.websocket.port = 5001       # Change port
config.gesture.gesture_cooldown = 0.5  # Adjust cooldown
config.debug = True                # Show camera feed
```

## Gesture Quick Reference

| Gesture         | Description           | Use Case        |
| --------------- | --------------------- | --------------- |
| `fist`          | ✊ Closed fist        | Select/Confirm  |
| `open_palm`     | ✋ Open hand          | Menu/Pause      |
| `point`         | ☝️ Index finger       | Point/Select    |
| `peace`         | ✌️ Two fingers up     | Screenshot      |
| `thumbs_up`     | 👍 Thumb up           | Like/Approve    |
| `rock`          | 🤘 Thumb + pinky      | Volume/Settings |
| `two_fingers`   | Index + middle        | Scroll          |
| `three_fingers` | Index + middle + ring | Special action  |
| `four_fingers`  | All except thumb      | Swipe mode      |
| `swipe_left`    | ← Hand left           | Previous        |
| `swipe_right`   | → Hand right          | Next            |
| `swipe_up`      | ↑ Hand up             | Scroll up       |
| `swipe_down`    | ↓ Hand down           | Scroll down     |

## WebSocket Messages

### Subscribe to Gestures

```json
{ "type": "subscribe" }
```

### Ping Server

```json
{ "type": "ping", "timestamp": 1234567890 }
```

### Gesture Event (Received)

```json
{
  "type": "gesture",
  "name": "swipe_left",
  "hand": "Right",
  "timestamp": 1234567890.123
}
```

## Troubleshooting

### Camera not working

```python
# Test camera
import cv2
cap = cv2.VideoCapture(0)
print(cap.isOpened())  # Should be True
```

### Wrong gestures detected

- Adjust `min_detection_confidence` (lower = more sensitive)
- Adjust `gesture_cooldown` (higher = less frequent)
- Improve lighting conditions

### WebSocket connection fails

```bash
# Check if port is in use (Windows)
netstat -ano | findstr :5001

# Check if port is in use (Linux/Mac)
lsof -i :5001
```

### High CPU usage

- Lower `config.camera.fps`
- Reduce `config.camera.width` and `height`
- Set `config.debug = False` (disable camera display)

## Code Snippets

### Custom Gesture in Electron

```typescript
window.electron.ipcRenderer.on('gesture-event', (event, data) => {
  const gesture = JSON.parse(data)

  if (gesture.name === 'swipe_left') {
    // Your code here
  }
})
```

### Add New Gesture

```python
# In src/gestures/recognizer.py
def recognize(self, hand_landmarks, hand_label):
    landmarks = hand_landmarks.landmark
    fingers_up = self._count_fingers_up(landmarks, hand_label)

    # Your custom gesture
    if fingers_up == [1, 0, 1, 0, 1]:  # Thumb, middle, pinky up
        return "my_custom_gesture"
```

### Testing WebSocket

```javascript
// In browser console
const ws = new WebSocket('ws://localhost:5001')
ws.onmessage = (e) => console.log(JSON.parse(e.data))
ws.send(JSON.stringify({ type: 'subscribe' }))
```

## File Structure

```
gesture_service/
├── main.py              # Start here
├── src/
│   ├── app.py           # Main app logic
│   ├── config.py        # Settings
│   ├── core/
│   │   ├── camera.py    # Camera code
│   │   ├── detector.py  # Detection logic
│   │   └── websocket_server.py  # Network
│   ├── gestures/
│   │   └── recognizer.py  # Gesture patterns
│   └── utils/
│       └── logger.py    # Logging
├── README.md            # Full documentation
├── INTEGRATION.md       # Electron integration
├── ARCHITECTURE.md      # System design
└── CUSTOM_GESTURES.py   # Examples
```

## Environment

### Install Dependencies

```bash
uv sync
# or
pip install mediapipe opencv-python websockets
```

### Activate Virtual Environment

```bash
# Windows
.venv\Scripts\activate

# Linux/Mac
source .venv/bin/activate
```

## Logging

### View Logs

Logs are output to console. Levels:

- `DEBUG` - Detailed info (when config.debug = True)
- `INFO` - General info (default)
- `WARNING` - Warning messages
- `ERROR` - Error messages
- `CRITICAL` - Critical errors

### Example Log Output

```
2024-11-07 10:30:00 - src.core.camera - INFO - Camera started: 640x480 @ 30fps
2024-11-07 10:30:01 - src.core.websocket_server - INFO - WebSocket server started on ws://0.0.0.0:5001
2024-11-07 10:30:05 - src.core.detector - INFO - Detected gesture: swipe_left (Right hand)
```

## Performance Tips

1. **Optimize camera settings**
   - Lower resolution if not needed: `config.camera.width = 320`
   - Reduce FPS: `config.camera.fps = 15`

2. **Disable debug mode in production**

   ```python
   config.debug = False  # No camera window
   ```

3. **Adjust cooldown for your use case**

   ```python
   config.gesture.gesture_cooldown = 1.0  # Less frequent
   ```

4. **Limit number of hands**
   ```python
   config.gesture.max_num_hands = 1  # Single hand only
   ```

## Common Patterns

### Gesture-Based Navigation

```typescript
switch (gesture.name) {
  case 'swipe_left':
    navigatePrevious()
    break
  case 'swipe_right':
    navigateNext()
    break
  case 'swipe_up':
    scrollUp()
    break
  case 'swipe_down':
    scrollDown()
    break
}
```

### Gesture-Based Control

```typescript
switch (gesture.name) {
  case 'open_palm':
    showMenu()
    break
  case 'fist':
    hideMenu()
    break
  case 'thumbs_up':
    increaseVolume()
    break
  case 'thumbs_down':
    decreaseVolume()
    break
}
```

### Hand-Specific Actions

```typescript
if (gesture.hand === 'Right') {
  // Right hand actions
} else if (gesture.hand === 'Left') {
  // Left hand actions
}
```
