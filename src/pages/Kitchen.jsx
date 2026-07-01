import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBranch } from '../hooks/useBranch'
import { useOrders } from '../hooks/useOrders'
import { useBranchDisplaySetting } from '../hooks/useBranchDisplaySetting'
import { useAuth } from '../context/AuthContext'
import { formatElapsed } from '../utils/formatTime'
import { supabase } from '../lib/supabase'
import { resolveDeliveryApp, hexToRgba, resolveDisplayNumber } from '../config/deliveryApps'
import { DeliveryAppLogo, DeliveryAppPill } from '../components/DeliveryAppBadge'
import BranchSelect from './BranchSelect'
import LoadingScreen from '../components/LoadingScreen'
import './Kitchen.css'

const ORDER_TYPE_LABELS = {
  dine_in: 'محلي',
  pickup: 'استلام',
  delivery: 'توصيل',
  drive_thru: 'سيارة',
}

// نصوص ولون البادج الملصق أعلى الكارت لكل حالة
const STATE_BADGE = {
  preparing: 'قيد التحضير',
  ready: 'جاهز',
  delivered: 'تم الاستلام',
}

// نص تأكيد فلتر شاشة الفرع (فلتر محلي لهذه الشاشة فقط)
const FILTER_CONFIRM = {
  active: 'هل تريد عرض الطلبات النشطة فقط؟',
  ready: 'هل تريد عرض الطلبات الجاهزة فقط؟',
}

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
  // الورك فلو (delivery-driven): الطلب يدخل "قيد التحضير" مباشرة (بلا خطوة استلام).
  const { preparing, ready, delivered } = useOrders(branch?.id)
  // وضع عرض الطلبات على شاشة العرض (يتحكم في شاشة العرض فقط، يتزامن realtime)
  const { displayMode, setDisplayMode } = useBranchDisplaySetting(branch?.id)
  // إظهار/إخفاء قسم "تم الاستلام" (محلي لهذه الشاشة فقط)
  const [showDelivered, setShowDelivered] = useState(false)
  // فلتر شاشة الفرع (محلي فقط): 'all' | 'active' | 'ready'
  const [filterMode, setFilterMode] = useState('all')
  // الفلتر المنتظر تأكيده (يفتح نافذة التأكيد)
  const [pendingFilter, setPendingFilter] = useState(null)
  // confirm = { order, action: 'ready' | 'delivered' }
  const [confirm, setConfirm] = useState(null)
  const [working, setWorking] = useState(false)

  // اختيار تاب الفلتر: "الكل" فوري بلا تأكيد، "النشطة"/"الجاهزة" تتطلب تأكيداً
  const selectFilter = useCallback((mode) => {
    setFilterMode(prev => {
      if (prev === mode) return prev       // نفس التاب — لا شيء
      if (mode === 'all') return 'all'     // رجوع للكل فوري
      setPendingFilter(mode)               // فلتر — افتح نافذة التأكيد
      return prev
    })
  }, [])

  const confirmFilter = useCallback(() => {
    setPendingFilter(prev => {
      if (prev) setFilterMode(prev)
      return null
    })
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!confirm || !session?.sessionId) return
    const { order, action } = confirm
    setWorking(true)
    try {
      // المزامنة العكسية لفوديكس + تحديث القاعدة محلياً عبر Edge Function واحدة
      const { data, error } = await supabase.functions.invoke('foodics-update-status', {
        body: {
          session_id: session.sessionId,
          order_internal_id: order.id,
          action, // 'ready' | 'delivered'
        },
      })

      if (error) throw error
      if (data && data.success === false) {
        throw new Error(data.error || 'فشلت العملية')
      }

      // الانتقال بين الأقسام يتم تلقائياً عبر Realtime (preparing → ready → completed).
      setConfirm(null)
    } catch (err) {
      console.error('Kitchen action error:', err)
      alert('حدث خطأ: ' + (err.message || 'فشل الاتصال'))
      setConfirm(null)
    } finally {
      setWorking(false)
    }
  }, [confirm, session?.sessionId])

  // ترتيب الأولوية: قيد التحضير أولاً، ثم الجاهز. (تم الاستلام في قسمه المنفصل)
  // الفلتر المحلي: 'ready' = الجاهز فقط، غير ذلك = قيد التحضير + الجاهز.
  const activeOrders = filterMode === 'ready'
    ? ready.map(order => ({ order, mode: 'ready' }))
    : [
        ...preparing.map(order => ({ order, mode: 'preparing' })),
        ...ready.map(order => ({ order, mode: 'ready' })),
      ]
  const hasActive = activeOrders.length > 0
  // قسم "تم الاستلام" يظهر فقط في وضع "الكل"
  const deliveredVisible = filterMode === 'all'
  const hasDelivered = delivered.length > 0

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
      {/* Header — براند + حالة + مفتاح شاشة العرض + تابات فلترة */}
      <header className="kitchen-header">
        <div className="kitchen-header-inner">
          {/* الصف العلوي: البراند يميناً + مفتاح شاشة العرض يساراً */}
          <div className="kt-hdr-top">
            <div className="kt-brand">
              <div className="kt-logo">{(branch?.name_ar || '').trim().slice(0, 2) || 'فـ'}</div>
              <div className="kt-brand-text">
                <div className="kt-name">{branch?.name_ar}</div>
                <div className="kt-status">
                  <span className="kt-status-dot" />متصل الآن
                </div>
              </div>
            </div>

            {/* اختيار وضع شاشة العرض (يتزامن realtime مع شاشة العرض) */}
            <label className="kt-display-select" title="يتحكم فيما تعرضه شاشة العرض">
              <span className="kt-display-select-lbl">شاشة العرض</span>
              <div className="kt-display-select-box">
                <select
                  value={displayMode}
                  onChange={e => setDisplayMode(e.target.value)}
                >
                  <option value="all">إظهار الكل</option>
                  <option value="ready">إظهار الجاهز</option>
                  <option value="preparing">إظهار النشط</option>
                  <option value="split">النشط + الجاهز (عمودين)</option>
                </select>
                <svg className="kt-display-select-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </label>
          </div>

          {/* تابات فلترة شاشة الفرع (محلي) — النشطة / الجاهزة / الكل */}
          <div className="kt-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'active'}
              className={`kt-tab ${filterMode === 'active' ? 'active' : ''}`}
              onClick={() => selectFilter('active')}
            >
              النشطة
              <span className="kt-tab-count">{preparing.length + ready.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'ready'}
              className={`kt-tab ${filterMode === 'ready' ? 'active' : ''}`}
              onClick={() => selectFilter('ready')}
            >
              الجاهزة
              <span className="kt-tab-count">{ready.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filterMode === 'all'}
              className={`kt-tab ${filterMode === 'all' ? 'active' : ''}`}
              onClick={() => selectFilter('all')}
            >
              الكل
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="kitchen-main">
        {!hasActive && !(deliveredVisible && hasDelivered) ? (
          <div className="kitchen-empty-wrap">
            <div className="kitchen-empty">
              <div className="kitchen-empty-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="kitchen-empty-title">لا توجد طلبات حالياً</div>
              <div className="kitchen-empty-subtitle">
                <span className="kitchen-empty-dot" />
                في انتظار طلبات جديدة من فوديكس...
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* قسم واحد: الطلبات النشطة (قيد التحضير + جاهز) */}
            <section className="kitchen-section">
              <div className="kitchen-section-header">
                <h2 className="kitchen-section-title">
                  {filterMode === 'ready' ? 'الطلبات الجاهزة' : 'الطلبات النشطة'}
                </h2>
                <span className="kitchen-section-count">{activeOrders.length}</span>
              </div>

              {hasActive ? (
                <div className="kitchen-grid">
                  {activeOrders.map(({ order, mode }) => (
                    <KitchenCard
                      key={order.id}
                      order={order}
                      mode={mode}
                      onAction={() =>
                        setConfirm({ order, action: mode === 'preparing' ? 'ready' : 'delivered' })
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="kitchen-section-empty">
                  {filterMode === 'ready' ? 'لا توجد طلبات جاهزة حالياً' : 'لا توجد طلبات نشطة حالياً'}
                </div>
              )}
            </section>

            {/* قسم تم الاستلام — قابل للطي عبر checkbox (يظهر فقط في وضع "الكل") */}
            {deliveredVisible && hasDelivered && (
              <section className="kitchen-section kitchen-section--delivered">
                <label className="kitchen-delivered-toggle">
                  <input
                    type="checkbox"
                    checked={showDelivered}
                    onChange={e => setShowDelivered(e.target.checked)}
                  />
                  <span>تم الاستلام</span>
                  <span className="kitchen-section-count">{delivered.length}</span>
                </label>

                {showDelivered && (
                  <div className="kitchen-grid">
                    {delivered.map(order => (
                      <KitchenCard key={order.id} order={order} mode="delivered" />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {/* Confirmation Modal */}
      {confirm && (
        <div className="kitchen-modal-overlay" onClick={() => !working && setConfirm(null)}>
          <div className="kitchen-modal" onClick={e => e.stopPropagation()}>
            <div className={`kitchen-modal-icon ${confirm.action === 'delivered' ? 'kitchen-modal-icon--delivered' : 'kitchen-modal-icon--ready'}`}>
              {confirm.action === 'ready' ? '✓' : '🚗'}
            </div>
            <div className="kitchen-modal-title">
              {confirm.action === 'ready' ? (
                <>هل تريد تحويل الطلب <span className="kitchen-modal-order-id">{resolveDisplayNumber(confirm.order)}</span> إلى جاهز؟</>
              ) : (
                <>هل تم تسليم الطلب <span className="kitchen-modal-order-id">{resolveDisplayNumber(confirm.order)}</span>؟</>
              )}
            </div>
            <div className="kitchen-modal-subtitle">
              {confirm.action === 'ready'
                ? 'سيظهر للعميل "جاهز للاستلام" وسيُحدّث في فوديكس'
                : 'سيُغلق الطلب ويُحدّث في فوديكس كـ "تم التسليم"'}
            </div>
            <div className="kitchen-modal-actions">
              <button
                className={confirm.action === 'delivered' ? 'kitchen-modal-confirm kitchen-modal-confirm--delivered' : 'kitchen-modal-confirm kitchen-modal-confirm--ready'}
                onClick={handleConfirm}
                disabled={working}
              >
                {working ? 'جاري التنفيذ...' : 'تأكيد'}
              </button>
              <button
                className="kitchen-modal-cancel"
                onClick={() => setConfirm(null)}
                disabled={working}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Confirmation Modal — تأكيد فلتر شاشة الفرع */}
      {pendingFilter && (
        <div className="kitchen-modal-overlay" onClick={() => setPendingFilter(null)}>
          <div className="kitchen-modal" onClick={e => e.stopPropagation()}>
            <div className="kitchen-modal-icon kitchen-modal-icon--ready">🔍</div>
            <div className="kitchen-modal-title">{FILTER_CONFIRM[pendingFilter]}</div>
            <div className="kitchen-modal-subtitle">سيتم تطبيق الفلتر على شاشة الفرع فقط</div>
            <div className="kitchen-modal-actions">
              <button className="kitchen-modal-confirm kitchen-modal-confirm--ready" onClick={confirmFilter}>
                تأكيد
              </button>
              <button className="kitchen-modal-cancel" onClick={() => setPendingFilter(null)}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KitchenCard({ order, mode, onAction }) {
  // قيد التحضير: العداد منذ بدء التجهيز (scanned_at). جاهز: منذ الجاهزية. تم الاستلام: منذ التسليم.
  const timeField =
    mode === 'delivered'
      ? (order.delivered_at || order.completed_at || order.ready_at)
      : mode === 'ready'
        ? (order.ready_at || order.scanned_at)
        : order.scanned_at
  const [elapsed, setElapsed] = useState(() => formatElapsed(timeField))

  useEffect(() => {
    setElapsed(formatElapsed(timeField))
    const interval = setInterval(() => setElapsed(formatElapsed(timeField)), 1000)
    return () => clearInterval(interval)
  }, [timeField])

  // هوية تطبيق التوصيل: تُحدّد لون كارت "قيد التحضير" فقط. (جاهز=أزرق، تم الاستلام=أخضر عبر CSS)
  const app = resolveDeliveryApp(order)

  // لون الكارت: قيد التحضير = لون التطبيق (inline)؛ غير ذلك = لون الحالة عبر class.
  const cardStyle =
    mode === 'preparing'
      ? {
          borderColor: app.color,
          background: `linear-gradient(150deg, ${hexToRgba(app.color, 0.16)} 0%, #ffffff 55%)`,
        }
      : undefined

  return (
    <div className={`kitchen-card kitchen-card--${mode}`} style={cardStyle}>
      {/* بادج الحالة الملصق أعلى الكارت */}
      <span className={`kitchen-card-badge kitchen-card-badge--${mode}`}>{STATE_BADGE[mode]}</span>

      {/* لوجو التطبيق في الأعلى (موحّد لكل الكروت) */}
      <div className="kitchen-card-logo">
        <DeliveryAppLogo app={app} size="md" />
      </div>

      {/* نوع الطلب — صف ثابت لا يلتف (نفس المكان في كل الكروت) */}
      <div className="kitchen-card-tags">
        {order.order_type && (
          <span className="kitchen-card-type" style={{ background: hexToRgba(app.color, 0.14), color: app.ink }}>
            {ORDER_TYPE_LABELS[order.order_type] || order.order_type}
          </span>
        )}
        <DeliveryAppPill app={app} size="sm" />
      </div>

      {/* رقم الطلب — "طلب" ملاصقة فوق الرقم */}
      <div className="kitchen-card-order">
        <span className="kitchen-card-order-lbl">طلب</span>
        <span className="kitchen-card-id" style={{ color: app.ink }}>#{resolveDisplayNumber(order)}</span>
      </div>

      {/* الوقت */}
      <div className="kitchen-card-time">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {elapsed}
      </div>

      {/* الزر: قيد التحضير → "جهز" (أزرق)، جاهز → "تم التسليم" (أخضر)، تم الاستلام → بلا زر */}
      {mode === 'preparing' && (
        <button className="kitchen-ready-btn" onClick={onAction}>
          ✓ جهز
        </button>
      )}
      {mode === 'ready' && (
        <button className="kitchen-delivered-btn" onClick={onAction}>
          🚗 تم التسليم
        </button>
      )}
    </div>
  )
}
