# Kitchen Screen Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/kitchen` page that shows all "preparing" orders in a grid layout with a "Ready" button + confirmation modal for each order.

**Architecture:** New `Kitchen.jsx` page + `Kitchen.css` using existing `useOrders` hook for realtime data. Uses existing `rpc_scanner_mark_ready` RPC to mark orders ready. Requires minor updates to `App.jsx` routing and `AuthContext.jsx` for `/kitchen` route support.

**Tech Stack:** React 18, Supabase JS Client v2 (realtime + RPC), CSS (custom, matching existing design tokens)

---

### Task 1: Update AuthContext to support `/kitchen` route

**Files:**
- Modify: `src/context/AuthContext.jsx:82-84`

**Step 1: Add `/kitchen` to routes that need branch param**

In `AuthContext.jsx`, find the `login` function's redirect logic (line 83):

```javascript
// BEFORE:
const needsBranch = ['/scan', '/display'].includes(route)

// AFTER:
const needsBranch = ['/scan', '/display', '/kitchen'].includes(route)
```

Also update `getDefaultRoute` (line 109):

```javascript
// BEFORE:
const needsBranch = ['/scan', '/display'].includes(route)

// AFTER:
const needsBranch = ['/scan', '/display', '/kitchen'].includes(route)
```

**Step 2: Commit**

```bash
git add src/context/AuthContext.jsx
git commit -m "feat(kitchen): add /kitchen to branch-aware routes in AuthContext"
```

---

### Task 2: Add `/kitchen` route to App.jsx

**Files:**
- Modify: `src/App.jsx`

**Step 1: Import Kitchen page and add route**

Add import at top of file:
```javascript
import Kitchen from './pages/Kitchen'
```

Add route after the `/scan` route (after line 69):
```jsx
<Route path="/kitchen" element={
  <ProtectedRoute allowedRoles={['user', 'admin']}>
    <Kitchen />
  </ProtectedRoute>
} />
```

**Step 2: Commit**

```bash
git add src/App.jsx
git commit -m "feat(kitchen): add /kitchen route with user+admin access"
```

---

### Task 3: Create Kitchen.css

**Files:**
- Create: `src/pages/Kitchen.css`

**Step 1: Write the stylesheet**

Use the same CSS variables and design tokens from `DisplayDashboard.css`. Key styles needed:

- `.kitchen-root` — same base as `.display-root` (dark bg, RTL, Tajawal font)
- `.kitchen-header` — reuse `.dash-header` pattern (branch name + clock + order count + logout)
- `.kitchen-grid` — `display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;`
- `.kitchen-card` — same style as `OrderCard` (gradient bg, border, rounded) with added ready button area
- `.kitchen-ready-btn` — green button (`--kz-green`), full width at bottom of card
- `.kitchen-modal-overlay` — fixed overlay with dark transparent bg
- `.kitchen-modal` — centered modal card with confirm/cancel buttons
- `.kitchen-empty` — reuse `.dash-empty` pattern
- Responsive breakpoints matching existing ones (1200px, 768px)

