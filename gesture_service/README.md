# Gesture Service for Smart Mirror

A modular, extensible gesture recognition service that detects hand gestures using MediaPipe and sends events to an Electron app via WebSocket.

## 📁 Project Structure

```
gesture_service/
├── main.py                 # Entry point - start here
├── pyproject.toml          # uv project configuration
│
├── src/                    # Source code
│   ├── app.py             # Main application orchestrator
│   ├── config.py          # Configuration management
│   ├── core/              # Core functionality
│   │   ├── camera.py      # Camera management
│   │   ├── detector.py    # Gesture detection
│   │   └── websocket_server.py  # WebSocket server
│   ├── gestures/          # Gesture recognition
│   │   └── recognizer.py  # Gesture recognition logic
│   └── utils/             # Utilities
│       └── logger.py      # Logging system
│
├── config/                # Configuration files
│   ├── .env.example       # Environment variables template
│   └── config_raspberry_pi.py  # Raspberry Pi optimized config
│
├── scripts/               # Utility scripts
│   ├── test_setup.py      # Verify installation
│   ├── quickstart.py      # Interactive quick start
│   └── setup_raspberry_pi.sh  # Raspberry Pi setup script
│
└── docs/                  # Documentation
    ├── ARCHITECTURE.md    # System design & architecture
    ├── INTEGRATION.md     # Electron integration guide
    ├── QUICK_REFERENCE.md # Quick commands & troubleshooting
    ├── RASPBERRY_PI_DEPLOYMENT.md  # Raspberry Pi guide
    ├── CROSS_PLATFORM.md  # Platform compatibility
    ├── OVERVIEW.md        # Visual overview
    ├── SUMMARY.md         # Project summary
    └── examples.py        # Custom gesture examples
```

## Features

### ✨ Core Features

- **Real-time gesture detection** using MediaPipe Hands
- **WebSocket communication** with Electron app
- **Modular architecture** for easy extension
- **Configurable settings** for camera, detection, and network
- **Gesture cooldown** to prevent duplicate detections
- **Multi-client support** for WebSocket connections
- **Cross-platform** - Works on Windows, Linux, Raspberry Pi

### 🤚 Supported Gestures

- `fist` - Closed fist
- `open_palm` - Open hand
- `point` - Index finger pointing
- `peace` - Peace sign (index + middle finger)
- `thumbs_up` - Thumb up
- `rock` - Rock sign (thumb + pinky)
- `two_fingers` - Index + middle fingers
- `three_fingers` - Index + middle + ring fingers
- `four_fingers` - All fingers except thumb
- `swipe_left`, `swipe_right`, `swipe_up`, `swipe_down` - Directional swipes

## Installation

1. Install dependencies using uv:

```bash
uv sync
```

2. **(Optional)** Create `.env` file for custom configuration:

```bash
# Copy template if you need custom settings
cp config/.env.example .env

# The service works out of the box with sensible defaults
# Only create .env if you need to override specific values
```

## Usage

### Running the Service

**Default configuration (Windows/Linux):**

```bash
uv run main.py
```

**Raspberry Pi optimized configuration:**

On Windows PowerShell:

```powershell
$env:CONFIG_PROFILE='raspberry_pi'; uv run main.py
```

On Linux/Mac/Raspberry Pi:

```bash
CONFIG_PROFILE=raspberry_pi uv run main.py
```

The service will:

1. Start the camera (default: device 0)
2. Initialize MediaPipe Hands for gesture detection
3. Start WebSocket server on `ws://0.0.0.0:5001`
4. Begin detecting and broadcasting gestures

### Configuration

The service uses a **hybrid configuration approach**:

#### Built-in Profiles (No .env needed)

**Default Profile** (Windows/Linux development):

- Camera: 640x480 @ 30fps
- Max hands: 2
- Debug mode: ON (shows camera feed)

**Raspberry Pi Profile** (Production):

Windows PowerShell:

```powershell
$env:CONFIG_PROFILE='raspberry_pi'; uv run main.py
```

Linux/Mac/Raspberry Pi:

```bash
CONFIG_PROFILE=raspberry_pi uv run main.py
```

- Camera: 320x240 @ 15fps (optimized for Pi)
- Max hands: 1 (better performance)
- Debug mode: OFF (headless)

#### Optional Environment Variable Overrides

Create a `.env` file to override any default values:

**Camera Settings:**

```bash
CAMERA_DEVICE_ID=0          # Camera device ID
CAMERA_WIDTH=640            # Frame width
CAMERA_HEIGHT=480           # Frame height
CAMERA_FPS=30               # Frames per second
```

**WebSocket Settings:**

```bash
WEBSOCKET_HOST=0.0.0.0      # Server host
WEBSOCKET_PORT=5001         # Server port
```

**Gesture Detection Settings:**

