# Logs Page — Online Users Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a logs page (`/logs`, admin only) showing currently online users with their page, branch, role, and last activity — powered by a heartbeat-based presence system.

**Architecture:** New `active_sessions` DB table with RPC functions (same security pattern as existing RPCs), a `useHeartbeat` hook integrated into `ProtectedRoute`, and a new `Logs.jsx` page with 30s polling and tabbed layout for future expansion.

**Tech Stack:** React 18, Supabase PostgreSQL + RPC, existing auth/session system, existing design tokens (Analytics.css pattern).

---

### Task 1: Create active_sessions migration

**Files:**
- Create: `supabase/migrations/012_active_sessions.sql`

**Step 1: Create the migration file**

```sql
-- ═══════════════════════════════════════════════════
-- Active Sessions — Presence/Heartbeat System
-- ═══════════════════════════════════════════════════

-- 1. Create table
CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_page TEXT NOT NULL DEFAULT '/',
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX idx_active_sessions_heartbeat ON active_sessions(last_heartbeat);

-- RLS: enabled, no policies = blocked from direct client access
ALTER TABLE active_sessions ENABLE ROW LEVEL SECURITY;

-- 2. Upsert heartbeat (any authenticated user)
CREATE OR REPLACE FUNCTION rpc_upsert_heartbeat(
  p_session_id UUID,
  p_current_page TEXT
) RETURNS JSON AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'جلسة غير صالحة');
  END IF;

  INSERT INTO active_sessions (user_id, current_page, last_heartbeat)
  VALUES (v_user.user_id, p_current_page, now())
  ON CONFLICT (user_id) DO UPDATE
  SET current_page = EXCLUDED.current_page,
      last_heartbeat = now();

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Remove session (on logout)
CREATE OR REPLACE FUNCTION rpc_remove_presence(p_session_id UUID)
RETURNS JSON AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL THEN
    RETURN json_build_object('success', true);
  END IF;

  DELETE FROM active_sessions WHERE user_id = v_user.user_id;
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Get online users (admin only)
CREATE OR REPLACE FUNCTION rpc_get_online_users(
  p_session_id UUID,
  p_timeout_seconds INTEGER DEFAULT 60
) RETURNS JSON AS $$
DECLARE
  v_user RECORD;
  v_result JSON;
BEGIN
  SELECT * INTO v_user FROM get_session_user(p_session_id);
  IF v_user IS NULL OR v_user.role != 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  SELECT json_agg(row_to_json(t))
  INTO v_result
  FROM (
    SELECT
      u.username,
      u.role,
      b.name_ar AS branch_name,
      b.code AS branch_code,
      a.current_page,
      a.last_heartbeat,
      a.started_at
    FROM active_sessions a
    JOIN users u ON a.user_id = u.id
    LEFT JOIN branches b ON u.branch_id = b.id
    WHERE a.last_heartbeat > now() - (p_timeout_seconds || ' seconds')::INTERVAL
    ORDER BY a.last_heartbeat DESC
  ) t;

  RETURN json_build_object('success', true, 'users', COALESCE(v_result, '[]'::json));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Unique constraint on user_id (one row per user for UPSERT)
ALTER TABLE active_sessions ADD CONSTRAINT active_sessions_user_id_unique UNIQUE (user_id);
```

**Step 2: Run this migration in Supabase SQL Editor**

Copy and paste the SQL into the Supabase dashboard SQL Editor and run it.

**Step 3: Commit**

```bash
git add supabase/migrations/012_active_sessions.sql
git commit -m "feat: add active_sessions table and presence RPC functions"
```

---

### Task 2: Create useHeartbeat hook

**Files:**
- Create: `src/hooks/useHeartbeat.js`

**Step 1: Create the hook**

