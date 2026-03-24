export default function StatsCard({ label, value, unit, color = 'text-white' }) {
  return (
    <div className="bg-[#2f2520] rounded-lg p-5 lg:p-6 border border-[#3d3028]">
      <div className="text-sm text-[#8a8280] mb-2">{label}</div>
      <div className={`text-2xl lg:text-3xl font-extrabold ${color}`}>
        {value}
        {unit && <span className="text-base font-normal text-[#8a8280] mr-1">{unit}</span>}
      </div>
    </div>
  )
}
