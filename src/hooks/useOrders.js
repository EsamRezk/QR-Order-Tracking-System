import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useOrders(branchId) {
  const [orders, setOrders] = useState([])
  const [newOrderFlag, setNewOrderFlag] = useState(0)

  const fetchOrders = useCallback(async () => {
    if (!branchId) return
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('branch_id', branchId)
      .in('status', ['preparing', 'ready'])
      .order('created_at', { ascending: false })
    setOrders(data || [])
  }, [branchId])

  useEffect(() => {
    if (!branchId) return
    fetchOrders()

    const channel = supabase
      .channel(`orders-${branchId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `branch_id=eq.${branchId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setOrders(prev => [payload.new, ...prev])
            setNewOrderFlag(f => f + 1)
          }
          if (payload.eventType === 'UPDATE') {
            setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new : o))
          }
          if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [branchId, fetchOrders])

  const preparing = orders.filter(o => o.status === 'preparing')
  const ready = orders.filter(o => o.status === 'ready')

  return { orders, preparing, ready, newOrderFlag, refetch: fetchOrders }
}
