import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Settings } from 'lucide-react'

const allData = [
  { name: 'Pendientes', value: 14, color: '#F97316', pct: 66.7 },
  { name: 'Confirmadas', value: 0, color: '#10B981', pct: 0 },
  { name: 'En Proceso', value: 0, color: '#8B5CF6', pct: 0 },
  { name: 'Completadas', value: 7, color: '#2563EB', pct: 33.3 },
  { name: 'Canceladas', value: 0, color: '#EF4444', pct: 0 },
]

const activeData = allData.filter(d => d.value > 0)

export default function StatusDonut() {
  const total = allData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 h-full" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div className="flex items-center gap-2 mb-5">
        <Settings className="w-5 h-5 text-[#2563EB]" />
        <h3 className="text-base font-bold text-[#1E293B]">Citas por estado</h3>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative w-[140px] h-[140px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={activeData.length > 0 ? activeData : [{ name: 'Sin datos', value: 1, color: '#E2E8F0' }]}
                cx="50%" cy="50%" innerRadius={45} outerRadius={62} paddingAngle={2} dataKey="value" stroke="none">
                {activeData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-[#1E293B]">{total}</span>
            <span className="text-[10px] text-[#64748B] font-medium">Total</span>
          </div>
        </div>
        <div className="flex-1 space-y-2.5">
          {allData.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-xs text-[#64748B] flex-1">{d.name}</span>
              <span className="text-xs font-bold text-[#1E293B]">{d.value}</span>
              <span className="text-[10px] text-[#94A3B8] w-10 text-right">({d.pct}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
