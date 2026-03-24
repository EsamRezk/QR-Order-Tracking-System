import { useState } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  {
    path: '/analytics',
    label: 'التحليلات',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
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
    path: '/display',
    label: 'شاشة العرض',
    needsBranch: true,
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
      </svg>
    ),
  },
  {
    path: '/admin',
    label: 'إدارة الفروع',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016A3.001 3.001 0 0021 9.349m-18 0a2.997 2.997 0 00.329-.089m17.342 0a2.997 2.997 0 01-.329.089" />
      </svg>
    ),
  },
  {
    path: '/add-user',
    label: 'إدارة المستخدمين',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
]

export default function AdminSidebar() {
  const { session, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(true)
  const [searchParams] = useSearchParams()

  if (!session || session.role !== 'admin') return null

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
      {/* Toggle Button - always visible */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: 'fixed',
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
            لوحة التحكم
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
            كبة زون
          </div>
          <div style={{ fontSize: '0.8rem', color: '#8a8280', marginTop: 2 }}>
            مرحباً، {session.username}
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
