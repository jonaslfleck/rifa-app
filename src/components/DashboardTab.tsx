import { useEffect, useRef } from 'react'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n'
import { AppState } from '../App'
import { formatCurrency, walletStatus, groupLabel, cleanPhone } from '../lib/store'

export function DashTab({ state }: { state: AppState; [k: string]: any }) {
  const auth = useAuth()
  const { t } = useTranslation()
  const ref1 = useRef<HTMLCanvasElement>(null)
  const ref2 = useRef<HTMLCanvasElement>(null)
  const ref3 = useRef<HTMLCanvasElement>(null)
  const charts = useRef<any[]>([])

  const dinner  = state.dinnerEvent
  const dancers = state.dancers
  const history = state.history
  const orders  = state.orders

  const year    = new Date().getFullYear()
  const month   = new Date().getMonth()
  const yearDinners = Object.values(history).filter(h => h.year === year)

  // Dancers visible to current user
  const allDancers = Object.values(dancers).filter(d => !d.inactive)
  const myDancers  = auth.isGuardian()
    ? allDancers.filter(d => {
        if (!auth.userPhone) return false
        const phones = [cleanPhone(d.phone), cleanPhone(d.guardian1Phone), cleanPhone(d.guardian2Phone), ...d.extraContacts.map(c => cleanPhone(c.phone))]
        return phones.includes(auth.userPhone!)
      })
    : allDancers

  // Orders visible to current user
  const myDancerNames = myDancers.map(d => d.name.toLowerCase())
  const visibleOrders = Object.values(orders).filter(o => {
    if (!auth.isGuardian()) return true
    if (o.phone === auth.userPhone || o.createdBy === auth.userPhone) return true
    return myDancerNames.some(n => o.name.toLowerCase().includes(n) || n.includes(o.name.toLowerCase()))
  })

  // Financial totals
  const histCollected = yearDinners.reduce((s, h) => s + h.collected, 0)
  const histExpense   = yearDinners.reduce((s, h) => s + h.expense, 0)
  const currCollected = dinner.attendees.filter(a => a.present === true && !a.isCook).reduce((s, a) => s + a.price, 0)
  const currExpense   = dinner.expenseAmount || 0
  const totalBalance  = (histCollected - histExpense) + (currCollected - currExpense)
  const totalCollected = histCollected + currCollected

  // Monthly chart data
  const monthlyCollected = Array(12).fill(0)
  const monthlyExpense   = Array(12).fill(0)
  yearDinners.forEach(h => { monthlyCollected[h.month-1] += h.collected; monthlyExpense[h.month-1] += h.expense })
  monthlyCollected[month] += currCollected
  monthlyExpense[month]   += currExpense

  const orderMonthOpen  = Array(12).fill(0)
  const orderMonthPaid  = Array(12).fill(0)
  visibleOrders.forEach(o => {
    if (!o.ts) return
    const m = new Date(o.ts).getMonth()
    if (new Date(o.ts).getFullYear() === year) {
      if (o.paid) orderMonthPaid[m] += (o.amount||0)
      else        orderMonthOpen[m] += (o.amount||0)
    }
  })

  useEffect(() => {
    charts.current.forEach(c => c?.destroy()); charts.current = []
    const months = t.months.short
    const opts = (ylabel = 'R$') => ({
      responsive: true,
      plugins: { legend: { labels: { font: { family: 'DM Sans', size: 11 } } } },
      scales: {
        y: { beginAtZero: true, ticks: { callback: (v: number) => ylabel + v.toFixed(0), font: { family: 'DM Sans', size: 10 } }, grid: { color: '#e8e4dc' } },
        x: { ticks: { font: { family: 'DM Sans', size: 10 } }, grid: { display: false } },
      },
    })
    if (ref1.current) charts.current.push(new Chart(ref1.current, {
      type: 'bar',
      data: { labels: months, datasets: [
        { label: t.dinner.collected, data: monthlyCollected, backgroundColor: '#3E200355', borderColor: '#3E2003', borderWidth: 1.5, borderRadius: 4 },
        { label: t.dinner.expense,   data: monthlyExpense,   backgroundColor: '#8B1A1A55', borderColor: '#8B1A1A', borderWidth: 1.5, borderRadius: 4 },
      ]},
      options: opts() as any,
    }))
    if (ref2.current) charts.current.push(new Chart(ref2.current, {
      type: 'bar',
      data: { labels: months, datasets: [
        { label: t.dinner.collected, data: monthlyCollected, backgroundColor: monthlyCollected.map((_,i) => i===month ? '#3E2003' : '#3E200366'), borderColor: '#3E2003', borderWidth: 1.5, borderRadius: 6 },
      ]},
      options: { ...opts(), plugins: { legend: { display: false } } } as any,
    }))
    if (ref3.current) charts.current.push(new Chart(ref3.current, {
      type: 'bar',
      data: { labels: months, datasets: [
        { label: t.orders.filterOpen, data: orderMonthOpen, backgroundColor: '#C9980A99', borderColor: '#C9980A', borderWidth: 1.5, borderRadius: 4 },
        { label: t.orders.filterPaid, data: orderMonthPaid, backgroundColor: '#2d6b1888', borderColor: '#2d6b18', borderWidth: 1.5, borderRadius: 4 },
      ]},
      options: opts() as any,
    }))
    return () => { charts.current.forEach(c => c?.destroy()); charts.current = [] }
  }, [JSON.stringify(monthlyCollected), JSON.stringify(monthlyExpense), JSON.stringify(orderMonthOpen)])

  if (!auth.canDash() && !auth.isGuardian()) return <div className="empty-state">{t.app.noPermission}</div>

  const showWallet    = auth.isSuper() || auth.isBoard() || auth.isCoordination() || auth.isSecretariat() || auth.isGuardian()
  const showFinancial = auth.isSuper() || auth.isBoard() || auth.isTreasury() || auth.isCoordination()

  // Wallet alerts (expiring within 90 days)
  const walletAlerts = myDancers
    .filter(d => d.walletExpiry)
    .map(d => { const ws = walletStatus(d.walletExpiry); return ws && ws.days <= 90 ? { ...d, ws } : null })
    .filter(Boolean)
    .sort((a: any, b: any) => a.ws.days - b.ws.days) as any[]

  // Expired wallets
  const expiredWallets = myDancers.filter(d => { const ws = walletStatus(d.walletExpiry); return ws && ws.days < 0 })

  return (
    <div>
      {/* Wallet alerts */}
      {showWallet && walletAlerts.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--dtg-red)', marginBottom: '1rem' }}>
          <div className="card-label" style={{ color: 'var(--dtg-red)' }}>{t.dashboard.walletAlerts}</div>
          {walletAlerts.map((d: any, i: number) => {
            const { days } = d.ws
            const status = t.dashboard.expiresIn(days)
            const expired = days < 0
            const bg  = expired ? 'var(--dtg-red)' : days <= 30 ? 'var(--red-bg)'  : days <= 60 ? '#fff3e0' : 'var(--amber-bg)'
            const col = expired ? '#fff'            : days <= 30 ? 'var(--dtg-red)' : days <= 60 ? '#A84000' : 'var(--amber-tx)'
            const dtStr = d.walletExpiry ? new Date(d.walletExpiry+'T12:00:00').toLocaleDateString('pt-BR') : ''
            return (
              <div key={i} className="cart-alerta-row">
                <div style={{ width:32, height:32, borderRadius:'50%', background:bg, color:col, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>🎫</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:500, fontSize:13 }}>{d.name}</div>
                  {(d.guardian1Name || d.guardian2Name) && (
                    <div style={{ fontSize:11, color:'var(--blue-tx)', marginBottom:1 }}>
                      👤 {[d.guardian1Name, d.guardian2Name].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{d.walletNumber||''} · {t.wallet.expiry_label} {dtStr}</div>
                </div>
                <span style={{ fontSize:11, padding:'3px 8px', borderRadius:20, fontWeight:600, background:bg, color:col, whiteSpace:'nowrap' }}>{status}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* KPIs */}
      <div className="dash-kpis">
        {!auth.isGuardian() && (
          <div className="dash-kpi">
            <div className="dash-kpi-val">{yearDinners.length}</div>
            <div className="dash-kpi-lbl">{t.dashboard.dinnersYear(year)}</div>
          </div>
        )}
        <div className="dash-kpi">
          <div className="dash-kpi-val">{myDancers.length}</div>
          <div className="dash-kpi-lbl">🕺 {auth.isGuardian() ? t.dashboard.myDancers : t.dashboard.allDancers}</div>
        </div>
        {!auth.isGuardian() && (
          <>
            <div className="dash-kpi">
              <div className="dash-kpi-val" style={{ color: totalBalance >= 0 ? 'var(--green-tx)' : 'var(--red-tx)' }}>
                R${formatCurrency(Math.abs(totalBalance))}
              </div>
              <div className="dash-kpi-lbl">{t.dashboard.accumulated}</div>
              <div className="dash-kpi-sub" style={{ color: totalBalance >= 0 ? 'var(--green-tx)' : 'var(--red-tx)' }}>
                {totalBalance >= 0 ? t.dashboard.positive : t.dashboard.negative}
              </div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-val">R${formatCurrency(totalCollected)}</div>
              <div className="dash-kpi-lbl">{t.dashboard.totalCollected}</div>
            </div>
          </>
        )}
      </div>

      {/* Financial charts */}
      {showFinancial && (
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-label">{t.dashboard.chartCollectedVsExpense}</div>
            <canvas ref={ref1} height={200} />
          </div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-label">
              {t.dashboard.chartMonthly(year)}
            </div>
            <canvas ref={ref2} height={180} />
          </div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-label">{t.dashboard.chartOrders}</div>
            <canvas ref={ref3} height={160} />
          </div>
        </>
      )}

      {/* Expired wallets card */}
      {showWallet && expiredWallets.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--dtg-red)' }}>
          <div className="card-label" style={{ color: 'var(--dtg-red)' }}>
            {t.dashboard.expiredWallets(expiredWallets.length)}
          </div>
          {expiredWallets.map((d, i) => (
            <div key={i} className="cart-alerta-row">
              <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--red-bg)', color:'var(--dtg-red)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>🎫</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:500, fontSize:13 }}>{d.name}</div>
                {(d.guardian1Name || d.guardian2Name) && (
                  <div style={{ fontSize:11, color:'var(--blue-tx)', marginBottom:1 }}>
                    👤 {[d.guardian1Name, d.guardian2Name].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div style={{ fontSize:11, color:'var(--muted)' }}>
                  {d.walletNumber||'—'} · {t.wallet.expiry_label} {d.walletExpiry ? new Date(d.walletExpiry+'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                </div>
              </div>
              <span style={{ fontSize:11, padding:'3px 8px', borderRadius:20, fontWeight:600, background:'var(--dtg-red)', color:'#fff', whiteSpace:'nowrap' }}>
                {t.wallet.status(-1)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Dinners realized */}
      {!auth.isGuardian() && (
        <div className="card">
          <div className="card-label">{t.dashboard.dinnersRealized}</div>
          {yearDinners.length === 0
            ? <p className="empty-state">{t.dashboard.noneArchived(year)}</p>
            : [...yearDinners].sort((a,b) => (b.ts||0)-(a.ts||0)).map((h, i, arr) => {
                const balance = (h.collected||0) - (h.expense||0)
                return (
                  <div key={h.id} className="dash-janta-row" style={i===arr.length-1?{borderBottom:'none'}:{}}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:500 }}>{h.eventDate}</div>
                      <div style={{ fontSize:11, color:'var(--muted)' }}>{h.organizer}</div>
                    </div>
                    <div style={{ textAlign:'right', fontSize:12, whiteSpace:'nowrap', flexShrink:0 }}>
                      <div style={{ color:'var(--green-tx)' }}>▲ R${formatCurrency(h.collected||0)}</div>
                      <div style={{ color:'var(--muted)' }}>▼ R${formatCurrency(h.expense||0)}</div>
                      <div style={{ color: balance>=0?'var(--green-tx)':'var(--red-tx)' }}>= R${formatCurrency(Math.abs(balance))}</div>
                    </div>
                  </div>
                )
              })}
        </div>
      )}
    </div>
  )
}
