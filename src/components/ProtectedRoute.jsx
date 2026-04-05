import { Navigate, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIdleTimer } from '../hooks/useIdleTimer'
import { useHeartbeat } from '../hooks/useHeartbeat'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, session, getDefaultRoute } = useAuth()
  const [searchParams] = useSearchParams()
  const location = useLocation()

  // Activate idle timer for user/admin
  useIdleTimer()
  useHeartbeat()

  // Not logged in → redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Role not allowed → redirect to user's default route
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return <Navigate to={getDefaultRoute()} replace />
  }

  // Branch protection for user role
  if (session.role === 'user') {
    const branchParam = searchParams.get('branch')
    const branchPages = ['/display', '/scan', '/kitchen']
    const currentPath = location.pathname

    if (branchPages.includes(currentPath) && branchParam && session.branchCode && branchParam !== session.branchCode) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f3f4f6',
          fontFamily: "'Tajawal', sans-serif",
          direction: 'rtl',
        }}>
          <div style={{
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: 16,
            padding: '3rem 2.5rem',
            border: '1px solid #e5e7eb',
            maxWidth: 420,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: '#ce0b0b15', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem', fontSize: '1.8rem',
            }}>🚫</div>
            <h2 style={{ color: '#2E2D2C', fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              ليس لديك صلاحية
            </h2>
            <p style={{ color: '#6B7280', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              لا يمكنك الوصول لهذا الفرع. يمكنك فقط الوصول لفرعك.
            </p>
            <a
              href={`${currentPath}?branch=${session.branchCode}`}
              style={{
                display: 'inline-block',
                padding: '0.75rem 2rem',
                background: '#5830C5',
                color: '#fff',
                borderRadius: 10,
                fontWeight: 700,
                textDecoration: 'none',
                fontSize: '0.95rem',
              }}
            >
              العودة لفرعي
            </a>
          </div>
        </div>
      )
    }

    // Analytics branch protection: user can only see their branch
    if (currentPath === '/analytics' && !session.branchCode) {
      // User without branch assigned — block analytics
      return <Navigate to={getDefaultRoute()} replace />
    }
  }

  return children
}
