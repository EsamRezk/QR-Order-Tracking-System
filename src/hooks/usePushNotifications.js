import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { VAPID_PUBLIC_KEY } from '../config/push'

// حالات زر التنبيهات في شاشة الفرع:
//   'checking'          جاري الفحص
//   'unsupported'       المتصفح لا يدعم التنبيهات
//   'ios-needs-install' آيفون من المتصفح — لازم "إضافة إلى الشاشة الرئيسية" أولاً
//   'denied'            المستخدم رفض الإذن (يُفعَّل من إعدادات الجهاز فقط)
//   'off'               مدعوم ولم يُفعَّل بعد
//   'on'                مفعّل ومسجّل لهذا الفرع

function isIOS() {
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

function isSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function saveSubscription(sessionId, branchId, sub) {
  const json = sub.toJSON()
  const { data, error } = await supabase.rpc('rpc_save_push_subscription', {
    p_session_id: sessionId,
    p_branch_id: branchId,
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_user_agent: navigator.userAgent,
  })
  if (error) throw error
  if (!data?.success) throw new Error(data?.error || 'تعذّر حفظ اشتراك التنبيهات')
}

export function usePushNotifications(sessionId, branchId) {
  const [status, setStatus] = useState('checking')
  const [busy, setBusy] = useState(false)

  // الفحص الأولي + لو الجهاز مشترك أصلاً نعيد ربطه بالفرع المفتوح حالياً
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!isSupported()) {
        setStatus(isIOS() && !isStandalone() ? 'ios-needs-install' : 'unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        setStatus('denied')
        return
      }
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (cancelled) return
        if (sub && Notification.permission === 'granted') {
          setStatus('on')
          if (sessionId && branchId) {
            saveSubscription(sessionId, branchId, sub).catch((e) =>
              console.error('push resubscribe failed:', e),
            )
          }
        } else {
          setStatus('off')
        }
      } catch (e) {
        console.error('push status check failed:', e)
        if (!cancelled) setStatus('off')
      }
    })()
    return () => { cancelled = true }
  }, [sessionId, branchId])

  // تفعيل — لازم يُستدعى من ضغطة زر (شرط iOS وأغلب المتصفحات لطلب الإذن)
  const enable = useCallback(async () => {
    if (!sessionId || !branchId) return { ok: false, error: 'لم يتم تحميل الفرع بعد' }
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off')
        return { ok: false, error: 'لم يتم السماح بالتنبيهات' }
      }
      const reg = await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }))
      await saveSubscription(sessionId, branchId, sub)
      setStatus('on')
      return { ok: true }
    } catch (e) {
      console.error('push enable failed:', e)
      return { ok: false, error: e.message || 'تعذّر تفعيل التنبيهات' }
    } finally {
      setBusy(false)
    }
  }, [sessionId, branchId])

  const disable = useCallback(async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        if (sessionId) {
          await supabase.rpc('rpc_delete_push_subscription', {
            p_session_id: sessionId,
            p_endpoint: endpoint,
          })
        }
      }
      setStatus('off')
      return { ok: true }
    } catch (e) {
      console.error('push disable failed:', e)
      return { ok: false, error: 'تعذّر إيقاف التنبيهات' }
    } finally {
      setBusy(false)
    }
  }, [sessionId])

  const sendTest = useCallback(async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (!sub) return { ok: false, error: 'التنبيهات غير مفعّلة على هذا الجهاز' }
      const { data, error } = await supabase.functions.invoke('push-test', {
        body: { session_id: sessionId, endpoint: sub.endpoint },
      })
      if (error) throw error
      if (!data?.success) return { ok: false, error: data?.error || 'تعذّر إرسال التنبيه' }
      return { ok: true }
    } catch (e) {
      console.error('push test failed:', e)
      return { ok: false, error: 'تعذّر إرسال التنبيه' }
    } finally {
      setBusy(false)
    }
  }, [sessionId])

  return { status, busy, enable, disable, sendTest, isIOS: isIOS() }
}
