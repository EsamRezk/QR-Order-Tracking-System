import { useEffect, useState, useCallback } from 'react'
import { supabase, fetchAllPaged } from '../lib/supabase'

export function useOrders(branchId, initialOrders) {
  const [orders, setOrders] = useState(() => initialOrders || [])
  const [newOrderFlag, setNewOrderFlag] = useState(0)

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

    setOrders([...(active || []), ...(completedRes?.data || [])])
  }, [branchId])

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
            setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o))
          }
          if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id !== payload.old.id))
          }
        }
      )
      .subscribe((status, err) => {
        if (err) console.error('Realtime Error:', err)
        console.log('Realtime Status:', status)
      })

    return () => supabase.removeChannel(channel)
    // initialOrders مقصود خارج الاعتماديات: يُستخدم كبذرة مرة واحدة عند تغيّر
    // branchId نفسه (يصل من نفس bootstrap)، لا كسبب لإعادة تنفيذ الـ effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, fetchOrders])

  const incoming = orders.filter(o => o.status === 'new')
  const preparing = orders.filter(o => o.status === 'preparing')
  const ready = orders.filter(o => o.status === 'ready')
  // تم تسليمها (مكتمل) — لقسم العميل المطوي. الأحدث أولاً.
  const delivered = orders
    .filter(o => o.status === 'completed')
    .sort((a, b) => new Date(b.completed_at || b.ready_at || 0) - new Date(a.completed_at || a.ready_at || 0))

  return { orders, incoming, preparing, ready, delivered, newOrderFlag, refetch: fetchOrders }
}
