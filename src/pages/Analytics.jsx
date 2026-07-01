import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase, fetchAllPaged } from '../lib/supabase'
import { formatDuration } from '../utils/formatTime'
import { useAuth } from '../context/AuthContext'
import { exportOrdersToExcel } from '../utils/exportExcel'
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

// عدد الطلبات المعروضة في صفحة الجدول الواحدة
const PAGE_SIZE = 50

// حجم الدفعة عند جلب كل الطلبات (أقصى ما تسمح به Supabase = 1000/طلب) — أقل عدد round-trips.
const FETCH_PAGE = 1000

// أعمدة الجلب: بدل select('*') الذي يسحب raw_qr_data كاملاً (كيلوبايتات/طلب = بطء شديد)،
// نجلب الأعمدة المطلوبة فقط + مسارات JSON الصغيرة التي تحتاجها دوال resolve* (قيَم نصية صغيرة).
// الحمولة تنكمش من عدة KB/طلب إلى ~بايتات، فيتحمّل كل السجل في أقل من ثانية.
const ORDERS_SELECT = [
  'id', 'status', 'order_id', 'foodics_order_number', 'delivery_app', 'channel_link',
  'scanned_at', 'created_at', 'ready_at', 'prep_duration_seconds', 'branch_id',
  'branches(name_ar, name_en)',
  'rq_app_id:raw_qr_data->foodics_order->>app_id',
  'rq_reference:raw_qr_data->foodics_order->>reference',
  'rq_reference_x:raw_qr_data->foodics_order->>reference_x',
  'rq_external_number:raw_qr_data->foodics_order->meta->>external_number',
  'rq_channel_link:raw_qr_data->foodics_order->meta->>channelLink',
  'rq_agg_name:raw_qr_data->foodics_order->aggregator->>name',
  'rq_agg_ref:raw_qr_data->foodics_order->aggregator->>reference',
  'rq_del_agg_name:raw_qr_data->foodics_order->delivery->aggregator->>name',
  'rq_del_co_name:raw_qr_data->foodics_order->delivery_company->>name',
  'rq_customer_name:raw_qr_data->foodics_order->customer->>name',
  'rq_tags:raw_qr_data->foodics_order->tags',
].join(', ')

// يعيد بناء الشكل المتداخل raw_qr_data.foodics_order من المسارات المسطّحة المجلوبة،
// حتى تعمل دوال resolveDeliveryApp/resolveAppOrderNumber/resolveFoodicsNumber بلا تغيير.
function hydrateOrder(r) {
  const {
    rq_app_id, rq_reference, rq_reference_x, rq_external_number, rq_channel_link,
    rq_agg_name, rq_agg_ref, rq_del_agg_name, rq_del_co_name, rq_customer_name, rq_tags,
    ...rest
  } = r
  return {
    ...rest,
    raw_qr_data: {
      foodics_order: {
        app_id: rq_app_id ?? undefined,
        reference: rq_reference ?? undefined,
        reference_x: rq_reference_x ?? undefined,
        meta: { external_number: rq_external_number ?? undefined, channelLink: rq_channel_link ?? undefined },
        aggregator: { name: rq_agg_name ?? undefined, reference: rq_agg_ref ?? undefined },
        delivery: { aggregator: { name: rq_del_agg_name ?? undefined } },
        delivery_company: { name: rq_del_co_name ?? undefined },
        customer: { name: rq_customer_name ?? undefined },
        tags: rq_tags ?? undefined,
      },
    },
  }
}

// خيارات فلتر الحالة (الكل + الحالات الفعّالة فقط — بلا ملغي/جديد)
const STATUS_OPTIONS = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'preparing', label: 'قيد التحضير' },
  { value: 'ready', label: 'جاهز' },
  { value: 'completed', label: 'مكتمل' },
]

const STATUS_META = {
  new: { label: '🆕 جديد' },
  preparing: { label: '🔥 قيد التحضير' },
  ready: { label: '✅ جاهز' },
  completed: { label: '📦 مكتمل' },
  cancelled: { label: '🚫 ملغي' },
}

