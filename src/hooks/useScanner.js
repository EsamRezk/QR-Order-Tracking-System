import { useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { parseQR } from '../utils/parseQR'
import { useAuth } from '../context/AuthContext'

const COOLDOWN_MS = parseInt(import.meta.env.VITE_SCAN_COOLDOWN_MS || '2000')

export function useScanner(branchId) {
  const { session } = useAuth()
  const [lastResult, setLastResult] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [history, setHistory] = useState([])
  const cooldownRef = useRef(false)

  const handleScan = useCallback(async (rawText) => {
    if (!branchId || cooldownRef.current || !session?.sessionId) return

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
        // FIRST SCAN - Create new order via RPC
        const { data: rpcData, error } = await supabase.rpc('rpc_scanner_insert_order', {
          p_session_id: session.sessionId,
          p_order_id: parsed.order_id,
          p_branch_id: branchId,
          p_channel_link: parsed.channel_link,
          p_raw_qr_data: parsed.raw,
          p_device_info: navigator.userAgent
        })

        if (error) throw error
        if (!rpcData?.success) throw new Error(rpcData?.error || 'خطأ في الإنشاء')

        result = { action: 'created', order: rpcData.data }
      } else if (existing.status === 'preparing') {
        // SECOND SCAN - Mark as ready via RPC
        const { data: rpcData, error } = await supabase.rpc('rpc_scanner_mark_ready', {
          p_session_id: session.sessionId,
          p_order_internal_id: existing.id,
          p_device_info: navigator.userAgent
        })

        if (error) throw error
        if (!rpcData?.success) throw new Error(rpcData?.error || 'خطأ في التحديث')

        result = { action: 'ready', order: { ...existing, status: 'ready', ready_at: new Date().toISOString() } }
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
  }, [branchId, session?.sessionId])

  const clearResult = useCallback(() => setLastResult(null), [])

  return { handleScan, lastResult, clearResult, scanning, history }
}