```css
/* Root — matches DisplayDashboard.css variables */
.kitchen-root {
    --bg-deep: #1a140e;
    --bg-base: #1E1810;
    --bg-card: #2a2018;
    --bg-elevated: #332a20;
    --border: rgba(61, 48, 40, 0.25);
    --border-solid: #3d3028;
    --text-primary: #F8F5F2;
    --text-secondary: #a09890;
    --text-muted: #706860;
    --text-dim: #575250;
    --accent: #FF5100;
    --accent-light: #FF7A3D;
    --green: #22c55e;
    --green-dark: #16a34a;

    font-family: 'Tajawal', sans-serif;
    min-height: 100vh;
    background: var(--bg-deep);
    color: var(--text-primary);
    direction: rtl;
}

/* Subtle background texture — same as display */
.kitchen-root::before {
    content: '';
    position: fixed;
    inset: 0;
    opacity: 0.025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
}

.kitchen-root > * {
    position: relative;
    z-index: 1;
}

/* Header — reuses dash-header pattern */
.kitchen-header {
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);
}

.kitchen-header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 2rem;
    padding-right: 136px;
    gap: 1rem;
}

.kitchen-brand {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.kitchen-logo {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: linear-gradient(135deg, var(--green) 0%, var(--green-dark) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(34, 197, 94, 0.2);
    flex-shrink: 0;
}

.kitchen-logo svg {
    width: 26px;
    height: 26px;
    color: white;
}

.kitchen-branch-name {
    font-size: 1.4rem;
    font-weight: 900;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    line-height: 1.2;
    margin: 0;
}

.kitchen-branch-sub {
    font-size: 0.78rem;
    color: var(--text-muted);
    font-weight: 400;
    margin-top: 0.1rem;
}

.kitchen-info {
    display: flex;
    align-items: center;
    gap: 1.5rem;
}

.kitchen-clock {
    font-size: 2.5rem;
    font-weight: 800;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    line-height: 1;
    direction: ltr;
}

.kitchen-count {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.4rem;
}

.kitchen-count-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.kitchen-count-dot--active {
    background: var(--accent);
    box-shadow: 0 0 8px rgba(255, 81, 0, 0.5);
    animation: kitchen-blink 2s ease-in-out infinite;
}

.kitchen-count-dot--idle {
    background: var(--text-muted);
}

@keyframes kitchen-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}

.kitchen-count-text {
    font-size: 0.78rem;
    color: var(--text-muted);
    font-weight: 500;
}

.kitchen-count-number {
    color: var(--text-primary);
    font-weight: 800;
}

/* Main content */
.kitchen-main {
    padding: 1.5rem 2rem 2rem;
}

/* Grid layout */
.kitchen-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
}

/* Order card */
.kitchen-card {
    background: linear-gradient(135deg, #2f2520 0%, rgba(255, 81, 0, 0.06) 100%);
    border: 1px solid rgba(255, 81, 0, 0.2);
    border-radius: 16px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    animation: kitchen-card-in 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes kitchen-card-in {
    from { opacity: 0; transform: translateY(16px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

.kitchen-card--fading {
    animation: kitchen-card-out 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes kitchen-card-out {
    to { opacity: 0; transform: scale(0.95); }
}

.kitchen-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.kitchen-card-order {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.kitchen-card-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(255, 81, 0, 0.2);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    font-weight: bold;
}

.kitchen-card-id {
    font-size: 1.5rem;
    font-weight: 900;
    color: var(--text-primary);
}

.kitchen-card-channel {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--accent-light);
}

.kitchen-card-time {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: var(--text-muted);
}

.kitchen-card-time svg {
    width: 16px;
    height: 16px;
}

/* Ready button */
.kitchen-ready-btn {
    width: 100%;
    padding: 0.75rem;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--green) 0%, var(--green-dark) 100%);
    color: white;
    font-family: 'Tajawal', sans-serif;
    font-size: 1rem;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
}

.kitchen-ready-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(34, 197, 94, 0.3);
}

.kitchen-ready-btn:active {
    transform: translateY(0);
}

.kitchen-ready-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
}

/* Modal overlay */
.kitchen-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    animation: kitchen-overlay-in 0.2s ease;
}

@keyframes kitchen-overlay-in {
    from { opacity: 0; }
    to { opacity: 1; }
}

.kitchen-modal {
    background: var(--bg-card);
    border: 1px solid var(--border-solid);
    border-radius: 20px;
    padding: 2rem 2.5rem;
    text-align: center;
    max-width: 400px;
    width: 90%;
    animation: kitchen-modal-in 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes kitchen-modal-in {
    from { opacity: 0; transform: scale(0.9) translateY(20px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
}

.kitchen-modal-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: rgba(34, 197, 94, 0.12);
    border: 1px solid rgba(34, 197, 94, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1rem;
    font-size: 1.5rem;
}

.kitchen-modal-title {
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
}

.kitchen-modal-order-id {
    color: var(--green);
    font-weight: 900;
}

.kitchen-modal-subtitle {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 1.5rem;
}

.kitchen-modal-actions {
    display: flex;
    gap: 0.75rem;
}

.kitchen-modal-confirm {
    flex: 1;
    padding: 0.75rem;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--green) 0%, var(--green-dark) 100%);
    color: white;
    font-family: 'Tajawal', sans-serif;
    font-size: 0.95rem;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.2s ease;
}

.kitchen-modal-confirm:hover {
    box-shadow: 0 4px 16px rgba(34, 197, 94, 0.3);
}

.kitchen-modal-confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.kitchen-modal-cancel {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--border-solid);
    border-radius: 10px;
    background: var(--bg-elevated);
    color: var(--text-secondary);
    font-family: 'Tajawal', sans-serif;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
}

.kitchen-modal-cancel:hover {
    border-color: var(--text-muted);
    color: var(--text-primary);
}

/* Empty state */
.kitchen-empty-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 70vh;
}

.kitchen-empty {
    text-align: center;
    animation: kitchen-card-in 0.6s cubic-bezier(0.4, 0, 0.2, 1) both;
}

.kitchen-empty-icon {
    width: 88px;
    height: 88px;
    border-radius: 22px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
}

.kitchen-empty-icon svg {
    width: 40px;
    height: 40px;
    color: var(--text-dim);
    opacity: 0.6;
}

.kitchen-empty-title {
    font-size: 1.2rem;
    font-weight: 800;
    color: var(--text-dim);
    margin-bottom: 0.4rem;
}

.kitchen-empty-subtitle {
    font-size: 0.88rem;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
}

.kitchen-empty-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--green);
    animation: kitchen-waiting 1.5s ease-in-out infinite;
}

@keyframes kitchen-waiting {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.3; transform: scale(0.6); }
}

/* Responsive */
@media (min-width: 1200px) {
    .kitchen-logo { width: 56px; height: 56px; border-radius: 16px; }
    .kitchen-logo svg { width: 30px; height: 30px; }
    .kitchen-branch-name { font-size: 1.75rem; }
    .kitchen-clock { font-size: 3rem; }
    .kitchen-header-inner { padding: 1.25rem 3rem; padding-right: 136px; }
    .kitchen-main { padding: 2rem 3rem; }
}

@media (max-width: 768px) {
    .kitchen-header-inner { padding: 0.85rem 1rem; }
    .kitchen-main { padding: 1rem; }
    .kitchen-brand { gap: 0.75rem; }
    .kitchen-logo { width: 40px; height: 40px; border-radius: 10px; }
    .kitchen-logo svg { width: 22px; height: 22px; }
    .kitchen-branch-name { font-size: 1.1rem; }
    .kitchen-clock { font-size: 1.6rem; }
    .kitchen-grid { grid-template-columns: 1fr; }
    .kitchen-empty-icon { width: 72px; height: 72px; border-radius: 18px; }
    .kitchen-empty-icon svg { width: 32px; height: 32px; }
}
```