```javascript
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const HEARTBEAT_INTERVAL_MS = 30 * 1000 // 30 seconds

export function useHeartbeat() {
  const { session } = useAuth()
  const location = useLocation()
  const intervalRef = useRef(null)
  const currentPageRef = useRef('')

  useEffect(() => {
    if (!session?.sessionId) return

    const currentPage = location.pathname + location.search

    const sendHeartbeat = async (page) => {
      try {
        await supabase.rpc('rpc_upsert_heartbeat', {
          p_session_id: session.sessionId,
          p_current_page: page,
        })
      } catch {
        // Silent fail — heartbeat is non-critical
      }
    }

    // Send immediately on page change
    currentPageRef.current = currentPage
    sendHeartbeat(currentPage)

    // Clear previous interval and set new one
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      sendHeartbeat(currentPageRef.current)
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [session?.sessionId, location.pathname, location.search])
}
```

**Step 2: Verify no syntax errors**

Run: `npm run dev`
Expected: No errors (hook not used yet)

**Step 3: Commit**

```bash
git add src/hooks/useHeartbeat.js
git commit -m "feat: create useHeartbeat hook for presence tracking"
```

---

### Task 3: Integrate heartbeat into ProtectedRoute

**Files:**
- Modify: `src/components/ProtectedRoute.jsx:1-4`

**Step 1: Import and activate useHeartbeat**

Add import at top:

```javascript
import { useHeartbeat } from '../hooks/useHeartbeat'
```

Add the hook call right after the existing `useIdleTimer()` call (line 11):

```javascript
  useIdleTimer()
  useHeartbeat()
```

**Step 2: Verify dev server runs**

Run: `npm run dev`
Expected: No errors. Check browser Network tab — should see `rpc_upsert_heartbeat` calls every 30s.

**Step 3: Commit**

```bash
git add src/components/ProtectedRoute.jsx
git commit -m "feat: integrate heartbeat into ProtectedRoute for all authenticated users"
```

---

### Task 4: Add presence cleanup on logout

**Files:**
- Modify: `src/context/AuthContext.jsx:93-97`

**Step 1: Call rpc_remove_presence before clearing session**

Replace the `logout` callback:

```javascript
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
  }, [navigate, session?.sessionId])
```

**Step 2: Add supabase import if not already present**

Check the imports at the top of `AuthContext.jsx` — `supabase` is already imported on line 3. No change needed.

**Step 3: Verify logout still works**

Run: `npm run dev`
Log in, then log out. Should work without errors.

**Step 4: Commit**

```bash
git add src/context/AuthContext.jsx
git commit -m "feat: clean up presence on logout"
```

---

### Task 5: Create Logs page CSS

**Files:**
- Create: `src/pages/Logs.css`

**Step 1: Create the stylesheet**

Use the same design system as Analytics.css (same CSS variables, same patterns). The page has: header, tab bar, and a table.

