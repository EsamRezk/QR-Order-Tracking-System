import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import './Logs.css'

const REFRESH_INTERVAL = 30 * 1000 // 30 seconds

const ROLE_LABELS = {
  admin: 'مدير',
  user: 'مستخدم',
  screen: 'شاشة',
}

const PAGE_MAP = {
  '/scan': { label: 'ماسح الطلبات', icon: '📷' },
  '/display': { label: 'شاشة العرض', icon: '🖥️' },
  '/kitchen': { label: 'شاشة المطبخ', icon: '🔥' },
  '/analytics': { label: 'التحليلات', icon: '📊' },
  '/admin': { label: 'إدارة الفروع', icon: '🏪' },
  '/add-user': { label: 'إدارة المستخدمين', icon: '👥' },
  '/logs': { label: 'سجل النظام', icon: '📋' },
  '/login': { label: 'تسجيل الدخول', icon: '🔑' },
}

function getPageInfo(fullPath) {
  if (!fullPath) return { label: 'غير محدد', icon: '❓' }
  const pathname = fullPath.split('?')[0]
  const params = new URLSearchParams(fullPath.split('?')[1] || '')
  const branch = params.get('branch')
  const page = PAGE_MAP[pathname] || { label: pathname, icon: '📄' }
  if (branch) {
    return { ...page, label: `${page.label} — ${branch}` }
  }
  return page
}

function getRelativeTime(timestamp) {
  if (!timestamp) return '—'
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (diff < 10) return 'الآن'
  if (diff < 60) return `قبل ${diff} ثانية`
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`
  return `قبل ${Math.floor(diff / 3600)} ساعة`
}

export default function Logs() {
  const { session } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('online')

  const fetchOnlineUsers = useCallback(async () => {
    if (!session?.sessionId) return
    try {
      const { data } = await supabase.rpc('rpc_get_online_users', {
        p_session_id: session.sessionId,
        p_timeout_seconds: 60,
      })
      if (data?.success) {
        setOnlineUsers(data.users || [])
      }
    } catch {
      // Silent fail — will retry on next interval
    }
    setLoading(false)
  }, [session?.sessionId])

  useEffect(() => {
    fetchOnlineUsers()
    const interval = setInterval(fetchOnlineUsers, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchOnlineUsers])

  // Re-render relative times every 15s
  const [, setTick] = useState(false)
  useEffect(() => {
    const timer = setInterval(() => setTick(t => !t), 15000)
    return () => clearInterval(timer)
  }, [])

  const TABS = [
    { id: 'online', label: 'المتصلون الآن', count: onlineUsers.length },
  ]

  return (
    <div className="logs-root">
      {/* Header */}
      <header className="logs-header">
        <div className="logs-header-inner">
          <div className="logs-header-top">
            <div className="logs-title-group">
              <h1 className="logs-title">
                سجل النظام
                <span className="online-badge">
                  <span className="online-badge-dot" />
                  {onlineUsers.length} متصل
                </span>
              </h1>
              <p className="logs-subtitle">مراقبة المستخدمين المتصلين والنشاط</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="logs-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`logs-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="logs-tab-count">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="logs-content">
        {activeTab === 'online' && (
          <>
            {loading ? (
              <div className="logs-loading">
                <div className="logs-spinner" />
                جاري التحميل...
              </div>
            ) : onlineUsers.length === 0 ? (
              <div className="online-table-wrap">
                <div className="logs-empty">
                  <div className="logs-empty-icon">👻</div>
                  <div className="logs-empty-title">لا يوجد مستخدمين متصلين</div>
                  <div className="logs-empty-text">سيظهر المستخدمون هنا عند اتصالهم بالنظام</div>
                </div>
              </div>
            ) : (
              <div className="online-table-wrap">
                <table className="online-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }} />
                      <th>المستخدم</th>
                      <th>الدور</th>
                      <th className="col-branch">الفرع</th>
                      <th>الصفحة الحالية</th>
                      <th className="col-time">آخر نشاط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onlineUsers.map((u, i) => {
                      const pageInfo = getPageInfo(u.current_page)
                      return (
                        <tr key={i}>
                          <td><span className="status-dot" /></td>
                          <td>
                            <div className="user-cell">
                              <div className={`user-avatar ${u.role}`}>
                                {u.username?.charAt(0)?.toUpperCase()}
                              </div>
                              <span className="user-name">{u.username}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`role-badge ${u.role}`}>
                              {ROLE_LABELS[u.role] || u.role}
                            </span>
                          </td>
                          <td className="col-branch">
                            {u.branch_name || '—'}
                          </td>
                          <td>
                            <span className="page-badge">
                              <span className="page-badge-icon">{pageInfo.icon}</span>
                              {pageInfo.label}
                            </span>
                          </td>
                          <td className="col-time">
                            <span className="time-cell">
                              {getRelativeTime(u.last_heartbeat)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
