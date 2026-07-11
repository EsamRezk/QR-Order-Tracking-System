import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DEFAULT_BRANCH = import.meta.env.VITE_DEFAULT_BRANCH || 'Erqaa-01'

export function useBranch() {
  const [searchParams] = useSearchParams()
  const [branch, setBranch] = useState(null)
  const [initialOrders, setInitialOrders] = useState(null)
  const [initialDisplaySetting, setInitialDisplaySetting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const branchCode = searchParams.get('branch')

  useEffect(() => {
    if (!branchCode) {
      setLoading(false)
      setError('لم يتم تحديد فرع')
      return
    }

    let cancelled = false

    const fetchBootstrap = async () => {
      setLoading(true)
      setError(null)

      // رحلة واحدة تُرجع الفرع + الطلبات + إعداد شاشة العرض معاً بدل ثلاث
      // رحلات متتالية (كل رحلة على الإنتاج ~700ms-1s بغض النظر عن حجم البيانات)
      const { data, error: fetchError } = await supabase.rpc('rpc_branch_bootstrap', {
        p_branch_code: branchCode,
      })

      if (cancelled) return

      if (fetchError || !data?.branch) {
        setError('الفرع غير موجود')
        setBranch(null)
        setInitialOrders(null)
        setInitialDisplaySetting(null)
      } else {
        setBranch(data.branch)
        setInitialOrders(data.orders || [])
        setInitialDisplaySetting(data.display_setting || { show_all_on_display: false, display_mode: 'all' })
      }
      setLoading(false)
    }

    fetchBootstrap()
    return () => { cancelled = true }
  }, [branchCode])

  return { branch, loading, error, branchCode, initialOrders, initialDisplaySetting }
}

export async function resolveBranchByLocation(location) {
  if (!location) return null
  const { data } = await supabase
    .from('branches')
    .select('*')
    .eq('location_label', location)
    .eq('is_active', true)
    .single()
  return data || null
}
