import { useState, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n'
import { AppState } from '../App'
import { Dancer, initials, cleanPhone, formatPhone, groupLabel } from '../lib/store'
import { validatePhone, focusFirstInvalid } from '../lib/validation'

interface Props { state: AppState; mutDancas: (d: Record<string, Dancer>) => void; mutLog: (l: any) => void; [k: string]: any }

const PAGE_SIZE = 15

export function PaisTab({ state, mutDancas, mutLog }: Props) {
  const auth = useAuth()
  const { t } = useTranslation()
  if (!auth.canDancas()) return <div className="empty-state">{t.app.noPermission}</div>

  const dancers = state.dancers
  const [search,   setSearch]   = useState('')
  const [page,     setPage]     = useState(0)
  const [editing,  setEditing]  = useState<{ key: string; name: string; phone: string; type: string } | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  type Guardian = {
    key: string; name: string; phone: string; type: string
    dancers: { id: string; name: string; group: string; groups?: string[] }[]
  }

  const guardiansMap: Record<string, Guardian> = {}

  Object.values(dancers).forEach(d => {
    const add = (name: string, phone: string, type: string) => {
      const key = cleanPhone(phone) || name.toLowerCase()
      if (!key) return
      if (!guardiansMap[key]) guardiansMap[key] = { key, name, phone: cleanPhone(phone), type, dancers: [] }
      if (!guardiansMap[key].dancers.find(x => x.id === d.id)) {
        guardiansMap[key].dancers.push({ id: d.id, name: d.name, group: d.group, groups: d.groups })
      }
    }
    if (d.guardian1Name?.trim()) add(d.guardian1Name, d.guardian1Phone, t.guardians.types['Responsável 1'])
    if (d.guardian2Name?.trim()) add(d.guardian2Name, d.guardian2Phone, t.guardians.types['Responsável 2'])
    d.extraContacts?.forEach(c => { if (c.name?.trim()) add(c.name, c.phone, t.guardians.types[c.type] || c.type) })
  })

  const guardians = Object.values(guardiansMap)
    .filter(g => {
      if (!search) return true
      const q = search.toLowerCase()
      return g.name.toLowerCase().includes(q) || g.phone.includes(q) ||
        g.dancers.some(d => d.name.toLowerCase().includes(q))
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const totalPages = Math.ceil(guardians.length / PAGE_SIZE)
  const pageGuardians = guardians.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const saveEdit = () => {
    if (!editing) return
    const newName  = editing.name.trim()
    const newPhone = cleanPhone(editing.phone)
    if (!newName) {
      setTimeout(() => focusFirstInvalid(formRef), 50)
      return
    }
    if (editing.phone && !validatePhone(newPhone)) {
      setTimeout(() => focusFirstInvalid(formRef), 50)
      return
    }
    const updated = { ...dancers }
    Object.values(updated).forEach(d => {
      let changed = false
      const nd = { ...d }
      if (cleanPhone(nd.guardian1Phone) === editing.key || nd.guardian1Name?.toLowerCase() === editing.key) {
        nd.guardian1Name = newName; if (newPhone) nd.guardian1Phone = newPhone; changed = true
      }
      if (cleanPhone(nd.guardian2Phone) === editing.key || nd.guardian2Name?.toLowerCase() === editing.key) {
        nd.guardian2Name = newName; if (newPhone) nd.guardian2Phone = newPhone; changed = true
      }
      if (changed) updated[d.id] = nd
    })
    mutDancas(updated)
    mutLog({ type: 'super', action: 'Responsável editado', actor: auth.userName ?? '', diff: { before: guardiansMap[editing.key]?.name ?? '', after: newName } })
    setEditing(null)
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <input className="search-box" placeholder={t.guardians.search}
          value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
          style={{ marginBottom: 0 }} />
      </div>

      {guardians.length === 0 && (
        <p className="empty-state">{t.guardians.noneFound}</p>
      )}

      {pageGuardians.map(g => (
        <div key={g.key} className="dancer-row" style={{ cursor:"pointer" }} onClick={() => setEditing({ key: g.key, name: g.name, phone: g.phone, type: g.type })}>
          <div className="dancer-avatar" style={{ background: 'var(--blue-bg)', color: 'var(--blue-tx)' }}>
            {initials(g.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="dancer-nome">{g.name}</div>
            <div className="dancer-sub">
              {g.type}{g.phone && <> · 📱 {formatPhone(g.phone)}</>}
            </div>
            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {g.dancers.map(d => (
                <span key={d.id} style={{ fontSize: 11, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '2px 8px', color: 'var(--muted)' }}>
                  {d.name} · {(d.groups && d.groups.length > 1 ? d.groups : [d.group]).map(groupLabel).join(', ')}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {g.phone && (
              <a href={`tel:${g.phone}`} className="btn btn-sm" style={{ textDecoration: 'none' }} onClick={e => e.stopPropagation()}>📞</a>
            )}
            <button className="btn btn-sm"
              onClick={() => setEditing({ key: g.key, name: g.name, phone: g.phone, type: g.type })}>
              ✏️
            </button>
          </div>
        </div>
      ))}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: '1rem', flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}>
            {t.app.pagePrev}
          </button>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t.app.pageOf(page+1, totalPages)}</span>
          <button className="btn btn-sm" onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page===totalPages-1}>
            {t.app.pageNext}
          </button>
        </div>
      )}

      <div style={{ marginTop: '1rem', padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--r-sm)', fontSize: 13, color: 'var(--muted)' }}>
        ℹ️ {t.guardians.infoNote(guardians.length)}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="overlay" onClick={() => setEditing(null)}>
          <div className="sheet" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">{t.guardians.editGuardian}</span>
              <button className="sheet-close" onClick={() => setEditing(null)}>×</button>
            </div>
            <div className="sheet-body" ref={formRef}>
              <div className="form-group">
                <label className="form-label">{t.guardians.nameLabel}</label>
                <input className="form-input" type="text" value={editing.name}
                  onChange={e => setEditing({...editing, name: e.target.value})} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">{t.guardians.phoneLabel}</label>
                <input className="form-input" type="tel" value={editing.phone}
                  onChange={e => setEditing({...editing, phone: e.target.value})} maxLength={15} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{t.guardians.editNote}</p>
            </div>
            <div className="sheet-footer">
              <button className="btn" onClick={() => setEditing(null)}>{t.app.cancel}</button>
              <button className="btn btn-primary" onClick={saveEdit}>{t.app.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
