import { useState, useCallback } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useSupabaseSync } from './hooks/useSupabaseSync'
import {
  loadDinner, saveDinner,
  loadCalendar, saveCalendar,
  loadDancers, saveDancers,
  loadHistory, saveHistory,
  loadOrders, saveOrders,
  loadAuditLogs, appendLog, clearLogs,
  loadAccessRequests, saveAccessRequests,
  loadUsers, saveUsers,
  loadBirthdayExtras, saveBirthdayExtras,
  DinnerEvent, CalendarEntry, Dancer, HistoryEntry,
  Order, AuditLog, AppUser, AccessRequest, BirthdayExtra,
} from './lib/store'

import LoginScreen      from './components/LoginScreen'
import Header           from './components/Header'
import WelcomeTab       from './components/WelcomeTab'
import DinnerTab        from './components/DinnerTab'
import CalendarTab      from './components/CalendarTab'
import DancersTab       from './components/DancersTab'
import { PaisTab as GuardiansTab } from './components/GuardiansTab'
import CashRegisterTab  from './components/CashRegisterTab'
import { ComandasTab as OrdersTab } from './components/OrdersTab'
import { CheckInTab }         from './components/CheckInTab'
import { DashTab as DashboardTab } from './components/DashboardTab'
import { HistTab as HistoryTab } from './components/HistoryTab'
import { BirthdaysTab }       from './components/BirthdaysTab'
import { LogsTab as AuditLogsTab } from './components/AuditLogsTab'
import { UsersTab }           from './components/UsersTab'
import { AccessRequestsTab }  from './components/AccessRequestsTab'
import { MenuEditorTab }      from './components/MenuEditorTab'

export type Tab =
  | 'welcome' | 'dinner' | 'calendar' | 'history'
  | 'dancers' | 'guardians' | 'users' | 'requests'
  | 'cashregister' | 'orders' | 'checkin'
  | 'dashboard' | 'birthdays' | 'menu' | 'auditlogs'

export interface AppState {
  dinner:        DinnerEvent
  dinnerEvent:   DinnerEvent  // alias for old components
  calendar:      Record<string, CalendarEntry>
  dancers:       Record<string, Dancer>
  history:       Record<string, HistoryEntry>
  orders:        Record<string, Order>
  auditLogs:     AuditLog[]
  requests:      Record<string, AccessRequest>
  users:         Record<string, AppUser>
  birthdayExtras:BirthdayExtra[]
  _dinnerId:     string | null
}

function buildInitialState(): AppState {
  const dinner = loadDinner()
  return {
    dinner,
    dinnerEvent:   dinner,
    calendar:      loadCalendar(),
    dancers:       loadDancers(),
    history:       loadHistory(),
    orders:        loadOrders(),
    auditLogs:     loadAuditLogs(),
    requests:      loadAccessRequests(),
    users:         loadUsers(),
    birthdayExtras:loadBirthdayExtras(),
    _dinnerId:     null,
  }
}

