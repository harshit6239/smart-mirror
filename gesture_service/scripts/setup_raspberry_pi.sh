#!/bin/bash
# Raspberry Pi Setup Script for Gesture Service

echo "=========================================="
echo "Gesture Service - Raspberry Pi Setup"
echo "=========================================="
echo ""

# Check if running on Raspberry Pi
if [ ! -f /proc/device-tree/model ]; then
    echo "⚠️  Warning: This doesn't appear to be a Raspberry Pi"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "📦 Installing system dependencies..."
sudo apt update
sudo apt install -y \
    python3-pip \
    python3-venv \
    python3-opencv \
    libopencv-dev \
    libatlas-base-dev

echo ""
echo "🐍 Creating Python virtual environment..."
python3 -m venv .venv
source .venv/bin/activate

echo ""
echo "📚 Installing Python packages..."
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "⚙️  Setting up Raspberry Pi configuration..."
if [ -f "config_raspberry_pi.py" ]; then
    # Backup current config if exists
    if [ -f "src/config.py" ]; then
        echo "Backing up current config..."
        mv src/config.py src/config_backup.py
    fi
    
    # Copy Raspberry Pi config
    cp config_raspberry_pi.py src/config.py
    echo "✅ Raspberry Pi configuration installed"
else
    echo "⚠️  config_raspberry_pi.py not found, keeping current config"
fi

echo ""
echo "🧪 Running setup tests..."
python test_setup.py

echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "To run the service:"
echo "  source .venv/bin/activate"
echo "  python main.py"
echo ""
echo "To set up auto-start, see: RASPBERRY_PI_DEPLOYMENT.md"
echo ""
