import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DEFAULT_BRANCH = import.meta.env.VITE_DEFAULT_BRANCH || 'Erqaa-01'

// إعادة محاولة تحميل الفرع عند فشل الاتصال: 2s → 4s → 8s → 16s → 30s (سقف)
const RETRY_BASE_MS = 2000
const RETRY_MAX_MS = 30000

export function useBranch() {
  const [searchParams] = useSearchParams()
  const [branch, setBranch] = useState(null)
  const [initialOrders, setInitialOrders] = useState(null)
  const [initialDisplaySetting, setInitialDisplaySetting] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [errorHint, setErrorHint] = useState(null)

  const branchCode = searchParams.get('branch')

  useEffect(() => {
    if (!branchCode) {
      setLoading(false)
      setError('لم يتم تحديد فرع')
      setErrorHint('تحقق من رابط الفرع')
      return
    }

    let cancelled = false
    let retryTimer = null
    let attempt = 0

    const fetchBootstrap = async () => {
      if (attempt === 0) {
        setLoading(true)
        setError(null)
        setErrorHint(null)
      }

      // رحلة واحدة تُرجع الفرع + الطلبات + إعداد شاشة العرض معاً بدل ثلاث
      // رحلات متتالية (كل رحلة على الإنتاج ~700ms-1s بغض النظر عن حجم البيانات)
      const { data, error: fetchError } = await supabase.rpc('rpc_branch_bootstrap', {
        p_branch_code: branchCode,
      })

      if (cancelled) return

      if (fetchError) {
        // خطأ اتصال/خادم (قاعدة متوقفة، انتهاء مهلة، شبكة الفرع) — ليس "فرع غير موجود".
        // الشاشات تعمل بلا تدخّل بشري (تلفاز الفرع)، لذا نعيد المحاولة تلقائياً للأبد
        // بتباعد تصاعدي حتى RETRY_MAX_MS، وتظهر الطلبات فور عودة الخادم.
        console.error('rpc_branch_bootstrap failed:', fetchError)
        setError('تعذّر الاتصال بالخادم')
        setErrorHint('جاري إعادة المحاولة تلقائياً…')
        setBranch(null)
        setInitialOrders(null)
        setInitialDisplaySetting(null)
        setLoading(false)
        const delay = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS)
        attempt += 1
        retryTimer = setTimeout(fetchBootstrap, delay)
        return
      }

      if (!data?.branch) {
        setError('الفرع غير موجود')
        setErrorHint('تحقق من رابط الفرع')
        setBranch(null)
        setInitialOrders(null)
        setInitialDisplaySetting(null)
      } else {
        setError(null)
        setErrorHint(null)
        setBranch(data.branch)
        setInitialOrders(data.orders || [])
        setInitialDisplaySetting(data.display_setting || { show_all_on_display: false, display_mode: 'all' })
      }
      setLoading(false)
    }

    fetchBootstrap()
    return () => {
      cancelled = true
      clearTimeout(retryTimer)
    }
  }, [branchCode])

  return { branch, loading, error, errorHint, branchCode, initialOrders, initialDisplaySetting }
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
