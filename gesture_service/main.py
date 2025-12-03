"""CLI entry point for launching the gesture WebSocket server."""

from src.backend import run  


def main() -> None:
    """Start the gesture WebSocket service."""

    run()


if __name__ == "__main__":
    main()
