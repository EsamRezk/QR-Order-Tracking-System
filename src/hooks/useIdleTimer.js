import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

const CHECK_INTERVAL_MS = 60 * 1000 // Check every 60 seconds
const IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000 // 12 hours

export function useIdleTimer() {
  const { session, logout, updateActivity } = useAuth()
  const lastUpdateRef = useRef(Date.now())

  useEffect(() => {
    // Don't track for screen role or if not authenticated
    if (!session || session.role === 'screen') return

    const throttledUpdate = () => {
      const now = Date.now()
      // Throttle updates to every 30 seconds to avoid excessive writes
      if (now - lastUpdateRef.current > 30000) {
        lastUpdateRef.current = now
        updateActivity()
      }
    }

    // Track user activity
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']
    events.forEach(event => {
      window.addEventListener(event, throttledUpdate, { passive: true })
    })

    // Periodic check for session expiry
    const interval = setInterval(() => {
      const elapsed = Date.now() - (session.lastActivity || 0)
      if (elapsed >= IDLE_TIMEOUT_MS) {
        logout()
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, throttledUpdate)
      })
      clearInterval(interval)
    }
  }, [session, logout, updateActivity])
}
