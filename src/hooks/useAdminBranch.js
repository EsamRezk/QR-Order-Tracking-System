import { useState, useEffect, useCallback } from 'react'

// الفرع المختار من القائمة الجانبية للأدمن — يبقى محفوظاً بين الصفحات
// حتى لا "يعلق" على فرع واحد ولا يُفقد عند الانتقال لصفحة بلا ?branch=
const STORAGE_KEY = 'kz_admin_branch'

export function useAdminBranch() {
  const [branchCode, setBranchCode] = useState(() => localStorage.getItem(STORAGE_KEY) || '')

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY) setBranchCode(e.newValue || '')
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const selectBranch = useCallback((code) => {
    if (code) localStorage.setItem(STORAGE_KEY, code)
    else localStorage.removeItem(STORAGE_KEY)
    setBranchCode(code || '')
  }, [])

  return { branchCode, selectBranch }
}
