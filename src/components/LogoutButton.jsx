import { useAuth } from '../context/AuthContext'

export default function LogoutButton({ className = '' }) {
  const { logout, session } = useAuth()

  if (!session) return null

  return (
    <button
      onClick={logout}
      className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm text-[var(--color-text-secondary)] bg-[var(--color-background-secondary)] border-none cursor-pointer transition-all duration-200 hover:bg-[#7b5cd6] hover:text-[#fff] active:scale-[0.97] ${className}`}
    >
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
      </svg>
      تسجيل الخروج
    </button>
  )
}