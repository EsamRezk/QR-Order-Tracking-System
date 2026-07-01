import { useLocation } from 'react-router-dom'
import logo from '../assets/img/KebbaZone Logo.png'

export default function AppLogo() {
  // شاشة العرض تستخدم هيدر مضغوط → نصغّر اللوجو ونرفعه ليتناسب معه
  const { pathname } = useLocation()
  // شاشة الفرع (/kitchen): لا نُظهر لوجو كبة زون إطلاقاً (بطلب المستخدم)
  if (pathname === '/kitchen') return null
  const compact = pathname === '/display'

  return (
    <img
      src={logo}
      alt="كبة زون"
      className="kz-fixed-logo"
      style={{
        position: 'fixed',
        top: compact ? 8 : 24,
        left: compact ? 16 : 24,
        height: compact ? 46 : 80,
        width: 'auto',
        zIndex: 200,
        borderRadius: compact ? 10 : 16,
        objectFit: 'contain',
      }}
    />
  )
}
