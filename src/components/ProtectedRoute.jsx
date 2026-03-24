import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIdleTimer } from '../hooks/useIdleTimer'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, session, getDefaultRoute } = useAuth()

  // Activate idle timer for user/admin
  useIdleTimer()

  // Not logged in → redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Role not allowed → redirect to user's default route
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return <Navigate to={getDefaultRoute()} replace />
  }

  return children
}
