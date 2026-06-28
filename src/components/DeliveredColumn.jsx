import { useState } from 'react'
import OrderCard from './OrderCard'
import './DeliveredColumn.css'

/**
 * قسم "تم تسليمها" — مطوي افتراضياً، يُفتح عند الضغط على الترويسة.
 * يعرض الطلبات المكتملة (delivered) في شبكة بسيطة.
 */
export default function DeliveredColumn({ orders = [] }) {
  const [open, setOpen] = useState(false)

  if (orders.length === 0) return null

  return (
    <section className={`delivered-section ${open ? 'delivered-section--open' : ''}`}>
      <button
        className="delivered-header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="delivered-chevron">{open ? '▾' : '▸'}</span>
        <span className="delivered-dot" />
        <h2 className="delivered-title">تم تسليمها</h2>
        <span className="delivered-count">{orders.length}</span>
      </button>

      {open && (
        <div className="delivered-list">
          {orders.map(order => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </section>
  )
}
