import logo from '../assets/img/KebbaZone Logo.png'

export default function AppLogo() {
  return (
    <img
      src={logo}
      alt="كبة زون"
      className="app-logo"
      style={{
        position: 'fixed',
        top: 24,
        left: 24,
        height: 80,
        width: 'auto',
        zIndex: 50,
        borderRadius: 16,
        objectFit: 'contain',
      }}
    />
  )
}
