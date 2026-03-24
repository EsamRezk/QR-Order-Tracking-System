import { useAuth } from '../context/AuthContext'

export default function LogoutButton({ className = '' }) {
  const { logout, session } = useAuth()

  if (!session) return null

  return (
    <button
      onClick={logout}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 bg-[#2f2520] border border-[#3d3028] text-[#8a8280] hover:bg-[#ce0b0b]/15 hover:text-[#ce0b0b] hover:border-[#ce0b0b]/30 cursor-pointer ${className}`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
      </svg>
      تسجيل الخروج
    </button>
  )
}
