import { useEffect } from 'react'

export type GestureType = 'SWIPE_LEFT' | 'SWIPE_RIGHT' | 'SWIPE_UP' | 'SWIPE_DOWN'

type GestureHandler = (gesture: GestureType) => void

/**
 * Subscribe to gesture events from the gesture service.
 * In development on non-Pi machines, arrow keys also fire gestures:
 *   ← ArrowLeft  → SWIPE_LEFT
 *   → ArrowRight → SWIPE_RIGHT
 *   ↑ ArrowUp    → SWIPE_UP
 *   ↓ ArrowDown  → SWIPE_DOWN
 */
export function useGesture(handler: GestureHandler): void {
  useEffect(() => {
    // Real gesture service events
    const unsub = window.api.onGesture((data) => {
      if (data.gesture_type === 'dynamic') {
        const g = data.gesture as GestureType
        if (['SWIPE_LEFT', 'SWIPE_RIGHT', 'SWIPE_UP', 'SWIPE_DOWN'].includes(g)) {
          handler(g)
        }
      }
    })

    // Keyboard fallback for dev / Windows testing
    const onKey = (e: KeyboardEvent): void => {
      const map: Partial<Record<string, GestureType>> = {
        ArrowLeft: 'SWIPE_LEFT',
        ArrowRight: 'SWIPE_RIGHT',
        ArrowUp: 'SWIPE_UP',
        ArrowDown: 'SWIPE_DOWN'
      }
      const gesture = map[e.key]
      if (gesture) handler(gesture)
    }
    window.addEventListener('keydown', onKey)

    return () => {
      unsub()
      window.removeEventListener('keydown', onKey)
    }
  }, [handler])
}
