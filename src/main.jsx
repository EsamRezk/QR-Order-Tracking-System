import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register Service Worker
// updateViaCache 'none': المتصفح يجيب sw.js من السيرفر كل مرة يتشيّك (مش من الكاش)،
// ونطلب فحص تحديث كل ما التطبيق يرجع للواجهة — فالـ PWA ما يفضلش على نسخة قديمة.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((reg) => {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {})
      })
    }).catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
