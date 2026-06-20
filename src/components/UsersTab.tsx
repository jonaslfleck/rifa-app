import { useState, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n'
import { AppState } from '../App'
import { AppUser, initials, formatPhone } from '../lib/store'
import { validateEmail, focusFirstInvalid } from '../lib/validation'

const ROLE_LABEL: Record<string, string> = {
  board: 'Diretoria', coordination: 'Coordenação', secretariat: 'Secretaria',
  kitchen: 'Cozinha', treasury: 'Tesouraria', organizer: 'Organizador', guardian: 'Responsável',
}
const ROLE_COLOR: Record<string, string> = {
  super: 'var(--dtg-red)', board: 'var(--purple-tx)', coordination: '#2d6b18',
  secretariat: '#065040', kitchen: 'var(--teal-tx)', treasury: 'var(--dtg-gold)',
  organizer: 'var(--amber-tx)', guardian: 'var(--blue-tx)',
}
const ROLE_DESC: Record<string, string> = {
  board: 'Acesso amplo: dançarinos, caixa, dashboard, histórico, aniversários.',
  coordination: 'Cadastra dançarinos, organiza jantas, vê dashboard.',
  secretariat: 'Igual à coordenação: cadastra dançarinos, organiza jantas.',
  kitchen: 'Apenas janta e calendário.',
  treasury: 'Caixa e dashboard financeiro.',
  organizer: 'Organiza jantas específicas: edita cardápio e lança gasto.',
  guardian: 'Confirma presença e vê calendário.',
}

interface Props { state: AppState; mutUsers: (u: Record<string, AppUser>) => void; mutLog: (l: any) => void; db: any; [k: string]: any }

export function UsersTab({ state, mutLog, db }: Props) {
  const auth = useAuth()
  const { t } = useTranslation()
  if (!auth.canUsuarios()) return <div className="empty-state">{t.app.noPermission}</div>

  const users = state.users
  const [search,      setSearch]      = useState('')
  const [showForm,    setShowForm]    = useState(false)
  const [editId,      setEditId]      = useState<string | null>(null)
  const [roleSel,     setRoleSel]     = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName,  setInviteName]  = useState('')
  const [invitePhone, setInvitePhone] = useState('')
  const [err,         setErr]         = useState('')
  const [saving,      setSaving]      = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  const filtered = Object.values(users).filter(u => {
    const q = search.toLowerCase()
    return !q || (u.name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q) || (u.phone||'').includes(q)
  })

  const openEdit = (u: AppUser) => {
    setEditId(u.id); setRoleSel(u.role); setInviteEmail(u.email||'')
    setInviteName(u.name||''); setInvitePhone(u.phone||''); setErr(''); setShowForm(true)
  }
  const openNew = () => {
    setEditId(null); setRoleSel(''); setInviteEmail(''); setInviteName(''); setInvitePhone(''); setErr(''); setShowForm(true)
  }

  const save = async () => {
    setErr('')
    if (!roleSel) {
      setErr('Selecione o papel.')
      setTimeout(() => focusFirstInvalid(formRef), 50)
      return
    }
    if (!editId && !inviteEmail.trim()) {
      setErr('Informe o e-mail.')
      setTimeout(() => focusFirstInvalid(formRef), 50)
      return
    }
    if (inviteEmail && !validateEmail(inviteEmail)) {
      setErr('E-mail inválido.')
      setTimeout(() => focusFirstInvalid(formRef), 50)
      return
    }

    setSaving(true)
    if (editId) {
      const { error } = await db.saveUserToDb({ id: editId, role: roleSel, name: inviteName, phone: invitePhone })
      if (error) { setErr('Erro: ' + error.message); setSaving(false); return }
      mutLog({ type:'super', action:'Papel alterado', actor: auth.userName??'', diff:{ before: users[editId]?.role??'—', after: roleSel } })
    } else {
      const fakeId = 'pending_' + Date.now()
      const user: AppUser = { id: fakeId, name: inviteName||inviteEmail, email: inviteEmail, phone: invitePhone, role: roleSel, ts: Date.now() }
      await db.saveUserToDb(user).catch(() => {})
      mutLog({ type:'super', action:'Usuário convidado', actor: auth.userName??'', diff:{ before:'—', after:`${inviteEmail} (${roleSel})` } })
      alert(`Convide o usuário em:\nSupabase → Authentication → Users → Invite user\ne-mail: ${inviteEmail}\n\nApós aceitar o convite, o papel "${ROLE_LABEL[roleSel]||roleSel}" será atribuído.`)
    }
    await db.reload()
    setSaving(false)
    setShowForm(false)
  }

  const remove = async () => {
    if (!editId || !confirm('Remover acesso deste usuário?')) return
    setSaving(true)
    await db.deleteUserFromDb(editId)
    setSaving(false)
    mutLog({ type:'super', action:'Acesso removido', actor: auth.userName??'', diff:{ before: users[editId]?.role??'—', after:'—' } })
    await db.reload()
    setShowForm(false)
  }

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:'1rem' }}>
        <input className="search-box" placeholder={t.users.search}
          value={search} onChange={e => setSearch(e.target.value)} style={{ flex:1, marginBottom:0 }} />
        <button className="btn btn-primary" onClick={openNew}>+ {t.users.newUser}</button>
      </div>

      {filtered.length === 0 && <div className="empty-state">{t.users.noneFound}</div>}

      {filtered.map(u => {
        const color = ROLE_COLOR[u.role] || 'var(--muted)'
        // Exibe: nome + email + telefone
        const displayName = u.name && u.name !== u.email ? u.name : (u.email || u.id)
        return (
          <div key={u.id} className="dancer-row" onClick={() => openEdit(u)} style={{ cursor:'pointer' }}>
            <div className="dancer-avatar" style={{ background: color+'22', color }}>
              {initials(displayName)}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div className="dancer-nome">{displayName}</div>
              <div className="dancer-sub" style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {u.email && <span>✉️ {u.email}</span>}
                {u.phone && <span>📱 {formatPhone(u.phone)}</span>}
              </div>
            </div>
            <span className="turma-badge" style={{ background: color+'22', color }}>
              {ROLE_LABEL[u.role] || u.role}
            </span>
          </div>
        )
      })}

      {showForm && (
        <div className="overlay" onClick={() => setShowForm(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">{editId ? 'Editar usuário' : 'Novo usuário'}</span>
              <button className="sheet-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div className="sheet-body" ref={formRef}>
              {err && <div className="error-box">{err}</div>}
              <div className="form-group">
                <label className="form-label">Nome</label>
                <input className="form-input" type="text" value={inviteName} data-field="name" onChange={e => setInviteName(e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Telefone</label>
                <input className="form-input" type="tel" placeholder="(51) 99999-9999" maxLength={15}
                  value={invitePhone} onChange={e => setInvitePhone(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail {!editId && <span className="req">*</span>}</label>
                <input className="form-input" type="email" value={inviteEmail} data-field="email" data-required="true" onChange={e => setInviteEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{t.users.roleLabel} <span className="req">*</span></label>
                <select className="form-input" value={roleSel} data-field="role" data-required="true" onChange={e => setRoleSel(e.target.value)}>
                  <option value="">Selecione...</option>
                  {Object.entries(ROLE_LABEL).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {roleSel && ROLE_DESC[roleSel] && (
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:6, padding:'6px 10px', background:'var(--bg)', borderRadius:8 }}>
                    {ROLE_DESC[roleSel]}
                  </div>
                )}
              </div>
            </div>
            <div className="sheet-footer">
              <button className="btn" onClick={() => setShowForm(false)}>{t.app.cancel}</button>
              {editId && <button className="btn btn-danger btn-sm" onClick={remove} disabled={saving}>🗑️</button>}
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Salvando...' : t.app.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
