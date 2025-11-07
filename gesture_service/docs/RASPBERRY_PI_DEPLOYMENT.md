# Raspberry Pi Deployment Guide

## 📋 Prerequisites

- Raspberry Pi 3, 4, or 5 (recommended: Pi 4 with 4GB+ RAM)
- Raspberry Pi OS (64-bit recommended)
- USB Camera or Raspberry Pi Camera Module
- Internet connection for initial setup

## 🚀 Quick Setup

### 1. System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install system dependencies
sudo apt install -y \
    python3-pip \
    python3-venv \
    python3-opencv \
    libopencv-dev \
    libatlas-base-dev \
    libjasper-dev \
    libqtgui4 \
    libqt4-test \
    libhdf5-dev
```

### 2. Camera Setup

#### For USB Camera:

```bash
# Camera should work out of the box
# Test with:
v4l2-ctl --list-devices
```

#### For Raspberry Pi Camera Module:

```bash
# Enable camera
sudo raspi-config
# Navigate to: Interface Options > Camera > Enable
# Reboot: sudo reboot

# Test camera
libcamera-hello --list-cameras
```

### 3. Project Setup

```bash
# Clone or copy your project to Raspberry Pi
cd ~
mkdir -p projects
cd projects
# (Copy your gesture_service folder here)

cd gesture_service

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install Python dependencies
pip install mediapipe opencv-python websockets

# Or use requirements.txt
pip install -r requirements.txt
```

### 4. Use Raspberry Pi Configuration

```bash
# Backup Windows config
mv src/config.py src/config_windows.py

# Use Raspberry Pi optimized config
cp config_raspberry_pi.py src/config.py
```

### 5. Test the Service

```bash
# Run setup verification
uv run scripts/test_setup.py

# If all tests pass, run the service
uv run main.py
```

## ⚙️ Configuration for Raspberry Pi

### Recommended Settings

Edit `src/config.py`:

```python
# Camera - Lower resolution for better performance
config.camera.width = 320
config.camera.height = 240
config.camera.fps = 15

# Gesture - Lower thresholds for faster processing
config.gesture.min_detection_confidence = 0.5
config.gesture.min_tracking_confidence = 0.3
config.gesture.max_num_hands = 1

# Debug - Disable for headless operation
config.debug = False
```

### For Raspberry Pi 5 (Better Performance)

```python
config.camera.width = 640
config.camera.height = 480
config.camera.fps = 20
```

### For Raspberry Pi 3 (Lower Performance)

```python
config.camera.width = 240
config.camera.height = 180
config.camera.fps = 10
```

## 🔧 Optimization Tips

### 1. Overclock (Optional)

```bash
sudo nano /boot/config.txt

# Add for Raspberry Pi 4:
over_voltage=6
arm_freq=2000

# Reboot
sudo reboot
```

### 2. Increase GPU Memory

```bash
sudo raspi-config
# Performance Options > GPU Memory > 256
```

### 3. Disable Desktop Environment (Headless)

```bash
sudo raspi-config
# System Options > Boot / Auto Login > Console
```

### 4. Use Lite Model (If Performance Issues)

Create a custom detector with lighter MediaPipe model:

```python
# In src/core/detector.py
self.hands = self.mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,  # Single hand only
    model_complexity=0,  # Use lite model (0 = lite, 1 = full)
    min_detection_confidence=0.5,
    min_tracking_confidence=0.3,
)
```

## 🚀 Auto-Start on Boot

### Method 1: systemd Service (Recommended)

Create service file:

```bash
sudo nano /etc/systemd/system/gesture-service.service
```

Add:

```ini
[Unit]
Description=Gesture Recognition Service
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/projects/gesture_service
Environment="PATH=/home/pi/projects/gesture_service/.venv/bin"
ExecStart=/home/pi/projects/gesture_service/.venv/bin/python main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable gesture-service
sudo systemctl start gesture-service
sudo systemctl status gesture-service
```

View logs:

```bash
journalctl -u gesture-service -f
```

### Method 2: Cron (Simpler)

```bash
crontab -e

