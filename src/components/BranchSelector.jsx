import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function BranchSelector({ value, onChange, includeAll = false }) {
  const [branches, setBranches] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

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

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const options = []
  if (includeAll) options.push({ id: '', name_ar: 'جميع الفروع' })
  branches.forEach(b => options.push(b))

  const selectedOption = options.find(o => o.id === (value || '')) || options[0]

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger — matches date-range-group container style */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="date-range-group cursor-pointer flex items-center gap-2 !pr-5 !pl-4"
      >
        <span className="text-sm font-medium text-[#e5e5e5]">
          {selectedOption?.name_ar || 'اختر الفرع'}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="10"
          height="10"
          viewBox="0 0 12 12"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path fill="#FF5100" d="M6 8L1 3h10z" />
        </svg>
      </div>

      {/* Dropdown */}
      <div
        className={`absolute top-full right-0 mt-2 min-w-[200px] bg-[#2a2018] border border-[#3d3028] rounded-xl shadow-xl z-50 overflow-hidden transition-all duration-200 origin-top
          ${isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
      >
        <div className="max-h-60 overflow-y-auto p-1.5">
          {options.map((opt) => {
            const isSelected = (value || '') === opt.id
            return (
              <div
                key={opt.id}
                onClick={() => {
                  onChange(opt.id || null)
                  setIsOpen(false)
                }}
                className={`px-4 py-2.5 cursor-pointer transition-colors text-sm font-medium rounded-lg ${
                  isSelected
                    ? 'bg-[#FF5100] text-white'
                    : 'text-[#e5e5e5] hover:bg-[#3d3028]'
                }`}
              >
                {opt.name_ar}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}