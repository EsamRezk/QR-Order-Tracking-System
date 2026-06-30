import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatDuration } from '../utils/formatTime'
import { useAuth } from '../context/AuthContext'
import { exportOrdersToExcel } from '../utils/exportExcel'
import BranchSelector from '../components/BranchSelector'
import LogoutButton from '../components/LogoutButton'
import LoadingScreen from '../components/LoadingScreen'
import { DeliveryAppLogo } from '../components/DeliveryAppBadge'
import {
  DELIVERY_APPS,
  DIRECT_APP,
  resolveDeliveryApp,
  resolveAppOrderNumber,
  resolveFoodicsNumber,
} from '../config/deliveryApps'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import './Analytics.css'

const DATE_RANGES = [
  { label: 'اليوم', days: 0, icon: '☀️' },
  { label: 'آخر 7 أيام', days: 7, icon: '📅' },
  { label: 'آخر 30 يوم', days: 30, icon: '📊' },
]

// خيارات فلتر الحالة (الكل + كل الحالات الممكنة)
const STATUS_OPTIONS = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'preparing', label: 'قيد التحضير' },
  { value: 'ready', label: 'جاهز' },
  { value: 'completed', label: 'مكتمل' },
  { value: 'cancelled', label: 'ملغي' },
  { value: 'new', label: 'جديد' },
]

const STATUS_META = {
  new: { label: '🆕 جديد' },
  preparing: { label: '🔥 قيد التحضير' },
  ready: { label: '✅ جاهز' },
  completed: { label: '📦 مكتمل' },
  cancelled: { label: '🚫 ملغي' },
}

// خيارات فلتر التطبيق (الكل + تطبيقات التوصيل + مباشر)
const APP_OPTIONS = [
  { value: 'all', label: 'كل التطبيقات' },
  ...Object.entries(DELIVERY_APPS).map(([key, app]) => ({ value: key, label: app.name })),
  { value: DIRECT_APP.key, label: DIRECT_APP.name },
]

/* ── صف طلب في الجدول (يعرض هوية التطبيق + رقمي التطبيق وفوديكس + الحالة) ── */
function OrderRow({ order }) {
  const app = resolveDeliveryApp(order)
  const appNumber = resolveAppOrderNumber(order)
  const status = STATUS_META[order.status] || { label: order.status }
  return (
    <tr>
      <td>
        <div className="app-cell">
          <DeliveryAppLogo app={app} size="sm" />
          <span className="app-cell-name" style={{ color: app.ink }}>{app.name}</span>
        </div>
      </td>
      <td className="order-id-cell" dir="ltr">{appNumber || '—'}</td>
      <td className="order-id-cell" dir="ltr">{resolveFoodicsNumber(order)}</td>
      <td className="branch-cell">{order.branches?.name_ar || '—'}</td>
      <td>
        <span className={`status-badge status-badge--${order.status}`}>{status.label}</span>
      </td>
      <td className="time-cell">{new Date(order.scanned_at || order.created_at).toLocaleString('ar-SA')}</td>
      <td className="time-cell">{order.ready_at ? new Date(order.ready_at).toLocaleString('ar-SA') : '—'}</td>
      <td className="duration-cell">{order.prep_duration_seconds ? formatDuration(order.prep_duration_seconds) : '—'}</td>
    </tr>
  )
}

function OrdersTableHead() {
  return (
    <thead>
      <tr>
        <th>التطبيق</th>
        <th>رقم بالتطبيق</th>
        <th>رقم فوديكس</th>
        <th>الفرع</th>
        <th>الحالة</th>
        <th>وقت الطلب</th>
        <th>وقت الجاهزية</th>
        <th>مدة التحضير</th>
      </tr>
    </thead>
  )
}

function getDateFrom(days) {
  if (days === 0) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today.toISOString()
  }
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

/* ── Animated Number ── */
function AnimatedValue({ value, suffix = '' }) {
  return (
    <span className="tabular-nums">{value}{suffix}</span>
  )
}

/* ── KPI Card ── */
function KPICard({ icon, label, value, accent, index }) {
  return (
    <div
      className="kpi-card group"
      style={{ '--accent': accent, animationDelay: `${index * 80}ms` }}
    >
      <div className="kpi-icon-wrap">
        <div className="kpi-icon">{icon}</div>
      </div>
      <div className="kpi-body">
        <span className="kpi-label">{label}</span>
        <span className="kpi-value" style={{ color: accent }}>
          <AnimatedValue value={value} />
        </span>
      </div>
      <div className="kpi-glow" />
    </div>
  )
}

/* ── Custom Tooltip ── */
function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      <p className="chart-tooltip-value">
        {payload[0].value} <span>{unit}</span>
      </p>
    </div>
  )
}

