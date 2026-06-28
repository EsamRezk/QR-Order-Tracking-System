import './DeliveryAppBadge.css'

/**
 * صندوق لوجو تطبيق التوصيل بإطار بلون التطبيق.
 * Props:
 *  - app: كائن الهوية من resolveDeliveryApp() ({ name, logo, color })
 *  - size: 'sm' | 'md' | 'lg' | 'xl' (افتراضي lg)
 */
export function DeliveryAppLogo({ app, size = 'lg' }) {
  if (!app) return null
  return (
    <div className={`app-logo app-logo--${size}`} style={{ borderColor: app.color }}>
      {app.logo ? (
        <img src={app.logo} alt={app.name} className="app-logo-img" loading="lazy" />
      ) : (
        <span className="app-logo-fallback" style={{ background: app.color }}>🛎️</span>
      )}
    </div>
  )
}

/**
 * بادج (pill) باسم التطبيق بخلفية لون الهوية.
 * Props:
 *  - app: كائن الهوية ({ name, color, onColor })
 *  - size: 'sm' | 'md' | 'lg' (افتراضي md)
 */
export function DeliveryAppPill({ app, size = 'md' }) {
  if (!app) return null
  return (
    <span
      className={`app-pill app-pill--${size}`}
      style={{ background: app.color, color: app.onColor }}
    >
      {app.name}
    </span>
  )
}
