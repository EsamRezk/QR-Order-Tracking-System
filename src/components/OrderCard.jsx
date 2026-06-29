import { useState, useEffect } from 'react'
import { formatElapsed } from '../utils/formatTime'
import { resolveDeliveryApp, hexToRgba, resolveDisplayNumber } from '../config/deliveryApps'
import { DeliveryAppLogo, DeliveryAppPill } from './DeliveryAppBadge'

const ORDER_TYPE_LABELS = {
  dine_in: 'محلي',
  pickup: 'استلام',
  delivery: 'توصيل',
}

export default function OrderCard({ order, fading = false }) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    const timeField = order.status === 'ready' ? order.ready_at : order.scanned_at
    setElapsed(formatElapsed(timeField))

    const interval = setInterval(() => {
      setElapsed(formatElapsed(timeField))
    }, 1000)

    return () => clearInterval(interval)
  }, [order])

  const app = resolveDeliveryApp(order)
  const isReady = order.status === 'ready'

  const cardStyle = {
    padding: '0.75rem 0.85rem',
    borderColor: app.color,
    background: `linear-gradient(150deg, ${hexToRgba(app.color, 0.16)} 0%, #ffffff 60%)`,
  }

  return (
    <div
      style={cardStyle}
      className={`${fading ? 'animate-fade-out' : 'animate-slide-in'} rounded-xl border-2 transition-all`}
    >
      <div className="flex items-center gap-2.5">
        {/* لوجو التطبيق ملاصق للمعلومات */}
        <DeliveryAppLogo app={app} size="lg" />

        {/* المعلومات */}
        <div className="flex-1 min-w-0">
          {/* صف علوي: نوع الطلب + اسم التطبيق (صغير) + جاهز */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {order.order_type && (
              <span
                className="text-[10px] lg:text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: hexToRgba(app.color, 0.14), color: app.ink }}
              >
                {ORDER_TYPE_LABELS[order.order_type] || order.order_type}
              </span>
            )}
            <DeliveryAppPill app={app} size="sm" />
            {isReady && (
              <span className="text-[10px] lg:text-xs font-bold text-[#16a34a]">✓ جاهز</span>
            )}
          </div>

          {/* رقم الطلب (كبير) */}
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className="text-xs lg:text-sm font-medium text-[#9ca3af]">طلب</span>
            <span className="text-4xl lg:text-5xl font-extrabold leading-none" style={{ color: app.ink }}>
              #{resolveDisplayNumber(order)}
            </span>
          </div>

          {/* الوقت */}
          <div className="mt-0.5 flex items-center gap-1.5 text-xs lg:text-sm text-[#6B7280]">
            <svg className="w-3.5 h-3.5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {elapsed}
          </div>
        </div>
      </div>
    </div>
  )
}
