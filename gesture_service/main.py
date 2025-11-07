"""
Gesture Service - Entry Point
Smart Mirror Gesture Recognition Service
"""

import asyncio
import sys
from src.app import GestureServiceApp


async def main():
    """Main entry point for the gesture service."""
    app = GestureServiceApp()
    await app.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        # Clean exit on Ctrl+C
        print("\n\n👋 Gesture Service stopped by user")
        sys.exit(0)

