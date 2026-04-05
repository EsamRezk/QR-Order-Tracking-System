export default function StatsCard({ label, value, unit, color = 'text-[#2E2D2C]' }) {
  return (
    <div className="bg-[#ffffff] rounded-lg p-5 lg:p-6 border border-[#e5e7eb]">
      <div className="text-sm text-[#6B7280] mb-2">{label}</div>
      <div className={`text-2xl lg:text-3xl font-extrabold ${color}`}>
        {value}
        {unit && <span className="text-base font-normal text-[#6B7280] mr-1">{unit}</span>}
      </div>
    </div>
  )
}
