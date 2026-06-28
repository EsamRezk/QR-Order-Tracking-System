import { useState, useEffect } from 'react'
import { formatElapsed } from '../utils/formatTime'
import { resolveDeliveryApp, hexToRgba } from '../config/deliveryApps'
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
    padding: '1.25rem 1.5rem',
    borderColor: app.color,
    background: `linear-gradient(150deg, ${hexToRgba(app.color, 0.16)} 0%, #ffffff 55%)`,
  }

  return (
    <div
      style={cardStyle}
      className={`${fading ? 'animate-fade-out' : 'animate-slide-in'} rounded-2xl border-[2.5px] transition-all`}
    >
      {/* رأس: نوع الطلب (يمين) + لوجو التطبيق (يسار) */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {order.order_type && (
            <span
              className="text-xs lg:text-sm font-bold px-2.5 py-1 rounded-full"
              style={{ background: hexToRgba(app.color, 0.14), color: app.ink }}
            >
              {ORDER_TYPE_LABELS[order.order_type] || order.order_type}
            </span>
          )}
          {isReady && (
            <span className="text-xs lg:text-sm font-bold text-[#16a34a]">✓ جاهز</span>
          )}
        </div>
        <DeliveryAppLogo app={app} size="xl" />
      </div>

      {/* بادج اسم التطبيق */}
      <div className="mt-3">
        <DeliveryAppPill app={app} size="lg" />
      </div>

      {/* رقم الطلب (كبير) */}
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-base lg:text-lg font-medium text-[#9ca3af]">طلب</span>
        <span className="text-4xl lg:text-6xl font-extrabold text-[#2E2D2C] leading-none" style={{ color: app.ink }}>
          #{order.order_id}
        </span>
      </div>

      {/* الوقت */}
      <div className="mt-3 flex items-center gap-2 text-sm lg:text-base text-[#6B7280]">
        <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {elapsed}
      </div>
    </div>
  )
}
