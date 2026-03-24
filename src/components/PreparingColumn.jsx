import OrderCard from './OrderCard'

export default function PreparingColumn({ orders }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-3 mb-4 bg-[#FF5100]/10 rounded-lg px-5 py-3 border border-[#FF5100]/15">
        <div className="w-3 h-3 rounded-full bg-[#FF5100] animate-pulse shadow-sm shadow-[#FF5100]/50" />
        <h2 className="text-lg lg:text-xl font-bold text-[#FF5100]">قيد التحضير</h2>
        <span className="text-sm bg-[#FF5100]/20 text-[#FF5100] px-3 py-1 rounded-md font-bold mr-auto">{orders.length}</span>
      </div>
      <div className="space-y-3">
        {orders.map(order => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </div>
  )
}
