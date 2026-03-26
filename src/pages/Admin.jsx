import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import LogoutButton from '../components/LogoutButton'
import LoadingScreen from '../components/LoadingScreen'
import './Admin.css'

const EMPTY_BRANCH = { name_ar: '', name_en: '', code: '', location_label: '' }

export default function Admin() {
  const { session } = useAuth()
  const [branches, setBranches] = useState([])
  const [form, setForm] = useState(EMPTY_BRANCH)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('*').order('created_at')
    setBranches(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchBranches() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name_ar || !form.name_en || !form.code || !form.location_label || !session?.sessionId) return

    await supabase.rpc('rpc_admin_upsert_branch', {
      p_session_id: session.sessionId,
      p_id: editing || null,
      p_name_ar: form.name_ar,
      p_name_en: form.name_en,
      p_code: form.code,
      p_location_label: form.location_label
    })

    setForm(EMPTY_BRANCH)
    setEditing(null)
    fetchBranches()
  }

  const handleEdit = (branch) => {
    setEditing(branch.id)
    setForm({
      name_ar: branch.name_ar,
      name_en: branch.name_en,
      code: branch.code,
      location_label: branch.location_label,
    })
  }

  const toggleActive = async (branch) => {
    if (!session?.sessionId) return
    await supabase.rpc('rpc_admin_toggle_branch', {
      p_session_id: session.sessionId,
      p_branch_id: branch.id,
      p_is_active: !branch.is_active
    })
    fetchBranches()
  }

  const cancelEdit = () => {
    setEditing(null)
    setForm(EMPTY_BRANCH)
  }

  const activeBranches = branches.filter(b => b.is_active)

  return (
    <div className="admin-root">
      {/* ── Header ── */}
      <header className="admin-header">
        <div className="admin-header-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="admin-header-badge">كبة زون — لوحة الإدارة</div>
            <h1 className="admin-page-title">إدارة الفروع</h1>
            <p className="admin-page-subtitle">إضافة وتعديل وإدارة فروع المطعم</p>
          </div>
          <LogoutButton />
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="admin-main">
        <div className="admin-sections">

          {/* ── Add / Edit Form ── */}
          <form onSubmit={handleSubmit} className="form-card">
            <div className="form-card-header">
              <div className="form-card-icon">
                {editing ? '✏️' : '➕'}
              </div>
              <h2 className={`form-card-title ${editing ? 'form-card-title-edit' : ''}`}>
                {editing ? 'تعديل فرع' : 'إضافة فرع جديد'}
              </h2>
            </div>

            <div className="form-card-body">
              <div className="form-grid">
                <div className="admin-input-group">
                  <label className="admin-input-label">الاسم بالعربية</label>
                  <input
                    type="text"
                    placeholder="مثال: فرع العرقة"
                    value={form.name_ar}
                    onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                    className="admin-input"
                    required
                  />
                </div>

                <div className="admin-input-group">
                  <label className="admin-input-label">Name in English</label>
                  <input
                    type="text"
                    placeholder="e.g. Erqaa Branch"
                    value={form.name_en}
                    onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                    className="admin-input"
                    dir="ltr"
                    required
                  />
                </div>

                <div className="admin-input-group">
                  <label className="admin-input-label">رمز الفرع</label>
                  <input
                    type="text"
                    placeholder="e.g. Erqaa-01"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="admin-input"
                    dir="ltr"
                    required
                  />
                </div>

                <div className="admin-input-group">
                  <label className="admin-input-label">عنوان الموقع</label>
                  <input
                    type="text"
                    placeholder="مثال: حي العرقة، الرياض"
                    value={form.location_label}
                    onChange={(e) => setForm({ ...form, location_label: e.target.value })}
                    className="admin-input"
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editing ? (
                    <>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      تحديث
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      إضافة
                    </>
                  )}
                </button>
                {editing && (
                  <button type="button" onClick={cancelEdit} className="btn-secondary">
                    إلغاء
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* ── Branch Table ── */}
          {loading ? (
            <LoadingScreen />
          ) : (
            <div className="table-card">
              <div className="table-card-header">
                <h3 className="table-card-title">
                  <span className="form-card-icon" style={{ width: 28, height: 28, fontSize: '0.85rem', borderRadius: 8 }}>🏪</span>
                  قائمة الفروع
                </h3>
                <span className="table-card-count">{branches.length} فرع</span>
              </div>

              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>الاسم</th>
                      <th>الرمز</th>
                      <th className="hide-mobile">الموقع</th>
                      <th>الحالة</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <div className="branch-name-primary">{b.name_ar}</div>
                          <div className="branch-name-secondary">{b.name_en}</div>
                        </td>
                        <td>
                          <span className="branch-code">{b.code}</span>
                        </td>
                        <td className="hide-mobile">
                          <span className="branch-location">{b.location_label}</span>
                        </td>
                        <td>
                          <span className={`status-badge ${b.is_active ? 'status-badge--active' : 'status-badge--inactive'}`}>
                            {b.is_active ? 'نشط' : 'معطل'}
                          </span>
                        </td>
                        <td>
                          <div className="actions-cell">
                            <button onClick={() => handleEdit(b)} className="action-btn action-btn--edit">
                              تعديل
                            </button>
                            <button
                              onClick={() => toggleActive(b)}
                              className={`action-btn ${b.is_active ? 'action-btn--deactivate' : 'action-btn--activate'}`}
                            >
                              {b.is_active ? 'تعطيل' : 'تفعيل'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Branch Links ── */}
          {activeBranches.length > 0 && (
            <div className="links-card">
              <div className="links-card-header">
                <div className="form-card-icon">🔗</div>
                <h3 className="links-card-title">روابط الفروع</h3>
              </div>
              <div className="links-card-body">
                {activeBranches.map(b => (
                  <div key={b.id} className="link-row">
                    <span className="link-branch-name">{b.name_ar}</span>
                    <span className="link-url link-url--display" dir="ltr">
                      /display?branch={b.code}
                    </span>
                    <span className="link-url link-url--scan" dir="ltr">
                      /scan?branch={b.code}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}