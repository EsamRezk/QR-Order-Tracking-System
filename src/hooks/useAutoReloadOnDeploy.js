import { useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════════
// تحديث تلقائي لما تنزل نسخة جديدة من الموقع — لكل الصفحات (تلفاز + جوال PWA).
//
// الاكتشاف: نجيب index.html من السيرفر (بلا كاش) ونقارن اسم ملف الـ JS الرئيسي
// (فيه hash بيتغير مع كل build). اختلف + ملفات النسخة الجديدة موجودة فعلاً = نسخة جديدة.
// بيتشيّك: كل CHECK_MS، ولما التطبيق يرجع للواجهة، ولما النت يرجع.
//
// التوقيت (علشان ما نقاطعش العامل وهو بيدوس):
//   - التطبيق في الخلفية أو لسه راجع للواجهة → reload فوراً
//   - مفتوح قدامه → نستنى لحد ما يبقى "هادي": مفيش لمس آخر IDLE_MS، ومفيش
//     نافذة تأكيد مفتوحة، ومفيش كتابة في خانة بحث/قائمة
// شاشة العرض (تلفاز ما حدش بيلمسه) بتبقى "هادية" دايماً → تتحدث خلال دقائق.
//
// حماية من الـ loop: لو عملنا reload لنفس النسخة مرتين وفضلت قديمة (كاش عنيد)
// ما نكررش — نستنى نسخة أحدث.
// في وضع التطوير (vite dev) مفيش hash → الهوك ما بيعملش حاجة.
// ═══════════════════════════════════════════════════════════════════
const CHECK_MS = 2 * 60 * 1000
const IDLE_MS = 45 * 1000
const SAFE_POLL_MS = 5 * 1000
const ATTEMPTS_KEY = 'kz_reload_attempts'

function currentEntry() {
  const el = document.querySelector('script[type="module"][src*="/assets/"]')
  return el ? new URL(el.src, location.origin).pathname : null
}

// هل فيه شغل جاري على الشاشة؟ (نافذة تأكيد مفتوحة أو كتابة في خانة)
function userIsBusy(lastInteraction) {
  if (Date.now() - lastInteraction < IDLE_MS) return true
  if (document.querySelector('.kitchen-modal-overlay, [role="dialog"]')) return true
  const el = document.activeElement
  return !!el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
}

function readAttempts() {
  try { return JSON.parse(sessionStorage.getItem(ATTEMPTS_KEY) || '{}') } catch { return {} }
}

export function useAutoReloadOnDeploy() {
  useEffect(() => {
    const mine = currentEntry()
    if (!mine) return // dev — لا يوجد ملف assets مُجزّأ

    let stopped = false
    let pending = null // اسم ملف النسخة الجديدة الجاهزة للتحميل
    let lastInteraction = Date.now()

    const reloadTo = (latest) => {
      // حماية من الـ loop: أقصى محاولتين لنفس النسخة في نفس الجلسة
      const attempts = readAttempts()
      if ((attempts[latest] || 0) >= 2) return
      attempts[latest] = (attempts[latest] || 0) + 1
      try { sessionStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts)) } catch { /* تخزين غير متاح */ }
      console.log('New version deployed — reloading', mine, '→', latest)
      location.reload()
    }

    const tryReload = () => {
      if (stopped || !pending) return
      if (document.visibilityState === 'hidden' || !userIsBusy(lastInteraction)) reloadTo(pending)
    }

    const check = async () => {
      if (stopped || pending) return
      try {
        const res = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const html = await res.text()
        const match = html.match(/<script[^>]+type="module"[^>]+src="([^"]*\/assets\/[^"]+\.js)"/)
        const latest = match ? new URL(match[1], location.origin).pathname : null
        if (stopped || !latest || latest === mine) return
        // النشر (FTP) بيرفع الملفات واحد ورا التاني: نتأكد إن ملفات النسخة الجديدة
        // (الـ JS + الـ CSS) موجودة فعلاً قبل الـ reload — وإلا تفتح صفحة بيضا.
        const assets = [latest, ...[...html.matchAll(/href="([^"]*\/assets\/[^"]+\.css)"/g)].map(m => m[1])]
        // ⚠️ السيرفر (.htaccess) بيرجّع index.html بـ 200 لأي ملف مش موجود —
        // فـ r.ok لوحده مش كفاية: لازم نوع الملف يكون JS/CSS فعلاً مش HTML.
        const ok = await Promise.all(assets.map(a =>
          fetch(a, { cache: 'no-store' })
            .then(r => r.ok && !(r.headers.get('content-type') || '').includes('text/html'))
            .catch(() => false)
        ))
        if (stopped || !ok.every(Boolean)) return
        pending = latest
        tryReload()
      } catch {
        // شبكة الفرع واقعة — نحاول في الدورة الجاية
      }
    }

    const onInteract = () => { lastInteraction = Date.now() }
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        // راجع للتطبيق = بداية جديدة: اللمس اللي قبل ما يخرج ما يتحسبش،
        // ولو فيه نسخة جديدة تتحمّل فوراً قبل ما يبدأ يشتغل
        lastInteraction = 0
        if (pending) reloadTo(pending)
        else check()
      } else {
        // راح للخلفية: نتشيّك ونحمّل وهو مش شايف
        if (pending) tryReload()
        else check()
      }
    }

    const checkTimer = setInterval(check, CHECK_MS)
    const safeTimer = setInterval(tryReload, SAFE_POLL_MS)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', check)
    window.addEventListener('pointerdown', onInteract, { passive: true })
    window.addEventListener('keydown', onInteract)
    check()

    return () => {
      stopped = true
      clearInterval(checkTimer)
      clearInterval(safeTimer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', check)
      window.removeEventListener('pointerdown', onInteract)
      window.removeEventListener('keydown', onInteract)
    }
  }, [])
}