/* ── Main Component ── */
export default function Analytics() {
  const { session } = useAuth()
  const isUserRole = session?.role === 'user'
  const [orders, setOrders] = useState([])
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [dateRange, setDateRange] = useState(7)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [searching, setSearching] = useState(false)
  // فلاتر جدول السجل (تُطبّق محلياً على الطلبات المجلوبة)
  const [statusFilter, setStatusFilter] = useState('all')
  const [appFilter, setAppFilter] = useState('all')
  const [numberFilter, setNumberFilter] = useState('')

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
  }, [isUserRole, session.branchId])

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

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResult(null)
  }

  useEffect(() => {
    // Wait for branch to be set before fetching for user role
    if (isUserRole && !selectedBranch) return

    const fetchOrders = async () => {
      setLoading(true)
      // نجلب كل الطلبات (بكل الحالات) ضمن الفترة/الفرع — الفلترة بالحالة/التطبيق/الرقم محلية
      let query = supabase
        .from('orders')
        .select('*, branches(name_ar, name_en)')
        .gte('created_at', getDateFrom(dateRange))
        .order('created_at', { ascending: false })
        .limit(1000)

      if (selectedBranch) {
        query = query.eq('branch_id', selectedBranch)
      }

      const { data } = await query
      setOrders(data || [])
      setLoading(false)
    }
    fetchOrders()
  }, [selectedBranch, dateRange, isUserRole, session.branchId])

  // الطلبات بعد تطبيق فلاتر الجدول (الحالة + التطبيق + الرقم)
  const filteredOrders = useMemo(() => {
    const num = numberFilter.trim().toLowerCase()
    return orders.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false
      if (appFilter !== 'all' && resolveDeliveryApp(o).key !== appFilter) return false
      if (num) {
        const haystack = [
          o.order_id,
          o.foodics_order_number,
          resolveAppOrderNumber(o),
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(num)) return false
      }
      return true
    })
  }, [orders, statusFilter, appFilter, numberFilter])

  const stats = useMemo(() => {
    if (orders.length === 0) return { total: 0, avg: 0, fastest: 0, slowest: 0 }
    const durations = orders.map(o => o.prep_duration_seconds).filter(Boolean)
    return {
      total: orders.length,
      avg: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      fastest: durations.length ? Math.min(...durations) : 0,
      slowest: durations.length ? Math.max(...durations) : 0,
    }
  }, [orders])

  const branchChartData = useMemo(() => {
    const map = {}
    orders.forEach(o => {
      if (!o.prep_duration_seconds) return // متوسط التحضير يُحسب فقط على الطلبات المكتملة
      const name = o.branches?.name_ar || 'غير معروف'
      if (!map[name]) map[name] = { name, total: 0, sum: 0 }
      map[name].total++
      map[name].sum += o.prep_duration_seconds
    })
    return Object.values(map).map(b => ({
      name: b.name,
      avg: b.total ? Math.round(b.sum / b.total / 60 * 10) / 10 : 0,
    }))
  }, [orders])

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, count: 0 }))
    orders.forEach(o => {
      const h = new Date(o.created_at).getHours()
      hours[h].count++
    })
    return hours
  }, [orders])


  const kpiCards = [
    { icon: '📦', label: 'إجمالي الطلبات', value: stats.total, accent: '#5830C5' },
    { icon: '⏱️', label: 'متوسط وقت التحضير', value: formatDuration(stats.avg), accent: '#f7941d' },
    { icon: '⚡', label: 'أسرع طلب', value: formatDuration(stats.fastest), accent: '#22c55e' },
    { icon: '🐢', label: 'أبطأ طلب', value: formatDuration(stats.slowest), accent: '#ef4444' },
  ]

  return (
    <div className="analytics-root">
      {/* ── Page Header ── */}
      <header className="page-header">
        <div className="header-inner">
          <div className="header-top">
            <div className="header-title-group">
              <div className="header-badge">
                كبة زون — التقارير
              </div>
              <h1 className="page-title">التحليلات والتقارير</h1>
              <p className="page-subtitle">
                تتبع أداء الفروع وأوقات تحضير الطلبات
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
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
              <LogoutButton />
            </div>
          </div>

          {/* Search */}
          <form className="order-search-bar" onSubmit={handleSearch}>
            <div className="order-search-input-wrap">
              <svg className="order-search-icon" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                className="order-search-input"
                placeholder="ابحث برقم الطلب..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                dir="ltr"
              />
              {searchQuery && (
                <button type="button" className="order-search-clear" onClick={clearSearch}>✕</button>
              )}
            </div>
            <button type="submit" className="order-search-btn" disabled={searching}>
              {searching ? 'جاري البحث...' : 'بحث'}
            </button>
          </form>

          {/* Filters */}
          <div className="filters-bar">
            {!isUserRole && (
              <BranchSelector value={selectedBranch} onChange={setSelectedBranch} includeAll />
            )}
            <div className="date-range-group">
              {DATE_RANGES.map(r => (
                <button
                  key={r.days}
                  onClick={() => setDateRange(r.days)}
                  className={`range-btn ${dateRange === r.days ? 'range-btn--active' : ''}`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <select
              className="filter-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              aria-label="فلترة بالحالة"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            <select
              className="filter-select"
              value={appFilter}
              onChange={e => setAppFilter(e.target.value)}
              aria-label="فلترة بالتطبيق"
            >
              {APP_OPTIONS.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>

            <input
              type="text"
              className="filter-number-input"
              placeholder="فلترة برقم الطلب..."
              value={numberFilter}
              onChange={e => setNumberFilter(e.target.value)}
              dir="ltr"
            />
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="main-content">
        {loading ? (
          <LoadingScreen text="جاري تحميل البيانات..." />
        ) : (
          <>
            {/* ── Search Results ── */}
            {searchResult !== null && (
              <div className="table-card search-results-card">
                <div className="table-header">
                  <div className="table-title">
                    <span className="chart-title-icon">🔍</span>
                    نتائج البحث عن: <span className="search-query-highlight">{searchQuery}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {searchResult.length > 0 && (
                      <span className="table-count">{searchResult.length} نتيجة</span>
                    )}
                    <button className="search-close-btn" onClick={clearSearch}>إغلاق</button>
                  </div>
                </div>
                {searchResult.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🔍</div>
                    <div className="empty-text">لا توجد نتائج لهذا الرقم</div>
                    <div className="empty-subtext">تأكد من رقم الطلب وحاول مرة أخرى</div>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table className="data-table">
                      <OrdersTableHead />
                      <tbody>
                        {searchResult.map(o => (
                          <OrderRow key={o.id} order={o} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── KPI Cards ── */}
            <div className="kpi-grid">
              {kpiCards.map((card, i) => (
                <KPICard
                  key={card.label}
                  icon={card.icon}
                  label={card.label}
                  value={card.value}
                  accent={card.accent}
                  index={i}
                />
              ))}
            </div>

            {/* ── Charts ── */}
            <div className="charts-grid">
              {/* Branch Avg Chart */}
              <div className="chart-card">
                <div className="chart-header">
                  <div className="chart-title">
                    <span className="chart-title-icon">📊</span>
                    متوسط وقت التحضير لكل فرع
                  </div>
                </div>
                {branchChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={branchChartData} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis
                        dataKey="name"
                        stroke="#9CA3AF"
                        fontSize={11}
                        fontWeight={500}
                        tickLine={false}
                        axisLine={{ stroke: '#ffffff08' }}
                      />
                      <YAxis
                        stroke="#9CA3AF"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={v => `${v} د`}
                      />
                      <Tooltip content={<ChartTooltip unit="دقيقة" />} cursor={{ fill: '#5830C508' }} />
                      <Bar
                        dataKey="avg"
                        fill="url(#barGradient)"
                        radius={[8, 8, 2, 2]}
                        maxBarSize={52}
                      />
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7B5CD6" />
                          <stop offset="100%" stopColor="#5830C5" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state" style={{ padding: '3rem 2rem' }}>
                    <div className="empty-icon">📊</div>
                    <div className="empty-text">لا توجد بيانات</div>
                  </div>
                )}
              </div>

              {/* Hourly Chart */}
              <div className="chart-card">
                <div className="chart-header">
                  <div className="chart-title">
                    <span className="chart-title-icon">🕐</span>
                    الطلبات حسب الساعة
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      stroke="#9CA3AF"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: '#ffffff08' }}
                      interval={2}
                    />
                    <YAxis
                      stroke="#9CA3AF"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip unit="طلب" />} />
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5830C5" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#5830C5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#7B5CD6"
                      strokeWidth={2.5}
                      fill="url(#areaGradient)"
                      dot={false}
                      activeDot={{ r: 5, fill: '#5830C5', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Orders Table ── */}
            <div className="table-card">
              <div className="table-header">
                <div className="table-title">
                  <span className="chart-title-icon">📋</span>
                  سجل الطلبات
                </div>
                {filteredOrders.length > 0 && (
                  <span className="table-count">
                    {filteredOrders.length}{filteredOrders.length !== orders.length ? ` من ${orders.length}` : ''} طلب
                  </span>
                )}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <div className="empty-text">
                    {orders.length === 0 ? 'لا توجد بيانات للفترة المحددة' : 'لا توجد طلبات مطابقة للفلاتر'}
                  </div>
                  <div className="empty-subtext">
                    {orders.length === 0 ? 'جرّب تغيير الفترة الزمنية أو الفرع' : 'جرّب تغيير الحالة أو التطبيق أو الرقم'}
                  </div>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="data-table">
                    <OrdersTableHead />
                    <tbody>
                      {filteredOrders.map(o => (
                        <OrderRow key={o.id} order={o} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}