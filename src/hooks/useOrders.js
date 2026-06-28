import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useOrders(branchId) {
  const [orders, setOrders] = useState([])
  const [newOrderFlag, setNewOrderFlag] = useState(0)

  const fetchOrders = useCallback(async () => {
    if (!branchId) return
    // الطلبات النشطة (جديد/قيد التحضير/جاهز) — كلها.
    const { data: active } = await supabase
      .from('orders')
      .select('*')
      .eq('branch_id', branchId)
      .in('status', ['new', 'preparing', 'ready'])
      .order('created_at', { ascending: false })

    // الطلبات المكتملة (تم تسليمها) — آخر 50 فقط لقسم "تم تسليمها" في شاشة العميل،
    // حتى لا نحمّل كل التاريخ. الـ Realtime يضيف الجديد تلقائياً.
    const { data: completed } = await supabase
      .from('orders')
      .select('*')
      .eq('branch_id', branchId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(50)

    setOrders([...(active || []), ...(completed || [])])
  }, [branchId])

  useEffect(() => {
    if (!branchId) return
    fetchOrders()

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
