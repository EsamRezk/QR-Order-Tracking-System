import { useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { parseQR } from '../utils/parseQR'

const COOLDOWN_MS = parseInt(import.meta.env.VITE_SCAN_COOLDOWN_MS || '2000')

export function useScanner(branchId) {
  const [lastResult, setLastResult] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [history, setHistory] = useState([])
  const cooldownRef = useRef(false)

  const handleScan = useCallback(async (rawText) => {
    if (!branchId || cooldownRef.current) return

    cooldownRef.current = true
    setScanning(true)
    setTimeout(() => { cooldownRef.current = false }, COOLDOWN_MS)

    try {
      const parsed = parseQR(rawText)

      // Check if order exists for this branch
      const { data: existing } = await supabase
        .from('orders')
        .select('*')
        .eq('order_id', parsed.order_id)
        .eq('branch_id', branchId)
        .single()

      let result

      if (!existing) {
        // FIRST SCAN - Create new order
        const { data: newOrder, error } = await supabase
          .from('orders')
          .insert({
            order_id: parsed.order_id,
            branch_id: branchId,
            channel_link: parsed.channel_link,
            status: 'preparing',
            raw_qr_data: parsed.raw,
          })
          .select()
          .single()

        if (error) throw error

        await supabase.from('scan_logs').insert({
          order_id: newOrder.id,
          scan_type: 'first_scan',
          scanned_at: new Date().toISOString(),
        })

        result = { action: 'created', order: newOrder }
      } else if (existing.status === 'preparing') {
        // SECOND SCAN - Mark as ready
        const { data: updated, error } = await supabase
          .from('orders')
          .update({ status: 'ready', ready_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw error

        await supabase.from('scan_logs').insert({
          order_id: existing.id,
          scan_type: 'second_scan',
          scanned_at: new Date().toISOString(),
        })

        result = { action: 'ready', order: updated }
      } else {
        result = { action: 'already_done', order: existing }
      }

      setLastResult(result)
      setHistory(prev => [{ ...result, timestamp: new Date() }, ...prev].slice(0, 10))
    } catch (err) {
      setLastResult({ action: 'error', message: err.message })
    } finally {
      setScanning(false)
    }
  }, [branchId])

  const clearResult = useCallback(() => setLastResult(null), [])

  return { handleScan, lastResult, clearResult, scanning, history }
}
