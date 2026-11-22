import { useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════════
// تحديث تلقائي لما تنزل نسخة جديدة من الموقع.
// شاشات العرض (تلفاز الفرع) مفتوحة أيام بدون ما حد يلمسها — فأي إصلاح
// بننشره ما كانش بيوصلها إلا لو حد عمل refresh بإيده.
// كل CHECK_MS نجيب index.html من السيرفر (بلا كاش) ونقارن اسم ملف الـ JS
// الرئيسي (فيه hash بيتغير مع كل build). اختلف + ملفاتها موجودة = reload.
// في وضع التطوير (vite dev) مفيش hash → الهوك ما بيعملش حاجة.
// ═══════════════════════════════════════════════════════════════════
const CHECK_MS = 5 * 60 * 1000

function currentEntry() {
  const el = document.querySelector('script[type="module"][src*="/assets/"]')
  return el ? new URL(el.src, location.origin).pathname : null
}

export function useAutoReloadOnDeploy() {
  useEffect(() => {
    const mine = currentEntry()
    if (!mine) return // dev — لا يوجد ملف assets مُجزّأ

    let stopped = false
    const check = async () => {
      try {
        const res = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const html = await res.text()
        const match = html.match(/<script[^>]+type="module"[^>]+src="([^"]*\/assets\/[^"]+\.js)"/)
        const latest = match ? new URL(match[1], location.origin).pathname : null
        if (stopped || !latest || latest === mine) return
        // النشر (FTP) بيرفع الملفات واحد ورا التاني: نتأكد إن ملفات النسخة الجديدة
        // (الـ JS + الـ CSS) موجودة فعلاً قبل الـ reload — وإلا التلفاز يفتح صفحة
        // بيضا ومحدش جنبه. لو لسه ناقصة نستنى الدورة الجاية.
        const assets = [latest, ...[...html.matchAll(/href="([^"]*\/assets\/[^"]+\.css)"/g)].map(m => m[1])]
        // ⚠️ السيرفر (.htaccess) بيرجّع index.html بـ 200 لأي ملف مش موجود —
        // فـ r.ok لوحده مش كفاية: لازم نوع الملف يكون JS/CSS فعلاً مش HTML.
        const ok = await Promise.all(assets.map(a =>
          fetch(a, { cache: 'no-store' })
            .then(r => r.ok && !(r.headers.get('content-type') || '').includes('text/html'))
            .catch(() => false)
        ))
        if (!stopped && ok.every(Boolean)) {
          console.log('New version deployed — reloading', mine, '→', latest)
          location.reload()
        }
      } catch {
        // شبكة الفرع واقعة — نحاول في الدورة الجاية
      }
    }

    const timer = setInterval(check, CHECK_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [])
}
