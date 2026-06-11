import { useState } from 'react'
import {
  LayoutDashboard, Calendar, Stethoscope, UserCheck, Users,
  BarChart3, MessageSquare, Settings, LogOut, ChevronLeft, ChevronDown
} from 'lucide-react'

function HeartECG({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M19.5 12.5c0 6-7.5 9-7.5 9s-7.5-3-7.5-9c0-3.5 2.5-6 5-6 1.5 0 2.5.8 3.2 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 5c1.5-1.5 4-1.5 5.5 0s1.5 4 0 5.5L12 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="7,12 9.5,12 11,9 13,15 14.5,12 17,12" stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', badge: null },
  { icon: Calendar, label: 'Citas', badge: null },
  { icon: Stethoscope, label: 'Servicios', badge: null },
  { icon: UserCheck, label: 'Médicos', badge: null },
  { icon: Users, label: 'Pacientes', badge: null },
  { icon: BarChart3, label: 'Reportes', badge: null },
  { icon: MessageSquare, label: 'Mensajes', badge: '3' },
  { icon: Settings, label: 'Configuración', badge: null },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [active, setActive] = useState(0)

  if (collapsed) {
    return (
      <aside className="fixed left-0 top-0 h-screen bg-[#0F1A2E] z-50 flex flex-col items-center pt-5" style={{ width: 64 }}>
        <div className="w-9 h-9 rounded-lg bg-[#2563EB] flex items-center justify-center mb-8">
          <HeartECG className="w-5 h-5 text-white" />
        </div>
        <button onClick={() => setCollapsed(false)} className="text-[#64748B] hover:text-white mb-5 transition-colors duration-150">
          <ChevronRight className="w-4 h-4" />
        </button>
        <nav className="flex flex-col gap-0.5 flex-1">
          {menuItems.map((item, i) => (
            <button key={i} onClick={() => setActive(i)}
              className={`p-2.5 rounded-xl transition-[background] duration-150 ${i === active ? 'bg-[#1E3A5F] text-white' : 'text-[#64748B] hover:text-white hover:bg-white/[0.06]'}`}
              title={item.label}>
              <item.icon className="w-4.5 h-4.5" />
            </button>
          ))}
        </nav>
        <button className="p-2.5 text-[#64748B] hover:text-white mt-auto mb-4 transition-colors duration-150" title="Cerrar sesión">
          <LogOut className="w-4.5 h-4.5" />
        </button>
      </aside>
    )
  }

  return (
    <aside className="fixed left-0 top-0 h-screen bg-[#0F1A2E] z-50 flex flex-col" style={{ width: 240 }}>
      {/* Logo */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#2563EB] flex items-center justify-center">
            <HeartECG className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-base">Medi</span>
          <span className="text-[#2563EB] font-bold text-base">Home RD</span>
        </div>
        <button onClick={() => setCollapsed(true)} className="text-[#64748B] hover:text-white transition-colors duration-150">
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Admin card */}
      <div className="mx-4 mt-4 mb-5 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-bold text-sm">A</div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#10B981] border-2 border-[#0F1A2E]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-semibold truncate">Administrador</div>
            <div className="text-[#64748B] text-[11px]">Administrador</div>
          </div>
          <ChevronDown className="w-4 h-4 text-[#64748B] flex-shrink-0" />
        </div>
      </div>

      {/* Section title */}
      <div className="px-5 mb-2">
        <span className="text-[10px] font-semibold text-[#64748B]/50 tracking-[1.2px]">NAVEGACIÓN</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {menuItems.map((item, i) => (
          <button key={i} onClick={() => setActive(i)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-[background] duration-150 relative ${
              i === active
                ? 'bg-[#1E3A5F] text-white'
                : 'text-[#64748B] hover:text-white hover:bg-white/[0.06]'
            }`}>
            {i === active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-5 border-l-[3px] border-solid border-[#2563EB]" />}
            <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge && (
              <span className="w-5 h-5 rounded-full bg-[#F97316] text-white text-[10px] font-bold flex items-center justify-center">{item.badge}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 mt-2">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#64748B] hover:text-white hover:bg-white/5 transition-all duration-150">
          <LogOut className="w-[18px] h-[18px]" />
          <span>Cerrar sesión</span>
        </button>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/[0.06] mt-2 text-center">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <HeartECG className="w-3.5 h-3.5 text-[#2563EB]" />
          <span className="text-[11px] text-[#64748B] font-semibold">MediHome RD</span>
        </div>
        <p className="text-[11px] text-[#64748B] leading-relaxed">© 2026 MediHomeRD<br />Todos los derechos reservados.</p>
      </div>
    </aside>
  )
}

function ChevronRight({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
