import { useState, useEffect } from 'react'
import { formatElapsed } from '../utils/formatTime'

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

  const channelName = order.channel_link
    ? order.channel_link.includes('jahez') ? 'جاهز'
    : order.channel_link.includes('hungerstation') ? 'هنقرستيشن'
    : 'مباشر'
    : 'مباشر'

  const isReady = order.status === 'ready'

  return (
    <div style={{ padding: '1.25rem 1.5rem' }} className={`${fading ? 'animate-fade-out' : 'animate-slide-in'} rounded-lg border transition-all ${
      isReady
        ? 'bg-gradient-to-l from-[#16a34a]/15 to-[#ffffff] border-[#22c55e]/25'
        : 'bg-gradient-to-l from-[#5830C5]/10 to-[#ffffff] border-[#5830C5]/20'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center text-lg font-bold ${
            isReady ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-[#5830C5]/20 text-[#5830C5]'
          }`}>
            {isReady ? '✓' : '🔥'}
          </div>
          <span className="text-2xl lg:text-4xl font-extrabold text-[#2E2D2C]">{order.order_id}</span>
        </div>
        <span className={`text-xs lg:text-sm font-bold ${
          isReady ? 'text-[#22c55e]' : 'text-[#7B5CD6]'
        }`}>
          {channelName}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm text-[#6B7280]">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {elapsed}
      </div>
    </div>
  )
}
