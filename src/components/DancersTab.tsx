import { useState, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n'
import { AppState } from '../App'
import { Dancer, DinnerEvent, GROUPS, groupLabel, groupClass, initials, walletStatus, cleanPhone, formatPhone, saveDinner } from '../lib/store'

interface Props {
  state: AppState
  mutDancas: (d: Record<string, Dancer>) => void
  mutEvento: (u: Partial<DinnerEvent>) => DinnerEvent
  mutLog: (l: any) => void
  [k: string]: any
}

const CONTACT_TYPES = ['Avô','Avó','Tio','Tia','Irmão','Irmã','Outro']
const PAGE_SIZE = 20

// Validações
const isValidPhone = (s: string) => !s || cleanPhone(s).length >= 10
const isValidEmail = (s: string) => !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())

export default function DancasTab({ state, mutDancas, mutEvento, mutLog, db }: Props) {
  const auth = useAuth()
  const { t } = useTranslation()

  const canEdit = auth.canDancas()
  const isGuardianOnly = auth.isGuardian() && !auth.canDancas()
  if (!canEdit && !isGuardianOnly) return <div className="empty-state">{t.app.noPermission}</div>

  const dancers = state.dancers
  const dinner  = state.dinnerEvent

  const [search,         setSearch]         = useState('')
  const [filterStatus,   setFilterStatus]   = useState<'active'|'inactive'|'all'>('active')
  const [showForm,       setShowForm]       = useState(false)
  const [showView,       setShowView]       = useState<Dancer | null>(null)
  const [editingId,      setEditingId]      = useState<string | null>(null)
  const [err,            setErr]            = useState('')
  const [form,           setForm]           = useState<Partial<Dancer>>({})
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [extraContacts,  setExtraContacts]  = useState<{ type:string; name:string; phone:string; birthDate?:string }[]>([])
  const [page,           setPage]           = useState(0)
  const formRef = useRef<HTMLDivElement>(null)

  const knownGuardianNames = [...new Set(
    Object.values(dancers).flatMap(d => [
      d.guardian1Name, d.guardian2Name,
      ...d.extraContacts.map(c => c.name),
    ].filter(Boolean))
  )]

  const myDancers = isGuardianOnly
    ? Object.values(dancers).filter(d => {
        if (!auth.userPhone) return false
        const phones = [cleanPhone(d.phone), cleanPhone(d.guardian1Phone), cleanPhone(d.guardian2Phone), ...d.extraContacts.map(c => cleanPhone(c.phone))]
        return phones.includes(auth.userPhone)
      })
    : Object.values(dancers)

  const filtered = myDancers
    .filter(d => {
      const isActive = !d.inactive
      if (filterStatus === 'active'   && !isActive) return false
      if (filterStatus === 'inactive' &&  isActive) return false
      const q = search.toLowerCase()
      return !q || d.name.toLowerCase().includes(q) || (d.group||'').toLowerCase().includes(q)
        || (d.guardian1Name||'').toLowerCase().includes(q) || (d.walletNumber||'').toLowerCase().includes(q)
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE)
  const pageDancers = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const openNew = () => {
    if (!canEdit) return
    setEditingId(null); setErr(''); setForm({})
    setSelectedGroups([]); setExtraContacts([]); setShowForm(true)
  }

  const openEdit = (d: Dancer) => {
    setEditingId(d.id); setErr('')
    setForm({
      name: d.name, birthDate: d.birthDate||'', phone: d.phone||'',
      guardian1Name: d.guardian1Name||'', guardian1Phone: d.guardian1Phone||'',
      guardian2Name: d.guardian2Name||'', guardian2Phone: d.guardian2Phone||'',
      walletNumber: d.walletNumber||'', walletExpiry: d.walletExpiry||'',
      walletCardStatus: d.walletCardStatus || 'none',
      allowOrder: d.allowOrder ?? true,
      inactive: d.inactive||false,
    })
    setSelectedGroups(d.groups?.length ? d.groups : [d.group].filter(Boolean))
    setExtraContacts((d.extraContacts || []).map(c => ({ ...c })))
    setShowForm(true)
  }

  const openInactivate = async (d: Dancer) => {
    if (!confirm(`Inativar ${d.name}?`)) return
    const updated = { ...dancers, [d.id]: { ...d, inactive: true } }
    if (db?.saveDancerToDb) await db.saveDancerToDb({ ...d, inactive: true }, dancers)
    else mutDancas(updated)
    mutLog({ type: 'super', action: 'Dançarino inativado', actor: auth.userName ?? '', diff: { before: 'ativo', after: 'inativo' } })
  }

  const openDelete = async (d: Dancer) => {
    if (!confirm(t.app.confirmDelete(d.name))) return
    if (db?.deleteDancerFromDb) await db.deleteDancerFromDb(d.id)
    else { const upd = { ...dancers }; delete upd[d.id]; mutDancas(upd) }
    mutLog({ type: 'super', action: 'Dançarino excluído', actor: auth.userName ?? '', diff: { before: d.name, after: '—' } })
  }

  const toggleGroup = (g: string) =>
    setSelectedGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])

  // Determinar se cartão/data devem ser bloqueados
  const walletCardStatusVal = (form as any).walletCardStatus ?? 'none'
  const walletLocked = walletCardStatusVal === 'none' || walletCardStatusVal === 'pending'

  // Status da carteirinha baseado no preenchimento do registro + data
  const computedWalletStatus = (() => {
    const hasNumber = !!(form.walletNumber?.trim())
    const hasExpiry = !!(form.walletExpiry)
    if (!hasNumber && !hasExpiry) return 'none'
    if (hasNumber && hasExpiry) {
      const today = new Date(); today.setHours(0,0,0,0)
      const exp = new Date((form.walletExpiry||'') + 'T12:00:00')
      return exp >= today ? 'ok' : 'expired'
    }
    return 'pending'
  })()

  const handleSave = async () => {
    setErr('')
    if (!form.name?.trim())              { setErr(t.dancers.nameRequired); return }
    if (!selectedGroups.length)          { setErr(t.dancers.groupRequired); return }
    if (!form.guardian1Name?.trim())     { setErr('Ao menos um responsável é obrigatório.'); return }

    // Validações de telefone
    if (form.phone && !isValidPhone(form.phone))               { setErr('Telefone do dançarino inválido.'); return }
    if (form.guardian1Phone && !isValidPhone(form.guardian1Phone)) { setErr('Telefone do Responsável 1 inválido.'); return }
    if (form.guardian2Phone && !isValidPhone(form.guardian2Phone)) { setErr('Telefone do Responsável 2 inválido.'); return }
    for (const c of extraContacts) {
      if (c.phone && !isValidPhone(c.phone)) { setErr(`Telefone inválido para ${c.name || 'contato extra'}.`); return }
    }

    const id = editingId ?? 'd' + Date.now()
    const dancer: Dancer = {
      id,
      name:             form.name.trim(),
      group:            selectedGroups[0],
      groups:           selectedGroups,
      birthDate:        form.birthDate || '',
      phone:            cleanPhone(form.phone || ''),
      guardian1Name:    form.guardian1Name?.trim() || '',
      guardian1Phone:   cleanPhone(form.guardian1Phone || ''),
      guardian2Name:    form.guardian2Name?.trim() || '',
      guardian2Phone:   cleanPhone(form.guardian2Phone || ''),
      walletNumber:     walletLocked ? '' : (form.walletNumber?.trim() || ''),
      walletExpiry:     walletLocked ? '' : (form.walletExpiry || ''),
      walletCardStatus: computedWalletStatus,
      allowOrder:       (form as any).allowOrder ?? true,
      extraContacts:    extraContacts.filter(c => c.name.trim()),
      inactive:         form.inactive || false,
    }

    if (db?.saveDancerToDb) await db.saveDancerToDb(dancer, dancers)
    else mutDancas({ ...dancers, [id]: dancer })

    const phones = [dancer.phone, dancer.guardian1Phone, dancer.guardian2Phone, ...extraContacts.map(c => cleanPhone(c.phone))].filter(p => p && p.length >= 10)
    const authPhones = [...dinner.authorizedPhones]
    const participants = { ...dinner.participants }
    phones.forEach(p => {
      if (!authPhones.includes(p)) authPhones.push(p)
      if (!participants[p]) {
        if (p === dancer.guardian1Phone && dancer.guardian1Name) participants[p] = dancer.guardian1Name
        else if (p === dancer.guardian2Phone && dancer.guardian2Name) participants[p] = dancer.guardian2Name
        else if (p === dancer.phone) participants[p] = dancer.name
        else { const c = extraContacts.find(cx => cleanPhone(cx.phone) === p); if (c) participants[p] = c.name }
      }
    })
    mutEvento({ authorizedPhones: authPhones, participants })
    mutLog({ type: 'super', action: editingId ? 'Dançarino editado' : 'Dançarino cadastrado', actor: auth.userName ?? '', diff: { before: editingId ? (dancers[id]?.name ?? '—') : '—', after: `${dancer.name} (${selectedGroups.map(groupLabel).join(', ')})` } })
    setShowForm(false)
  }

  const handleDelete = async () => {
    if (!editingId) return
    const d = dancers[editingId]
    if (!confirm(t.app.confirmDelete(d?.name || 'dançarino'))) return
    if (db?.deleteDancerFromDb) await db.deleteDancerFromDb(editingId)
    else { const updated = { ...dancers }; delete updated[editingId]; mutDancas(updated) }
    mutLog({ type: 'super', action: 'Dançarino excluído', actor: auth.userName ?? '', diff: { before: d?.name ?? '', after: '—' } })
    setShowForm(false)
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', gap:8, marginBottom:'0.5rem', flexWrap:'wrap' }}>
        <input className="search-box" placeholder={t.dancers.search} value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          style={{ flex:1, marginBottom:0, minWidth:150 }} />
        {canEdit && (
          <button className="btn btn-primary" onClick={openNew} style={{ whiteSpace:'nowrap' }}>
            {t.dancers.newDancer}
          </button>
        )}
      </div>

      {/* Status filters */}
      <div style={{ display:'flex', gap:6, marginBottom:'1rem', flexWrap:'wrap' }}>
        {(['active','inactive','all'] as const).map(f => (
          <button key={f} className={`log-filter ${filterStatus===f?'active':''}`}
            onClick={() => { setFilterStatus(f); setPage(0) }}>
            {f==='active' ? t.dancers.filterActive : f==='inactive' ? t.dancers.filterInactive : t.dancers.filterAll}
          </button>
        ))}
        <span style={{ fontSize:12, color:'var(--muted)', alignSelf:'center', marginLeft:4 }}>
          {t.dancers.count(filtered.length)}
        </span>
      </div>

      {filtered.length === 0 && <div className="empty-state">{t.dancers.noneFound}</div>}

      {pageDancers.map(d => {
        const ws = walletStatus(d.walletExpiry)
        const expiryStr = d.walletExpiry ? new Date(d.walletExpiry + 'T12:00:00').toLocaleDateString('pt-BR') : ''
        return (
          <div key={d.id} className="dancer-row" style={{ opacity: d.inactive ? 0.5 : 1 }}>
            <div className="dancer-avatar" style={d.inactive ? { background:'var(--bg)', color:'var(--muted)' } : {}}>
              {initials(d.name)}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div className="dancer-nome">
                {d.name}
                {d.inactive && <span style={{ fontSize:10, color:'var(--muted)', fontWeight:400 }}> {t.dancers.inactiveSuffix}</span>}
              </div>
              <div className="dancer-sub">
                {[d.guardian1Name, d.guardian2Name].filter(Boolean).join(' · ')}
              </div>
              {/* Invernadas - todas visíveis */}
              {(d.groups || [d.group]).filter(Boolean).length > 0 && (
                <div style={{ marginTop:3, display:'flex', flexWrap:'wrap', gap:3 }}>
                  {(d.groups || [d.group]).filter(Boolean).map((g, i) => (
                    <span key={i} className={`turma-badge ${groupClass(g)}`} style={{ fontSize:'9px', padding:'1px 5px' }}>
                      {groupLabel(g)}
                    </span>
                  ))}
                </div>
              )}
              {d.walletNumber && (
                <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>
                  🎫 {d.walletNumber}
                  {expiryStr && <span> · vence {expiryStr}</span>}
                  {d.walletCardStatus && d.walletCardStatus !== 'none' && (
                    <span style={{ marginLeft:4, fontSize:9, padding:'1px 5px', borderRadius:8,
                      background: d.walletCardStatus==='ok' ? 'var(--green-bg)' : d.walletCardStatus==='pending' ? 'var(--amber-bg)' : 'var(--red-bg)',
                      color: d.walletCardStatus==='ok' ? 'var(--green-tx)' : d.walletCardStatus==='pending' ? 'var(--amber-tx)' : 'var(--red-tx)',
                      fontWeight:500 }}>
                      {d.walletCardStatus==='ok' ? 'Ativo' : d.walletCardStatus==='pending' ? 'Em andamento' : 'Expirado'}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Ações: visualizar, inativar, excluir */}
            <div style={{ display:'flex', gap:4, flexShrink:0 }}>
              <button className="btn btn-sm" title="Visualizar" onClick={() => setShowView(d)}>👁️</button>
              {canEdit && !d.inactive && (
                <button className="btn btn-sm" title="Inativar" onClick={() => openInactivate(d)}>🚫</button>
              )}
              {(auth.isSuper() || auth.isManagement()) && (
                <button className="btn btn-sm btn-danger" title="Excluir" onClick={() => openDelete(d)}>🗑️</button>
              )}
              {canEdit && (
                <button className="btn btn-sm" title="Editar" onClick={() => openEdit(d)}>✏️</button>
              )}
            </div>
          </div>
        )
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:'1rem', flexWrap:'wrap' }}>
          <button className="btn btn-sm" onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}>{t.app.pagePrev}</button>
          <span style={{ fontSize:13, color:'var(--muted)' }}>{t.app.pageOf(page+1, totalPages)} — {t.dancers.count(filtered.length)}</span>
          <button className="btn btn-sm" onClick={() => setPage(p => Math.min(totalPages-1, p+1))} disabled={page===totalPages-1}>{t.app.pageNext}</button>
        </div>
      )}

      {/* View sheet */}
      {showView && (
        <div className="overlay" onClick={() => setShowView(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">👁️ {showView.name}</span>
              <button className="sheet-close" onClick={() => setShowView(null)}>×</button>
            </div>
            <div className="sheet-body">
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {showView.birthDate && <Row label="Data de nascimento" value={new Date(showView.birthDate+'T12:00:00').toLocaleDateString('pt-BR')} />}
                <Row label="Invernadas" value={(showView.groups||[showView.group]).filter(Boolean).map(groupLabel).join(', ')} />
                {showView.guardian1Name && <Row label="Responsável 1" value={`${showView.guardian1Name}${showView.guardian1Phone ? ' · ' + formatPhone(showView.guardian1Phone) : ''}`} />}
                {showView.guardian2Name && <Row label="Responsável 2" value={`${showView.guardian2Name}${showView.guardian2Phone ? ' · ' + formatPhone(showView.guardian2Phone) : ''}`} />}
                {showView.extraContacts?.filter(c=>c.name).map((c,i) => (
                  <Row key={i} label={c.type} value={`${c.name}${c.phone ? ' · ' + formatPhone(c.phone) : ''}`} />
                ))}
                {showView.walletNumber && <Row label="Registro Trad." value={showView.walletNumber} />}
                {showView.walletExpiry && <Row label="Vencimento Carteira" value={new Date(showView.walletExpiry+'T12:00:00').toLocaleDateString('pt-BR')} />}
                <Row label="Status Carteira" value={showView.walletCardStatus==='ok'?'Ativo':showView.walletCardStatus==='pending'?'Em andamento':showView.walletCardStatus==='expired'?'Expirado':'Não possui'} />
                <Row label="Autorização comanda" value={showView.allowOrder!==false?'Sim':'Não'} />
              </div>
            </div>
            <div className="sheet-footer">
              <button className="btn" onClick={() => setShowView(null)}>Fechar</button>
              {canEdit && <button className="btn btn-primary" onClick={() => { setShowView(null); openEdit(showView) }}>✏️ Editar</button>}
            </div>
          </div>
        </div>
      )}

      {/* Form sheet */}
      {showForm && (
        <div className="overlay" onClick={() => setShowForm(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">{editingId ? t.dancers.editDancer : t.dancers.newDancer}</span>
              <button className="sheet-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div className="sheet-body" ref={formRef}>
              {err && <div className="error-box">{err}</div>}

              <div className="form-group">
                <label className="form-label">{t.dancers.fullName} <span className="req">*</span></label>
                <input className="form-input" type="text" placeholder={t.dancers.namePlaceholder}
                  data-field="name" data-required="true"
                  value={form.name??''} onChange={e => setForm({...form,name:e.target.value})} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">{t.dancers.birthDate}</label>
                <input className="form-input" type="date" value={form.birthDate??''}
                  onChange={e => setForm({...form,birthDate:e.target.value})} />
              </div>

              {/* Groups */}
              <div className="form-group">
                <label className="form-label">
                  {t.dancers.groups} <span style={{ fontWeight:400, color:'var(--muted)' }}>{t.dancers.groupsHint}</span>
                </label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:6 }}>
                  {GROUPS.map(g => (
                    <label key={g} style={{ display:'flex', alignItems:'center', gap:5, fontSize:13, cursor:'pointer' }}>
                      <input type="checkbox" checked={selectedGroups.includes(g)} onChange={() => toggleGroup(g)} />
                      {groupLabel(g)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">{t.dancers.ownPhone} {t.app.optional}</label>
                <input className="form-input" type="tel" placeholder="51 99999-9999" maxLength={15}
                  value={form.phone??''} onChange={e => setForm({...form,phone:e.target.value})} />
                {form.phone && !isValidPhone(form.phone) && (
                  <div style={{ fontSize:11, color:'var(--dtg-red)', marginTop:3 }}>Telefone inválido</div>
                )}
              </div>

              <hr className="sep" />
              <div className="mini-label">{t.dancers.walletSection}</div>

              {/* Status da carteira baseado no preenchimento */}
              <div className="form-group">
                <label className="form-label">Status da Carteirinha Tradicionalista</label>
                <div style={{ padding:'8px 12px', borderRadius:8, fontSize:13, fontWeight:500,
                  background: computedWalletStatus==='ok' ? 'var(--green-bg)' : computedWalletStatus==='expired' ? 'var(--red-bg)' : computedWalletStatus==='pending' ? 'var(--amber-bg)' : 'var(--bg)',
                  color: computedWalletStatus==='ok' ? 'var(--green-tx)' : computedWalletStatus==='expired' ? 'var(--red-tx)' : computedWalletStatus==='pending' ? 'var(--amber-tx)' : 'var(--muted)',
                }}>
                  {computedWalletStatus==='ok' ? '✅ Ativo' : computedWalletStatus==='expired' ? '❌ Expirado' : computedWalletStatus==='pending' ? '⏳ Em andamento (preencha registro e data)' : '— Não possui (preencha registro e data para ativar)'}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t.dancers.walletNumber}</label>
                  <input className="form-input" type="text" placeholder={t.dancers.walletPlaceholder}
                    maxLength={20} value={form.walletNumber??''}
                    onChange={e => setForm({...form,walletNumber:e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t.dancers.walletExpiry}</label>
                  <input className="form-input" type="date" value={form.walletExpiry??''}
                    onChange={e => setForm({...form,walletExpiry:e.target.value})} />
                </div>
              </div>

              <hr className="sep" />
              <div className="mini-label">Autorização</div>
              <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'10px 0' }}>
                <input type="checkbox" checked={(form as any).allowOrder ?? true}
                  onChange={e => setForm({ ...form, allowOrder: e.target.checked } as any)}
                  style={{ width:18, height:18, accentColor:'var(--dtg-brown)', flexShrink:0 }} />
                <span style={{ fontSize:14, lineHeight:1.4 }}>Autorizo meu filho(a) a abrir comanda no sistema</span>
              </label>

              <hr className="sep" />
              <div className="mini-label">{t.dancers.guardian1} <span className="req">*</span></div>
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="form-input" type="text" value={form.guardian1Name??''} list="g1-list"
                  data-field="guardian1Name" data-required="true"
                  onChange={e => setForm({...form,guardian1Name:e.target.value})} />
                <datalist id="g1-list">{knownGuardianNames.map(n => <option key={n} value={n}/>)}</datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input className="form-input" type="tel" placeholder="51 99999-9999" maxLength={15}
                  value={form.guardian1Phone??''} onChange={e => setForm({...form,guardian1Phone:e.target.value})} />
                {form.guardian1Phone && !isValidPhone(form.guardian1Phone) && (
                  <div style={{ fontSize:11, color:'var(--dtg-red)', marginTop:3 }}>Telefone inválido</div>
                )}
              </div>

              <hr className="sep" />
              <div className="mini-label">{t.dancers.guardian2} {t.app.optional}</div>
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="form-input" type="text" value={form.guardian2Name??''} list="g2-list"
                  onChange={e => setForm({...form,guardian2Name:e.target.value})} />
                <datalist id="g2-list">{knownGuardianNames.map(n => <option key={n} value={n}/>)}</datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input className="form-input" type="tel" placeholder="51 99999-9999" maxLength={15}
                  value={form.guardian2Phone??''} onChange={e => setForm({...form,guardian2Phone:e.target.value})} />
                {form.guardian2Phone && !isValidPhone(form.guardian2Phone) && (
                  <div style={{ fontSize:11, color:'var(--dtg-red)', marginTop:3 }}>Telefone inválido</div>
                )}
              </div>

              <hr className="sep" />
              <div className="mini-label">{t.dancers.otherFamily}</div>
              {extraContacts.map((c, i) => (
                <div key={i} className="resp-extra-row">
                  <select className="form-input" style={{ flex:'0.8', minWidth:85, fontSize:13, padding:'6px 8px' }}
                    value={c.type} onChange={e => { const a=[...extraContacts]; a[i]={...a[i],type:e.target.value}; setExtraContacts(a) }}>
                    {CONTACT_TYPES.map(type => <option key={type}>{type}</option>)}
                  </select>
                  <input className="form-input" type="text" style={{ flex:1 }} value={c.name}
                    placeholder="Nome" list={`ec-name-${i}`}
                    onChange={e => { const a=[...extraContacts]; a[i]={...a[i],name:e.target.value}; setExtraContacts(a) }} />
                  <datalist id={`ec-name-${i}`}>{knownGuardianNames.map(n => <option key={n} value={n}/>)}</datalist>
                  <input className="form-input" type="tel" style={{ flex:'0.9', minWidth:80 }}
                    value={c.phone} placeholder="Telefone" maxLength={15}
                    onChange={e => { const a=[...extraContacts]; a[i]={...a[i],phone:e.target.value}; setExtraContacts(a) }} />
                  <button className="btn-remove" onClick={() => setExtraContacts(extraContacts.filter((_,j) => j!==i))}>×</button>
                </div>
              ))}
              <button className="add-link" onClick={() => setExtraContacts([...extraContacts, { type:'Avó', name:'', phone:'' }])}>
                {t.dancers.addPerson}
              </button>

              {editingId && canEdit && (
                <>
                  <hr className="sep" />
                  <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                    <input type="checkbox" checked={!!form.inactive}
                      onChange={e => setForm({...form, inactive: e.target.checked})} />
                    {t.dancers.inactiveLabel}
                  </label>
                </>
              )}
            </div>
            <div className="sheet-footer">
              <button className="btn" onClick={() => setShowForm(false)}>{t.app.cancel}</button>
              {editingId && (auth.isSuper() || auth.isManagement()) && (
                <button className="btn btn-danger btn-sm" onClick={handleDelete}>🗑️ {t.app.delete}</button>
              )}
              <button className="btn btn-primary" onClick={handleSave}>{t.app.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper para exibição
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:'flex', gap:8 }}>
      <span style={{ fontSize:12, color:'var(--muted)', minWidth:130, flexShrink:0 }}>{label}:</span>
      <span style={{ fontSize:13, fontWeight:500 }}>{value || '—'}</span>
    </div>
  )
}
