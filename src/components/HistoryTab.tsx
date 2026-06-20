import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n'
import { AppState } from '../App'
import { HistoryEntry, formatCurrency } from '../lib/store'

const PAGE_SIZE = 10
interface Props { state: AppState; mutHist: (h: Record<string, HistoryEntry>) => void; mutLog: (l: any) => void; db: any; [k: string]: any }

export function HistTab({ state, mutHist, mutLog, db }: Props) {
  const auth = useAuth()
  const { t } = useTranslation()
  if (!auth.canHist()) return <div className="empty-state">{t.app.noPermission}</div>

  const [page, setPage] = useState(0)
  const history = state.history
  const sorted  = Object.values(history).sort((a, b) => (b.ts||0) - (a.ts||0))
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const pageItems  = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const exportTSV = (h: HistoryEntry) => {
    const balance = h.collected - h.expense
    const rows = [
      ['Relatório — ' + h.title], [''],
      ['Data:', h.eventDate], ['Organização:', h.organizer], [''],
      ['Confirmados:', String(h.attendeeCount)], ['Compareceram:', String(h.presentCount)], [''],
      ['Arrecadado:', String(h.collected)], ['Gasto:', String(h.expense)], ['Saldo:', String(balance)],
      [''], ['Gasto desc.:', h.expenseDesc||'—'],
      ['Gerado:', new Date().toLocaleString('pt-BR')],
    ]
    const csv  = rows.map(r => r.join('\t')).join('\n')
    const blob = new Blob([csv], { type: 'text/tab-separated-values;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `Janta ${h.eventDate}.tsv`.replace(/[/\\?%*:|"<>]/g, '')
    a.click(); URL.revokeObjectURL(url)
  }

  const exportAll = () => {
    if (!sorted.length) { alert(t.history.noneYet); return }
    const header = ['Data','Título','Org.','Confirmados','Presentes','Arrecadado','Gasto','Saldo']
    const rows = [header.join('\t'), ...sorted.map(h =>
      [h.eventDate, h.title, h.organizer, h.attendeeCount, h.presentCount, h.collected, h.expense, h.collected-h.expense].join('\t')
    )]
    const blob = new Blob([rows.join('\n')], { type: 'text/tab-separated-values;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'Histórico jantas DTG.tsv'
    a.click(); URL.revokeObjectURL(url)
  }

  const handleDelete = (id: string) => {
    if (!confirm(t.history.deleteConfirm)) return
    const updated = { ...history }; delete updated[id]
    db.removeHistoryEntry(id, history).catch(() => { mutHist(updated) })
    mutLog({ type: 'super', action: 'Histórico excluído', actor: auth.userName??'', diff: { before: history[id]?.eventDate??'', after: '—' } })
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: '1rem' }}>{t.history.subtitle}</p>
      {sorted.length > 0 && !auth.isGuardian() && (
        <div className="btn-row no-print" style={{ marginBottom: '1rem' }}>
          <button className="btn btn-teal" onClick={exportAll}>{t.history.exportAll}</button>
        </div>
      )}
      {sorted.length === 0 && <p className="empty-state">{t.history.noneYet}</p>}

      {pageItems.map(h => {
        const balance = (h.collected||0) - (h.expense||0)
        return (
          <div key={h.id} className="hist-item">
            <div className="hist-titulo">{h.title}</div>
            <div className="hist-data">📅 {h.eventDate}{h.organizer ? ` · 👨‍🍳 ${h.organizer}` : ''}</div>
            <div className="hist-nums">
              <div className="hist-num"><strong>{h.attendeeCount||0}</strong>{t.history.confirmed}</div>
              <div className="hist-num"><strong>{h.presentCount||0}</strong>{t.history.attended}</div>
              <div className="hist-num"><strong>R${formatCurrency(h.collected||0)}</strong>{t.history.collected}</div>
              <div className="hist-num"><strong>R${formatCurrency(h.expense||0)}</strong>{t.history.expense}</div>
              <div className="hist-num">
                <strong className={balance>=0?'hist-saldo-pos':'hist-saldo-neg'}>R${formatCurrency(Math.abs(balance))}</strong>
                <span className={balance>=0?'hist-saldo-pos':'hist-saldo-neg'}>
                  {balance >= 0 ? t.history.balancePlus : t.history.balanceMinus}
                </span>
              </div>
            </div>
            {h.expenseDesc && <div style={{ fontSize:12, color:'var(--muted)' }}>📝 {h.expenseDesc}</div>}
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={() => exportTSV(h)}>{t.history.exportSingle}</button>
              {auth.isSuper() && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(h.id)}>🗑️</button>}
            </div>
          </div>
        )
      })}

      {totalPages > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:'1rem', flexWrap:'wrap' }}>
          <button className="btn btn-sm" onClick={() => setPage(p => Math.max(0,p-1))} disabled={page===0}>{t.app.pagePrev}</button>
          <span style={{ fontSize:13, color:'var(--muted)' }}>{t.app.pageOf(page+1, totalPages)}</span>
          <button className="btn btn-sm" onClick={() => setPage(p => Math.min(totalPages-1,p+1))} disabled={page===totalPages-1}>{t.app.pageNext}</button>
        </div>
      )}
    </div>
  )
}
