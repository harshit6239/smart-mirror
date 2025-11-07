#!/usr/bin/env python3
"""
Quick Start Script
Run this to get started immediately with gesture control!
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to Python path so we can import src modules
parent_dir = Path(__file__).parent.parent
sys.path.insert(0, str(parent_dir))


def print_header():
    """Print welcome header."""
    print("=" * 70)
    print("🤚 GESTURE SERVICE - QUICK START 🤚")
    print("=" * 70)
    print()


def print_instructions():
    """Print quick start instructions."""
    print("📋 QUICK START INSTRUCTIONS:")
    print()
    print("1. ✅ Dependencies installed (run 'uv sync' if not)")
    print("2. 📸 Make sure your camera is connected")
    print("3. 🚀 Service will start on ws://localhost:5001")
    print("4. 🖥️  Connect from Electron: new WebSocket('ws://localhost:5001')")
    print()
    print("=" * 70)
    print()


def print_gestures():
    """Print supported gestures."""
    print("🤚 SUPPORTED GESTURES:")
    print()
    gestures = [
        ("✊", "Fist", "Close all fingers"),
        ("✋", "Open Palm", "Open all fingers"),
        ("☝️", "Point", "Index finger only"),
        ("✌️", "Peace", "Index + middle fingers"),
        ("👍", "Thumbs Up", "Thumb up"),
        ("🤘", "Rock", "Thumb + pinky"),
        ("⬅️", "Swipe Left", "Hand pointing left"),
        ("➡️", "Swipe Right", "Hand pointing right"),
        ("⬆️", "Swipe Up", "Hand pointing up"),
        ("⬇️", "Swipe Down", "Hand pointing down"),
    ]
    
    for emoji, name, description in gestures:
        print(f"  {emoji}  {name:15s} - {description}")
    
    print()
    print("=" * 70)
    print()


def print_tips():
    """Print usage tips."""
    print("💡 TIPS:")
    print()
    print("  • Ensure good lighting for better detection")
    print("  • Position hand clearly in front of camera")
    print("  • Wait ~0.5s between gestures (cooldown)")
    print("  • Press Ctrl+C to stop the service")
    print("  • Check console for detected gestures")
    print()
    print("=" * 70)
    print()


def check_requirements():
    """Check if required packages are installed."""
    print("🔍 Checking requirements...")
    print()
    
    missing = []
    
    try:
        import cv2
        print("  ✅ OpenCV")
    except ImportError:
        print("  ❌ OpenCV")
        missing.append("opencv-python")
    
    try:
        import mediapipe
        print("  ✅ MediaPipe")
    except ImportError:
        print("  ❌ MediaPipe")
        missing.append("mediapipe")
    
    try:
        import websockets
        print("  ✅ WebSockets")
    except ImportError:
        print("  ❌ WebSockets")
        missing.append("websockets")
    
    print()
    
    if missing:
        print(f"❌ Missing packages: {', '.join(missing)}")
        print()
        print("Run: uv sync")
        print("Or:  pip install " + " ".join(missing))
        print()
        return False
    
    print("✅ All requirements satisfied!")
    print()
    return True


async def main():
    """Run quick start."""
    print_header()
    
    if not check_requirements():
        print("=" * 70)
        print("Please install missing packages first.")
        print("=" * 70)
        return 1
    
    print_instructions()
    print_gestures()
    print_tips()
    
    print("🚀 Starting Gesture Service...")
    print()
    print("=" * 70)
    print()
    
    # Import and run the actual app
    try:
        from src.app import GestureServiceApp
        app = GestureServiceApp()
        await app.run()
        return 0
    except KeyboardInterrupt:
        print("\n\n👋 Gesture Service stopped by user")
        return 0
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        print("\nCheck the logs above for details.")
        return 1


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        print("\n\n👋 Goodbye!")
        sys.exit(0)
