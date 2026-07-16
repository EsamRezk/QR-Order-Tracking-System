import { useEffect } from 'react'
import './Toast.css'

// تنبيه عائم غير معطِّل (بديل alert): يظهر أعلى الشاشة ويختفي تلقائياً.
// toast = { key, message, type: 'error' | 'success' } | null
export default function Toast({ toast, onClose, duration = 4500 }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [toast, onClose, duration])

  if (!toast) return null

  return (
    <div className={`kz-toast kz-toast--${toast.type || 'error'}`} role="alert" onClick={onClose}>
      <span className="kz-toast-icon" aria-hidden="true">
        {toast.type === 'success' ? '✓' : '⚠'}
      </span>
      <span className="kz-toast-msg">{toast.message}</span>
    </div>
  )
}
