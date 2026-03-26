import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBranch } from '../hooks/useBranch'
import { useOrders } from '../hooks/useOrders'
import { useSound } from '../hooks/useSound'
import { formatClock } from '../utils/formatTime'
import { supabase } from '../lib/supabase'
import PreparingColumn from '../components/PreparingColumn'
import ReadyColumn from '../components/ReadyColumn'
import BranchSelect from './BranchSelect'
import LoadingScreen from '../components/LoadingScreen'
import './DisplayDashboard.css'

const READY_TIMEOUT_MS = (parseInt(import.meta.env.VITE_READY_TIMEOUT_MINUTES, 10) || 5) * 60 * 1000

export default function DisplayDashboard() {
  const [searchParams] = useSearchParams()

  // Show branch selection if no branch specified in URL
  if (!searchParams.get('branch')) {
    return <BranchSelect target="display" />
  }

  return <DisplayDashboardInner />
}

function DisplayDashboardInner() {
  const { branch, loading, error } = useBranch()
  const { preparing, ready, newOrderFlag } = useOrders(branch?.id)
  const { play, loadSound } = useSound()
  const [clock, setClock] = useState(formatClock())
  const prevOrderFlag = useRef(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [fadingOrders, setFadingOrders] = useState(new Set())

  // Auto-clear ready orders after timeout
  const completeOrder = useCallback(async (orderId) => {
    setFadingOrders(prev => new Set([...prev, orderId]))
    setTimeout(async () => {
      await supabase
        .from('orders')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', orderId)
      setFadingOrders(prev => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
    }, 500)
  }, [])

  useEffect(() => {
    if (!ready.length) return
    const interval = setInterval(() => {
      const now = Date.now()
      for (const order of ready) {
        if (fadingOrders.has(order.id)) continue
        const readyAt = new Date(order.ready_at).getTime()
        if (now - readyAt >= READY_TIMEOUT_MS) {
          completeOrder(order.id)
        }
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [ready, fadingOrders, completeOrder])

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setClock(formatClock()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Play sound on new order
  useEffect(() => {
    if (newOrderFlag > 0 && newOrderFlag !== prevOrderFlag.current && soundEnabled) {
      play()
    }
    prevOrderFlag.current = newOrderFlag
  }, [newOrderFlag, play, soundEnabled])

  const toggleSound = () => {
    if (!soundEnabled) {
      loadSound()
      setSoundEnabled(true)
    } else {
      setSoundEnabled(false)
    }
  }

  /* ── Loading State ── */
  if (loading) return <LoadingScreen fullScreen />

  /* ── Error State ── */
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

  const totalActive = preparing.length + ready.length

  /* ── Main Dashboard ── */
  return (
    <div className="display-root">
      {/* ── Header ── */}
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <div className="dash-logo">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="dash-branch-name">{branch?.name_ar}</h1>
              <p className="dash-branch-sub">{branch?.name_en} — كبة زون</p>
            </div>
          </div>

          <div className="dash-controls-area">
            <button 
              onClick={toggleSound}
              className={`dash-sound-toggle ${soundEnabled ? 'sound-on' : 'sound-off'}`}
              title={soundEnabled ? 'إيقاف الصوت' : 'تشغيل الصوت'}
            >
              {soundEnabled ? (
                <svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              ) : (
                <svg fill="currentColor" viewBox="0 0 24 24" width="24" height="24">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              )}
            </button>
            <div className="dash-clock-info">
              <div className="dash-clock">{clock}</div>
              <div className="dash-active-status">
                <div className={`dash-status-dot ${totalActive > 0 ? 'dash-status-dot--active' : 'dash-status-dot--idle'}`} />
                <span className="dash-status-text">
                  الطلبات النشطة: <span className="dash-status-count">{totalActive}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="dash-main">
        {totalActive === 0 ? (
          <div className="dash-empty-wrap">
            <div className="dash-empty">
              <div className="dash-empty-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
              </div>
              <div className="dash-empty-title">لا توجد طلبات نشطة</div>
              <div className="dash-empty-subtitle">
                <span className="dash-empty-dot" />
                في انتظار طلبات جديدة...
              </div>
            </div>
          </div>
        ) : (
          <div className="dash-columns">
            <PreparingColumn orders={preparing} />
            <ReadyColumn orders={ready} fadingOrders={fadingOrders} />
          </div>
        )}
      </main>
    </div>
  )
}