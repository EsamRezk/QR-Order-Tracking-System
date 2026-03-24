import OrderCard from './OrderCard'
import './PreparingColumn.css'

export default function PreparingColumn({ orders }) {
  return (
    <div className="preparing-column">
      <div className="preparing-column-header">
        <span className="preparing-column-dot" />
        <h2 className="preparing-column-title">قيد التحضير</h2>
        <span className="preparing-column-count">{orders.length}</span>
      </div>
      <div className="preparing-column-list">
        {orders.map(order => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </div>
  )
}