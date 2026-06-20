import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n'
import { AppState } from '../App'
import {
  BirthdayExtra, Dancer, AppUser,
  daysUntilBirthday, birthdayAge, groupLabel, initials, GROUPS,
} from '../lib/store'

const PAGE_SIZE = 30

interface Props {
  state: AppState
  mutBirthdayExtras: (e: BirthdayExtra[]) => void
  mutLog: (l: any) => void
  [k: string]: any
}

type BdEntry = {
  name: string; birthDate: string; type: 'dancer'|'family'|'team'
  group: string; groups: string[]; days: number; age: number | null
}

export function BirthdaysTab({ state, mutBirthdayExtras, mutLog }: Props) {
  const auth = useAuth()
  const { t } = useTranslation()
  if (!auth.canAniv()) return <div className="empty-state">{t.app.noPermission}</div>

  const [filter, setFilter] = useState<'all'|'today'|'week'|'month'|'dancer'|'family'|'team'>('all')
  const [page, setPage] = useState(0)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<Partial<BirthdayExtra>>({})
  const [err, setErr] = useState('')

  const dancers = state.dancers
  const users   = state.users
  const extras  = state.birthdayExtras

  // Build list from all sources
  const entries: BdEntry[] = []

  Object.values(dancers).filter(d => !d.inactive && d.birthDate).forEach(d => {
    entries.push({ name: d.name, birthDate: d.birthDate, type: 'dancer', group: d.group, groups: d.groups, days: daysUntilBirthday(d.birthDate), age: birthdayAge(d.birthDate) })
    // Guardian family birthdays via extraContacts
    d.extraContacts.filter(c => c.birthDate).forEach(c => {
      entries.push({ name: c.name, birthDate: c.birthDate!, type: 'family', group: d.group, groups: d.groups, days: daysUntilBirthday(c.birthDate!), age: birthdayAge(c.birthDate!) })
    })
  })

  Object.values(users).filter(u => u.birthDate).forEach(u => {
    entries.push({ name: u.name, birthDate: u.birthDate!, type: 'team', group: '', groups: [], days: daysUntilBirthday(u.birthDate!), age: birthdayAge(u.birthDate!) })
  })

  extras.filter(e => e.birthDate).forEach(e => {
    const t2 = e.type === 'dancer' ? 'dancer' : e.type === 'team' ? 'team' : 'family'
    entries.push({ name: e.name, birthDate: e.birthDate, type: t2, group: e.group, groups: e.groups, days: daysUntilBirthday(e.birthDate), age: birthdayAge(e.birthDate) })
  })

  const filtered = entries.filter(e => {
    if (filter === 'today')  return e.days === 0
    if (filter === 'week')   return e.days >= 0 && e.days <= 7
    if (filter === 'month')  return e.days >= 0 && e.days <= 30
    if (filter === 'dancer') return e.type === 'dancer'
    if (filter === 'family') return e.type === 'family'
    if (filter === 'team')   return e.type === 'team'
    return true
  }).sort((a, b) => a.days - b.days)

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageItems  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const saveExtra = () => {
    setErr('')
    if (!addForm.name?.trim())     { setErr('Nome obrigatório.'); return }
    if (!addForm.birthDate?.trim()){ setErr('Data obrigatória.'); return }
    const entry: BirthdayExtra = {
      name:      addForm.name.trim(),
      birthDate: addForm.birthDate,
      type:      addForm.type || 'family',
      group:     addForm.group || '',
      groups:    addForm.groups || [],
    }
    mutBirthdayExtras([...extras, entry])
    mutLog({ type: 'organizer', action: 'Aniversário adicionado', actor: auth.userName ?? '', diff: { before: '—', after: entry.name } })
    setAddForm({}); setShowAdd(false)
  }

  const remove = (idx: number) => {
    if (!confirm(`Remover ${extras[idx]?.name}?`)) return
    mutBirthdayExtras(extras.filter((_, i) => i !== idx))
  }

  const typeBadge = (type: string) => ({
    dancer: { bg: 'var(--blue-bg)', color: 'var(--blue-tx)', label: 'Dançarino' },
    family: { bg: 'var(--amber-bg)', color: 'var(--amber-tx)', label: 'Familiar' },
    team:   { bg: 'var(--purple-bg)', color: 'var(--purple-tx)', label: 'Equipe' },
  }[type] ?? { bg: 'var(--bg)', color: 'var(--muted)', label: type })

  const FILTERS: [typeof filter, string][] = [
    ['all','all'], ['today','today'], ['week','week'], ['month','month'], ['dancer','dancer'], ['family','family'], ['team','team'],
  ].map(([k,v]) => [k as typeof filter, (t.birthdays as any)['filter' + v.charAt(0).toUpperCase() + v.slice(1)] ?? v])

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:'0.75rem', justifyContent:'flex-end' }}>
        <button className="btn btn-primary btn-sm" onClick={() => { setAddForm({}); setShowAdd(true) }}>
          + {t.app.add}
        </button>
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:'1rem', flexWrap:'wrap' }}>
        {FILTERS.map(([f, label]) => (
          <button key={f} className={`log-filter ${filter===f?'active':''}`}
            onClick={() => { setFilter(f); setPage(0) }}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <p className="empty-state">{t.birthdays.noneFound}</p>}

      {pageItems.map((e, i) => {
        const badge = typeBadge(e.type)
        const dtStr = new Date(e.birthDate + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'long' })
        const soon  = e.days === 0 ? t.birthdays.today : e.days <= 7 ? t.birthdays.thisWeek : e.days <= 30 ? t.birthdays.thisMonth : null
        return (
          <div key={i} className="dancer-row">
            <div className="dancer-avatar" style={{ background: badge.bg, color: badge.color }}>
              {initials(e.name)}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div className="dancer-nome">
                {e.name}
                {e.age !== null && <span style={{ fontSize:12, color:'var(--muted)', fontWeight:400 }}> · {e.age} anos</span>}
              </div>
              <div className="dancer-sub">
                🎂 {dtStr}
                {e.group && <span> · {groupLabel(e.group)}</span>}
              </div>
            </div>
            {soon && (
              <span style={{ fontSize:11, padding:'3px 8px', borderRadius:20, background: e.days===0?'var(--dtg-red)':'var(--green-bg)', color: e.days===0?'#fff':'var(--green-tx)', fontWeight:600, whiteSpace:'nowrap' }}>
                {soon}
              </span>
            )}
            <span className="turma-badge" style={{ background: badge.bg, color: badge.color }}>
              {badge.label}
            </span>
          </div>
        )
      })}

      {totalPages > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:'1rem' }}>
          <button className="btn btn-sm" onClick={() => setPage(p=>Math.max(0,p-1))} disabled={page===0}>{t.app.pagePrev}</button>
          <span style={{ fontSize:13, color:'var(--muted)' }}>{t.app.pageOf(page+1,totalPages)}</span>
          <button className="btn btn-sm" onClick={() => setPage(p=>Math.min(totalPages-1,p+1))} disabled={page===totalPages-1}>{t.app.pageNext}</button>
        </div>
      )}

      {showAdd && (
        <div className="overlay" onClick={() => setShowAdd(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">Adicionar aniversário</span>
              <button className="sheet-close" onClick={() => setShowAdd(false)}>×</button>
            </div>
            <div className="sheet-body">
              {err && <div className="error-box">{err}</div>}
              <div className="form-group"><label className="form-label">Nome *</label>
                <input className="form-input" type="text" value={addForm.name??''} onChange={e=>setAddForm({...addForm,name:e.target.value})} autoFocus /></div>
              <div className="form-group"><label className="form-label">Data de nascimento *</label>
                <input className="form-input" type="date" value={addForm.birthDate??''} onChange={e=>setAddForm({...addForm,birthDate:e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Tipo</label>
                <select className="form-input" value={addForm.type??'family'} onChange={e=>setAddForm({...addForm,type:e.target.value})}>
                  <option value="dancer">Dançarino</option>
                  <option value="family">Familiar</option>
                  <option value="team">Equipe</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Invernada</label>
                <select className="form-input" value={addForm.group??''} onChange={e=>setAddForm({...addForm,group:e.target.value})}>
                  <option value="">—</option>
                  {GROUPS.map(g => <option key={g} value={g}>{groupLabel(g)}</option>)}
                </select>
              </div>
            </div>
            <div className="sheet-footer">
              <button className="btn" onClick={() => setShowAdd(false)}>{t.app.cancel}</button>
              <button className="btn btn-primary" onClick={saveExtra}>{t.app.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
