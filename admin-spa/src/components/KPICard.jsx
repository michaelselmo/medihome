import { LineChart, Line, ResponsiveContainer } from 'recharts'

export default function KPICard({ icon: Icon, color, title, value, variation, trend, sparkData }) {
  const up = trend === 'up'
  const down = trend === 'down'

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
      <div className="text-[11px] font-semibold text-[#64748B] tracking-[0.5px] mb-0.5">{title}</div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold text-[#1E293B]">{value}</div>
          <div className={`flex items-center gap-1 text-[11px] font-medium mt-0.5 ${
            up ? 'text-[#10B981]' : down ? 'text-[#EF4444]' : 'text-[#64748B]'
          }`}>
            {up ? '↑' : down ? '↓' : '—'} {Math.abs(variation)}% vs ayer
          </div>
        </div>
        <div className="w-[72px] h-10">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