// خيارات فلتر التطبيق (الكل + تطبيقات التوصيل + مباشر) — مع اللوجو في القائمة
const APP_OPTIONS = [
  { value: 'all', label: 'كل التطبيقات' },
  ...Object.entries(DELIVERY_APPS).map(([key, app]) => ({ value: key, label: app.name, logo: app.logo })),
  { value: DIRECT_APP.key, label: DIRECT_APP.name, logo: DIRECT_APP.logo },
]

/* ── قائمة منسدلة مخصّصة (بدل select الافتراضي) ── */
function Dropdown({ value, options, onChange, ariaLabel }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = options.find(o => o.value === value) || options[0]

  return (
    <div className={`dd ${open ? 'dd--open' : ''}`} ref={ref}>
      <button
        type="button"
        className="dd-trigger"
        onClick={() => setOpen(o => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected.logo ? <img className="dd-logo" src={selected.logo} alt="" /> : null}
        <span className="dd-trigger-label">{selected.label}</span>
        <svg className="dd-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="dd-menu" role="listbox">
          {options.map(o => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`dd-option ${o.value === value ? 'dd-option--active' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              {'logo' in o ? (
                o.logo
                  ? <img className="dd-logo" src={o.logo} alt="" />
                  : <span className="dd-logo dd-logo--ph" />
              ) : null}
              <span>{o.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ── شارة مصدر تغيير الحالة (النظام = نحن / فوديكس) ── */
function SourceBadge({ kind, by }) {
  const label = by === 'system' ? 'النظام' : 'فوديكس'
  const k = kind === 'ready' ? 'جاهز' : 'تسليم'
  return <span className={`src-badge src-badge--${by}`}>{k}: {label}</span>
}

/* ── صف طلب في الجدول (يعرض هوية التطبيق + رقمي التطبيق وفوديكس + الحالة + مصدر التحديث) ── */
function OrderRow({ order, sources }) {
  const app = resolveDeliveryApp(order)
  const appNumber = resolveAppOrderNumber(order)
  const status = STATUS_META[order.status] || { label: order.status }
  const src = sources?.[order.id] || {}
  const isReady = order.status === 'ready' || order.status === 'completed'
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
      <td>
        {isReady ? (
          <div className="src-stack">
            <SourceBadge kind="ready" by={src.ready ? 'system' : 'foodics'} />
            {order.status === 'completed' && (
              <SourceBadge kind="delivered" by={src.delivered ? 'system' : 'foodics'} />
            )}
          </div>
        ) : (
          <span className="src-empty">—</span>
        )}
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
        <th>مصدر التحديث</th>
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

// يبني خريطة مصدر التغيير من صفوف scan_logs: { [orderId]: { ready, delivered } }
function buildSourceMap(logs) {
  const map = {}
  ;(logs || []).forEach(l => {
    if (!map[l.order_id]) map[l.order_id] = {}
    if (l.scan_type === 'ready_scan' || l.scan_type === 'second_scan') map[l.order_id].ready = true
    if (l.scan_type === 'delivered') map[l.order_id].delivered = true
  })
  return map
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
  // فلاتر جدول السجل (تُطبّق محلياً على الطلبات المجلوبة)
  const [statusFilter, setStatusFilter] = useState('all')
  const [appFilter, setAppFilter] = useState('all')
  const [numberFilter, setNumberFilter] = useState('')
  // ترقيم صفحات جدول السجل — 100 طلب في الصفحة
  const [page, setPage] = useState(1)
  // مصدر تغيير الحالة لكل طلب: { [orderId]: { ready: bool, delivered: bool } }
  // وجود سجل scan_log (ready_scan/delivered) = التغيير تمّ من نظامنا؛ غيابه = من فوديكس.
  const [statusSources, setStatusSources] = useState({})

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

  useEffect(() => {
    // Wait for branch to be set before fetching for user role
    if (isUserRole && !selectedBranch) return

    const fetchOrders = async () => {
      setLoading(true)
      // نجلب كل الطلبات (بكل الحالات) ضمن الفترة/الفرع — أعمدة مختارة فقط (بلا raw_qr_data
      // الكامل) على دفعات 1000، فالحمولة صغيرة والتحميل سريع. الفلترة بالحالة/التطبيق/الرقم محلية.
      const data = await fetchAllPaged(() => {
        let q = supabase
          .from('orders')
          .select(ORDERS_SELECT)
          .gte('created_at', getDateFrom(dateRange))
          .order('created_at', { ascending: false })
        if (selectedBranch) q = q.eq('branch_id', selectedBranch)
        return q
      }, FETCH_PAGE)
      setOrders(data.map(hydrateOrder))

      // مصدر تغيير الحالة: نجلب سجلات scan_logs (ready_scan/second_scan/delivered)
      // ضمن نفس الفترة. وجود السجل = تمّ من نظامنا، وغيابه = تمّ من فوديكس.
      const logs = await fetchAllPaged(() =>
        supabase
          .from('scan_logs')
          .select('order_id, scan_type')
          .in('scan_type', ['ready_scan', 'second_scan', 'delivered'])
          .gte('scanned_at', getDateFrom(dateRange))
      , FETCH_PAGE)
      setStatusSources(buildSourceMap(logs))

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
        // الفلترة بالرقمين معاً: رقم فوديكس (reference) + رقم التطبيق
        const haystack = [
          resolveFoodicsNumber(o),
          resolveAppOrderNumber(o),
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(num)) return false
      }
      return true
    })
  }, [orders, statusFilter, appFilter, numberFilter])

  // ── ترقيم صفحات الجدول (100/صفحة) ──
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE))
  // نرجع للصفحة الأولى عند تغيّر الفلاتر/الفترة/الفرع
  useEffect(() => { setPage(1) }, [statusFilter, appFilter, numberFilter, dateRange, selectedBranch])
  const currentPage = Math.min(page, totalPages)
  const pagedOrders = useMemo(
    () => filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredOrders, currentPage]
  )

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
    // عند عدم تحديد فرع: نُظهر كل الفروع حتى لو بلا طلبات مكتملة (متوسط = 0)
    if (!selectedBranch) {
      branches.forEach(b => { map[b.name_ar] = { name: b.name_ar, total: 0, sum: 0 } })
    }
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
  }, [orders, branches, selectedBranch])

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
                  exportOrdersToExcel(filteredOrders, branchName, statusSources)
                }}
                className="export-btn"
                disabled={filteredOrders.length === 0}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                تصدير Excel
              </button>
              <LogoutButton />
            </div>
          </div>

          {/* Filters */}
          <div className="filters-bar">
            {!isUserRole && (
              <Dropdown
                value={selectedBranch || 'all'}
                options={[
                  { value: 'all', label: 'جميع الفروع' },
                  ...branches.map(b => ({ value: b.id, label: b.name_ar })),
                ]}
                onChange={v => setSelectedBranch(v === 'all' ? null : v)}
                ariaLabel="فلترة بالفرع"
              />
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

            <Dropdown
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={setStatusFilter}
              ariaLabel="فلترة بالحالة"
            />

            <Dropdown
              value={appFilter}
              options={APP_OPTIONS}
              onChange={setAppFilter}
              ariaLabel="فلترة بالتطبيق"
            />

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
                <>
                  <div className="table-wrapper">
                    <table className="data-table">
                      <OrdersTableHead />
                      <tbody>
                        {pagedOrders.map(o => (
                          <OrderRow key={o.id} order={o} sources={statusSources} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="table-pagination">
                      <button
                        className="pagination-btn"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                      >
                        ‹ السابق
                      </button>
                      <span className="pagination-info">
                        صفحة {currentPage} من {totalPages}
                      </span>
                      <button
                        className="pagination-btn"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                      >
                        التالي ›
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}