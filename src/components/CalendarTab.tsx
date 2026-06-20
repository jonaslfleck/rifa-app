import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n'
import { AppState } from '../App'
import { CalendarEntry } from '../lib/store'

interface Props { state: AppState; mutCal: (c: Record<string, CalendarEntry>) => void; mutLog: (l: any) => void; [k: string]: any }

export default function CalTab({ state, mutCal, mutLog, db }: Props) {
  const auth = useAuth()
  const { t } = useTranslation()
  const calendar = state.calendar

  const [showNew,       setShowNew]       = useState(false)
  const [showEdit,      setShowEdit]      = useState(false)
  const [showPostpone,  setShowPostpone]  = useState(false)
  const [showBlock,     setShowBlock]     = useState(false)
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [newForm,       setNewForm]       = useState({ date: new Date().toISOString().slice(0,10), name: auth.userName??'', menu: '' })
  const [editForm,      setEditForm]      = useState({ date:'', menu:'', guardians:[] as string[], newGuardian:'' })
  const [postponeForm,  setPostponeForm]  = useState({ newDate:'', reason:'' })
  const [blockForm,     setBlockForm]     = useState({ date: new Date().toISOString().slice(0,10), reason:'Ensaio fechado' })
  const [err,           setErr]           = useState('')

  const today = new Date(); today.setHours(0,0,0,0)
  const entries = Object.values(calendar).sort((a,b) => a.date.localeCompare(b.date))

  const persist = async (cal: Record<string, CalendarEntry>, changed?: CalendarEntry[], deletedId?: string) => {
    mutCal(cal)
    if (db?.saveCalEntries && changed?.length) await db.saveCalEntries(changed, cal)
    else if (db?.saveCalEntry && changed?.length === 1) await db.saveCalEntry(changed[0], cal)
    if (db?.deleteCalEntry && deletedId) await db.deleteCalEntry(deletedId)
  }

  const saveNew = async () => {
    setErr('')
    if (!newForm.date)        { setErr(t.calendar.chooseDate);  return }
    if (!newForm.name.trim()) { setErr(t.calendar.nameRequired); return }
    const blocked = entries.find(e => e.date === newForm.date && e.blocked)
    if (blocked) { setErr(t.calendar.dateBlocked(blocked.blockReason || t.calendar.blockedDay)); return }
    const id = 'j' + Date.now()
    const entry: CalendarEntry = { id, date: newForm.date, guardians: [newForm.name.trim()], menu: newForm.menu.trim(), createdBy: auth.userPhone ?? auth.userName ?? '' }
    await persist({ ...calendar, [id]: entry }, [entry])
    mutLog({ type: auth.isSuper() ? 'super' : 'organizer', action: 'Janta proposta', actor: auth.userName??'', diff: { before:'—', after: new Date(newForm.date+'T12:00:00').toLocaleDateString('pt-BR') } })
    setShowNew(false)
  }

  const openEdit = (id: string) => {
    const e = calendar[id]; if (!e) return
    setEditingId(id); setErr('')
    setEditForm({ date: e.date, menu: e.menu??'', guardians:[...(e.guardians??[])], newGuardian:'' })
    setShowEdit(true)
  }

  const saveEdit = async () => {
    if (!editingId) return
    if (!editForm.date) { setErr(t.calendar.chooseDate); return }
    const orig = calendar[editingId]
    const updated: CalendarEntry = { ...orig, date: editForm.date, menu: editForm.menu, guardians: editForm.guardians }
    await persist({ ...calendar, [editingId]: updated }, [updated])
    mutLog({ type: auth.isSuper() ? 'super' : 'organizer', action: 'Janta editada', actor: auth.userName??'', diff: { before: orig?.date??'', after: editForm.date } })
    setShowEdit(false)
  }

  const removeEntry = async () => {
    if (!editingId || !confirm(t.calendar.confirmRemoveDate)) return
    const e = calendar[editingId]
    const updated = { ...calendar }; delete updated[editingId]
    await persist(updated, undefined, editingId)
    mutLog({ type: auth.isSuper() ? 'super' : 'organizer', action: 'Janta removida', actor: auth.userName??'', diff: { before: e?.date??'', after:'—' } })
    setShowEdit(false)
  }

  const joinAsGuardian = async (id: string) => {
    const e = calendar[id]; if (!e) return
    const name = auth.userName??''
    if (!name || e.guardians.includes(name)) { alert(t.calendar.alreadyGuardian); return }
    const updated: CalendarEntry = { ...e, guardians: [...e.guardians, name] }
    await persist({ ...calendar, [id]: updated }, [updated])
    mutLog({ type: auth.isSuper() ? 'super' : 'organizer', action: 'Entrou como responsável', actor: name, diff: { before:'—', after: new Date(e.date+'T12:00:00').toLocaleDateString('pt-BR') } })
  }

  const removeGuardian = async (entryId: string, idx: number) => {
    const e = calendar[entryId]; if (!e) return
    const guardians = [...e.guardians]; guardians.splice(idx,1)
    const updated: CalendarEntry = { ...e, guardians }
    await persist({ ...calendar, [entryId]: updated }, [updated])
  }

  const savePostpone = async () => {
    setErr('')
    if (!postponeForm.newDate) { setErr(t.calendar.newDateRequired); return }
    const future = entries.filter(e => !e.blocked && new Date(e.date+'T12:00:00') >= today).sort((a,b) => a.date.localeCompare(b.date))
    if (!future.length) { alert(t.calendar.noFutureDinners); return }
    const firstDt  = new Date(future[0].date+'T12:00:00')
    const newDt    = new Date(postponeForm.newDate+'T12:00:00')
    const delta    = Math.round((newDt.getTime() - firstDt.getTime()) / 86400000)
    if (delta <= 0) { setErr(t.calendar.dateMustBeLater); return }
    const updated  = { ...calendar }
    const changed: CalendarEntry[] = []
    future.forEach(e => {
      const dt = new Date(e.date+'T12:00:00'); dt.setDate(dt.getDate() + delta)
      const ne: CalendarEntry = { ...e, date: dt.toISOString().slice(0,10) }
      updated[e.id] = ne; changed.push(ne)
    })
    await persist(updated, changed)
    mutLog({ type:'super', action:'Jantas postergadas', actor:auth.userName??'', diff:{ before:`${future.length} jantas`, after:`+${delta} dias` } })
    setShowPostpone(false)
    alert(t.calendar.postponeSuccess(future.length, delta))
  }

  const saveBlock = async () => {
    if (!blockForm.date) { setErr(t.calendar.chooseDate); return }
    const id = 'b' + Date.now()
    const entry: CalendarEntry = { id, date: blockForm.date, guardians:[], menu:'', blocked:true, blockReason: blockForm.reason, createdBy: auth.userName??'' }
    await persist({ ...calendar, [id]: entry }, [entry])
    mutLog({ type:'super', action:'Dia bloqueado', actor:auth.userName??'', diff:{ before:'—', after: blockForm.date } })
    setShowBlock(false)
  }

  const removeBlock = async (id: string) => {
    if (!confirm(t.calendar.removeBlock + '?')) return
    const updated = { ...calendar }; delete updated[id]
    await persist(updated, undefined, id)
    mutLog({ type:'super', action:'Bloqueio removido', actor:auth.userName??'', diff:{ before: calendar[id]?.date??'', after:'—' } })
  }

  const canPostpone = auth.canPostergar()
  const tomorrow    = new Date(today.getTime() + 86400000).toISOString().slice(0,10)

  return (
    <div>
      {canPostpone && (
        <div style={{ display:'flex', gap:8, marginBottom:'1rem', flexWrap:'wrap' }}>
          <button className="btn btn-primary" style={{ flex:1 }} onClick={() => { setErr(''); setShowPostpone(true) }}>
            {t.calendar.postpone}
          </button>
          <button className="btn" style={{ flex:1 }} onClick={() => { setErr(''); setShowBlock(true) }}>
            {t.calendar.blockDay}
          </button>
        </div>
      )}

      {entries.length === 0 && <div className="empty-state">{t.calendar.noDinners}</div>}

      {entries.map(e => {
        const dt     = new Date(e.date+'T12:00:00')
        const past   = dt < today
        const soon   = !past && (dt.getTime() - today.getTime()) < 8 * 86400000
        const dtStr  = dt.toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' })
        const amGuardian = e.guardians.includes(auth.userName??'')
        const canEdit    = auth.isSuper() || auth.isBoard() || auth.isCoordination() ||
          (e.createdBy === auth.userPhone && (auth.isGuardian() || auth.isOrganizer())) ||
          (e.createdBy === auth.userName  && (auth.isGuardian() || auth.isOrganizer()))
        return (
          <div key={e.id} className={`cal-item ${e.blocked?'bloqueado':''}`}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <div className="cal-date">
                  {dtStr.charAt(0).toUpperCase() + dtStr.slice(1)}
                  {e.blocked && <span className="cal-blocked-badge">{t.calendar.blockedDay}</span>}
                </div>
                <div className="cal-date-sub">{t.calendar.guardiansLabel}</div>
              </div>
              <span className={`cal-badge ${soon?'badge-ativa':past?'badge-passada':'badge-futura'}`}>
                {soon ? t.calendar.soon : past ? t.calendar.past : t.calendar.upcoming}
              </span>
            </div>

            <div className="cal-pais">
              {e.guardians.length === 0
                ? <span style={{ fontSize:13, color:'var(--muted)' }}>{t.calendar.noGuardian}</span>
                : e.guardians.map((g,i) => {
                    const canRem = auth.isSuper() || auth.isBoard() || g === auth.userName
                    return (
                      <span key={i} className="pai-tag">
                        {g}
                        {canRem && !past && <button onClick={() => removeGuardian(e.id,i)}>×</button>}
                      </span>
                    )
                  })}
            </div>

            {e.menu && <div style={{ fontSize:13, color:'var(--muted)', marginBottom:8 }}>🍽️ {e.menu}</div>}

            {!past && !e.blocked && auth.role && (
              <div className="cal-actions">
                {!amGuardian && (
                  <button className="btn btn-primary btn-sm" onClick={() => joinAsGuardian(e.id)}>
                    {t.calendar.enterAsGuardian}
                  </button>
                )}
                {canEdit && (
                  <button className="btn btn-sm" onClick={() => openEdit(e.id)}>
                    {t.calendar.editRemove}
                  </button>
                )}
              </div>
            )}

            {e.blocked && (auth.isSuper() || auth.isBoard()) && (
              <div className="cal-actions">
                <button className="btn btn-danger btn-sm" onClick={() => removeBlock(e.id)}>
                  {t.calendar.removeBlock}
                </button>
              </div>
            )}
          </div>
        )
      })}

      {auth.role && (
        <button className="btn btn-block" style={{ marginTop:8 }}
          onClick={() => { setErr(''); setNewForm({ date: new Date().toISOString().slice(0,10), name: auth.userName??'', menu:'' }); setShowNew(true) }}>
          {t.calendar.proposeNew}
        </button>
      )}

      {/* New dinner sheet */}
      {showNew && (
        <div className="overlay" onClick={() => setShowNew(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">{t.calendar.proposeDinner}</span>
              <button className="sheet-close" onClick={() => setShowNew(false)}>×</button>
            </div>
            <div className="sheet-body">
              {err && <div className="error-box">{err}</div>}
              <div className="form-group">
                <label className="form-label">{t.calendar.dateLabel}</label>
                <input className="form-input" type="date" value={newForm.date} onChange={e => setNewForm({...newForm,date:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t.calendar.guardianNameLabel}</label>
                <input className="form-input" type="text" value={newForm.name} onChange={e => setNewForm({...newForm,name:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t.calendar.menuLabel} {t.app.optional}</label>
                <input className="form-input" type="text" placeholder={t.calendar.menuPlaceholder} value={newForm.menu} onChange={e => setNewForm({...newForm,menu:e.target.value})} />
              </div>
            </div>
            <div className="sheet-footer">
              <button className="btn" onClick={() => setShowNew(false)}>{t.app.cancel}</button>
              <button className="btn btn-primary" onClick={saveNew}>{t.calendar.proposeBtn}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit sheet */}
      {showEdit && editingId && (
        <div className="overlay" onClick={() => setShowEdit(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">{t.calendar.editDinner}</span>
              <button className="sheet-close" onClick={() => setShowEdit(false)}>×</button>
            </div>
            <div className="sheet-body">
              {err && <div className="error-box">{err}</div>}
              <div className="form-group">
                <label className="form-label">{t.calendar.dateLabel}</label>
                <input className="form-input" type="date" value={editForm.date} onChange={e => setEditForm({...editForm,date:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t.calendar.menuLabel}</label>
                <textarea className="form-input" value={editForm.menu} onChange={e => setEditForm({...editForm,menu:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t.calendar.guardiansLabel}</label>
                <div className="tag-row">
                  {editForm.guardians.map((g,i) => (
                    <div key={i} className="tag tag-green">
                      {g}<button onClick={() => setEditForm({...editForm, guardians: editForm.guardians.filter((_,j)=>j!==i)})}>×</button>
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:8, marginTop:6 }}>
                  <input className="form-input" type="text" placeholder={t.calendar.addGuardianPlaceholder}
                    value={editForm.newGuardian} style={{ flex:1 }}
                    onChange={e => setEditForm({...editForm,newGuardian:e.target.value})}
                    onKeyDown={e => e.key==='Enter' && editForm.newGuardian.trim() && setEditForm({...editForm,guardians:[...editForm.guardians,editForm.newGuardian.trim()],newGuardian:''})} />
                  <button className="btn btn-sm btn-primary"
                    onClick={() => { if(editForm.newGuardian.trim()) setEditForm({...editForm,guardians:[...editForm.guardians,editForm.newGuardian.trim()],newGuardian:''}) }}>
                    +
                  </button>
                </div>
              </div>
            </div>
            <div className="sheet-footer" style={{ flexDirection:'column', gap:6 }}>
              <div style={{ display:'flex', gap:8, width:'100%' }}>
                <button className="btn" onClick={() => setShowEdit(false)}>{t.app.cancel}</button>
                <button className="btn btn-primary" onClick={saveEdit}>{t.app.save}</button>
              </div>
              <button className="btn btn-danger btn-block" onClick={removeEntry}>{t.calendar.removeDate}</button>
            </div>
          </div>
        </div>
      )}

      {/* Postpone sheet */}
      {showPostpone && (
        <div className="overlay" onClick={() => setShowPostpone(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">{t.calendar.postpone}</span>
              <button className="sheet-close" onClick={() => setShowPostpone(false)}>×</button>
            </div>
            <div className="sheet-body">
              <p className="sheet-sub">{t.calendar.postponeSubtitle}</p>
              {err && <div className="error-box">{err}</div>}
              {(() => {
                const future = entries.filter(e => !e.blocked && new Date(e.date+'T12:00:00') >= today)
                return future.length > 0 ? (
                  <div className="postergar-notice">
                    <span>⚠️</span>
                    <div>
                      <strong>{t.calendar.futureCount(future.length)}</strong><br />
                      {t.calendar.nextDinner} {new Date(future[0].date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'})}<br />
                      <span style={{ fontSize:12, color:'var(--amber-tx)' }}>{t.calendar.allWillShift}</span>
                    </div>
                  </div>
                ) : <p className="empty-state">{t.calendar.noFutureDinners}</p>
              })()}
              <div className="form-group">
                <label className="form-label">{t.calendar.postponeNewDate}</label>
                <input className="form-input" type="date" value={postponeForm.newDate} min={tomorrow}
                  onChange={e => setPostponeForm({...postponeForm,newDate:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t.calendar.postponeConfirm} {t.app.optional}</label>
                <input className="form-input" type="text" placeholder={t.calendar.blockReasonPlaceholder}
                  value={postponeForm.reason} onChange={e => setPostponeForm({...postponeForm,reason:e.target.value})} />
              </div>
            </div>
            <div className="sheet-footer">
              <button className="btn" onClick={() => setShowPostpone(false)}>{t.app.cancel}</button>
              <button className="btn btn-primary" onClick={savePostpone}>{t.calendar.postponeConfirm}</button>
            </div>
          </div>
        </div>
      )}

      {/* Block sheet */}
      {showBlock && (
        <div className="overlay" onClick={() => setShowBlock(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">{t.calendar.blockDay}</span>
              <button className="sheet-close" onClick={() => setShowBlock(false)}>×</button>
            </div>
            <div className="sheet-body">
              <p className="sheet-sub">{t.calendar.blockSubtitle}</p>
              {err && <div className="error-box">{err}</div>}
              <div className="form-group">
                <label className="form-label">{t.calendar.dateLabel}</label>
                <input className="form-input" type="date" value={blockForm.date}
                  onChange={e => setBlockForm({...blockForm,date:e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t.calendar.blockReasonLabel}</label>
                <input className="form-input" type="text" placeholder={t.calendar.blockReasonPlaceholder}
                  value={blockForm.reason} onChange={e => setBlockForm({...blockForm,reason:e.target.value})} />
              </div>
            </div>
            <div className="sheet-footer">
              <button className="btn" onClick={() => setShowBlock(false)}>{t.app.cancel}</button>
              <button className="btn btn-primary" onClick={saveBlock}>{t.app.confirm}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
