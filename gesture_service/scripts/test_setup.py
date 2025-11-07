"""
Test script to verify gesture service setup.

Run this to check if all dependencies are installed and working.
"""

import sys
from pathlib import Path

# Add parent directory to Python path so we can import src modules
parent_dir = Path(__file__).parent.parent
sys.path.insert(0, str(parent_dir))


def test_imports():
    """Test if all required packages are installed."""
    print("Testing imports...")
    
    try:
        import cv2
        print("✓ OpenCV imported successfully")
    except ImportError:
        print("✗ OpenCV not found. Install: pip install opencv-python")
        return False
    
    try:
        import mediapipe
        print("✓ MediaPipe imported successfully")
    except ImportError:
        print("✗ MediaPipe not found. Install: pip install mediapipe")
        return False
    
    try:
        import websockets
        print("✓ websockets imported successfully")
    except ImportError:
        print("✗ websockets not found. Install: pip install websockets")
        return False
    
    return True


def test_camera():
    """Test if camera is accessible."""
    print("\nTesting camera...")
    
    try:
        import cv2
        cap = cv2.VideoCapture(0)
        
        if not cap.isOpened():
            print("✗ Camera not accessible. Check camera connection.")
            return False
        
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            print("✗ Cannot read from camera")
            return False
        
        print(f"✓ Camera working (frame shape: {frame.shape})")
        return True
        
    except Exception as e:
        print(f"✗ Camera test failed: {e}")
        return False


def test_mediapipe():
    """Test MediaPipe Hands initialization."""
    print("\nTesting MediaPipe Hands...")
    
    try:
        import mediapipe as mp
        
        mp_hands = mp.solutions.hands
        hands = mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        hands.close()
        
        print("✓ MediaPipe Hands initialized successfully")
        return True
        
    except Exception as e:
        print(f"✗ MediaPipe test failed: {e}")
        return False


def test_websocket():
    """Test WebSocket server can be created."""
    print("\nTesting WebSocket server...")
    
    try:
        import asyncio
        import websockets
        
        async def test():
            async def handler(websocket):
                pass
            
            # Try to create server
            server = await websockets.serve(handler, "localhost", 5001)
            server.close()
            await server.wait_closed()
            return True
        
        result = asyncio.run(test())
        
        if result:
            print("✓ WebSocket server test passed")
            return True
        
    except OSError as e:
        if "Address already in use" in str(e):
            print("⚠ Port 5001 already in use (this is OK if service is running)")
            return True
        print(f"✗ WebSocket test failed: {e}")
        return False
    except Exception as e:
        print(f"✗ WebSocket test failed: {e}")
        return False


def test_modules():
    """Test if custom modules can be imported."""
    print("\nTesting custom modules...")
    
    try:
        from src.config import config
        print(f"✓ Config imported (WebSocket port: {config.websocket.port})")
        
        from src.core import CameraManager, GestureDetector, WebSocketServer
        print("✓ Core modules imported")
        
        from src.gestures import GestureRecognizer
        print("✓ Gesture modules imported")
        
        from src.utils import get_logger
        print("✓ Utility modules imported")
        
        from src.app import GestureServiceApp
        print("✓ App module imported")
        
        return True
        
    except Exception as e:
        print(f"✗ Module import failed: {e}")
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("Gesture Service - Setup Verification")
    print("=" * 60)
    
    results = {
        "Imports": test_imports(),
        "Camera": test_camera(),
        "MediaPipe": test_mediapipe(),
        "WebSocket": test_websocket(),
        "Modules": test_modules(),
    }
    
    print("\n" + "=" * 60)
    print("Test Results:")
    print("=" * 60)
    
    for test_name, result in results.items():
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{test_name:15s} {status}")
    
    print("=" * 60)
    
    if all(results.values()):
        print("\n🎉 All tests passed! Your setup is ready.")
        print("\nRun the service with: uv run main.py")
        return 0
    else:
        print("\n⚠️  Some tests failed. Please fix the issues above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
