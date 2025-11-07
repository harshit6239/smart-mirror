# Configuration Guide

## Overview

The gesture service uses a **hybrid configuration approach**:

1. **Built-in defaults** - Works out of the box (committed to git)
2. **Profile system** - Optimized presets for different platforms
3. **Environment overrides** - Optional `.env` file for custom values

> **Note for Windows PowerShell users:** Environment variable syntax is different!
>
> - PowerShell: `$env:VAR='value'; command`
> - Bash/Linux: `VAR=value command`

## Quick Start

### No Configuration Needed

```bash
# Just run it - uses sensible defaults
uv run main.py
```

Default settings:

- Camera: 640x480 @ 30fps
- Max hands: 2
- Debug mode: ON (shows camera feed)
- WebSocket: 0.0.0.0:5001

## Configuration Profiles

### Default Profile (Windows/Linux Development)

```bash
uv run main.py
```

**Settings:**

- Camera: 640x480 @ 30fps
- Max hands: 2
- Debug: ON (shows camera feed with landmarks)
- Best for: Development, testing, debugging

### Raspberry Pi Profile (Production)

**On Windows PowerShell:**

```powershell
$env:CONFIG_PROFILE='raspberry_pi'; uv run main.py
```

**On Linux/Mac/WSL:**

```bash
CONFIG_PROFILE=raspberry_pi uv run main.py
```

**Settings:**

- Camera: 320x240 @ 15fps (optimized for Pi performance)
- Max hands: 1 (better performance)
- Debug: OFF (headless, no display)
- Best for: Production deployment on Raspberry Pi

## Environment Variable Overrides

### When to Use `.env`

Create a `.env` file **only if** you need to:

- Override specific values
- Use different hardware (different camera)
- Change network settings
- Customize for your specific setup

### How to Use `.env`

1. Copy the template:

   ```bash
   cp config/.env.example .env
   ```

2. Uncomment and modify only the values you want to override:

   ```bash
   # Override just the camera resolution
   CAMERA_WIDTH=1280
   CAMERA_HEIGHT=720
   ```

3. The `.env` file is gitignored and won't be committed

### Available Environment Variables

```bash
# Profile selection
CONFIG_PROFILE=raspberry_pi  # 'default' or 'raspberry_pi'

# Camera settings
CAMERA_DEVICE_ID=0
CAMERA_WIDTH=640
CAMERA_HEIGHT=480
CAMERA_FPS=30

# WebSocket settings
WEBSOCKET_HOST=0.0.0.0
WEBSOCKET_PORT=5001

# Gesture detection
GESTURE_MIN_DETECTION_CONFIDENCE=0.7
GESTURE_MIN_TRACKING_CONFIDENCE=0.5
GESTURE_MAX_NUM_HANDS=2
GESTURE_COOLDOWN=0.5

# Debug mode
DEBUG=true
```

## Configuration Examples

### Example 1: Default (No .env file)

```bash
uv run main.py
```

Result: 640x480 @ 30fps, 2 hands, debug ON

### Example 2: Raspberry Pi Profile

**Windows PowerShell:**

```powershell
$env:CONFIG_PROFILE='raspberry_pi'; uv run main.py
```

**Linux/Mac:**

```bash
CONFIG_PROFILE=raspberry_pi uv run main.py
```

Result: 320x240 @ 15fps, 1 hand, debug OFF

### Example 3: Raspberry Pi with Custom Port

Create `.env`:

```bash
CONFIG_PROFILE=raspberry_pi
WEBSOCKET_PORT=8080
```

Run:

```bash
uv run main.py
```

Result: Pi settings + custom port 8080

### Example 4: High Resolution Camera

Create `.env`:

```bash
CAMERA_WIDTH=1920
CAMERA_HEIGHT=1080
CAMERA_FPS=60
```

Run:

```bash
uv run main.py
```

Result: Full HD @ 60fps (if your camera supports it)

### Example 5: Multiple Cameras Setup

Create `.env`:

```bash
CAMERA_DEVICE_ID=1  # Use second camera
WEBSOCKET_PORT=5002 # Different port
```

### Example 6: Headless Mode on Windows

Create `.env`:

```bash
DEBUG=false  # No camera window display
```

## Configuration Priority

The configuration is loaded in this order (later values override earlier):

1. **Built-in defaults** (in `src/config.py`)
2. **Profile settings** (if CONFIG_PROFILE is set)
3. **Environment variables** (from `.env` file or system)

Example:

```bash
# Default says: width=640
# Raspberry Pi profile says: width=320
# .env says: CAMERA_WIDTH=800

# Result: width=800 (.env wins)
```

## Platform-Specific Setup

### Windows Development

No setup needed:

```powershell
uv run main.py
```

**To test Raspberry Pi profile on Windows:**

```powershell
$env:CONFIG_PROFILE='raspberry_pi'; uv run main.py
```

### Raspberry Pi Production

```bash
# Method 1: Use environment variable
CONFIG_PROFILE=raspberry_pi uv run main.py

# Method 2: Create .env with profile
echo "CONFIG_PROFILE=raspberry_pi" > .env
uv run main.py

# Method 3: Set in systemd service
# See docs/RASPBERRY_PI_DEPLOYMENT.md
```

### Linux Desktop

Same as Windows - default profile works great:

```bash
uv run main.py
```

## Troubleshooting

### Check Current Configuration

```bash
uv run python -c "from src.config import config; print(f'Camera: {config.camera.width}x{config.camera.height}'); print(f'Port: {config.websocket.port}'); print(f'Debug: {config.debug}')"
```

### .env Not Working?

1. Make sure `.env` is in the root `gesture_service/` folder
2. Check file format (no quotes around values)
3. Variable names are case-sensitive
4. Restart the service after changing `.env`

### Which Profile Am I Using?

```bash
# On Windows
echo $env:CONFIG_PROFILE

# On Linux/Mac
echo $CONFIG_PROFILE
```

If empty or not set, you're using the default profile.

## Best Practices

1. **Development**: Use default profile, no `.env` needed
2. **Production (Pi)**: Use `CONFIG_PROFILE=raspberry_pi`
3. **Custom hardware**: Create `.env` with only necessary overrides
4. **Version control**: Never commit `.env` (it's gitignored)
5. **Documentation**: Document your `.env` settings in your deployment notes
6. **Testing**: Use `scripts/test_setup.py` after changing configuration

## Summary

| Scenario               | Configuration Method                            |
| ---------------------- | ----------------------------------------------- |
| Quick test/development | No setup needed                                 |
| Windows development    | Default (no .env)                               |
| Raspberry Pi           | `CONFIG_PROFILE=raspberry_pi`                   |
| Custom camera          | Create `.env`, set CAMERA\_\* vars              |
| Different port         | Create `.env`, set WEBSOCKET_PORT               |
| Multiple instances     | Create `.env` per instance with different ports |
| Production deployment  | Profile + `.env` for overrides                  |
