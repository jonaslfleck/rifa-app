import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n'
import { AppState } from '../App'
import { DinnerEvent, HistoryEntry, Order, formatCurrency, cleanPhone } from '../lib/store'

const PAGE_SIZE = 25

interface Props {
  state: AppState
  mutDinner: (u: Partial<DinnerEvent>) => DinnerEvent
  mutHistory: (h: Record<string, HistoryEntry>) => void
  mutOrders: (o: Record<string, Order>) => void
  mutLog: (l: any) => void
  db: any
  [k: string]: any
}

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX', dinheiro: 'Dinheiro', cartao_debito: 'Débito', cartao_credito: 'Crédito',
}

export default function CashRegisterTab({ state, mutDinner, mutHistory, mutOrders, mutLog, db }: Props) {
  const auth = useAuth()
  const { t } = useTranslation()
  if (!auth.canCaixa()) return <div className="empty-state">{t.app.noPermission}</div>

  const [subTab, setSubTab] = useState<'dinner'|'orders'>('dinner')
  const [showArchive, setShowArchive] = useState(false)
  const [orderSearch, setOrderSearch] = useState('')
  const [orderFilter, setOrderFilter] = useState<'open'|'paid'|'all'>('open')
  const [orderPage,   setOrderPage]   = useState(0)
  const [showPay,     setShowPay]     = useState<string|null>(null)
  const [payMethod,   setPayMethod]   = useState('')
  const [payNotes,    setPayNotes]    = useState('')

  const dinner  = state.dinner
  const history = state.history
  const orders  = state.orders

  const attendees = dinner.attendees
  const present   = attendees.filter(a => a.present === true)
  const collected = present.filter(a => !a.isCook).reduce((s, a) => s + a.price, 0)
  const balance   = collected - (dinner.expenseAmount || 0)

  const togglePresence = (idx: number, val: boolean | null) => {
    const updated = attendees.map((a, i) => i === idx ? { ...a, present: val } : a)
    mutDinner({ attendees: updated })
  }

  const archive = () => {
    const id   = 'h' + Date.now()
    const now  = new Date()
    const entry: HistoryEntry = {
      id,
      title:         dinner.title,
      eventDate:     dinner.eventDate,
      organizer:     dinner.organizer,
      type:          dinner.isDonation ? 'Doação' : 'Turma',
      attendeeCount: attendees.length,
      presentCount:  present.length,
      collected,
      expense:       dinner.expenseAmount || 0,
      expenseDesc:   dinner.expenseDesc   || '',
      menu:          dinner.menu          || [],
      ts:            now.getTime(),
      month:         now.getMonth() + 1,
      year:          now.getFullYear(),
    }
    db.saveHistoryEntry(entry, history).catch(() => {
      // Fallback: já salvo local pelo mutHistory acima
    })
    mutHistory({ ...history, [id]: entry })
    mutDinner({ attendees: [], expenseAmount: 0, expenseDesc: '', closed: false, lockAt: '', title: 'Janta da Turma', eventDate: '' })
    mutLog({ type: 'super', action: 'Janta arquivada', actor: auth.userName ?? '', diff: { before: dinner.title, after: `Arquivada (R$${formatCurrency(collected)})` } })
    setShowArchive(false)
  }

  // Orders tab
  const filteredOrders = Object.values(orders)
    .filter(o => {
      if (orderFilter === 'open') return !o.paid
      if (orderFilter === 'paid') return  o.paid
      return true
    })
    .filter(o => {
      if (!orderSearch) return true
      const q = orderSearch.toLowerCase()
      return o.name.toLowerCase().includes(q) || o.description.toLowerCase().includes(q)
    })
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))

  const totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE)
  const pageOrders = filteredOrders.slice(orderPage * PAGE_SIZE, (orderPage + 1) * PAGE_SIZE)
  const openTotal  = filteredOrders.filter(o => !o.paid).reduce((s, o) => s + o.amount, 0)

  const payOrder = () => {
    if (!payMethod || !showPay) return
    const o = orders[showPay]
    if (!o) return
    mutOrders({ ...orders, [showPay]: { ...o, paid: true, paymentMethod: payMethod, paymentNotes: payNotes.trim() } })
    mutLog({ type: 'super', action: 'Comanda paga', actor: auth.userName ?? '', diff: { before: o.name, after: `R$${formatCurrency(o.amount)} via ${payMethod}` } })
    setShowPay(null); setPayMethod(''); setPayNotes('')
  }

  const reverseOrder = (id: string) => {
    const o = orders[id]
    if (!confirm(`Estornar R$${formatCurrency(o.amount)} de ${o.name}?`)) return
    mutOrders({ ...orders, [id]: { ...o, paid: false, paymentMethod: undefined } })
  }

  const deleteOrder = (id: string) => {
    const o = orders[id]
    if (!confirm(`Excluir comanda de ${o.name}?`)) return
    const updated = { ...orders }; delete updated[id]; mutOrders(updated)
  }

  return (
    <div>
      {/* Summary */}
      <div className="dash-kpis" style={{ marginBottom:'1rem' }}>
            <div className="dash-kpi">
              <div className="dash-kpi-val">{attendees.length}</div>
              <div className="dash-kpi-lbl">{t.dinner.confirmed}</div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-val">{present.length}</div>
              <div className="dash-kpi-lbl">{t.checkIn.attended}</div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-val">R${formatCurrency(collected)}</div>
              <div className="dash-kpi-lbl">{t.dinner.collected}</div>
            </div>
            <div className="dash-kpi">
              <div className="dash-kpi-val" style={{ color: balance >= 0 ? 'var(--green-tx)' : 'var(--red-tx)' }}>
                R${formatCurrency(Math.abs(balance))}
              </div>
              <div className="dash-kpi-lbl">{t.checkIn.balance}</div>
            </div>
          </div>

          {/* Attendees */}
          {attendees.map((a, i) => (
            <div key={i} className="dancer-row">
              <div style={{ flex:1, minWidth:0 }}>
                <div className="dancer-nome">{a.isCook ? '👨‍🍳 ' : ''}{a.name}</div>
                <div className="dancer-sub">{a.priceLabel} · R${formatCurrency(a.price)}</div>
              </div>
              <div style={{ display:'flex', gap:4 }}>
                <button className={`btn btn-sm ${a.present===true?'btn-primary':''}`} onClick={() => togglePresence(i, a.present===true ? null : true)}>✓</button>
                <button className={`btn btn-sm ${a.present===false?'btn-danger':''}`} onClick={() => togglePresence(i, a.present===false ? null : false)}>✗</button>
              </div>
            </div>
          ))}

          {attendees.length === 0 && <p className="empty-state">Nenhum inscrito.</p>}

          <button className="btn btn-danger btn-block" style={{ marginTop:'1rem' }}
            onClick={() => setShowArchive(true)}>
            {t.dinner.archiveDinner}
          </button>

      {/* Archive confirm */}
      {showArchive && (
        <div className="overlay" onClick={() => setShowArchive(false)}>
          <div className="sheet" style={{ maxWidth:380 }} onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">{t.dinner.archiveDinner}</span>
              <button className="sheet-close" onClick={() => setShowArchive(false)}>×</button>
            </div>
            <div className="sheet-body">
              <p className="sheet-sub">{t.dinner.archiveConfirm}</p>
              <div className="dash-kpis" style={{ marginTop:8 }}>
                <div className="dash-kpi"><div className="dash-kpi-val">{attendees.length}</div><div className="dash-kpi-lbl">Inscritos</div></div>
                <div className="dash-kpi"><div className="dash-kpi-val">{present.length}</div><div className="dash-kpi-lbl">Presentes</div></div>
                <div className="dash-kpi"><div className="dash-kpi-val">R${formatCurrency(collected)}</div><div className="dash-kpi-lbl">Arrecadado</div></div>
              </div>
            </div>
            <div className="sheet-footer">
              <button className="btn" onClick={() => setShowArchive(false)}>{t.app.cancel}</button>
              <button className="btn btn-danger" onClick={archive}>{t.dinner.archiveDinner}</button>
            </div>
          </div>
        </div>
      )}

      {/* Pay sheet */}
      {showPay && orders[showPay] && (
        <div className="overlay" onClick={() => setShowPay(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">{t.orders.payOrder}</span>
              <button className="sheet-close" onClick={() => setShowPay(null)}>×</button>
            </div>
            <div className="sheet-body">
              {(() => { const o = orders[showPay!]; return (
                <>
                  <div style={{ background:'var(--bg)', borderRadius:8, padding:12, marginBottom:'1rem', fontSize:14 }}>
                    <strong>{o.name}</strong><br />{o.description} · <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:18 }}>R${formatCurrency(o.amount)}</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.orders.paymentMethod}</label>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      {[['pix',t.orders.pix],['dinheiro',t.orders.cash],['cartao_debito',t.orders.debit],['cartao_credito',t.orders.credit]].map(([v,label]) => (
                        <button key={v} className={`forma-pgto-btn ${payMethod===v?'selected':''}`} onClick={() => setPayMethod(v)}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.orders.obsLabel}</label>
                    <input className="form-input" type="text" placeholder={t.orders.obsPlaceholder} value={payNotes} onChange={e => setPayNotes(e.target.value)} />
                  </div>
                </>
              )})()}
            </div>
            <div className="sheet-footer">
              <button className="btn" onClick={() => setShowPay(null)}>{t.app.cancel}</button>
              <button className="btn btn-primary" onClick={payOrder}>{t.orders.confirmPayment}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