```css
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');

.logs-root {
  --bg-deep: #1a140e;
  --bg-base: #1E1810;
  --bg-card: #2a2018;
  --bg-elevated: #332a20;
  --border: #3d302840;
  --border-hover: #FF510030;
  --text-primary: #F8F5F2;
  --text-secondary: #a09890;
  --text-muted: #706860;
  --accent: #FF5100;
  --accent-light: #FF7A3D;
  --accent-glow: #FF510020;
  --green: #22c55e;
  --red: #ef4444;

  font-family: 'Tajawal', sans-serif;
  min-height: 100vh;
  background: var(--bg-deep);
  color: var(--text-primary);
  direction: rtl;
}

/* ── Noise texture ── */
.logs-root::before {
  content: '';
  position: fixed;
  inset: 0;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 0;
}

.logs-root > * {
  position: relative;
  z-index: 1;
}

/* ── Header ── */
.logs-header {
  background: linear-gradient(180deg, #2a201800 0%, var(--bg-deep) 100%),
              linear-gradient(135deg, #FF510008 0%, transparent 50%);
  border-bottom: 1px solid var(--border);
  padding: 2rem 0 1.5rem;
}

.logs-header-inner {
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 2rem;
}

.logs-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

@media (max-width: 1650px) {
  .logs-header-top {
    padding-right: 180px;
    padding-left: 90px;
  }
}

.logs-title-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.logs-title {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logs-subtitle {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.online-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: #22c55e18;
  border: 1px solid #22c55e30;
  color: var(--green);
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.2rem 0.75rem;
  border-radius: 100px;
}

.online-badge-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

/* ── Tabs ── */
.logs-tabs {
  max-width: 1440px;
  margin: 0 auto;
  padding: 1.25rem 2rem 0;
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--border);
}

.logs-tab {
  padding: 0.6rem 1.25rem;
  border: none;
  background: none;
  color: var(--text-muted);
  font-family: 'Tajawal', sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.logs-tab:hover {
  color: var(--text-secondary);
}

.logs-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.logs-tab-count {
  background: var(--accent-glow);
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.1rem 0.5rem;
  border-radius: 100px;
}

/* ── Content ── */
.logs-content {
  max-width: 1440px;
  margin: 0 auto;
  padding: 1.5rem 2rem 3rem;
}

/* ── Online Users Table ── */
.online-table-wrap {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
}

.online-table {
  width: 100%;
  border-collapse: collapse;
}

.online-table thead th {
  padding: 0.9rem 1.25rem;
  text-align: right;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
}

.online-table tbody tr {
  border-bottom: 1px solid #3d302820;
  transition: background 0.15s;
}

.online-table tbody tr:last-child {
  border-bottom: none;
}

.online-table tbody tr:hover {
  background: #FF510008;
}

.online-table tbody td {
  padding: 0.85rem 1.25rem;
  font-size: 0.9rem;
  color: var(--text-primary);
  vertical-align: middle;
}

/* ── User cell ── */
.user-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.user-avatar.admin {
  background: #FF510018;
  color: var(--accent);
}

.user-avatar.user {
  background: #22c55e18;
  color: var(--green);
}

.user-avatar.screen {
  background: #3b82f618;
  color: #60a5fa;
}

.user-name {
  font-weight: 700;
}

/* ── Role badge ── */
.role-badge {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 700;
}

.role-badge.admin {
  background: #FF510015;
  color: var(--accent);
  border: 1px solid #FF510025;
}

.role-badge.user {
  background: #22c55e15;
  color: var(--green);
  border: 1px solid #22c55e25;
}

.role-badge.screen {
  background: #3b82f615;
  color: #60a5fa;
  border: 1px solid #3b82f625;
}

/* ── Page badge ── */
.page-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.7rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.page-badge-icon {
  font-size: 0.85rem;
}

/* ── Time cell ── */
.time-cell {
  color: var(--text-muted);
  font-size: 0.85rem;
}

/* ── Status dot ── */
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--green);
  display: inline-block;
  animation: pulse-dot 2s ease-in-out infinite;
  box-shadow: 0 0 8px #22c55e40;
}

/* ── Empty state ── */
.logs-empty {
  text-align: center;
  padding: 4rem 2rem;
}

.logs-empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
  font-size: 1.8rem;
}

.logs-empty-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.logs-empty-text {
  font-size: 0.9rem;
  color: var(--text-muted);
}

/* ── Loading ── */
.logs-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.logs-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .logs-header-inner,
  .logs-tabs,
  .logs-content {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .logs-header-top {
    padding-right: 80px;
    padding-left: 60px;
  }

  .logs-title {
    font-size: 1.2rem;
  }

  .online-table thead th,
  .online-table tbody td {
    padding: 0.7rem 0.75rem;
    font-size: 0.8rem;
  }

  /* Hide branch and time columns on mobile */
  .online-table .col-branch,
  .online-table .col-time {
    display: none;
  }
}
```

**Step 2: Commit**

```bash
git add src/pages/Logs.css
git commit -m "feat: add Logs page styles matching project design system"
```

---

### Task 6: Create Logs page component

**Files:**
- Create: `src/pages/Logs.jsx`

**Step 1: Create the page**

