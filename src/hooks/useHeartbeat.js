import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const HEARTBEAT_INTERVAL_MS = 30 * 1000 // 30 seconds

export function useHeartbeat() {
  const { session } = useAuth()
  const location = useLocation()
  const intervalRef = useRef(null)
  const currentPageRef = useRef('')

  useEffect(() => {
    if (!session?.sessionId) return

    const currentPage = location.pathname + location.search

    const sendHeartbeat = async (page) => {
      try {
        await supabase.rpc('rpc_upsert_heartbeat', {
          p_session_id: session.sessionId,
          p_current_page: page,
        })
      } catch {
        // Silent fail — heartbeat is non-critical
      }
    }

    // Send immediately on page change
    currentPageRef.current = currentPage
    sendHeartbeat(currentPage)

    // Clear previous interval and set new one
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      sendHeartbeat(currentPageRef.current)
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [session?.sessionId, location.pathname, location.search])
}
