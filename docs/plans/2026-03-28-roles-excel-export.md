# User Roles & Excel Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand user role access to Display/Kitchen/Analytics (branch-locked), hide screen role, and replace CSV export with styled Excel export (logo + RTL + colored headers).

**Architecture:** Modify route permissions in App.jsx, add branch-level protection in ProtectedRoute, update UserSidebar navigation, filter Analytics by user's branch, and create an Excel export utility using `exceljs`.

**Tech Stack:** React 18, exceljs, existing Supabase queries, KebbaZone Logo.png

---

### Task 1: Install exceljs

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run: `npm install exceljs`

**Step 2: Verify installation**

Run: `npm ls exceljs`
Expected: `exceljs@x.x.x`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add exceljs dependency for Excel export"
```

---

### Task 2: Update route permissions in App.jsx

**Files:**
- Modify: `src/App.jsx:65-84`

**Step 1: Add 'user' to display and analytics allowedRoles**

Change the routes to:

```jsx
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
```

**Step 2: Verify dev server loads without errors**

Run: `npm run dev`
Expected: No compilation errors

**Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: allow user role access to display, kitchen, and analytics routes"
```

---

### Task 3: Add branch protection in ProtectedRoute

**Files:**
- Modify: `src/components/ProtectedRoute.jsx`

**Step 1: Add branch validation for user role**

For `user` role on pages that use `?branch=` param, verify the branch matches the user's assigned branch. If not, show an access denied screen with a back button.

```jsx
import { Navigate, useSearchParams, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIdleTimer } from '../hooks/useIdleTimer'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, session, getDefaultRoute } = useAuth()
  const [searchParams] = useSearchParams()
  const location = useLocation()

  useIdleTimer()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return <Navigate to={getDefaultRoute()} replace />
  }

  // Branch protection for user role
  if (session.role === 'user') {
    const branchParam = searchParams.get('branch')
    const branchPages = ['/display', '/scan', '/kitchen']
    const currentPath = location.pathname

    if (branchPages.includes(currentPath) && branchParam && session.branchCode && branchParam !== session.branchCode) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1E1810',
          fontFamily: "'Tajawal', sans-serif",
          direction: 'rtl',
        }}>
          <div style={{
            textAlign: 'center',
            background: '#2f2520',
            borderRadius: 16,
            padding: '3rem 2.5rem',
            border: '1px solid #3d3028',
            maxWidth: 420,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: '#ce0b0b15', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem', fontSize: '1.8rem',
            }}>🚫</div>
            <h2 style={{ color: '#fff', fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              ليس لديك صلاحية
            </h2>
            <p style={{ color: '#8a8280', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              لا يمكنك الوصول لهذا الفرع. يمكنك فقط الوصول لفرعك.
            </p>
            <a
              href={`${currentPath}?branch=${session.branchCode}`}
              style={{
                display: 'inline-block',
                padding: '0.75rem 2rem',
                background: '#FF5100',
                color: '#fff',
                borderRadius: 10,
                fontWeight: 700,
                textDecoration: 'none',
                fontSize: '0.95rem',
              }}
            >
              العودة لفرعي
            </a>
          </div>
        </div>
      )
    }

    // Analytics branch protection: user can only see their branch
    if (currentPath === '/analytics' && !session.branchCode) {
      // User without branch assigned — block analytics
      return <Navigate to={getDefaultRoute()} replace />
    }
  }

  return children
}
```

**Step 2: Verify it compiles**