```jsx
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
    const { data } = await supabase.rpc('rpc_get_online_users', {
      p_session_id: session.sessionId,
      p_timeout_seconds: 60,
    })
    if (data?.success) {
      setOnlineUsers(data.users || [])
    }
    setLoading(false)
  }, [session?.sessionId])

  useEffect(() => {
    fetchOnlineUsers()
    const interval = setInterval(fetchOnlineUsers, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchOnlineUsers])

  // Re-render relative times every 15s
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 15000)
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
```

**Step 2: Verify it compiles**

Run: `npm run dev`
Expected: No errors (page not routed yet)

**Step 3: Commit**

```bash
git add src/pages/Logs.jsx
git commit -m "feat: create Logs page with online users tab"
```

---

### Task 7: Add route and navigation

**Files:**
- Modify: `src/App.jsx:1-14` (imports) and `src/App.jsx:85-94` (routes)
- Modify: `src/components/AdminSidebar.jsx:5-65` (NAV_ITEMS)

**Step 1: Add Logs import in App.jsx**

Add after the `AddUser` import (line 11):

```javascript
import Logs from './pages/Logs'
```

**Step 2: Add /logs route in App.jsx**

Add after the `/add-user` route block (after line 94):

```jsx
            <Route path="/logs" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Logs />
              </ProtectedRoute>
            } />
```

**Step 3: Add "سجل النظام" to AdminSidebar NAV_ITEMS**

Add a new item to the `NAV_ITEMS` array in `AdminSidebar.jsx`, after the "إدارة المستخدمين" entry (after the closing `}` on line 64, before `]` on line 65):

```javascript
  {
    path: '/logs',
    label: 'سجل النظام',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
```

**Step 4: Verify everything works**

Run: `npm run dev`
Expected:
- Admin sidebar shows "سجل النظام" link
- Clicking it navigates to `/logs`
- Page loads and shows online users (or empty state)

**Step 5: Commit**

```bash
git add src/App.jsx src/components/AdminSidebar.jsx
git commit -m "feat: add /logs route and navigation link for admin"
```

---

### Task 8: Final verification & build

**Step 1: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Manual test checklist**

- [ ] Log in as admin → sidebar shows "سجل النظام"
- [ ] Navigate to `/logs` → page loads with header and tabs
- [ ] Online users table shows current admin user
- [ ] Page shows correct current page (e.g., "سجل النظام")
- [ ] Open another tab/login as different user → appears in the list within 30s
- [ ] Log out second user → disappears from list within 60s
- [ ] Non-admin user cannot access `/logs` (redirected)

**Step 4: Fix any issues and commit**

```bash
git add -A
git commit -m "fix: resolve any lint/build issues from logs page"
```

---

### Task 9: Update PROJECT_REFERENCE.md

**Files:**
- Modify: `PROJECT_REFERENCE.md`

**Step 1: Add to project structure**

Add in the `src/hooks/` section:
```
│   │   ├── useHeartbeat.js    # Heartbeat presence tracking (30s interval)
```

Add in the `src/pages/` section:
```
│   │   ├── Logs.jsx              # صفحة سجل النظام + CSS
│   │   ├── Logs.css
```

Add in the migrations section:
```
│       └── 012_active_sessions.sql
```

**Step 2: Add to Routes table**

```
| `/logs` | `Logs` | admin | سجل النظام — المتصلون الآن |
```

**Step 3: Add database table documentation**

Add `active_sessions` table schema.

**Step 4: Add RPC functions to the table**

```
| `rpc_upsert_heartbeat(p_session_id, p_current_page)` | تحديث حالة الحضور | SECURITY DEFINER |
| `rpc_remove_presence(p_session_id)` | حذف الحضور عند الخروج | SECURITY DEFINER |
| `rpc_get_online_users(p_session_id, p_timeout_seconds)` | جلب المتصلين (admin) | SECURITY DEFINER |
```

**Step 5: Add to changelog**

```
| 2026-03-28 | إضافة صفحة سجل النظام (Logs) — تاب المتصلون الآن مع نظام heartbeat للحضور |
```

**Step 6: Commit**

```bash
git add PROJECT_REFERENCE.md
git commit -m "docs: update project reference with logs page and presence system"
```
