import { useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  {
    path: '/scan',
    label: 'ماسح الطلبات',
    needsBranch: true,
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
      </svg>
    ),
  },
  {
    path: '/kitchen',
    label: 'شاشة المطبخ',
    needsBranch: true,
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
      </svg>
    ),
  },
]

export default function UserSidebar() {
  const { session, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(true)
  const [searchParams] = useSearchParams()

  if (!session || session.role !== 'user') return null

  const branchCode = searchParams.get('branch') || session.branchCode || ''

  const getPath = (item) => {
    if (item.needsBranch && branchCode) {
      return `${item.path}?branch=${branchCode}`
    }
    return item.path
  }

  const isActive = (item) => {
    return location.pathname === item.path
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 1001,
          width: 44,
          height: 44,
          borderRadius: 12,
          background: '#2f2520',
          border: '1px solid #3d3028',
          color: '#FF5100',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
          {collapsed ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          )}
        </svg>
      </button>

      {/* Overlay */}
      {!collapsed && (
        <div
          onClick={() => setCollapsed(true)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999,
            transition: 'opacity 0.3s',
          }}
        />
      )}

      {/* Sidebar */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          background: '#2a2018',
          borderRight: '1px solid #3d3028',
          zIndex: 1000,
          transform: collapsed ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: "'Tajawal', sans-serif",
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.5rem 1.25rem 1.25rem',
          borderBottom: '1px solid #3d302840',
        }}>
          <div style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            color: '#FF5100',
            background: '#FF510012',
            border: '1px solid #FF510020',
            padding: '0.15rem 0.6rem',
            borderRadius: 100,
            display: 'inline-block',
            marginBottom: '0.5rem',
          }}>
            كبة زون
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
            {session.username}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#8a8280', marginTop: 2 }}>
            {session.branch || 'الفرع'}
          </div>
        </div>

        {/* Nav Items */}
        <div style={{ flex: 1, padding: '0.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={getPath(item)}
              onClick={() => setCollapsed(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.7rem 1rem',
                borderRadius: 10,
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: 600,
                transition: 'all 0.15s',
                background: isActive(item) ? '#FF510015' : 'transparent',
                color: isActive(item) ? '#FF7A3D' : '#a09890',
                border: isActive(item) ? '1px solid #FF510020' : '1px solid transparent',
              }}
            >
              <span style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isActive(item) ? '#FF510020' : '#1E181080',
                flexShrink: 0,
              }}>
                <span style={{ width: 18, height: 18, display: 'flex' }}>{item.icon}</span>
              </span>
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Footer - Logout */}
        <div style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid #3d302840',
        }}>
          <button
            onClick={() => { setCollapsed(true); logout() }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              width: '100%',
              padding: '0.7rem 1rem',
              borderRadius: 10,
              background: 'transparent',
              border: '1px solid #ce0b0b20',
              color: '#ce0b0b',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Tajawal', sans-serif",
              transition: 'all 0.15s',
            }}
          >
            <svg style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            تسجيل الخروج
          </button>
        </div>
      </nav>
    </>
  )
}
