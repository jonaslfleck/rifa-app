import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n'
import { AppState } from '../App'
import { formatCurrency, cleanPhone } from '../lib/store'

function getGreeting(t: ReturnType<typeof useTranslation>['t']) {
  const h = new Date().getHours()
  if (h < 12) return t.greeting.morning
  if (h < 18) return t.greeting.afternoon
  return t.greeting.evening
}

interface Props { state: AppState; onTab: (tab: string) => void }

export default function WelcomeTab({ state, onTab }: Props) {
  const auth = useAuth()
  const { t } = useTranslation()

  const dinnerEvent = state.dinnerEvent
  const orders      = state.orders
  const calendar    = state.calendar
  const dancers     = state.dancers

  // Last login tracking
  const lastLogin = (() => {
    try {
      const ts = localStorage.getItem('jdtg_last_login')
      if (!ts) return null
      return new Date(Number(ts)).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch { return null }
  })()
  try { localStorage.setItem('jdtg_last_login', String(Date.now())) } catch {}

  // Dancers visible to current user
  const myDancers = (() => {
    const all = Object.values(dancers).filter(d => !d.inactive)
    if (!auth.isGuardian() || !auth.userPhone) return all
    return all.filter(d => {
      const phones = [
        cleanPhone(d.phone),
        cleanPhone(d.guardian1Phone),
        cleanPhone(d.guardian2Phone),
        ...d.extraContacts.map(c => cleanPhone(c.phone)),
      ]
      return phones.includes(auth.userPhone!)
    })
  })()

  const myDancerNames = myDancers.map(d => d.name.toLowerCase())

  // Orders visible to current user
  const myOpenOrders = Object.values(orders).filter(o => {
    if (o.paid) return false
    if (auth.canCaixa()) return true
    if (auth.isGuardian() || auth.isOrganizer()) {
      if (o.phone === auth.userPhone || o.createdBy === auth.userPhone) return true
      return myDancerNames.some(n =>
        o.name.toLowerCase().includes(n) || n.includes(o.name.toLowerCase())
      )
    }
    return false
  })
  const totalOpen = myOpenOrders.reduce((s, o) => s + (o.amount || 0), 0)

  // Upcoming calendar
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const upcomingCal = Object.values(calendar)
    .filter(e => !e.blocked && new Date(e.date + 'T12:00:00') >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4)

  const attendees     = dinnerEvent.attendees || []
  const myAttendance  = attendees.filter(a => a.phone === auth.userPhone)
  const isAttending   = myAttendance.length > 0

  const danceiroLabel = auth.isGuardian()
    ? t.welcome.myDancers(myDancers.length)
    : t.welcome.allDancers

  return (
    <div>
      {/* Hero */}
      <div className="welcome-hero">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div className="welcome-greeting">
              {getGreeting(t)}, {(auth.userName ?? t.greeting.welcome).split(' ')[0]}!
            </div>
            {lastLogin && (
              <div className="welcome-sub">{t.greeting.lastAccess} {lastLogin}</div>
            )}
            {auth.role && (
              <div className="welcome-role">
                {t.roleEmoji[auth.role]} {t.roles[auth.role] ?? auth.role}
              </div>
            )}
          </div>
          <div style={{ fontSize: 40, flexShrink: 0 }}>{t.roleEmoji[auth.role ?? ''] ?? '🎭'}</div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8, marginBottom: '1rem' }}>
        <div className="dash-kpi">
          <div className="dash-kpi-val">{myDancers.length}</div>
          <div className="dash-kpi-lbl">{danceiroLabel}</div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-val">{upcomingCal.length}</div>
          <div className="dash-kpi-lbl">{t.welcome.scheduledDinners}</div>
        </div>
        {(auth.canCaixa() || auth.isGuardian() || auth.isOrganizer()) && (
          <div className="dash-kpi">
            <div className="dash-kpi-val" style={{ color: myOpenOrders.length > 0 ? 'var(--amber-tx)' : 'var(--green-tx)' }}>
              {myOpenOrders.length}
            </div>
            <div className="dash-kpi-lbl">{t.welcome.openOrders}</div>
          </div>
        )}
        {auth.canViewTotal() && attendees.length > 0 && (
          <div className="dash-kpi">
            <div className="dash-kpi-val">{attendees.length}</div>
            <div className="dash-kpi-lbl">{t.welcome.confirmedCount}</div>
          </div>
        )}
      </div>

      {/* Active dinner */}
      {dinnerEvent.eventDate && (
        <div className="card">
          <div className="card-label">
            {t.dinner.current}
            {dinnerEvent.isDonation && <span className="badge-doacao">{t.dinner.donation}</span>}
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{dinnerEvent.title}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>📅 {dinnerEvent.eventDate}</div>
          {dinnerEvent.organizer && (
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>👨‍🍳 {dinnerEvent.organizer}</div>
          )}
          <div className="stats" style={{ marginBottom: 8 }}>
            <div className="stat">
              <div className="stat-num">{attendees.length}</div>
              <div className="stat-lbl">{t.dinner.confirmed}</div>
            </div>
            {isAttending && (
              <div className="stat">
                <div className="stat-num" style={{ color: 'var(--green-tx)' }}>✓</div>
                <div className="stat-lbl">{t.welcome.confirmedCount}</div>
              </div>
            )}
            {auth.canViewTotal() && (
              <div className="stat">
                <div className="stat-num">
                  R${formatCurrency(attendees.filter(a => a.present === true && !a.isCook).reduce((s, a) => s + a.price, 0))}
                </div>
                <div className="stat-lbl">{t.dinner.collected}</div>
              </div>
            )}
          </div>
          {dinnerEvent.deadline && (
            <div className="notice notice-amber" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>⏰</span>
              <span style={{ fontSize: 13 }}>{dinnerEvent.deadline}</span>
            </div>
          )}
          {!isAttending && !dinnerEvent.closed && (auth.isGuardian() || auth.isOrganizer()) && (
            <button className="btn btn-primary btn-block" style={{ marginBottom: 0 }} onClick={() => onTab('janta')}>
              {t.welcome.confirmPresence}
            </button>
          )}
          {isAttending && (
            <button className="btn btn-block" style={{ marginBottom: 0 }} onClick={() => onTab('janta')}>
              {t.welcome.viewFullList}
            </button>
          )}
        </div>
      )}

      {/* Open orders */}
      {(auth.isGuardian() || auth.isOrganizer() || auth.canCaixa()) && myOpenOrders.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--dtg-gold)' }}>
          <div className="card-label">
            💳 {t.orders.filterOpen}
            <span style={{ fontFamily: "'DM Serif Display',serif", fontSize: 16, color: 'var(--dtg-brown)' }}>
              R${formatCurrency(totalOpen)}
            </span>
          </div>
          {myOpenOrders.slice(0, 3).map(o => (
            <div key={o.id} className="comanda-row aberta" style={{ marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="comanda-nome">{o.name}</div>
                <div className="comanda-data">
                  {o.description || ''} · {o.date ? new Date(o.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : ''}
                </div>
              </div>
              <div className="comanda-valor">R${formatCurrency(o.amount || 0)}</div>
            </div>
          ))}
          {myOpenOrders.length > 3 && (
            <div style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 8px' }}>
              + {myOpenOrders.length - 3} comanda(s)...
            </div>
          )}
          <button className="btn btn-gold btn-block" style={{ marginBottom: 0 }} onClick={() => onTab('comandas')}>
            {t.welcome.viewAllOrders}
          </button>
        </div>
      )}

      {/* Calendar preview */}
      {upcomingCal.length > 0 && (
        <div className="card">
          <div className="card-label">
            {t.welcome.upcomingDinners}
            <button className="btn btn-sm" onClick={() => onTab('cal')} style={{ fontSize: 11 }}>
              {t.welcome.viewAll}
            </button>
          </div>
          {upcomingCal.map(entry => {
            const dt     = new Date(entry.date + 'T12:00:00')
            const dtStr  = dt.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
            const days   = Math.round((dt.getTime() - today.getTime()) / 86400000)
            const isSoon = days <= 7
            return (
              <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 48, height: 48, background: isSoon ? 'var(--green-bg)' : 'var(--bg)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: isSoon ? 'var(--green-tx)' : 'var(--dtg-brown)', lineHeight: 1 }}>{dt.getDate()}</span>
                  <span style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase' }}>
                    {dt.toLocaleDateString('pt-BR', { month: 'short' })}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {dtStr.charAt(0).toUpperCase() + dtStr.slice(1)}
                    {isSoon && (
                      <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--green-bg)', color: 'var(--green-tx)', borderRadius: 10, padding: '1px 6px', fontWeight: 600 }}>
                        {t.welcome.thisWeek}
                      </span>
                    )}
                  </div>
                  {entry.guardians.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
                      👨‍🍳 {entry.guardians.join(' · ')}
                    </div>
                  )}
                  {entry.menu && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>🍽️ {entry.menu}</div>
                  )}
                </div>
              </div>
            )
          })}
          <div style={{ height: 8 }} />
          <button className="btn btn-block" style={{ marginBottom: 0 }} onClick={() => onTab('cal')}>
            {t.welcome.proposeDate}
          </button>
        </div>
      )}

      {upcomingCal.length === 0 && !dinnerEvent.eventDate && (
        <div className="card">
          <div className="empty-state">
            {t.welcome.noDinner}<br />
            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => onTab('cal')}>
              {t.welcome.proposeFirst}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
