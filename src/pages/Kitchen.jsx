import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBranch } from '../hooks/useBranch'
import { useOrders } from '../hooks/useOrders'
import { useBranchDisplaySetting } from '../hooks/useBranchDisplaySetting'
import { useAuth } from '../context/AuthContext'
import { formatClock, formatElapsed } from '../utils/formatTime'
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
  // ملاحظة: incoming لا يزال متاحاً من useOrders لو احتجنا إرجاع خطوة الاستلام لاحقاً.
  const { preparing, ready } = useOrders(branch?.id)
  // مفتاح "إظهار كل الطلبات على شاشة العرض" (يتحكم في شاشة العرض فقط — هذه الشاشة تعرض الكل دائماً)
  const { showAll, setShowAll } = useBranchDisplaySetting(branch?.id)
  const [clock, setClock] = useState(formatClock())
  // confirm = { order, action: 'ready' | 'delivered' }
  const [confirm, setConfirm] = useState(null)
  const [working, setWorking] = useState(false)
  const [fadingOrders, setFadingOrders] = useState(new Set())

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setClock(formatClock()), 1000)
    return () => clearInterval(interval)
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

      // "تم التسليم" يُخرج الطلب من شاشة المطبخ → أنيميشن خروج.
      // "جاهز" ينقل الطلب من قسم "قيد التحضير" إلى "جاهز" تلقائياً عبر Realtime — بلا fade.
      if (action === 'delivered') {
        setFadingOrders(prev => new Set([...prev, order.id]))
      }
      setConfirm(null)
    } catch (err) {
      console.error('Kitchen action error:', err)
      alert('حدث خطأ: ' + (err.message || 'فشل الاتصال'))
      setConfirm(null)
    } finally {
      setWorking(false)
    }
  }, [confirm, session?.sessionId])

  const visibleReady = ready.filter(o => !fadingOrders.has(o.id))
  const totalActive = preparing.length + visibleReady.length

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
              <h1 className="kitchen-branch-name">الفرع — {branch?.name_ar}</h1>
              <p className="kitchen-branch-sub">{branch?.name_en} — كبة زون</p>
            </div>
          </div>

          <div className="kitchen-info">
            <div>
              <div className="kitchen-clock">{clock}</div>
              <div className="kitchen-count">
                <div className={`kitchen-count-dot ${totalActive > 0 ? 'kitchen-count-dot--active' : 'kitchen-count-dot--idle'}`} />
                <span className="kitchen-count-text">
                  قيد التحضير: <span className="kitchen-count-number">{preparing.length}</span>
                  {' · '}
                  جاهز: <span className="kitchen-count-number">{visibleReady.length}</span>
                </span>
              </div>
            </div>
            {/* مفتاح إظهار كل الطلبات على شاشة العرض (يتزامن realtime) */}
            <label className="kitchen-display-toggle" title="عند التفعيل: شاشة العرض تُظهر كل الطلبات. عند الإيقاف: تُظهر طلبات التوصيل فقط.">
              <input
                type="checkbox"
                checked={showAll}
                onChange={e => setShowAll(e.target.checked)}
              />
              <span>إظهار كل الطلبات على شاشة العرض</span>
            </label>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="kitchen-main">
        {totalActive === 0 ? (
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
            {/* قسم قيد التحضير — بزر "جاهز" */}
            {preparing.length > 0 && (
              <section className="kitchen-section">
                <div className="kitchen-section-header kitchen-section-header--prep">
                  <span className="kitchen-section-dot" />
                  <h2 className="kitchen-section-title">قيد التحضير</h2>
                  <span className="kitchen-section-count">{preparing.length}</span>
                </div>
                <div className="kitchen-grid">
                  {preparing.map(order => (
                    <KitchenCard
                      key={order.id}
                      order={order}
                      mode="preparing"
                      onAction={() => setConfirm({ order, action: 'ready' })}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* قسم جاهز — بزر "تم التسليم" */}
            {visibleReady.length > 0 && (
              <section className="kitchen-section">
                <div className="kitchen-section-header kitchen-section-header--ready">
                  <span className="kitchen-section-dot" />
                  <h2 className="kitchen-section-title">جاهز</h2>
                  <span className="kitchen-section-count">{visibleReady.length}</span>
                </div>
                <div className="kitchen-grid">
                  {visibleReady.map(order => (
                    <KitchenCard
                      key={order.id}
                      order={order}
                      mode="ready"
                      fading={fadingOrders.has(order.id)}
                      onAction={() => setConfirm({ order, action: 'delivered' })}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Confirmation Modal */}
      {confirm && (
        <div className="kitchen-modal-overlay" onClick={() => !working && setConfirm(null)}>
          <div className="kitchen-modal" onClick={e => e.stopPropagation()}>
            <div className="kitchen-modal-icon">{confirm.action === 'ready' ? '✓' : '🚗'}</div>
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
                className={confirm.action === 'delivered' ? 'kitchen-modal-confirm kitchen-modal-confirm--delivered' : 'kitchen-modal-confirm'}
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
    </div>
  )
}

function KitchenCard({ order, mode, fading = false, onAction }) {
  // قيد التحضير: العداد منذ بدء التجهيز (scanned_at). جاهز: منذ الجاهزية (ready_at).
  const timeField = mode === 'ready' ? (order.ready_at || order.scanned_at) : order.scanned_at
  const [elapsed, setElapsed] = useState(() => formatElapsed(timeField))

  useEffect(() => {
    setElapsed(formatElapsed(timeField))
    const interval = setInterval(() => setElapsed(formatElapsed(timeField)), 1000)
    return () => clearInterval(interval)
  }, [timeField])

  // هوية تطبيق التوصيل: الكارت كله يأخذ لون التطبيق (إطار + خلفية متدرّجة).
  const app = resolveDeliveryApp(order)
  const isReady = mode === 'ready'

  const cardStyle = {
    borderColor: app.color,
    background: `linear-gradient(150deg, ${hexToRgba(app.color, 0.16)} 0%, #ffffff 55%)`,
  }

  return (
    <div
      className={`kitchen-card ${isReady ? 'kitchen-card--ready' : ''} ${fading ? 'kitchen-card--fading' : ''}`}
      style={cardStyle}
    >
      {/* رأس: نوع الطلب + علامة جاهز (يمين) ولوجو التطبيق (يسار) */}
      <div className="kitchen-card-header">
        <div className="kitchen-card-tags">
          {order.order_type && (
            <span className="kitchen-card-type" style={{ background: hexToRgba(app.color, 0.14), color: app.ink }}>
              {ORDER_TYPE_LABELS[order.order_type] || order.order_type}
            </span>
          )}
          {isReady && <span className="kitchen-card-ready-flag">✓ جاهز</span>}
        </div>
        <DeliveryAppLogo app={app} size="xl" />
      </div>

      {/* بادج اسم التطبيق */}
      <DeliveryAppPill app={app} size="lg" />

      {/* رقم الطلب */}
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

      {/* الزر: قيد التحضير → "جاهز"، جاهز → "تم التسليم" */}
      {isReady ? (
        <button className="kitchen-delivered-btn" onClick={onAction}>
          🚗 تم التسليم
        </button>
      ) : (
        <button className="kitchen-ready-btn" onClick={onAction}>
          ✓ جاهز
        </button>
      )}
    </div>
  )
}
