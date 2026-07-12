import { useState, useEffect, useRef } from 'react'
import './Dropdown.css'

/* ── قائمة منسدلة موحّدة لكل النظام (بدل select الافتراضي) ── */
export default function Dropdown({ value, options, onChange, ariaLabel, placeholder }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selected = options.find(o => o.value === value)

  return (
    <div className={`dd ${open ? 'dd--open' : ''}`} ref={ref}>
      <button
        type="button"
        className="dd-trigger"
        onClick={() => setOpen(o => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected?.logo ? <img className="dd-logo" src={selected.logo} alt="" /> : null}
        <span className="dd-trigger-label">{selected?.label || placeholder || ''}</span>
        <svg className="dd-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="dd-menu" role="listbox">
          {options.map(o => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`dd-option ${o.value === value ? 'dd-option--active' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              {'logo' in o ? (
                o.logo
                  ? <img className="dd-logo" src={o.logo} alt="" />
                  : <span className="dd-logo dd-logo--ph" />
              ) : null}
              <span>{o.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
