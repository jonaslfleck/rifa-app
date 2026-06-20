import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n'
import { AppState } from '../App'
import { AuditLog } from '../lib/store'

type FilterKey = 'all' | 'super' | 'organizer' | 'guardian' | 'deleted'
const PAGE_SIZE = 50

interface Props { state: AppState; mutClearLogs: () => void; db: any; [k: string]: any }

export function LogsTab({ state, mutClearLogs, db }: Props) {
  const auth = useAuth()
  const { t } = useTranslation()
  if (!auth.canLogs()) return <div className="empty-state">{t.app.noPermission}</div>

  const [filter, setFilter] = useState<FilterKey>('all')
  const [page,   setPage]   = useState(0)
  const logs = state.auditLogs

  const filtered = logs.filter(l => {
    if (filter === 'all')     return true
    if (filter === 'super')   return l.type === 'super'
    if (filter === 'organizer')     return l.type === 'organizer'
    if (filter === 'guardian')return l.type === 'guardian'
    if (filter === 'deleted') return (l.action||'').toLowerCase().match(/remov|exclu|arquiv/)
    return true
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const logClass = (l: AuditLog) => {
    const a = (l.action||'').toLowerCase()
    if (a.match(/remov|exclu|estorn/)) return 'log-item log-delete'
    if (l.type === 'super')            return 'log-item log-super'
    if (l.type === 'organizer')              return 'log-item log-org'
    return 'log-item log-pai'
  }

  const FILTERS: [FilterKey, string][] = [
    ['all',      t.logs.filterAll],
    ['super',    t.logs.filterTeam],
    ['organizer',      t.logs.filterOrganizer],
    ['guardian', t.logs.filterGuardian],
    ['deleted',  t.logs.filterDeleted],
  ]

  return (
    <div>
      <div className="log-filters">
        {FILTERS.map(([f, label]) => (
          <button key={f} className={`log-filter ${filter===f?'active':''}`}
            onClick={() => { setFilter(f); setPage(0) }}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <p className="empty-state">{t.logs.none}</p>}

      {pageItems.map(l => (
        <div key={l.id} className={logClass(l)}>
          <strong>{l.action}</strong> — <span style={{ opacity: .8 }}>{l.actor}</span>
          {l.diff && (
            <div className="log-diff">
              <span style={{ color: 'var(--red-tx)' }}>− {l.diff.before}</span>
              {'  '}
              <span style={{ color: 'var(--green-tx)' }}>+ {l.diff.after}</span>
            </div>
          )}
          <div className="log-time">
            {new Date(l.ts).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' })}
          </div>
        </div>
      ))}

      {totalPages > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:'1rem', flexWrap:'wrap' }}>
          <button className="btn btn-sm" onClick={() => setPage(p => Math.max(0,p-1))} disabled={page===0}>{t.app.pagePrev}</button>
          <span style={{ fontSize:13, color:'var(--muted)' }}>{t.app.pageOf(page+1, totalPages)} ({filtered.length})</span>
          <button className="btn btn-sm" onClick={() => setPage(p => Math.min(totalPages-1,p+1))} disabled={page===totalPages-1}>{t.app.pageNext}</button>
        </div>
      )}

      {logs.length > 0 && (
        <button className="btn btn-danger no-print" style={{ marginTop: '.5rem' }}
          onClick={() => { if (confirm(t.logs.confirmClear)) mutClearLogs() }}>
          {t.logs.clearLogs}
        </button>
      )}
    </div>
  )
}
