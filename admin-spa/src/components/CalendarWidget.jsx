import { useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const events = {
  14: ['#2563EB'],
  21: ['#10B981'],
  22: ['#8B5CF6'],
  28: ['#F97316'],
}

export default function CalendarWidget() {
  const now = new Date()
  const [month, setMonth] = useState(4)
  const [year, setYear] = useState(2026)
  const [view, setView] = useState('Mes')

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  const prevDays = new Date(year, month, 0).getDate()

  const goPrev = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const goNext = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push({ day: prevDays - firstDay + 1 + i, other: true })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, other: false })
  while (cells.length < 42) cells.push({ day: cells.length - daysInMonth - firstDay + 1, other: true })

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 h-full" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#2563EB]" />
          <h3 className="text-base font-bold text-[#1E293B]">Calendario</h3>
        </div>
        <div className="flex items-center gap-1 bg-[#F1F5F9] rounded-lg p-0.5">
          {['Mes', 'Semana', 'Día'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                view === v ? 'bg-white text-[#1E293B] shadow-sm' : 'text-[#64748B] hover:text-[#1E293B]'
              }`}>{v}</button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <button onClick={goPrev} className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-[#64748B] hover:bg-[#E2E8F0] transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-[#1E293B]">{monthNames[month]} {year}</span>
        <button onClick={goNext} className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-[#64748B] hover:bg-[#E2E8F0] transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-4">
        {daysOfWeek.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-[#94A3B8] py-2 uppercase tracking-wider">{d}</div>
        ))}
        {cells.map((cell, i) => {
          const today = cell.day === 31 && !cell.other
          const dayEvents = events[cell.day] || []
          return (
            <div key={i}
              className={`text-center py-1.5 text-sm relative rounded-lg transition-colors ${
                cell.other ? 'text-[#CBD5E1]' : today ? 'bg-[#2563EB] text-white font-bold' : 'text-[#1E293B] hover:bg-[#F1F5F9]'
              }`}>
              {cell.day}
              {!cell.other && dayEvents.length > 0 && !today && (
                <div className="flex justify-center gap-0.5 mt-0.5">
                  {dayEvents.map((c, j) => <div key={j} className="w-1 h-1 rounded-full" style={{ backgroundColor: c }} />)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-3 pt-3 border-t border-[#E2E8F0]">
        {[
          { label: 'Citas', color: '#2563EB' },
          { label: 'Controles', color: '#10B981' },
          { label: 'Exámenes', color: '#8B5CF6' },
          { label: 'Cirugías', color: '#F97316' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] text-[#64748B]">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