```bash
GESTURE_MIN_DETECTION_CONFIDENCE=0.7   # Detection confidence
GESTURE_MIN_TRACKING_CONFIDENCE=0.5    # Tracking confidence
GESTURE_MAX_NUM_HANDS=2                # Max hands to detect
GESTURE_COOLDOWN=0.5                   # Cooldown in seconds
```

**Debug Mode:**

```bash
DEBUG=true                  # Shows camera feed with landmarks
```

**Profile Selection:**

```bash
CONFIG_PROFILE=raspberry_pi  # Use 'raspberry_pi' or 'default'
```

#### Configuration Examples

**Example 1: Default settings (no .env needed)**

```bash
uv run main.py
# Uses: 640x480 @ 30fps, 2 hands, debug ON
```

**Example 2: Raspberry Pi profile**

Windows PowerShell:

```powershell
$env:CONFIG_PROFILE='raspberry_pi'; uv run main.py
# Uses: 320x240 @ 15fps, 1 hand, debug OFF
```

Linux/Mac/Raspberry Pi:

```bash
CONFIG_PROFILE=raspberry_pi uv run main.py
# Uses: 320x240 @ 15fps, 1 hand, debug OFF
```

**Example 3: Raspberry Pi with custom port**
Create `.env`:

```bash
CONFIG_PROFILE=raspberry_pi
WEBSOCKET_PORT=8080
```

**Example 4: Custom resolution only**
Create `.env`:

```bash
CAMERA_WIDTH=1280
CAMERA_HEIGHT=720
```

## WebSocket Protocol

### Message Format

#### Gesture Event (Server → Client)

```json
{
  "type": "gesture",
  "name": "open_palm",
  "hand": "Right",
  "timestamp": 1699372800.123
}
```

#### Status Event (Server → Client)

```json
{
  "type": "status",
  "status": "started",
  "service": "gesture_recognition"
}
```

#### Ping/Pong (Client ↔ Server)

```json
// Client sends
{
  "type": "ping",
  "timestamp": 1699372800.123
}

// Server responds
{
  "type": "pong",
  "timestamp": 1699372800.123
}
```

#### Subscribe (Client → Server)

```json
{
  "type": "subscribe"
}

// Server responds
{
  "type": "subscribed",
  "status": "success"
}
```

## Extending the Service

### Adding New Gestures

1. Open `src/gestures/recognizer.py`
2. Add your gesture logic in the `recognize()` method:

```python
def recognize(self, hand_landmarks, hand_label: str) -> Optional[str]:
    landmarks = hand_landmarks.landmark
    fingers_up = self._count_fingers_up(landmarks, hand_label)

    # Add your custom gesture
    if fingers_up == [1, 0, 1, 0, 1]:
        return "custom_gesture"

    # ... rest of the code
```

### Adding New Detection Methods

1. Create a new recognizer class in `src/gestures/`
2. Import and use it in `src/core/detector.py`

### Custom Configuration

Add new configuration dataclasses in `src/config.py`:

```python
@dataclass
class CustomConfig:
    setting1: str = "value"
    setting2: int = 42

@dataclass
class AppConfig:
    # ... existing configs
    custom: CustomConfig = CustomConfig()
```

## Integration with Electron

### Example Electron Integration

```typescript
// In your Electron main process or renderer
const ws = new WebSocket('ws://localhost:5001')

ws.onopen = () => {
  console.log('Connected to gesture service')
  ws.send(JSON.stringify({ type: 'subscribe' }))
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)

  if (data.type === 'gesture') {
    console.log(`Gesture detected: ${data.name} (${data.hand})`)

    // Handle different gestures
    switch (data.name) {
      case 'swipe_left':
        // Navigate left
        break
      case 'swipe_right':
        // Navigate right
        break
      case 'open_palm':
        // Show menu
        break
      // ... handle other gestures
    }
  }
}
```

## Development

### Project Structure Benefits

- **`src/core/`**: Core functionality that rarely changes
- **`src/gestures/`**: Easy to add/modify gesture recognition
- **`src/utils/`**: Shared utilities across the project
- **`src/config.py`**: Centralized configuration
- **`src/app.py`**: Application orchestration and lifecycle

### Best Practices

1. **Add logging**: Use `logger.info()`, `logger.debug()`, etc.
2. **Handle errors gracefully**: All modules have proper error handling
3. **Type hints**: All functions have type annotations
4. **Documentation**: Docstrings for all classes and methods

## Troubleshooting

### Camera not detected

- Check if camera is available: `cv2.VideoCapture(0).isOpened()`
- Try different device IDs in `config.camera.device_id`

### WebSocket connection fails

- Check if port 5001 is available
- Verify firewall settings
- Try different host/port in config

### Gestures not detected

- Ensure good lighting
- Adjust `min_detection_confidence` and `min_tracking_confidence`
- Check camera position and hand visibility

## License

MIT
