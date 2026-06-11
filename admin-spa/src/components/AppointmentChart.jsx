import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { FileText, CalendarDays, ChevronDown } from 'lucide-react'

const data = [
  { hour: '7AM', completadas: 20, pendientes: 10 },
  { hour: '8AM', completadas: 35, pendientes: 18 },
  { hour: '9AM', completadas: 28, pendientes: 22 },
  { hour: '10AM', completadas: 40, pendientes: 25 },
  { hour: '11AM', completadas: 45, pendientes: 28 },
  { hour: '12PM', completadas: 38, pendientes: 20 },
  { hour: '1PM', completadas: 30, pendientes: 15 },
  { hour: '2PM', completadas: 42, pendientes: 24 },
  { hour: '3PM', completadas: 36, pendientes: 19 },
  { hour: '4PM', completadas: 48, pendientes: 26 },
  { hour: '5PM', completadas: 52, pendientes: 30 },
  { hour: '6PM', completadas: 44, pendientes: 22 },
  { hour: '7PM', completadas: 38, pendientes: 16 },
]

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-xl px-4 py-3 shadow-lg border border-[#E2E8F0]">
        <p className="text-sm font-semibold text-[#1E293B] mb-1.5">{label}</p>
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-[#64748B]">{p.name}:</span>
            <span className="font-bold text-[#1E293B]">{p.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

function CustomLegend({ payload }) {
  return (
    <div className="flex items-center gap-5 mb-4">
      {payload?.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-sm text-[#64748B]">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function AppointmentChart() {
  const [period, setPeriod] = useState('Hoy')
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 h-full" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#2563EB]" />
          <h3 className="text-base font-bold text-[#1E293B]">Resumen de citas</h3>
        </div>
        <div className="relative">
          <button onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-sm text-[#64748B] hover:bg-[#F1F5F9] transition-colors">
            <CalendarDays className="w-3.5 h-3.5" />
            {period}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-[#E2E8F0] z-20 py-1 w-36">
                {['Hoy', 'Esta semana', 'Este mes', 'Este año'].map(p => (
                  <button key={p} onClick={() => { setPeriod(p); setOpen(false) }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-[#F1F5F9] transition-colors ${period === p ? 'text-[#2563EB] font-semibold' : 'text-[#64748B]'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} domain={[0, 60]} />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
            <Line type="monotone" dataKey="completadas" stroke="#2563EB" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#2563EB' }} name="Completadas" />
            <Line type="monotone" dataKey="pendientes" stroke="#8B5CF6" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#8B5CF6' }} name="Pendientes" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