Run: `npm run dev`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ProtectedRoute.jsx
git commit -m "feat: add branch-level protection for user role"
```

---

### Task 4: Update UserSidebar with Display + Analytics links

**Files:**
- Modify: `src/components/UserSidebar.jsx:5-28`

**Step 1: Add Display and Analytics to NAV_ITEMS**

Add two new items to the `NAV_ITEMS` array:

```javascript
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
    path: '/display',
    label: 'شاشة الفرع',
    needsBranch: true,
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
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
  {
    path: '/analytics',
    label: 'التحليلات',
    needsBranch: false,
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
]
```

**Step 2: Commit**

```bash
git add src/components/UserSidebar.jsx
git commit -m "feat: add display and analytics links to user sidebar"
```

---

### Task 5: Hide screen role from AddUser page

**Files:**
- Modify: `src/pages/AddUser.jsx:10-14`

**Step 1: Filter out 'screen' from ROLE_OPTIONS**

```javascript
const ROLE_OPTIONS = [
  { value: 'user', label: 'مستخدم', icon: '👤' },
  { value: 'admin', label: 'مدير', icon: '🛡️' },
]
```

Also update the role change handler (line 193-199) — remove the `screen` case:

```javascript
onChange={(e) => {
  const newRole = e.target.value
  const updates = { role: newRole }
  if (newRole === 'admin') updates.route = '/analytics'
  else updates.route = '/scan'
  setForm({ ...form, ...updates })
}}
```

**Step 2: Commit**

```bash
git add src/pages/AddUser.jsx
git commit -m "feat: hide screen role from add user form"
```

---

### Task 6: Update Analytics for user role — branch filtering

**Files:**
- Modify: `src/pages/Analytics.jsx`

**Step 1: Import useAuth and add branch locking**

Add `useAuth` import and lock the branch for user role:

```jsx
import { useAuth } from '../context/AuthContext'
```

Inside the component, add after the existing state declarations:

```jsx
const { session } = useAuth()
const isUserRole = session?.role === 'user'
```

**Step 2: Lock selectedBranch for user role**

Replace the `useEffect` for fetching branches (lines 79-85):

```jsx
useEffect(() => {
  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('*').eq('is_active', true)
    setBranches(data || [])
    // If user role, auto-select their branch
    if (isUserRole && session.branchId) {
      setSelectedBranch(session.branchId)
    }
  }
  fetchBranches()
}, [])
```

**Step 3: Conditionally hide branch filter in JSX**

Wrap the `BranchSelector` in the filters-bar (line 239) with a condition:

```jsx
{!isUserRole && (
  <BranchSelector value={selectedBranch} onChange={setSelectedBranch} includeAll />
)}
```

**Step 4: Lock search to user's branch**

In the `handleSearch` function, add branch filter for user role. After the `.ilike()` call:

```jsx
const handleSearch = async (e) => {
  e.preventDefault()
  const q = searchQuery.trim()
  if (!q) {
    setSearchResult(null)
    return
  }
  setSearching(true)
  let query = supabase
    .from('orders')
    .select('*, branches(name_ar, name_en)')
    .ilike('order_id', `%${q}%`)
    .order('created_at', { ascending: false })
    .limit(50)

  if (isUserRole && session.branchId) {
    query = query.eq('branch_id', session.branchId)
  }

  const { data } = await query
  setSearchResult(data || [])
  setSearching(false)
}
```

**Step 5: Commit**

```bash
git add src/pages/Analytics.jsx
git commit -m "feat: lock analytics to user's branch for user role"
```

---

### Task 7: Create Excel export utility

**Files:**
- Create: `src/utils/exportExcel.js`

**Step 1: Create the export utility**

```javascript
import ExcelJS from 'exceljs'

