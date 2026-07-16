import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, fetchAllPaged } from '../lib/supabase'

// ترتيب الحالات لمنع التراجع — مطابق لـ STATUS_RANK في الـ Edge Functions
const STATUS_RANK = { new: 0, preparing: 1, ready: 2, completed: 3, cancelled: 3 }

// مهلة أمان للتحديث التفاؤلي: لو لا تأكيد صريح ولا Realtime خلالها → رجوع تلقائي
const PENDING_TTL_MS = 15000

// حقول التحديث التفاؤلي — مطابقة لما تكتبه RPCs المطبخ (migration 032)
function optimisticPatch(action) {
  const now = new Date().toISOString()
  return action === 'ready'
    ? { status: 'ready', ready_at: now, foodics_delivery_status: 2, synced_to_foodics: false }
    : {
        status: 'completed',
        delivered_at: now,
        completed_at: now,
        foodics_delivery_status: 5,
        synced_to_foodics: false,
      }
}

export function useOrders(branchId, initialOrders) {
  const [orders, setOrders] = useState(() => initialOrders || [])
  const [newOrderFlag, setNewOrderFlag] = useState(0)
  // عدّاد يعيد الرندر عند تغيّر خريطة التحديثات المعلقة (الخريطة نفسها في ref)
  const [, setPendingVersion] = useState(0)

  // خريطة التحديثات التفاؤلية المعلقة: orderId → { target, patch, snapshot, timer }
  const pendingRef = useRef(new Map())
  // مرآة متزامنة لحالة الطلبات — للقراءة الفورية داخل الدوال دون انتظار رندر
  const ordersRef = useRef(orders)
  useEffect(() => {
    ordersRef.current = orders
  })

  const bumpPending = useCallback(() => setPendingVersion(v => v + 1), [])

  // إزالة قيد معلق (مع إيقاف مؤقّت الرجوع التلقائي)
  const clearPendingEntry = useCallback((id) => {
    const entry = pendingRef.current.get(id)
    if (!entry) return null
    clearTimeout(entry.timer)
    pendingRef.current.delete(id)
    bumpPending()
    return entry
  }, [bumpPending])

  // ── التحديث التفاؤلي: الكارت يتحرك فوراً قبل أي شبكة ──────────────
  // يُستدعى من شاشة الفرع لحظة تأكيد "جاهز"/"تم التسليم".
  const markOrderLocal = useCallback((id, action) => {
    const current = ordersRef.current.find(o => o.id === id)
    if (!current) return
    const patch = optimisticPatch(action)
    if (STATUS_RANK[current.status] >= STATUS_RANK[patch.status]) return // متقدم بالفعل

    // لا نكدّس قيوداً: قيد أقدم لنفس الطلب يُستبدل (مع الحفاظ على أقدم snapshot)
    const prevEntry = clearPendingEntry(id)
    const entry = {
      target: patch.status,
      patch,
      snapshot: prevEntry?.snapshot ?? {
        status: current.status,
        ready_at: current.ready_at,
        delivered_at: current.delivered_at,
        completed_at: current.completed_at,
        foodics_delivery_status: current.foodics_delivery_status,
        synced_to_foodics: current.synced_to_foodics,
      },
      // مهلة أمان: بلا تأكيد (نجاح صريح أو Realtime) يرجع الكارت تلقائياً
      // فلا يظل الطلب "متحركاً" في الشاشة بينما القاعدة لم تتغير.
      timer: setTimeout(() => {
        const stale = pendingRef.current.get(id)
        if (!stale) return
        pendingRef.current.delete(id)
        setOrders(prev => prev.map(o => (o.id === id ? { ...o, ...stale.snapshot } : o)))
        bumpPending()
        console.warn('Optimistic update expired, reverted order', id)
      }, PENDING_TTL_MS),
    }
    pendingRef.current.set(id, entry)
    setOrders(prev => prev.map(o => (o.id === id ? { ...o, ...patch } : o)))
    bumpPending()
  }, [clearPendingEntry, bumpPending])

  // تأكيد نجاح (وصل رد success من السيرفر): ننهي القيد ونثبّت الحالة.
  // نعيد تطبيق الـ patch لا لمجرد إنهاء القيد: لو كانت مهلة الأمان قد سبقت
  // الردَّ وأرجعت الكارت، فالقاعدة أصبحت في الحالة الجديدة فعلاً ويجب أن
  // تعكسها الشاشة دون انتظار Realtime (الذي غالباً يكون منقطعاً وقتها).
  const confirmOrderLocal = useCallback((id, action) => {
    clearPendingEntry(id)
    const patch = optimisticPatch(action)
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o
      // forward-only: لا نتراجع لو وصلت حالة أحدث عبر Realtime قبل التأكيد
      if (STATUS_RANK[o.status] >= STATUS_RANK[patch.status]) return o
      return { ...o, ...patch }
    }))
  }, [clearPendingEntry])

  // فشل نهائي: نرجع الكارت لحالته السابقة. ترجع true لو حصل رجوع فعلاً
  // (false = القيد كان مؤكداً بالفعل عبر Realtime/نجاح سابق — لا داعي لتنبيه).
  const revertOrderLocal = useCallback((id) => {
    const entry = clearPendingEntry(id)
    if (!entry) return false
    setOrders(prev => prev.map(o => (o.id === id ? { ...o, ...entry.snapshot } : o)))
    return true
  }, [clearPendingEntry])

  // هل لهذا الطلب تحديث معلق؟ (لتعطيل زر الكارت مؤقتاً ومنع النقر المزدوج)
  const isOrderPending = useCallback((id) => pendingRef.current.has(id), [])

  const fetchOrders = useCallback(async () => {
    if (!branchId) return
    // نقرأ من v_orders_display (نفس أعمدة orders لكن raw_qr_data مُقلّم = payload أخف بكثير).
    // النشط والمكتمل بالتوازي (Promise.all) لتقليل زمن التحميل.
    const [active, completedRes] = await Promise.all([
      // الطلبات النشطة (جديد/قيد التحضير/جاهز) — كلها، على دفعات 1000 لتجاوز حد 1000 صف.
      fetchAllPaged(() =>
        supabase
          .from('v_orders_display')
          .select('*')
          .eq('branch_id', branchId)
          .in('status', ['new', 'preparing', 'ready'])
          .order('created_at', { ascending: false })
      , 1000),
      // الطلبات المكتملة (تم تسليمها) — آخر 50 فقط لقسم "تم تسليمها". Realtime يضيف الجديد.
      supabase
        .from('v_orders_display')
        .select('*')
        .eq('branch_id', branchId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(50),
    ])

    // إعادة تطبيق التحديثات التفاؤلية المعلقة فوق النتيجة — كي لا يُرجِع
    // refetch متزامنٌ كارتاً تحرك للتو (القاعدة لم تلحق بعد).
    const fresh = [...(active || []), ...(completedRes?.data || [])]
    const overlaid = fresh.map(row => {
      const entry = pendingRef.current.get(row.id)
      if (!entry) return row
      if (STATUS_RANK[row.status] >= STATUS_RANK[entry.target]) {
        // القاعدة أكدت (أو تجاوزت) الهدف — القيد انتهى
        clearPendingEntry(row.id)
        return row
      }
      return { ...row, ...entry.patch }
    })
    setOrders(overlaid)
  }, [branchId, clearPendingEntry])

  useEffect(() => {
    if (!branchId) return

    // لو وصلت طلبات أولية جاهزة (من bootstrap شاشة الفرع/العرض) نستخدمها
    // مباشرة بدل رحلة جلب إضافية مكرّرة — راجع rpc_branch_bootstrap.
    if (initialOrders) {
      setOrders(initialOrders)
    } else {
      fetchOrders()
    }

    const channel = supabase
      .channel(`orders-${branchId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `branch_id=eq.${branchId}` },
        (payload) => {
          console.log('Realtime Order Update:', payload)
          if (payload.eventType === 'INSERT') {
            setOrders(prev => {
              // avoid duplicates
              if (prev.some(o => o.id === payload.new.id)) return prev;
              return [payload.new, ...prev]
            })
            setNewOrderFlag(f => f + 1)
          }
          if (payload.eventType === 'UPDATE') {
            // القاعدة وصلت (أو تجاوزت) هدف التحديث التفاؤلي → القيد انتهى
            const entry = pendingRef.current.get(payload.new.id)
            if (entry && STATUS_RANK[payload.new.status] >= STATUS_RANK[entry.target]) {
              clearPendingEntry(payload.new.id)
            }
            setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o))
          }
          if (payload.eventType === 'DELETE') {
            clearPendingEntry(payload.old.id)
            setOrders(prev => prev.filter(o => o.id !== payload.old.id))
          }
        }
      )
      .subscribe((status, err) => {
        if (err) console.error('Realtime Error:', err)
        console.log('Realtime Status:', status)
      })

    const pending = pendingRef.current
    return () => {
      supabase.removeChannel(channel)
      // تنظيف مؤقّتات الرجوع التلقائي عند الخروج/تغيير الفرع
      pending.forEach(entry => clearTimeout(entry.timer))
      pending.clear()
    }
    // initialOrders مقصود خارج الاعتماديات: يُستخدم كبذرة مرة واحدة عند تغيّر
    // branchId نفسه (يصل من نفس bootstrap)، لا كسبب لإعادة تنفيذ الـ effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, fetchOrders, clearPendingEntry])

  const incoming = orders.filter(o => o.status === 'new')
  const preparing = orders.filter(o => o.status === 'preparing')
  const ready = orders.filter(o => o.status === 'ready')
  // تم تسليمها (مكتمل) — لقسم العميل المطوي. الأحدث أولاً.
  const delivered = orders
    .filter(o => o.status === 'completed')
    .sort((a, b) => new Date(b.completed_at || b.ready_at || 0) - new Date(a.completed_at || a.ready_at || 0))

  return {
    orders,
    incoming,
    preparing,
    ready,
    delivered,
    newOrderFlag,
    refetch: fetchOrders,
    // واجهة التحديث التفاؤلي (شاشة الفرع)
    markOrderLocal,
    confirmOrderLocal,
    revertOrderLocal,
    isOrderPending,
  }
}
