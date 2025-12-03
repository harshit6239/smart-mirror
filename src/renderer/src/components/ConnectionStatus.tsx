import { useEffect, useState } from 'react'

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error' | 'retrying'

interface ConnectionStateData {
  state: ConnectionState
  attempts: number
  nextRetryIn: number
}

export default function ConnectionStatus(): React.JSX.Element | null {
  const [connectionState, setConnectionState] = useState<ConnectionStateData>({
    state: 'connecting',
    attempts: 0,
    nextRetryIn: 0
  })

  useEffect(() => {
    console.log('[ConnectionStatus] Setting up WebSocket state listener')

    // Get initial state
    window.api.getWebSocketState().then((data) => {
      console.log('[ConnectionStatus] Got initial state:', data)
      const parsed = JSON.parse(data) as ConnectionStateData
      console.log('[ConnectionStatus] Parsed initial state:', parsed)
      setConnectionState(parsed)
    })

    // Listen for state changes
    const unsubscribe = window.api.onWebSocketState((data: string) => {
      console.log('[ConnectionStatus] Received WebSocket state:', data)
      const parsed = JSON.parse(data) as ConnectionStateData
      console.log('[ConnectionStatus] Parsed state:', parsed)
      setConnectionState(parsed)
    })

    return () => {
      console.log('[ConnectionStatus] Cleaning up WebSocket state listener')
      unsubscribe()
    }
  }, [])

  // Don't show anything when connected
  if (connectionState.state === 'connected') {
    console.log('[ConnectionStatus] Connected - hiding overlay')
    return null
  }

  console.log('[ConnectionStatus] Rendering overlay with state:', connectionState)

  const getStatusMessage = (): string => {
    switch (connectionState.state) {
      case 'connecting':
        return 'Connecting to gesture service...'
      case 'retrying':
        return `Reconnecting... (Attempt ${connectionState.attempts})`
      case 'error':
        return 'Connection error. Retrying...'
      case 'disconnected':
        return 'Disconnected from gesture service'
      default:
        return 'Connecting...'
    }
  }

  const getStatusColor = (): string => {
    switch (connectionState.state) {
      case 'connecting':
        return 'bg-blue-500'
      case 'retrying':
        return 'bg-yellow-500'
      case 'error':
        return 'bg-red-500'
      case 'disconnected':
        return 'bg-gray-500'
      default:
        return 'bg-blue-500'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
      <div className="text-center">
        {/* Animated spinner */}
        <div className="mb-6 flex justify-center">
          <div
            className={`h-16 w-16 animate-spin rounded-full border-4 border-gray-300 ${getStatusColor()} border-t-transparent`}
          ></div>
        </div>

        {/* Status message */}
        <h2 className="mb-2 text-2xl font-semibold text-white">{getStatusMessage()}</h2>

        {/* Retry info */}
        {connectionState.state === 'retrying' && connectionState.nextRetryIn > 0 && (
          <p className="text-sm text-gray-400">
            Next attempt in {Math.round(connectionState.nextRetryIn / 1000)}s
          </p>
        )}

        {/* Connection tips */}
        {(connectionState.state === 'error' || connectionState.state === 'retrying') &&
          connectionState.attempts > 3 && (
            <div className="mt-6 max-w-md rounded-lg bg-gray-800 p-4 text-left text-sm text-gray-300">
              <p className="mb-2 font-semibold text-white">Troubleshooting:</p>
              <ul className="list-inside list-disc space-y-1">
                <li>Make sure the gesture service is running</li>
                <li>
                  Run: <code className="rounded bg-gray-700 px-1">uv run main.py</code>
                </li>
                <li>Check if port 5001 is available</li>
                <li>Verify WebSocket URL in .env</li>
              </ul>
            </div>
          )}
      </div>
    </div>
  )
}
