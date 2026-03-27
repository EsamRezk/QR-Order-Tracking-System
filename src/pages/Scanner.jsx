import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBranch } from '../hooks/useBranch'
import { useScanner } from '../hooks/useScanner'
import ScannerView from '../components/ScannerView'

import { formatTime } from '../utils/formatTime'
import BranchSelect from './BranchSelect'
import LoadingScreen from '../components/LoadingScreen'
import './Scanner.css'

export default function Scanner() {
  const [searchParams] = useSearchParams()

  // Show branch selection if no branch specified in URL
  if (!searchParams.get('branch')) {
    return <BranchSelect target="scan" />
  }

  return <ScannerInner />
}

function ScannerInner() {
  const { branch, loading, error: branchError } = useBranch()
  const { handleScan, lastResult, clearResult, scanning, history } = useScanner(branch?.id)
  const [showFeedback, setShowFeedback] = useState(false)

  const onScan = async (text) => {
    await handleScan(text)
    setShowFeedback(true)
    if (navigator.vibrate) navigator.vibrate(200)
    setTimeout(() => {
      setShowFeedback(false)
      clearResult()
    }, 3000)
  }

  /* ── Loading ── */
  if (loading) return <LoadingScreen fullScreen />

  /* ── Error ── */
  if (branchError) {
    return (
      <div className="scanner-fullscreen">
        <div className="scanner-error-card">
          <div className="scanner-error-icon">⚠️</div>
          <div className="scanner-error-title">{branchError}</div>
          <div className="scanner-error-subtitle">تحقق من رابط الفرع</div>
        </div>
      </div>
    )
  }

  return (
    <div className="scanner-root">
      {/* ── Header ── */}
      <header className="scanner-header">
        <div>
          <div className="scanner-header-badge">
            <span className="scanner-header-dot" />
            <span className="scanner-header-badge-text">ماسح الطلبات</span>
          </div>
          <h1 className="scanner-branch-name">{branch?.name_ar}</h1>
          <p className="scanner-brand-sub">كبة زون</p>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="scanner-main">
        {/* Scanner Area */}
        <div className="scanner-area">
          <ScannerView onScan={onScan} enabled={!scanning} />

          {/* Feedback Overlay */}
          {showFeedback && lastResult && (
            <div className="scanner-feedback">
              {lastResult.action === 'created' && (
                <div className="feedback-content">
                  <div className="feedback-icon-wrap feedback-icon-wrap--created">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <div className="feedback-label feedback-label--created">طلب جديد</div>
                  <div className="feedback-order-id">{lastResult.order?.order_id}</div>
                </div>
              )}

              {lastResult.action === 'ready' && (
                <div className="feedback-content">
                  <div className="feedback-icon-wrap feedback-icon-wrap--ready">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <div className="feedback-label feedback-label--ready">الطلب جاهز</div>
                  <div className="feedback-order-id">{lastResult.order?.order_id}</div>
                </div>
              )}

              {lastResult.action === 'already_done' && (
                <div className="feedback-content">
                  <div className="feedback-icon-wrap feedback-icon-wrap--duplicate">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div className="feedback-label feedback-label--duplicate">الطلب جاهز بالفعل</div>
                  <div className="feedback-order-id">{lastResult.order?.order_id}</div>
                </div>
              )}

              {lastResult.action === 'error' && (
                <div className="feedback-content">
                  <div className="feedback-icon-wrap feedback-icon-wrap--error">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="feedback-label feedback-label--error">خطأ</div>
                  <div className="feedback-error-msg">{lastResult.message}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Processing Indicator */}
        {scanning && (
          <div className="scanner-processing">
            <div className="scanner-processing-inner">
              <span className="scanner-processing-spinner" />
              جاري المعالجة...
            </div>
          </div>
        )}

        {/* Scan History */}
        {history.length > 0 && (
          <div className="history-section">
            <div className="history-header">
              <span className="history-icon">📋</span>
              <h2 className="history-title">آخر عمليات المسح</h2>
            </div>
            <div className="history-list">
              {history.map((item, i) => (
                <div key={i} className="history-item" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="history-item-right">
                    <span className={`history-badge ${item.action === 'created' ? 'history-badge--created' :
                      item.action === 'ready' ? 'history-badge--ready' :
                        'history-badge--duplicate'
                      }`}>
                      {item.action === 'created' ? 'جديد' : item.action === 'ready' ? 'جاهز' : 'مكرر'}
                    </span>
                    <span className="history-order-id">{item.order?.order_id}</span>
                  </div>
                  <span className="history-time">{formatTime(item.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}