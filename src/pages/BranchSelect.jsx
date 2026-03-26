import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoadingScreen from '../components/LoadingScreen'
import './BranchSelect.css'

export default function BranchSelect({ target = 'display' }) {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // If branch already in URL, skip selection
  const existingBranch = searchParams.get('branch')
  useEffect(() => {
    if (existingBranch) return
    const fetchBranches = async () => {
      const { data } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name_ar')
      setBranches(data || [])
      setLoading(false)
    }
    fetchBranches()
  }, [existingBranch])

  if (existingBranch) return null

  const handleSelect = (code) => {
    navigate(`/${target}?branch=${code}`)
  }

  const titles = {
    scan: { title: 'ماسح الطلبات', subtitle: 'اختر الفرع للمسح' },
    kitchen: { title: 'شاشة المطبخ', subtitle: 'اختر الفرع لعرض طلبات المطبخ' },
    display: { title: 'شاشة العرض', subtitle: 'اختر الفرع لعرض الطلبات' },
  }
  const { title, subtitle } = titles[target] || titles.display
  const icon = target === 'scan' ? (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 14.625v2.625m0 0v2.625m0-2.625h2.625m-2.625 0H16.5m4.125-2.625v2.625m0 0v2.625m0-2.625h-2.625" />
    </svg>
  ) : target === 'kitchen' ? (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
    </svg>
  ) : (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )

  if (loading) return <LoadingScreen fullScreen />

  return (
    <div className="branch-select-fullscreen">
      <div className="branch-select-container">
        {/* Header */}
        <div className="branch-select-header">
          <div className="branch-select-icon">{icon}</div>
          <h1 className="branch-select-title">{title}</h1>
          <p className="branch-select-subtitle">{subtitle}</p>
        </div>

        {/* Branch List */}
        {branches.length === 0 ? (
          <div className="branch-select-empty">لا توجد فروع نشطة</div>
        ) : (
          <div className="branch-select-list">
            {branches.map((b, i) => (
              <button
                key={b.id}
                className="branch-select-card"
                onClick={() => handleSelect(b.code)}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="branch-select-card-content">
                  <div className="branch-select-card-name">{b.name_ar}</div>
                  {b.name_en && (
                    <div className="branch-select-card-name-en">{b.name_en}</div>
                  )}
                  {b.location_label && (
                    <div className="branch-select-card-location">{b.location_label}</div>
                  )}
                </div>
                <div className="branch-select-card-arrow">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
