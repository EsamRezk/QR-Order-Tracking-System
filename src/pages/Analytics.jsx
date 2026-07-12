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

// عدد الطلبات المعروضة في صفحة الجدول الواحدة — يُجلب من القاعدة صفحة-بصفحة
const PAGE_SIZE = 50

// عدد المنتجات في قائمة "الأكثر مبيعاً إجمالاً"
const TOP_PRODUCTS_LIMIT = 10

// 🔒 شارت "قيمة المبيعات (بالفلوس)" مخفي من الكود بالكامل حالياً بطلب صاحب المشروع.
// لإظهاره لاحقاً: غيّر القيمة إلى true (لا حاجة لأي تعديل آخر — البيانات مجلوبة أصلاً).
const SHOW_REVENUE_PRODUCTS_CHART = false

// حجم الدفعة عند التصدير فقط (أقصى ما تسمح به Supabase = 1000/طلب) — كل دفعة
// استعلام مستقل سريع بالفهرس فلا يقترب أي منها من statement_timeout.
const FETCH_PAGE = 1000

// أعمدة الجلب: بدل select('*') الذي يسحب raw_qr_data كاملاً (كيلوبايتات/طلب = بطء شديد)،
// نجلب الأعمدة المطلوبة فقط + مسارات JSON الصغيرة التي تحتاجها دوال resolve* (قيَم نصية صغيرة).
// الحمولة تنكمش من عدة KB/طلب إلى ~بايتات، فيتحمّل كل السجل في أقل من ثانية.
// ملاحظة: delivery_app / channel_link ليست أعمدة حقيقية (تفحصها resolve* كاحتمال فقط
// وترجع undefined) — لا تُدرَج في الـ select وإلا يفشل الاستعلام (column does not exist).
const ORDERS_SELECT = [
  'id', 'status', 'order_id', 'foodics_order_number',
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

// يبني استعلام الطلبات بفلاتر SQL (تاريخ/فرع/حالة/تطبيق/رقم) — لصفحة الجدول وللتصدير.
// الفلترة بالتطبيق والرقم على الأعمدة المحسوبة delivery_app/app_number/foodics_ref
// (migration 027 — تُحسب بالـ trigger عند الكتابة، فلا JSON يُفكّك أثناء الفلترة).
function buildOrdersQuery({ dateFrom, branchId, status, app, number, withCount = false }) {
  let q = supabase
    .from('orders')
    .select(ORDERS_SELECT, withCount ? { count: 'exact' } : undefined)
    .gte('created_at', dateFrom)
    .order('created_at', { ascending: false })
  if (branchId) q = q.eq('branch_id', branchId)
  if (status && status !== 'all') q = q.eq('status', status)
  if (app && app !== 'all') q = q.eq('delivery_app', app)
  // تعقيم مدخل البحث من رموز صيغة or() في PostgREST (أرقام الطلبات أرقام عملياً)
  const num = (number || '').replace(/[,()%*'"\\]/g, '').trim()
  if (num) {
    q = q.or([
      `app_number.ilike.*${num}*`,
      `foodics_ref.ilike.*${num}*`,
      `foodics_order_number.ilike.*${num}*`,
      `order_id.ilike.*${num}*`,
    ].join(','))
  }
  return q
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
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [dateRange, setDateRange] = useState(7)
  const [loading, setLoading] = useState(true)
  // ملخص التحليلات المحسوب في القاعدة (rpc_analytics_summary):
  // {total, avg, fastest, slowest, by_branch, hourly} — رحلة واحدة بلا جلب صفوف.
  const [summary, setSummary] = useState(null)
  // أعلى المنتجات مبيعاً: { overall:[{name,qty,revenue}], by_branch:[{branch,name,qty,revenue}] }
  // محسوبة في القاعدة (rpc_top_products) من جدول order_items المسطّح — بلا لمس raw_qr_data.
  const [topProducts, setTopProducts] = useState(null)
  // فلاتر جدول السجل — تُنفَّذ في القاعدة (WHERE) وليس محلياً
  const [statusFilter, setStatusFilter] = useState('all')
  const [appFilter, setAppFilter] = useState('all')
  const [numberFilter, setNumberFilter] = useState('')
  // النسخة المؤجّلة (debounce) من حقل الرقم — استعلام واحد بعد توقف الكتابة
  const [numberQuery, setNumberQuery] = useState('')
  // ترقيم صفحات جدول السجل — تُجلب الصفحة الظاهرة فقط من القاعدة
  const [page, setPage] = useState(1)
  const [pageRows, setPageRows] = useState([])
  const [filteredCount, setFilteredCount] = useState(0)
  const [tableLoading, setTableLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
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

  // debounce حقل الرقم (400ms)
  useEffect(() => {
    const t = setTimeout(() => setNumberQuery(numberFilter.trim()), 400)
    return () => clearTimeout(t)
  }, [numberFilter])

  // ملخص التحليلات: KPIs + متوسط الفروع + التوزيع الساعي — تجميع واحد في القاعدة
  // (أعمدة صغيرة مفهرسة، بلا raw_qr_data) بدل جلب كل طلبات الفترة إلى المتصفح.
  useEffect(() => {
    // Wait for branch to be set before fetching for user role
    if (isUserRole && !selectedBranch) return
    let cancelled = false
    const fetchSummary = async () => {
      setLoading(true)
      const { data, error } = await supabase.rpc('rpc_analytics_summary', {
        p_from: getDateFrom(dateRange),
        p_branch_id: selectedBranch || null,
      })
      if (cancelled) return
      if (error) console.error('rpc_analytics_summary error:', error)
      setSummary(error ? null : data)
      setLoading(false)
    }
    fetchSummary()
    return () => { cancelled = true }
  }, [selectedBranch, dateRange, isUserRole])

  // أعلى المنتجات مبيعاً (إجمالاً + لكل فرع) — تجميع واحد في القاعدة على نفس فلتري الفترة والفرع.
  useEffect(() => {
    if (isUserRole && !selectedBranch) return
    let cancelled = false
    const fetchTopProducts = async () => {
      const { data, error } = await supabase.rpc('rpc_top_products', {
        p_from: getDateFrom(dateRange),
        p_branch_id: selectedBranch || null,
        p_limit: TOP_PRODUCTS_LIMIT,
      })
      if (cancelled) return
      if (error) console.error('rpc_top_products error:', error)
      setTopProducts(error ? null : data)
    }
    fetchTopProducts()
    return () => { cancelled = true }
  }, [selectedBranch, dateRange, isUserRole])

  // نرجع للصفحة الأولى عند تغيّر الفلاتر/الفترة/الفرع
  useEffect(() => { setPage(1) }, [statusFilter, appFilter, numberQuery, dateRange, selectedBranch])

  // صفحة الجدول الظاهرة فقط (50 صف): الفلترة والعدّ والترتيب في القاعدة.
  // استخراج مسارات raw_qr_data (ORDERS_SELECT) يتم لـ50 صفاً فقط = رخيص.
  useEffect(() => {
    if (isUserRole && !selectedBranch) return
    let cancelled = false
    const fetchPage = async () => {
      setTableLoading(true)
      const { data, count, error } = await buildOrdersQuery({
        dateFrom: getDateFrom(dateRange),
        branchId: selectedBranch,
        status: statusFilter,
        app: appFilter,
        number: numberQuery,
        withCount: true,
      }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      if (cancelled) return
      if (error) {
        console.error('orders page error:', error)
        setPageRows([])
        setFilteredCount(0)
        setStatusSources({})
      } else {
        setPageRows((data || []).map(hydrateOrder))
        setFilteredCount(count ?? 0)
        // مصدر تغيير الحالة لصفوف الصفحة الظاهرة فقط (بالـ id) بدل كل سجلات الفترة
        const ids = (data || []).map(r => r.id)
        if (ids.length) {
          const { data: logs } = await supabase
            .from('scan_logs')
            .select('order_id, scan_type')
            .in('scan_type', ['ready_scan', 'second_scan', 'delivered'])
            .in('order_id', ids)
          if (cancelled) return
          setStatusSources(buildSourceMap(logs))
        } else {
          setStatusSources({})
        }
      }
      setTableLoading(false)
    }
    fetchPage()
    return () => { cancelled = true }
  }, [selectedBranch, dateRange, statusFilter, appFilter, numberQuery, page, isUserRole])

  // تصدير Excel: يجلب كل صفوف الفلترة الحالية عند الطلب فقط، على دفعات 1000
  // (كل دفعة استعلام مستقل سريع بالفهرس) + سجلات المصدر للفترة، ثم يولّد الملف.
  const handleExport = async () => {
    setExporting(true)
    try {
      const rows = await fetchAllPaged(() => buildOrdersQuery({
        dateFrom: getDateFrom(dateRange),
        branchId: selectedBranch,
        status: statusFilter,
        app: appFilter,
        number: numberQuery,
      }), FETCH_PAGE, { throwOnError: true })
      const logs = await fetchAllPaged(() =>
        supabase
          .from('scan_logs')
          .select('order_id, scan_type')
          .in('scan_type', ['ready_scan', 'second_scan', 'delivered'])
          .gte('scanned_at', getDateFrom(dateRange))
          .order('scanned_at', { ascending: false })
      , FETCH_PAGE, { throwOnError: true })
      const branchName = isUserRole
        ? session.branch
        : branches.find(b => b.id === selectedBranch)?.name_ar || null
      await exportOrdersToExcel(rows.map(hydrateOrder), branchName, buildSourceMap(logs))
    } catch (e) {
      console.error('export error:', e)
      alert('فشل تصدير الملف — أعد المحاولة')
    } finally {
      setExporting(false)
    }
  }

  const stats = summary || { total: 0, avg: 0, fastest: 0, slowest: 0 }
  const branchChartData = summary?.by_branch || []
  const topOverall = topProducts?.overall || []
  // أعلى منتج لكل فرع — نُسقِط الفروع التي لا مبيعات لها (name فارغة)
  const topByBranch = (topProducts?.by_branch || []).filter(b => b.name)
  const hourlyData = useMemo(
    () => (summary?.hourly || []).map(h => ({ hour: `${h.hour}:00`, count: h.count })),
    [summary]
  )

  // ── ترقيم صفحات الجدول ──
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)


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
                onClick={handleExport}
                className="export-btn"
                disabled={filteredCount === 0 || exporting}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                {exporting ? 'جاري التصدير...' : 'تصدير Excel'}
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

            {/* ── أعلى المنتجات مبيعاً ── */}
            <div className="products-grid">
              {/* أعلى 10 منتجات على كل الفروع (بالكمية) */}
              <div className="chart-card">
                <div className="chart-header">
                  <div className="chart-title">
                    <span className="chart-title-icon">🏆</span>
                    أعلى 10 منتجات مبيعاً (بالكمية)
                  </div>
                </div>
                {topOverall.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(280, topOverall.length * 42)}>
                    <BarChart data={topOverall} layout="vertical" margin={{ left: 12, right: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                      <XAxis
                        type="number"
                        stroke="#9CA3AF"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="#6B7280"
                        fontSize={12}
                        fontWeight={500}
                        tickLine={false}
                        axisLine={false}
                        width={160}
                      />
                      <Tooltip content={<ChartTooltip unit="قطعة" />} cursor={{ fill: '#5830C508' }} />
                      <defs>
                        <linearGradient id="productBarGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#5830C5" />
                          <stop offset="100%" stopColor="#7B5CD6" />
                        </linearGradient>
                      </defs>
                      <Bar dataKey="qty" fill="url(#productBarGradient)" radius={[0, 8, 8, 0]} maxBarSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state" style={{ padding: '3rem 2rem' }}>
                    <div className="empty-icon">🍽️</div>
                    <div className="empty-text">لا توجد مبيعات منتجات للفترة المحددة</div>
                  </div>
                )}
              </div>

              {/* 🔒 شارت قيمة المبيعات (بالفلوس) — مخفي بالكود، يظهر عند SHOW_REVENUE_PRODUCTS_CHART=true */}
              {SHOW_REVENUE_PRODUCTS_CHART && (
                <div className="chart-card">
                  <div className="chart-header">
                    <div className="chart-title">
                      <span className="chart-title-icon">💰</span>
                      أعلى 10 منتجات مبيعاً (بقيمة المبيعات)
                    </div>
                  </div>
                  {topOverall.length > 0 ? (
                    <ResponsiveContainer width="100%" height={Math.max(280, topOverall.length * 42)}>
                      <BarChart
                        data={[...topOverall].sort((a, b) => b.revenue - a.revenue)}
                        layout="vertical"
                        margin={{ left: 12, right: 24 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                        <XAxis type="number" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          stroke="#6B7280"
                          fontSize={12}
                          fontWeight={500}
                          tickLine={false}
                          axisLine={false}
                          width={160}
                        />
                        <Tooltip content={<ChartTooltip unit="ر.س" />} cursor={{ fill: '#5830C508' }} />
                        <defs>
                          <linearGradient id="productRevenueGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#f7941d" />
                            <stop offset="100%" stopColor="#fbbf24" />
                          </linearGradient>
                        </defs>
                        <Bar dataKey="revenue" fill="url(#productRevenueGradient)" radius={[0, 8, 8, 0]} maxBarSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-state" style={{ padding: '3rem 2rem' }}>
                      <div className="empty-icon">🍽️</div>
                      <div className="empty-text">لا توجد مبيعات منتجات للفترة المحددة</div>
                    </div>
                  )}
                </div>
              )}

              {/* أعلى منتج في كل فرع */}
              <div className="chart-card">
                <div className="chart-header">
                  <div className="chart-title">
                    <span className="chart-title-icon">🥇</span>
                    أعلى منتج مبيعاً في كل فرع
                  </div>
                </div>
                {topByBranch.length > 0 ? (
                  <div className="branch-top-grid">
                    {topByBranch.map((b, i) => (
                      <div className="branch-top-card" key={`${b.branch}-${i}`}>
                        <div className="branch-top-rank">#{i + 1}</div>
                        <div className="branch-top-body">
                          <span className="branch-top-branch">{b.branch}</span>
                          <span className="branch-top-product">{b.name}</span>
                        </div>
                        <div className="branch-top-qty">
                          <span className="branch-top-qty-num">{b.qty}</span>
                          <span className="branch-top-qty-unit">قطعة</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '3rem 2rem' }}>
                    <div className="empty-icon">🍽️</div>
                    <div className="empty-text">لا توجد مبيعات منتجات للفترة المحددة</div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Orders Table ── */}
            <div className="table-card">
              <div className="table-header">
                <div className="table-title">
                  <span className="chart-title-icon">📋</span>
                  سجل الطلبات
                </div>
                {filteredCount > 0 && (
                  <span className="table-count">
                    {filteredCount}{summary && filteredCount !== summary.total ? ` من ${summary.total}` : ''} طلب
                  </span>
                )}
              </div>

              {filteredCount === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <div className="empty-text">
                    {(summary?.total ?? 0) === 0 ? 'لا توجد بيانات للفترة المحددة' : 'لا توجد طلبات مطابقة للفلاتر'}
                  </div>
                  <div className="empty-subtext">
                    {(summary?.total ?? 0) === 0 ? 'جرّب تغيير الفترة الزمنية أو الفرع' : 'جرّب تغيير الحالة أو التطبيق أو الرقم'}
                  </div>
                </div>
              ) : (
                <>
                  <div className="table-wrapper" style={{ opacity: tableLoading ? 0.5 : 1, transition: 'opacity 0.15s' }}>
                    <table className="data-table">
                      <OrdersTableHead />
                      <tbody>
                        {pageRows.map(o => (
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