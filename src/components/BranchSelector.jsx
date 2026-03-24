import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function BranchSelector({ value, onChange, includeAll = false }) {
  const [branches, setBranches] = useState([])

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name_ar')
      setBranches(data || [])
    }
    fetch()
  }, [])

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="bg-[#2f2520] text-white border border-[#3d3028] rounded-lg px-5 py-3 text-base focus:outline-none focus:border-[#FF5100] transition-colors appearance-none cursor-pointer min-w-[180px]"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23FF5100' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'left 14px center', paddingLeft: '32px' }}
    >
      {includeAll && <option value="">جميع الفروع</option>}
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name_ar}
        </option>
      ))}
    </select>
  )
}
