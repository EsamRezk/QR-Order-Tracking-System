import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DEFAULT_BRANCH = import.meta.env.VITE_DEFAULT_BRANCH || 'Erqaa-01'

export function useBranch() {
  const [searchParams] = useSearchParams()
  const [branch, setBranch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const branchCode = searchParams.get('branch') || DEFAULT_BRANCH

  useEffect(() => {
    const fetchBranch = async () => {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('branches')
        .select('*')
        .eq('code', branchCode)
        .eq('is_active', true)
        .single()

      if (fetchError || !data) {
        setError('الفرع غير موجود')
        setBranch(null)
      } else {
        setBranch(data)
      }
      setLoading(false)
    }

    fetchBranch()
  }, [branchCode])

  return { branch, loading, error, branchCode }
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
