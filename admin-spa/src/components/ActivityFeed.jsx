import { ArrowRight } from 'lucide-react'

const activities = [
  { color: '#F97316', text: 'Nueva cita creada — Prueba Email - Sonografía Obstétrica', time: '28 may, 08:41 AM' },
  { color: '#10B981', text: 'Nueva cita creada — Test Debug - Sonografía Obstétrica', time: '28 may, 08:41 AM' },
  { color: '#8B5CF6', text: 'Nueva cita creada — Carlos Beltre - Perfil Hemodinámico', time: '18 may, 05:02 PM' },
  { color: '#EF4444', text: 'Nueva cita creada — Rafael mendez - Sonografía Obstétrica', time: '18 may, 04:55 PM' },
  { color: '#8B5CF6', text: 'Nueva cita creada — Fernando Cruz - Consulta Médica a Domicilio', time: '18 may, 04:54 PM' },
]

export default function ActivityFeed() {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 h-full" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-[#1E293B]">Actividad reciente</h3>
        <button className="flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:text-[#2563EB]/80 transition-colors">
          Ver todos <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <div className="space-y-3">
        {activities.map((a, i) => (
          <div key={i} className="flex items-start gap-3 pb-3 border-b border-[#F1F5F9] last:border-0 last:pb-0">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5"
              style={{ backgroundColor: a.color }}>
              {a.text.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#1E293B] leading-relaxed">{a.text}</p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">{a.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
