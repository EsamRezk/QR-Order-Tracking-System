# Logs Page — Online Users Tab Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create implementation plan after approval.

**Goal:** Add a logs page (`/logs`, admin only) with a tabbed layout. First tab shows currently online users with their page, branch, role, and last activity. Future tabs TBD.

**Architecture:** New `active_sessions` DB table with heartbeat mechanism, a `useHeartbeat` hook in all protected pages, and a new `Logs.jsx` page with real-time polling.

**Tech Stack:** React 18, Supabase (PostgreSQL + RPC), existing auth system, existing design tokens.

---

## Database

### New table: `active_sessions`

```sql
CREATE TABLE active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_page TEXT NOT NULL DEFAULT '/',
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX idx_active_sessions_heartbeat ON active_sessions(last_heartbeat);
```

- RLS: enabled, access via RPC only (same pattern as `users` table)
- Realtime: NOT needed (polling every 30s is sufficient)

### RPC Functions

**`upsert_heartbeat(p_user_id UUID, p_current_page TEXT)`**
- UPSERT into `active_sessions` — insert if no row for user, update `last_heartbeat` + `current_page` if exists
- SECURITY DEFINER

**`remove_session(p_user_id UUID)`**
- DELETE from `active_sessions` WHERE `user_id = p_user_id`
- Called on logout
- SECURITY DEFINER

**`get_online_users(p_timeout_seconds INTEGER DEFAULT 60)`**
- SELECT from `active_sessions` JOIN `users` JOIN `branches`
- WHERE `last_heartbeat > now() - interval '1 second' * p_timeout_seconds`
- Returns: username, role, branch name (name_ar), current_page, last_heartbeat, started_at
- Admin only (validate caller is admin)
- SECURITY DEFINER

---

## Frontend

### Hook: `useHeartbeat.js`
- Runs inside `ProtectedRoute` for all authenticated users
- On mount: calls `upsert_heartbeat` with current page
- Every 30 seconds: calls `upsert_heartbeat` with current page
- Listens to route changes (`useLocation`) to update page immediately
- On unmount / logout: calls `remove_session`

### Page: `Logs.jsx` + `Logs.css`
- **URL:** `/logs` (admin only)
- **Layout:** Header + tab bar + content area
- **Header:** "سجل النظام" title + online count badge
- **Tabs:** "المتصلون الآن" (active), future tabs placeholder
- **Online Users Table:**
  - Columns: المستخدم، الدور، الفرع، الصفحة الحالية، آخر نشاط
  - Green dot indicator for each online user
  - Friendly page names (e.g., `/kitchen?branch=Erqaa-01` → "شاشة المطبخ — عرقه")
  - Relative time for last activity (e.g., "قبل 15 ثانية")
  - Auto-refresh every 30 seconds
- **Empty state:** "لا يوجد مستخدمين متصلين حالياً"
- **Design:** Dark theme matching existing pages (kz-dark background, kz-primary accents, Tajawal font)

### Route & Navigation
- Add `/logs` route in `App.jsx` — admin only
- Add "سجل النظام" link in admin navigation

---

## Session Lifecycle

```
Login → INSERT active_sessions (via upsert_heartbeat)
  ↓
Every 30s → UPDATE last_heartbeat + current_page
  ↓
Route change → UPDATE current_page immediately
  ↓
Logout → DELETE from active_sessions (via remove_session)
  ↓
Stale check → Online if last_heartbeat within 60s
```

---

## Decisions

- **Polling over Realtime:** 30s polling is simpler and sufficient for admin monitoring. No need for Realtime subscription on this table.
- **RPC over direct access:** Same security pattern as `users` table — RLS enabled, no policies, access only through SECURITY DEFINER functions.
- **Single row per user:** UPSERT ensures one session row per user (not per tab/device). Last active tab wins.
- **60s timeout:** User considered offline if no heartbeat for 60 seconds. Generous enough to handle network hiccups.
