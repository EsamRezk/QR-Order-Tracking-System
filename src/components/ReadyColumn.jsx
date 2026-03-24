import OrderCard from './OrderCard'
import './ReadyColumn.css'

export default function ReadyColumn({ orders, fadingOrders = new Set() }) {
  return (
    <div className="ready-column">
      <div className="ready-column-header">
        <span className="ready-column-dot" />
        <h2 className="ready-column-title">جاهز</h2>
        <span className="ready-column-count">{orders.length}</span>
      </div>
      <div className="ready-column-list">
        {orders.map(order => (
          <OrderCard key={order.id} order={order} fading={fadingOrders.has(order.id)} />
        ))}
      </div>
    </div>
  )
}