**Step 2: Commit**

```bash
git add src/pages/Kitchen.css
git commit -m "feat(kitchen): add Kitchen page styles with grid layout and modal"
```

---

### Task 4: Create Kitchen.jsx

**Files:**
- Create: `src/pages/Kitchen.jsx`

**Step 1: Write the Kitchen page component**

The page should:
1. Check for `?branch=` param, show `BranchSelect` if missing
2. Use `useBranch()` to get branch data
3. Use `useOrders()` to get realtime preparing orders
4. Show grid of order cards with ready button
5. Confirmation modal when ready button is clicked
6. Call `rpc_scanner_mark_ready` RPC on confirm (same RPC used by scanner — see `useScanner.js:52`)
7. Fade animation when order is marked ready

```jsx
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBranch } from '../hooks/useBranch'
import { useOrders } from '../hooks/useOrders'
import { useAuth } from '../context/AuthContext'
import { formatClock, formatElapsed } from '../utils/formatTime'
import { supabase } from '../lib/supabase'
import BranchSelect from './BranchSelect'
import LoadingScreen from '../components/LoadingScreen'
import './Kitchen.css'

export default function Kitchen() {
  const [searchParams] = useSearchParams()
  if (!searchParams.get('branch')) {
    return <BranchSelect target="kitchen" />
  }
  return <KitchenInner />
}

function KitchenInner() {
  const { session } = useAuth()
  const { branch, loading, error } = useBranch()
  const { preparing } = useOrders(branch?.id)
  const [clock, setClock] = useState(formatClock())
  const [confirmOrder, setConfirmOrder] = useState(null)
  const [marking, setMarking] = useState(false)
  const [fadingOrders, setFadingOrders] = useState(new Set())

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setClock(formatClock()), 1000)
    return () => clearInterval(interval)
  }, [])

  const handleMarkReady = useCallback(async () => {
    if (!confirmOrder || !session?.sessionId) return
    setMarking(true)
    try {
      // Add to fading set
      setFadingOrders(prev => new Set([...prev, confirmOrder.id]))
      setConfirmOrder(null)

      // Call same RPC used by scanner
      await supabase.rpc('rpc_scanner_mark_ready', {
        p_session_id: session.sessionId,
        p_order_internal_id: confirmOrder.id,
        p_device_info: navigator.userAgent
      })
    } catch (err) {
      console.error('Error marking order ready:', err)
      // Remove from fading if error
      setFadingOrders(prev => {
        const next = new Set(prev)
        next.delete(confirmOrder?.id)
        return next
      })
    } finally {
      setMarking(false)
    }
  }, [confirmOrder, session?.sessionId])

  // Filter out fading orders after animation
  const visibleOrders = preparing.filter(o => !fadingOrders.has(o.id))

  if (loading) return <LoadingScreen fullScreen />

  if (error) {
    return (
      <div className="display-fullscreen">
        <div className="display-error-card">
          <div className="display-error-icon">⚠️</div>
          <div className="display-error-title">{error}</div>
          <div className="display-error-subtitle">تحقق من رابط الفرع</div>
        </div>
      </div>
    )
  }

  return (
    <div className="kitchen-root">
      {/* Header */}
      <header className="kitchen-header">
        <div className="kitchen-header-inner">
          <div className="kitchen-brand">
            <div className="kitchen-logo">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
              </svg>
            </div>
            <div>
              <h1 className="kitchen-branch-name">مطبخ — {branch?.name_ar}</h1>
              <p className="kitchen-branch-sub">{branch?.name_en} — كبة زون</p>
            </div>
          </div>

          <div className="kitchen-info">
            <div>
              <div className="kitchen-clock">{clock}</div>
              <div className="kitchen-count">
                <div className={`kitchen-count-dot ${visibleOrders.length > 0 ? 'kitchen-count-dot--active' : 'kitchen-count-dot--idle'}`} />
                <span className="kitchen-count-text">
                  قيد التحضير: <span className="kitchen-count-number">{visibleOrders.length}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="kitchen-main">
        {visibleOrders.length === 0 ? (
          <div className="kitchen-empty-wrap">
            <div className="kitchen-empty">
              <div className="kitchen-empty-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="kitchen-empty-title">لا توجد طلبات قيد التحضير</div>
              <div className="kitchen-empty-subtitle">
                <span className="kitchen-empty-dot" />
                في انتظار طلبات جديدة...
              </div>
            </div>
          </div>
        ) : (
          <div className="kitchen-grid">
            {visibleOrders.map(order => (
              <KitchenCard
                key={order.id}
                order={order}
                fading={fadingOrders.has(order.id)}
                onReady={() => setConfirmOrder(order)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      {confirmOrder && (
        <div className="kitchen-modal-overlay" onClick={() => !marking && setConfirmOrder(null)}>
          <div className="kitchen-modal" onClick={e => e.stopPropagation()}>
            <div className="kitchen-modal-icon">✓</div>
            <div className="kitchen-modal-title">
              هل تريد تحويل الطلب <span className="kitchen-modal-order-id">{confirmOrder.order_id}</span> إلى جاهز؟
            </div>
            <div className="kitchen-modal-subtitle">سيتم نقل الطلب إلى قائمة الطلبات الجاهزة</div>
            <div className="kitchen-modal-actions">
              <button
                className="kitchen-modal-confirm"
                onClick={handleMarkReady}
                disabled={marking}
              >
                {marking ? 'جاري التحويل...' : 'تأكيد'}
              </button>
              <button
                className="kitchen-modal-cancel"
                onClick={() => setConfirmOrder(null)}
                disabled={marking}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KitchenCard({ order, fading, onReady }) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(order.scanned_at))

  useEffect(() => {
    setElapsed(formatElapsed(order.scanned_at))
    const interval = setInterval(() => {
      setElapsed(formatElapsed(order.scanned_at))
    }, 1000)
    return () => clearInterval(interval)
  }, [order.scanned_at])

  const channelName = order.channel_link
    ? order.channel_link.includes('jahez') ? 'جاهز'
    : order.channel_link.includes('hungerstation') ? 'هنقرستيشن'
    : 'مباشر'
    : 'مباشر'

  return (
    <div className={`kitchen-card ${fading ? 'kitchen-card--fading' : ''}`}>
      <div className="kitchen-card-header">
        <div className="kitchen-card-order">
          <div className="kitchen-card-icon">🔥</div>
          <span className="kitchen-card-id">{order.order_id}</span>
        </div>
        <span className="kitchen-card-channel">{channelName}</span>
      </div>
      <div className="kitchen-card-time">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {elapsed}
      </div>
      <button className="kitchen-ready-btn" onClick={onReady}>
        ✓ جاهز
      </button>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/pages/Kitchen.jsx
git commit -m "feat(kitchen): add Kitchen page with grid layout, ready button, and confirmation modal"
```

