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
      // Call same RPC used by scanner
      const { data, error } = await supabase.rpc('rpc_scanner_mark_ready', {
        p_session_id: session.sessionId,
        p_order_internal_id: confirmOrder.id,
        p_device_info: navigator.userAgent
      })

      if (error) throw error
      if (data && !data.success) {
        throw new Error(data.error || 'فشل تحويل الطلب')
      }

      // Add to fading set only strictly after SUCCESS
      setFadingOrders(prev => new Set([...prev, confirmOrder.id]))
      setConfirmOrder(null)

    } catch (err) {
      console.error('Error marking order ready:', err)
      alert('حدث خطأ: ' + (err.message || 'فشل الاتصال'))
      // Notice we do NOT fade if it errors, so the order stays visible
      setConfirmOrder(null)
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
