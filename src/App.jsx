import { Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import DisplayDashboard from './pages/DisplayDashboard'
import Scanner from './pages/Scanner'
import Analytics from './pages/Analytics'
import Admin from './pages/Admin'
import Kitchen from './pages/Kitchen'
import Login from './pages/Login'
import AddUser from './pages/AddUser'
import Logs from './pages/Logs'
import AdminSidebar from './components/AdminSidebar'
import UserSidebar from './components/UserSidebar'
import AppLogo from './components/AppLogo'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#1E1810]">
          <div className="text-center bg-[#2f2520] rounded-lg p-10 border border-[#3d3028] mx-4">
            <div className="w-16 h-16 bg-[#ce0b0b]/15 rounded-lg flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-[#ce0b0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div className="text-xl text-white font-bold mb-2">حدث خطأ غير متوقع</div>
            <div className="text-[#8a8280] mb-6">يرجى المحاولة مرة أخرى</div>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-8 py-3 bg-[#FF5100] text-white rounded-lg font-bold hover:bg-[#FF7A3D] transition-colors"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppLogo />
          <AdminSidebar />
          <UserSidebar />
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes */}
            <Route path="/display" element={
              <ProtectedRoute allowedRoles={['screen', 'user', 'admin']}>
                <DisplayDashboard />
              </ProtectedRoute>
            } />
            <Route path="/scan" element={
              <ProtectedRoute allowedRoles={['user', 'admin']}>
                <Scanner />
              </ProtectedRoute>
            } />
            <Route path="/kitchen" element={
              <ProtectedRoute allowedRoles={['user', 'admin']}>
                <Kitchen />
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute allowedRoles={['user', 'admin']}>
                <Analytics />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Admin />
              </ProtectedRoute>
            } />
            <Route path="/add-user" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AddUser />
              </ProtectedRoute>
            } />
            <Route path="/logs" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Logs />
              </ProtectedRoute>
            } />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App

