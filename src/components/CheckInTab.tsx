import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n'
import { AppState } from '../App'
import { DinnerEvent, HistoryEntry, formatCurrency } from '../lib/store'

interface Props {
  state: AppState
  mutDinner: (u: Partial<DinnerEvent>) => DinnerEvent
  mutHistory: (h: Record<string, HistoryEntry>) => void
  mutLog: (l: any) => void
  [k: string]: any
}

export function CheckInTab({ state, mutDinner, mutHistory, mutLog }: Props) {
  const auth = useAuth()
  const { t } = useTranslation()
  if (!auth.canCaixa()) return <div className="empty-state">{t.app.noPermission}</div>

  const [search, setSearch] = useState('')
  const dinner   = state.dinner
  const attendees = dinner.attendees

  const filtered = attendees.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase())
  )

  const present  = attendees.filter(a => a.present === true)
  const absent   = attendees.filter(a => a.present === false)
  const collected = present.filter(a => !a.isCook).reduce((s, a) => s + a.price, 0)
  const balance   = collected - (dinner.expenseAmount || 0)

  const toggle = (idx: number, val: boolean | null) => {
    const updated = attendees.map((a, i) => i === idx ? { ...a, present: val } : a)
    mutDinner({ attendees: updated })
  }

  const allPresentIdx = attendees.reduce((acc, a, i) => {
    const fi = filtered.indexOf(a)
    if (fi >= 0) acc.push(i)
    return acc
  }, [] as number[])

  const markAll = (val: boolean | null) => {
    const updated = attendees.map((a, i) =>
      allPresentIdx.includes(i) ? { ...a, present: val } : a
    )
    mutDinner({ attendees: updated })
  }

  return (
    <div>
      {/* Summary */}
      <div className="dash-kpis" style={{ marginBottom: '1rem' }}>
        <div className="dash-kpi">
          <div className="dash-kpi-val">{attendees.length}</div>
          <div className="dash-kpi-lbl">{t.checkIn.confirmed}</div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-val" style={{ color: 'var(--green-tx)' }}>{present.length}</div>
          <div className="dash-kpi-lbl">{t.checkIn.attended}</div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-val" style={{ color: 'var(--red-tx)' }}>{absent.length}</div>
          <div className="dash-kpi-lbl">Ausentes</div>
        </div>
        <div className="dash-kpi">
          <div className="dash-kpi-val">R${formatCurrency(collected)}</div>
          <div className="dash-kpi-lbl">{t.checkIn.collected}</div>
        </div>
        {dinner.expenseAmount > 0 && (
          <div className="dash-kpi">
            <div className="dash-kpi-val" style={{ color: balance >= 0 ? 'var(--green-tx)' : 'var(--red-tx)' }}>
              R${formatCurrency(Math.abs(balance))}
            </div>
            <div className="dash-kpi-lbl">{balance >= 0 ? t.checkIn.balance + ' +' : t.checkIn.balance + ' −'}</div>
          </div>
        )}
      </div>

      {/* Search + bulk actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <input className="search-box" placeholder={t.checkIn.search}
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, marginBottom: 0, minWidth: 140 }} />
        <button className="btn btn-sm" onClick={() => markAll(true)}>✓ Todos</button>
        <button className="btn btn-sm" onClick={() => markAll(null)}>— Reset</button>
      </div>

      {filtered.length === 0 && <p className="empty-state">{t.checkIn.noneFound}</p>}

      {filtered.map(a => {
        const idx = attendees.indexOf(a)
        return (
          <div key={idx} className="dancer-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="dancer-nome">{a.isCook ? '👨‍🍳 ' : ''}{a.name}</div>
              <div className="dancer-sub">{a.priceLabel} · R${formatCurrency(a.price)}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                className={`btn btn-sm ${a.present === true ? 'btn-primary' : ''}`}
                style={{ minWidth: 36 }}
                onClick={() => toggle(idx, a.present === true ? null : true)}>
                ✓
              </button>
              <button
                className={`btn btn-sm ${a.present === false ? 'btn-danger' : ''}`}
                style={{ minWidth: 36 }}
                onClick={() => toggle(idx, a.present === false ? null : false)}>
                ✗
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
