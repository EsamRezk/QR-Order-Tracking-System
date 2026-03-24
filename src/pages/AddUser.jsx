import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import LogoutButton from '../components/LogoutButton'
import './AddUser.css'

const EMPTY_FORM = { username: '', password: '', branch_id: '', route: '/scan', role: 'user' }

const ROLE_OPTIONS = [
  { value: 'user', label: 'مستخدم', icon: '👤' },
  { value: 'admin', label: 'مدير', icon: '🛡️' },
  { value: 'screen', label: 'شاشة', icon: '🖥️' },
]

const ROUTE_OPTIONS = [
  { value: '/scan', label: '/scan — ماسح الطلبات' },
  { value: '/display', label: '/display — شاشة العرض' },
  { value: '/analytics', label: '/analytics — التحليلات' },
  { value: '/admin', label: '/admin — إدارة الفروع' },
]

export default function AddUser() {
  const { session } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [branches, setBranches] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'success'|'error', text }

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('name_ar')
    setBranches(data || [])
  }

  const fetchUsers = async () => {
    const { data } = await supabase.rpc('list_users', { p_admin_id: session.userId })
    if (data?.success) {
      setUsers(data.users || [])
    }
  }

  useEffect(() => {
    Promise.all([fetchBranches(), fetchUsers()]).then(() => setLoading(false))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) {
      setMessage({ type: 'error', text: 'يرجى إدخال اسم المستخدم وكلمة المرور' })
      return
    }

    setSubmitting(true)
    setMessage(null)

    const { data } = await supabase.rpc('create_user', {
      p_admin_id: session.userId,
      p_username: form.username,
      p_password: form.password,
      p_branch_id: form.branch_id || null,
      p_route: form.route,
      p_role: form.role,
    })

    if (data?.success) {
      setMessage({ type: 'success', text: `تم إضافة المستخدم "${form.username}" بنجاح` })
      setForm(EMPTY_FORM)
      fetchUsers()
    } else {
      setMessage({ type: 'error', text: data?.error || 'حدث خطأ' })
    }

    setSubmitting(false)
  }

  const handleDelete = async (userId, username) => {
    if (!confirm(`هل تريد حذف المستخدم "${username}"؟`)) return

    const { data } = await supabase.rpc('delete_user', {
      p_admin_id: session.userId,
      p_user_id: userId,
    })

    if (data?.success) {
      setMessage({ type: 'success', text: `تم حذف المستخدم "${username}"` })
      fetchUsers()
    } else {
      setMessage({ type: 'error', text: data?.error || 'حدث خطأ' })
    }
  }

  return (
    <div className="adduser-root">
      {/* Header */}
      <header className="adduser-header">
        <div className="adduser-header-inner">
          <div>
            <div className="adduser-header-badge">كبة زون — إدارة المستخدمين</div>
            <h1 className="adduser-page-title">إضافة مستخدم</h1>
            <p className="adduser-page-subtitle">إنشاء حسابات للموظفين والشاشات</p>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="adduser-main">
        {/* Message */}
        {message && (
          <div className={`adduser-message adduser-message--${message.type}`}>
            {message.type === 'success' ? '✅' : '❌'} {message.text}
          </div>
        )}

        <div className="adduser-sections">
          {/* ── Add User Form ── */}
          <form onSubmit={handleSubmit} className="adduser-form-card">
            <div className="adduser-form-header">
              <div className="adduser-form-icon">➕</div>
              <h2 className="adduser-form-title">إضافة مستخدم جديد</h2>
            </div>

            <div className="adduser-form-body">
              <div className="adduser-form-grid">
                {/* Username */}
                <div className="adduser-input-group">
                  <label className="adduser-label">اسم المستخدم</label>
                  <input
                    type="text"
                    placeholder="مثال: ahmed"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="adduser-input"
                    dir="ltr"
                    required
                  />
                </div>

                {/* Password */}
                <div className="adduser-input-group">
                  <label className="adduser-label">كلمة المرور</label>
                  <input
                    type="password"
                    placeholder="كلمة مرور قوية"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="adduser-input"
                    dir="ltr"
                    required
                  />
                </div>

                {/* Branch */}
                <div className="adduser-input-group">
                  <label className="adduser-label">الفرع</label>
                  <select
                    value={form.branch_id}
                    onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                    className="adduser-select"
                  >
                    <option value="">— بدون فرع —</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name_ar} ({b.code})</option>
                    ))}
                  </select>
                </div>

                {/* Role */}
                <div className="adduser-input-group">
                  <label className="adduser-label">الصلاحية</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="adduser-select"
                  >
                    {ROLE_OPTIONS.map(r => (
                      <option key={r.value} value={r.value}>{r.icon} {r.label}</option>
                    ))}
                  </select>
                </div>

                {/* Route */}
                <div className="adduser-input-group adduser-input-group--full">
                  <label className="adduser-label">المسار بعد الدخول</label>
                  <select
                    value={form.route}
                    onChange={(e) => setForm({ ...form, route: e.target.value })}
                    className="adduser-select"
                    dir="ltr"
                  >
                    {ROUTE_OPTIONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="adduser-form-actions">
                <button type="submit" className="adduser-btn-primary" disabled={submitting}>
                  {submitting ? (
                    <><span className="adduser-spinner" /> جاري الإضافة...</>
                  ) : (
                    <>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      إضافة المستخدم
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* ── Users Table ── */}
          {loading ? (
            <div className="adduser-loading">
              <div className="adduser-loading-spinner" />
              <div className="adduser-loading-text">جاري التحميل...</div>
            </div>
          ) : (
            <div className="adduser-table-card">
              <div className="adduser-table-header">
                <h3 className="adduser-table-title">
                  <span className="adduser-form-icon" style={{ width: 28, height: 28, fontSize: '0.85rem', borderRadius: 8 }}>👥</span>
                  المستخدمون
                </h3>
                <span className="adduser-table-count">{users.length} مستخدم</span>
              </div>

              {users.length === 0 ? (
                <div className="adduser-empty">لا يوجد مستخدمون</div>
              ) : (
                <div className="adduser-table-wrap">
                  <table className="adduser-table">
                    <thead>
                      <tr>
                        <th>المستخدم</th>
                        <th>الصلاحية</th>
                        <th>الفرع</th>
                        <th className="adduser-hide-mobile">المسار</th>
                        <th>إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td>
                            <span className="adduser-username">{u.username}</span>
                          </td>
                          <td>
                            <span className={`adduser-role-badge adduser-role-badge--${u.role}`}>
                              {u.role === 'admin' ? '🛡️ مدير' : u.role === 'screen' ? '🖥️ شاشة' : '👤 مستخدم'}
                            </span>
                          </td>
                          <td>{u.branch_name || '—'}</td>
                          <td className="adduser-hide-mobile">
                            <code className="adduser-route-code">{u.route}</code>
                          </td>
                          <td>
                            {u.id !== session.userId && (
                              <button
                                onClick={() => handleDelete(u.id, u.username)}
                                className="adduser-delete-btn"
                              >
                                حذف
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