function AppContent() {
  const auth = useAuth()
  const [tab, setTab]     = useState<Tab>('welcome')
  const [state, setState] = useState<AppState>(buildInitialState)

  const db = useSupabaseSync(setState)

  const mutDinner = useCallback((updates: Partial<DinnerEvent>) => {
    const merged = saveDinner(updates)
    setState(s => ({ ...s, dinner: merged, dinnerEvent: merged }))
    return merged
  }, [])

  const mutCalendar = useCallback((cal: Record<string, CalendarEntry>) => {
    saveCalendar(cal)
    setState(s => ({ ...s, calendar: cal }))
  }, [])

  const mutDancers = useCallback((dancers: Record<string, Dancer>) => {
    saveDancers(dancers)
    setState(s => ({ ...s, dancers }))
  }, [])

  const mutHistory = useCallback((history: Record<string, HistoryEntry>) => {
    saveHistory(history)
    setState(s => ({ ...s, history }))
    // Individual DB sync is done via db.saveHistoryEntry / db.removeHistoryEntry
    // called directly from CashRegisterTab and HistoryTab
  }, [])

  const mutOrders = useCallback((orders: Record<string, Order>) => {
    saveOrders(orders)
    setState(s => ({ ...s, orders }))
  }, [])

  const mutLog = useCallback((entry: Omit<AuditLog, 'id' | 'ts'>) => {
    // Fire-and-forget: persist to DB; also keep local as fallback
    const log = appendLog(entry)
    setState(s => ({ ...s, auditLogs: [log, ...s.auditLogs].slice(0, 500) }))
    db.appendLogToDb(entry).catch(() => {/* silent – local already saved */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mutClearLogs = useCallback(() => {
    clearLogs()
    setState(s => ({ ...s, auditLogs: [] }))
    db.clearLogsFromDb().catch(() => {/* silent */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mutRequests = useCallback((requests: Record<string, AccessRequest>) => {
    saveAccessRequests(requests)
    setState(s => ({ ...s, requests }))
  }, [])

  const mutUsers = useCallback((users: Record<string, AppUser>) => {
    saveUsers(users)
    setState(s => ({ ...s, users }))
    // Individual DB sync is done via db.saveUserToDb / db.deleteUserFromDb
    // called directly from UsersTab
  }, [])

  const mutBirthdayExtras = useCallback((birthdayExtras: BirthdayExtra[]) => {
    saveBirthdayExtras(birthdayExtras)
    setState(s => ({ ...s, birthdayExtras }))
    db.saveBirthdayExtrasToDb(birthdayExtras).catch(() => {/* silent */})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!auth.loading && !auth.role) {
    return <LoginScreen dinner={state.dinner} onSuccess={() => setTab('welcome')} />
  }
  if (auth.loading) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--dtg-brown)' }}>
        <div style={{ color:'var(--dtg-cream)', fontFamily:"'DM Serif Display',serif", fontSize:22, textAlign:'center' }}>
          App Camboatá
          <div style={{ fontSize:13, color:'rgba(253,248,238,.6)', marginTop:8 }}>Carregando...</div>
        </div>
      </div>
    )
  }

  const requestCount = Object.keys(state.requests).length
  const shared = {
    state, setState,
    // English names (new components)
    mutDinner, mutCalendar, mutDancers, mutHistory, mutOrders,
    mutLog, mutClearLogs, mutRequests, mutUsers, mutBirthdayExtras,
    db,
    // Legacy aliases so old components still receive their expected props
    mutEvento:   mutDinner,
    mutCal:      mutCalendar,
    mutDancas:   mutDancers,
    mutHist:     mutHistory,
    mutComandas: mutOrders,
    mutSol:      mutRequests,
    mutUsuarios: mutUsers,
    mutAnivExtra:mutBirthdayExtras,
  }
  const onTab = (t: string) => setTab(t as Tab)

  const tabs: Record<Tab, JSX.Element> = {
    welcome:     <WelcomeTab      state={state} onTab={onTab} />,
    dinner:      <DinnerTab       {...shared} />,
    calendar:    <CalendarTab     {...shared} />,
    history:     <HistoryTab      {...shared} />,
    dancers:     <DancersTab      {...shared} />,
    guardians:   <GuardiansTab    {...shared} />,
    users:       <UsersTab        {...shared} />,
    requests: <AccessRequestsTab />,
    cashregister:<CashRegisterTab {...shared} />,
    orders:      <OrdersTab       {...shared} />,
    checkin:     <CheckInTab      {...shared} />,
    dashboard:   <DashboardTab    {...shared} />,
    birthdays:   <BirthdaysTab    {...shared} />,
    menu:        <MenuEditorTab   {...shared} />,
    auditlogs:   <AuditLogsTab    {...shared} />,
  }

  return (
    <div>
      <Header tab={tab} onTab={onTab} requestCount={requestCount} />
      <div className="app">{tabs[tab]}</div>
    </div>
  )
}

export default function App() {
  return <AuthProvider><AppContent /></AuthProvider>
}
