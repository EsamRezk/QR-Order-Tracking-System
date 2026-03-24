import OrderCard from './OrderCard'

export default function ReadyColumn({ orders, fadingOrders = new Set() }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-3 mb-4 bg-[#22c55e]/10 rounded-lg px-5 py-3 border border-[#22c55e]/15">
        <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
        <h2 className="text-lg lg:text-xl font-bold text-[#22c55e]">جاهز</h2>
        <span className="text-sm bg-[#22c55e]/20 text-[#22c55e] px-3 py-1 rounded-md font-bold mr-auto">{orders.length}</span>
      </div>
      <div className="space-y-3">
        {orders.map(order => (
          <OrderCard key={order.id} order={order} fading={fadingOrders.has(order.id)} />
        ))}
      </div>
    </div>
  )
}