# Add:
@reboot sleep 30 && cd /home/pi/projects/gesture_service && /home/pi/projects/gesture_service/.venv/bin/python main.py > /tmp/gesture.log 2>&1
```

## 📊 Performance Monitoring

### Check CPU Usage

```bash
# While service is running
top -p $(pgrep -f main.py)
```

### Check Temperature

```bash
vcgencmd measure_temp
```

### Monitor in Real-time

```bash
watch -n 1 'vcgencmd measure_temp && vcgencmd measure_clock arm'
```

## 🐛 Troubleshooting

### Camera Not Detected

```bash
# List USB cameras
v4l2-ctl --list-devices

# Test camera
sudo apt install fswebcam
fswebcam test.jpg

# For Pi Camera
libcamera-still -o test.jpg
```

### Low FPS / Laggy

- Lower camera resolution
- Reduce FPS
- Use model_complexity=0
- Disable debug mode
- Single hand detection only

### High CPU Temperature

```bash
# Check temp
vcgencmd measure_temp

# If over 70°C, add cooling:
# - Install heatsink
# - Add fan
# - Improve ventilation
```

### Memory Issues

```bash
# Check memory
free -h

# Increase swap if needed
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# Set: CONF_SWAPSIZE=2048
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

## 🌐 Network Configuration

### Allow WebSocket Connections

```bash
# If using firewall
sudo ufw allow 5001/tcp

# Check listening ports
sudo netstat -tlnp | grep 5001
```

### Static IP (Optional)

```bash
sudo nano /etc/dhcpcd.conf

# Add:
interface wlan0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

## 📱 Testing from Electron

```typescript
// Connect to Raspberry Pi WebSocket
const ws = new WebSocket('ws://RASPBERRY_PI_IP:5001')

ws.onopen = () => {
  console.log('Connected to Raspberry Pi gesture service')
  ws.send(JSON.stringify({ type: 'subscribe' }))
}

ws.onmessage = (event) => {
  const gesture = JSON.parse(event.data)
  console.log('Gesture from Pi:', gesture)
}
```

## 🎯 Production Checklist

- [ ] Install all system dependencies
- [ ] Set up camera correctly
- [ ] Use optimized config for your Pi model
- [ ] Test gesture detection
- [ ] Set up auto-start service
- [ ] Configure static IP (optional)
- [ ] Test from Electron app
- [ ] Monitor temperature and CPU usage
- [ ] Add cooling if needed
- [ ] Set up logging for debugging

## 📈 Expected Performance

| Raspberry Pi Model | Resolution | FPS   | CPU Usage | Latency   |
| ------------------ | ---------- | ----- | --------- | --------- |
| Pi 3B+             | 320x240    | 10-12 | ~60%      | 150-200ms |
| Pi 4 (4GB)         | 320x240    | 15-20 | ~40%      | 100-150ms |
| Pi 4 (4GB)         | 640x480    | 10-15 | ~60%      | 150-200ms |
| Pi 5 (8GB)         | 640x480    | 20-25 | ~30%      | 80-120ms  |

## 🔐 Security Tips

```bash
# Change default password
passwd

# Update regularly
sudo apt update && sudo apt upgrade -y

# Only allow WebSocket from smart mirror
# (Configure firewall to allow only your Electron app's IP)
```

## 📝 Maintenance

### Update Gesture Service

```bash
cd ~/projects/gesture_service
git pull  # If using git
sudo systemctl restart gesture-service
```

### View Logs

```bash
# If using systemd
journalctl -u gesture-service -n 100 -f

# If using cron
tail -f /tmp/gesture.log
```

### Backup Configuration

```bash
cp src/config.py ~/config_backup.py
```

## 🎉 You're Ready!

Your gesture service is now deployed on Raspberry Pi and ready to power your smart mirror! 🚀