// Convert image file to base64 for exceljs
async function getLogoBase64() {
  try {
    const response = await fetch('/assets/img/KebbaZone Logo.png')
    const blob = await response.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result.split(',')[1])
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function getChannelName(channelLink) {
  if (!channelLink) return 'مباشر'
  if (channelLink.includes('jahez')) return 'جاهز'
  if (channelLink.includes('hungerstation')) return 'هنقرستيشن'
  return 'توصيل'
}

function formatPrepDuration(seconds) {
  if (!seconds) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs} ث`
  return `${mins}د ${secs}ث`
}

export async function exportOrdersToExcel(orders, branchName) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'كبة زون'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('سجل الطلبات', {
    views: [{ rightToLeft: true }],
  })

  // Column definitions
  sheet.columns = [
    { header: 'رقم الطلب', key: 'order_id', width: 18 },
    { header: 'الفرع', key: 'branch', width: 16 },
    { header: 'القناة', key: 'channel', width: 16 },
    { header: 'وقت المسح', key: 'scanned_at', width: 28 },
    { header: 'وقت الجاهزية', key: 'ready_at', width: 28 },
    { header: 'مدة التحضير', key: 'prep_duration', width: 18 },
  ]

  // ── Row 1-2: Logo + Title ──
  // Merge cells for logo area
  sheet.mergeCells('A1:F2')
  const titleCell = sheet.getCell('A1')
  titleCell.value = `سجل الطلبات — ${branchName || 'جميع الفروع'}`
  titleCell.font = { name: 'Tajawal', size: 16, bold: true, color: { argb: 'FF333333' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F5F4' } }

  // Try to add logo
  const logoBase64 = await getLogoBase64()
  if (logoBase64) {
    const logoId = workbook.addImage({
      base64: logoBase64,
      extension: 'png',
    })
    sheet.addImage(logoId, {
      tl: { col: 4.5, row: 0.1 },
      ext: { width: 80, height: 45 },
    })
  }

  // ── Row 3: Header ──
  const headerRow = sheet.getRow(3)
  const headers = ['رقم الطلب', 'الفرع', 'القناة', 'وقت المسح', 'وقت الجاهزية', 'مدة التحضير']
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = { name: 'Tajawal', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF5100' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE04500' } },
      bottom: { style: 'thin', color: { argb: 'FFE04500' } },
      left: { style: 'thin', color: { argb: 'FFE04500' } },
      right: { style: 'thin', color: { argb: 'FFE04500' } },
    }
  })
  headerRow.height = 32

  // ── Data Rows (starting from row 4) ──
  orders.forEach((order, index) => {
    const rowNum = index + 4
    const row = sheet.getRow(rowNum)
    const isEven = index % 2 === 0
    const bgColor = isEven ? 'FFFFFFFF' : 'FFFFF5F0'

    const values = [
      order.order_id,
      order.branches?.name_ar || '—',
      getChannelName(order.channel_link),
      order.scanned_at ? new Date(order.scanned_at).toLocaleString('ar-SA') : '—',
      order.ready_at ? new Date(order.ready_at).toLocaleString('ar-SA') : '—',
      formatPrepDuration(order.prep_duration_seconds),
    ]

    values.forEach((val, i) => {
      const cell = row.getCell(i + 1)
      cell.value = val
      cell.font = { name: 'Tajawal', size: 11, color: { argb: 'FF333333' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      }
    })
    row.height = 26
  })

  // ── Generate & Download ──
  const today = new Date().toISOString().slice(0, 10)
  const fileName = `طلبات_${branchName || 'الكل'}_${today}.xlsx`

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
```

**Step 2: Copy logo to public for fetch access**

The logo at `src/assets/img/KebbaZone Logo.png` needs to be accessible via fetch. Copy it to `public/assets/img/KebbaZone Logo.png`.

Run: `mkdir -p public/assets/img && cp "src/assets/img/KebbaZone Logo.png" "public/assets/img/KebbaZone Logo.png"`

**Step 3: Commit**

```bash
git add src/utils/exportExcel.js "public/assets/img/KebbaZone Logo.png"
git commit -m "feat: create Excel export utility with styled output, logo, and RTL"
```

---

### Task 8: Replace CSV button with Excel export in Analytics

**Files:**
- Modify: `src/pages/Analytics.jsx`

**Step 1: Import the export utility**

Add at top of file:

```javascript
import { exportOrdersToExcel } from '../utils/exportExcel'
```

**Step 2: Replace the commented CSV button with Excel button**

Replace the commented out CSV button block (lines 202-208) with:

```jsx
<button
  onClick={() => {
    const branchName = isUserRole
      ? session.branch
      : branches.find(b => b.id === selectedBranch)?.name_ar || null
    exportOrdersToExcel(orders, branchName)
  }}
  className="export-btn"
  disabled={orders.length === 0}
>
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
  تصدير Excel
</button>
```

**Step 3: Remove the old `exportCSV` function** (lines 165-177)

Delete the entire `exportCSV` function since it's no longer needed.

**Step 4: Verify**

Run: `npm run dev`
Expected: Excel button appears, clicking downloads a styled .xlsx file

**Step 5: Commit**

```bash
git add src/pages/Analytics.jsx
git commit -m "feat: replace CSV export with styled Excel export in analytics"
```

---

### Task 9: Final verification & build check

**Step 1: Run lint**

Run: `npm run lint`
Expected: No errors

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: resolve any lint/build issues"
```
