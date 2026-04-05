import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import LogoutButton from '../components/LogoutButton'
import LoadingScreen from '../components/LoadingScreen'
import './AddUser.css'

const EMPTY_FORM = { username: '', password: '', branch_id: '', route: '/scan', role: 'user' }

const ROLE_OPTIONS = [
  { value: 'user', label: 'مستخدم', icon: '👤' },
  { value: 'admin', label: 'مدير', icon: '🛡️' },
]

// Edit mode: null = adding, { id, ... } = editing


const ROUTE_OPTIONS = {
  user: [
    { value: '/scan', label: '/scan — ماسح الطلبات' },
    { value: '/kitchen', label: '/kitchen — شاشة المطبخ' },
    { value: '/display', label: '/display — شاشة العرض' },
    { value: '/analytics', label: '/analytics — التحليلات' },
  ],
  admin: [
    { value: '/analytics', label: '/analytics — التحليلات' },
    { value: '/admin', label: '/admin — إدارة الفروع' },
    { value: '/scan', label: '/scan — ماسح الطلبات' },
  ],
}

export default function AddUser() {
  const { session } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [branches, setBranches] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'success'|'error', text }
  const [editingUser, setEditingUser] = useState(null) // null = add mode, { id } = edit mode

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('name_ar')
    setBranches(data || [])
  }

  const fetchUsers = async () => {
    if (!session?.sessionId) return
    try {
      const { data, error } = await supabase.rpc('rpc_list_users_secure', { p_session_id: session.sessionId })
      if (error) {
        setMessage({ type: 'error', text: `RPC Error: ${error.message}` })
        return
      }
      if (data?.success) {
        setUsers(data.users || [])
      } else {
        setMessage({ type: 'error', text: data?.error || 'فشل جلب المستخدمين' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: `Exception: ${err.message}` })
    }
  }

  useEffect(() => {
    Promise.all([fetchBranches(), fetchUsers()]).then(() => setLoading(false))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || (!editingUser && !form.password)) {
      setMessage({ type: 'error', text: 'يرجى إدخال اسم المستخدم وكلمة المرور' })
      return
    }

    setSubmitting(true)
    setMessage(null)

    if (editingUser) {
      // Update existing user
      const { data } = await supabase.rpc('rpc_update_user_secure', {
        p_session_id: session.sessionId,
        p_target_user_id: editingUser.id,
        p_username: form.username,
        p_password: form.password || '',
        p_branch_id: form.branch_id || null,
        p_route: form.route,
        p_role: form.role,
      })

      if (data?.success) {
        setMessage({ type: 'success', text: `تم تعديل المستخدم "${form.username}" بنجاح` })
        setForm(EMPTY_FORM)
        setEditingUser(null)
        fetchUsers()
      } else {
        setMessage({ type: 'error', text: data?.error || 'حدث خطأ' })
      }
    } else {
      // Create new user
      const { data } = await supabase.rpc('rpc_create_user_secure', {
        p_session_id: session.sessionId,
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
    }

    setSubmitting(false)
  }

  const handleEdit = (user) => {
    setEditingUser(user)
    setForm({
      username: user.username,
      password: '',
      branch_id: user.branch_id || '',
      route: user.route,
      role: user.role,
    })
    setMessage(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const cancelEdit = () => {
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setMessage(null)
  }

  const handleDelete = async (userId, username) => {
    if (!confirm(`هل تريد حذف المستخدم "${username}"؟`)) return

    const { data } = await supabase.rpc('rpc_delete_user_secure', {
      p_session_id: session.sessionId,
      p_target_user_id: userId,
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
          <div className="adduser-logout-wrap">
            <LogoutButton />
          </div>
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
              <div className="adduser-form-icon">{editingUser ? '✏️' : '➕'}</div>
              <h2 className="adduser-form-title">{editingUser ? `تعديل المستخدم: ${editingUser.username}` : 'إضافة مستخدم جديد'}</h2>
              {editingUser && (
                <button type="button" onClick={cancelEdit} className="adduser-cancel-btn">إلغاء التعديل</button>
              )}
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
                  <label className="adduser-label">كلمة المرور {editingUser && <span style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>(اتركها فارغة لعدم التغيير)</span>}</label>
                  <input
                    type="password"
                    placeholder={editingUser ? 'اتركها فارغة لعدم التغيير' : 'كلمة مرور قوية'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="adduser-input"
                    dir="ltr"
                    required={!editingUser}
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
                    onChange={(e) => {
                      const newRole = e.target.value
                      const updates = { role: newRole }
                      if (newRole === 'admin') updates.route = '/analytics'
                      else updates.route = '/scan'
                      setForm({ ...form, ...updates })
                    }}
                    className="adduser-select"
                  >
                    {ROLE_OPTIONS.map(r => (
                      <option key={r.value} value={r.value}>{r.icon} {r.label}</option>
                    ))}
                  </select>
                </div>

                {/* Route - hidden for admin (always /analytics) */}
                {form.role !== 'admin' && (
                  <div className="adduser-input-group adduser-input-group--full">
                    <label className="adduser-label">المسار بعد الدخول</label>
                    <select
                      value={form.route}
                      onChange={(e) => setForm({ ...form, route: e.target.value })}
                      className="adduser-select"
                      dir="ltr"
                    >
                      {(ROUTE_OPTIONS[form.role] || ROUTE_OPTIONS.user).map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="adduser-form-actions">
                <button type="submit" className="adduser-btn-primary" disabled={submitting}>
                  {submitting ? (
                    <><span className="adduser-spinner" /> {editingUser ? 'جاري التعديل...' : 'جاري الإضافة...'}</>
                  ) : (
                    <>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d={editingUser ? "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" : "M12 4.5v15m7.5-7.5h-15"} />
                      </svg>
                      {editingUser ? 'حفظ التعديلات' : 'إضافة المستخدم'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* ── Users Table ── */}
          {loading ? (
            <LoadingScreen />
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
                            <div className="adduser-action-btns">
                              <button
                                onClick={() => handleEdit(u)}
                                className="adduser-edit-btn"
                              >
                                تعديل
                              </button>
                              {u.id !== session.userId && (
                                <button
                                  onClick={() => handleDelete(u.id, u.username)}
                                  className="adduser-delete-btn"
                                >
                                  حذف
                                </button>
                              )}
                            </div>
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
