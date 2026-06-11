import Sidebar from './components/Sidebar'
import Header from './components/Header'
import KPICard from './components/KPICard'
import AppointmentChart from './components/AppointmentChart'
import CalendarWidget from './components/CalendarWidget'
import ServicesList from './components/ServicesList'
import ActivityFeed from './components/ActivityFeed'
import StatusDonut from './components/StatusDonut'
import {
  BarChart3, Clock, CheckCircle2, Loader2, XCircle
} from 'lucide-react'

const kpiData = [
  { icon: BarChart3, color: '#2563EB', title: 'TOTAL DE CITAS', value: '21', variation: 8.2, trend: 'up', sparkData: [{ v: 10 }, { v: 11 }, { v: 14 }, { v: 13 }, { v: 16 }, { v: 18 }, { v: 21 }] },
  { icon: Clock, color: '#F97316', title: 'PENDIENTES', value: '14', variation: 12.5, trend: 'up', sparkData: [{ v: 7 }, { v: 8 }, { v: 9 }, { v: 10 }, { v: 11 }, { v: 12 }, { v: 14 }] },
  { icon: CheckCircle2, color: '#10B981', title: 'CONFIRMADAS', value: '0', variation: 100, trend: 'down', sparkData: [{ v: 12 }, { v: 10 }, { v: 8 }, { v: 5 }, { v: 3 }, { v: 1 }, { v: 0 }] },
  { icon: Loader2, color: '#8B5CF6', title: 'EN PROCESO', value: '0', variation: 0, trend: 'zero', sparkData: [{ v: 1 }, { v: 1 }, { v: 1 }, { v: 1 }, { v: 1 }, { v: 1 }, { v: 1 }] },
  { icon: CheckCircle2, color: '#3B82F6', title: 'COMPLETADAS', value: '7', variation: 40, trend: 'up', sparkData: [{ v: 3 }, { v: 3 }, { v: 4 }, { v: 4 }, { v: 5 }, { v: 6 }, { v: 7 }] },
  { icon: XCircle, color: '#EF4444', title: 'CANCELADAS', value: '0', variation: 0, trend: 'zero', sparkData: [{ v: 0 }, { v: 1 }, { v: 0 }, { v: 0 }, { v: 0 }, { v: 1 }, { v: 0 }] },
]

export default function App() {
  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      <Sidebar />
      <div style={{ marginLeft: 240 }} className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1" style={{ padding: '24px 28px' }}>
          <div className="grid grid-cols-6 gap-4 mb-6">
            {kpiData.map((kpi, i) => <KPICard key={i} {...kpi} />)}
          </div>
          <div className="grid grid-cols-[3fr_2fr] gap-5 mb-6">
            <AppointmentChart />
            <CalendarWidget />
          </div>
          <div className="grid grid-cols-3 gap-5">
            <ServicesList />
            <ActivityFeed />
            <StatusDonut />
          </div>
        </main>
      </div>
    </div>
  )
}
