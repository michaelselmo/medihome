import { Stethoscope, ArrowRight } from 'lucide-react'

const services = [
  { name: 'Sonografía Obstétrica', count: 5, pct: 38 },
  { name: 'Consulta Médica a Domicilio', count: 2, pct: 15 },
  { name: 'Mapa Cardiológico', count: 2, pct: 15 },
  { name: 'Perfil Morfológico', count: 2, pct: 15 },
  { name: 'Perfil Hemodinámico', count: 2, pct: 15 },
]

export default function ServicesList() {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 h-full" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-[#1E293B]">Servicios más solicitados</h3>
        <button className="flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:text-[#2563EB]/80 transition-colors">
          Ver todos <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <div className="space-y-4">
        {services.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-4 h-4 text-[#94A3B8]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-[#1E293B] truncate">{s.name}</span>
                <span className="text-xs font-semibold text-[#64748B] ml-2 flex-shrink-0">{s.count} ({s.pct}%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                <div className="h-full rounded-full bg-[#2563EB] transition-all duration-500" style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
