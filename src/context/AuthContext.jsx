import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const SESSION_KEY = 'kz_session'
const IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000 // 12 hours

function getStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

function isSessionValid(session) {
  if (!session) return false
  // Screen sessions never expire
  if (session.role === 'screen') return true
  // User/admin: check 12h inactivity
  const elapsed = Date.now() - (session.lastActivity || 0)
  return elapsed < IDLE_TIMEOUT_MS
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const stored = getStoredSession()
    if (isSessionValid(stored)) return stored
    if (stored) localStorage.removeItem(SESSION_KEY)
    return null
  })
  const navigate = useNavigate()

  // Sync session state if localStorage changes in another tab
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === SESSION_KEY) {
        const newSession = e.newValue ? JSON.parse(e.newValue) : null
        setSession(newSession)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const login = useCallback(async (username, password) => {
    const { data, error } = await supabase.rpc('authenticate_user', {
      p_username: username,
      p_password: password,
    })

    if (error) {
      return { success: false, error: 'حدث خطأ في الاتصال' }
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'بيانات الدخول غير صحيحة' }
    }

    const user = data.user
    const newSession = {
      sessionId: data.sessionId,
      userId: user.id,
      username: user.username,
      branch: user.branch || null,
      branchCode: user.branchCode || null,
      branchId: user.branchId || null,
      route: user.route,
      role: user.role,
      lastActivity: Date.now(),
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession))
    setSession(newSession)

    // Redirect based on user's configured route
    const route = user.route || '/scan'
    const needsBranch = ['/scan', '/display', '/kitchen'].includes(route)
    if (needsBranch && user.branchCode) {
      navigate(`${route}?branch=${user.branchCode}`)
    } else {
      navigate(route)
    }

    return { success: true }
  }, [navigate])

  const logout = useCallback(async () => {
    // Remove presence before clearing session
    if (session?.sessionId) {
      try {
        await supabase.rpc('rpc_remove_presence', {
          p_session_id: session.sessionId,
        })
      } catch {
        // Silent fail — don't block logout
      }
    }
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    navigate('/login')
  }, [navigate, session])

  const updateActivity = useCallback(() => {
    if (!session || session.role === 'screen') return
    const updated = { ...session, lastActivity: Date.now() }
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated))
    setSession(updated)
  }, [session])

  const getDefaultRoute = useCallback(() => {
    if (!session) return '/login'
    const route = session.route || '/scan'
    const needsBranch = ['/scan', '/display', '/kitchen'].includes(route)
    if (needsBranch && session.branchCode) {
      return `${route}?branch=${session.branchCode}`
    }
    return route
  }, [session])

  const value = {
    session,
    isAuthenticated: isSessionValid(session),
    login,
    logout,
    updateActivity,
    getDefaultRoute,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
