import { Search, Moon, Bell, CalendarDays, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Header() {
  const today = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#E2E8F0] flex items-center gap-4" style={{ padding: '12px 28px' }}>
      <div className="relative flex-[0_0_40%]">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
        <input
          type="text"
          placeholder="Buscar pacientes, citas, servicios, médicos..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-sm text-[#1E293B] placeholder:text-[#94A3B8] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10 transition-all"
        />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <button className="w-9 h-9 rounded-xl bg-[#F1F5F9] flex items-center justify-center text-[#64748B] hover:text-[#1E293B] hover:bg-[#E2E8F0] transition-all duration-150">
          <Moon className="w-[18px] h-[18px]" />
        </button>

        <div className="relative">
          <button className="w-9 h-9 rounded-xl bg-[#F1F5F9] flex items-center justify-center text-[#64748B] hover:text-[#1E293B] hover:bg-[#E2E8F0] transition-all duration-150">
            <Bell className="w-[18px] h-[18px]" />
          </button>
          <div className="absolute -top-1 -right-1 w-[17px] h-[17px] rounded-full bg-[#EF4444] text-white text-[9px] font-bold flex items-center justify-center">1</div>
        </div>

        <div className="w-px h-7 bg-[#E2E8F0] mx-1" />

        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <CalendarDays className="w-[18px] h-[18px] text-[#2563EB]" />
          <span className="font-medium text-[13px]">{today}</span>
        </div>

        <div className="w-px h-7 bg-[#E2E8F0] mx-1" />

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-bold text-sm">A</div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold text-[#1E293B] leading-tight">Administrador</div>
            <div className="text-[11px] text-[#64748B]">Administrador</div>
          </div>
          <ChevronDown className="w-4 h-4 text-[#94A3B8] hidden sm:block" />
        </div>
      </div>
    </header>
  )
}