---

### Task 5: Update BranchSelect to support `kitchen` target

**Files:**
- Modify: `src/pages/BranchSelect.jsx`

**Step 1: Check if BranchSelect handles the `target` prop for URL building**

The `BranchSelect` component receives `target` prop (e.g., `"display"`, `"scan"`) and builds URLs like `/${target}?branch=${code}`. Since we pass `target="kitchen"`, it should work automatically. Verify by reading the component — if it uses the target directly in URL construction, no change is needed.

**Step 2: Commit (only if changes were needed)**

---

### Task 6: Update PROJECT_REFERENCE.md

**Files:**
- Modify: `PROJECT_REFERENCE.md`

**Step 1: Add Kitchen page details**

Add to Routes table (section 4):
```
| `/kitchen?branch=CODE` | `Kitchen` | user, admin | شاشة المطبخ — عرض الطلبات قيد التحضير + زر جاهز |
```

Add to Pages section (8.7) a new entry for Kitchen.

Add to section 6 (Business Logic) — order lifecycle:
```
[زر جاهز في المطبخ] → UPDATE order (status: ready, ready_at) + INSERT scan_log (second_scan)
```

Add to changelog (section 13):
```
| 2026-03-27 | إضافة شاشة المطبخ (/kitchen): عرض grid للطلبات قيد التحضير + زر جاهز مع modal تأكيد |
```

**Step 2: Commit**

```bash
git add PROJECT_REFERENCE.md
git commit -m "docs: update PROJECT_REFERENCE with kitchen screen details"
```
