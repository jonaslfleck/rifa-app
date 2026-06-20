import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n'
import { AppState } from '../App'
import { focusFirstInvalid } from '../lib/validation'
import {
  DinnerEvent, Attendee, AccessRequest, Order,
  formatCurrency, cleanPhone, formatPhone, groupLabel,
  loadAccessRequests, saveAccessRequests,
} from '../lib/store'

interface Props {
  state: AppState
  mutDinner: (u: Partial<DinnerEvent>) => DinnerEvent
  mutOrders: (o: Record<string, Order>) => void
  mutRequests: (r: Record<string, AccessRequest>) => void
  mutLog: (l: any) => void
  db?: any
  [k: string]: any
}

const LOCK_KEY = 'jdtg_lock_ts'

// ── PIX QR helper ─────────────────────────────────────────────────────────────
function buildPixPayload(pixKey: string, merchantName: string, amount: number): string {
  const amt = amount.toFixed(2)
  const name = merchantName.slice(0, 25).padEnd(1, ' ')
  const city = 'BRASIL'
  const txId = 'DTG' + Date.now().toString().slice(-8)

  const field = (id: string, val: string) => {
    const len = val.length.toString().padStart(2, '0')
    return `${id}${len}${val}`
  }

  const gui  = field('00', 'BR.GOV.BCB.PIX')
  const key  = field('01', pixKey)
  const mai  = field('26', gui + key)
  const mcc  = field('52', '0000')
  const curr = field('53', '986')
  const amtF = field('54', amt)
  const cntry= field('58', 'BR')
  const nameF= field('59', name)
  const cityF= field('60', city)
  const txF  = field('62', field('05', txId))

  const partial = '000201' + mai + mcc + curr + amtF + cntry + nameF + cityF + txF + '6304'

  // CRC16-CCITT
  let crc = 0xFFFF
  for (let i = 0; i < partial.length; i++) {
    crc ^= partial.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1
  }
  return partial + (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')
}

export default function DinnerTab({ state, mutDinner, mutOrders, mutRequests, mutLog, db }: Props) {
  const auth = useAuth()
  const { t } = useTranslation()
  const dinner = state.dinner
  const dancers = state.dancers

  const [showEdit,      setShowEdit]      = useState(false)
  const [showExpense,   setShowExpense]   = useState(false)
  const [showAddMenu,   setShowAddMenu]   = useState(false)
  const [showRequest,   setShowRequest]   = useState(false)
  const [showPix,       setShowPix]       = useState(false)
  const [pixAmount,     setPixAmount]     = useState('')
  const [pixCopied,     setPixCopied]     = useState(false)
  const [editForm,      setEditForm]      = useState<Partial<DinnerEvent>>({})
  const [expenseVal,    setExpenseVal]    = useState('')
  const [expenseDesc,   setExpenseDesc]   = useState('')
  const [menuItem,      setMenuItem]      = useState('')
  const [addName,       setAddName]       = useState('')
  const [addPriceIdx,   setAddPriceIdx]   = useState(0)
  const [addCook,       setAddCook]       = useState(false)
  const [reqName,       setReqName]       = useState('')
  const [reqPhone,      setReqPhone]      = useState('')
  const [reqReason,     setReqReason]     = useState('')
  const [reqOk,         setReqOk]         = useState(false)
  const [searchDancer,  setSearchDancer]  = useState('')
  const [err,           setErr]           = useState('')
  const formEditRef    = useRef<HTMLDivElement>(null)
  const formExpenseRef = useRef<HTMLDivElement>(null)
  const formReqRef     = useRef<HTMLDivElement>(null)
  const formPixRef     = useRef<HTMLDivElement>(null)
  const [isLocked,      setIsLocked]      = useState(false)

  // Check lock
  useEffect(() => {
    if (!dinner.lockAt) { setIsLocked(false); return }
    const check = () => {
      const lockTime = new Date(dinner.lockAt).getTime()
      setIsLocked(Date.now() >= lockTime)
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [dinner.lockAt])

  // ── Se não há janta configurada, não exibe nada ────────────────────────────
  const hasDinner = !!dinner.title?.trim()

  const isDinnerOrg = auth.isDinnerOrganizer(dinner.organizerPhones, dinner.organizer)
  const canManage   = auth.canCaixa() || isDinnerOrg
  const canRegister = auth.isGuardian() || auth.isOrganizer() || canManage

  const myAttendees = dinner.attendees.filter(a => a.phone === auth.userPhone)
  const alreadyIn   = myAttendees.length > 0
  const totalCollected = dinner.attendees
    .filter(a => a.present === true && !a.isCook)
    .reduce((s, a) => s + a.price, 0)

  const myDancers = auth.isGuardian()
    ? Object.values(dancers).filter(d => {
        const phones = [cleanPhone(d.phone), cleanPhone(d.guardian1Phone), cleanPhone(d.guardian2Phone)]
        return phones.includes(auth.userPhone ?? '')
      })
    : Object.values(dancers)

  const filteredDancers = myDancers
    .filter(d => !searchDancer || d.name.toLowerCase().includes(searchDancer.toLowerCase()))
    .slice(0, 5)

  // ── PIX payload ──────────────────────────────────────────────────────────
  const pixPayload = (() => {
    if (!dinner.pixKey) return ''
    const amt = parseFloat(pixAmount.replace(',', '.'))
    if (isNaN(amt) || amt <= 0) return ''
    return buildPixPayload(dinner.pixKey, 'DTG Camboata', amt)
  })()

  const copyPix = () => {
    if (!pixPayload) return
    navigator.clipboard.writeText(pixPayload).then(() => {
      setPixCopied(true)
      setTimeout(() => setPixCopied(false), 3000)
    })
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  const register = (isCook = false) => {
    setErr('')
    const name = addName.trim() || auth.userName || ''
    if (!name) {
      setErr('Digite o nome.')
      document.querySelector<HTMLElement>('[data-field="addName"]')?.focus()
      return
    }
    if (alreadyIn && !canManage) { setErr(t.dinner.alreadyRegistered); return }
    if ((isLocked || dinner.closed) && !canManage) { setErr(dinner.lockMessage); return }
    const priceOpt = dinner.priceOptions[addPriceIdx] ?? dinner.priceOptions[0]
    const attendee: Attendee = {
      name,
      price:      isCook ? 0 : (priceOpt?.price ?? 0),
      priceLabel: isCook ? t.dinner.cookFree : (priceOpt?.label ?? ''),
      phone:      auth.userPhone ?? '',
      present:    null,
      isCook,
    }
    const updated = [...dinner.attendees, attendee]
    if (db?.addAttendee && state._dinnerId) {
      db.addAttendee(state._dinnerId, attendee)
    } else {
      mutDinner({ attendees: updated })
    }
    mutLog({ type: 'organizer', action: 'Inscrito adicionado', actor: auth.userName ?? '', diff: { before: '—', after: `${name}` } })
    setAddName(''); setAddPriceIdx(0); setAddCook(false)
  }

  const remove = (idx: number) => {
    const a = dinner.attendees[idx]
    if (!canManage && a.phone !== auth.userPhone) { setErr(t.dinner.onlyOwnRemoval); return }
    if (!confirm(t.dinner.confirmRemove(a.name))) return
    const updated = dinner.attendees.filter((_, i) => i !== idx)
    if (db?.removeAttendee && a._dbId && state._dinnerId) {
      db.removeAttendee(a._dbId, state._dinnerId)
    } else {
      mutDinner({ attendees: updated })
    }
    mutLog({ type: 'organizer', action: 'Inscrito removido', actor: auth.userName ?? '', diff: { before: a.name, after: '—' } })
  }

  const saveEdit = () => {
    if (!editForm.title?.trim()) {
      setErr('Digite o título.')
      setTimeout(() => focusFirstInvalid(formEditRef), 50)
      return
    }
    mutDinner(editForm)
    mutLog({ type: 'super', action: 'Janta editada', actor: auth.userName ?? '', diff: { before: dinner.title, after: editForm.title ?? '' } })
    setShowEdit(false)
  }

  const saveExpense = () => {
    const val = parseFloat(expenseVal.replace(',', '.'))
    if (isNaN(val)) {
      setErr('Valor inválido.')
      setTimeout(() => focusFirstInvalid(formExpenseRef), 50)
      return
    }
    mutDinner({ expenseAmount: val, expenseDesc: expenseDesc.trim() })
    mutLog({ type: 'super', action: 'Gasto registrado', actor: auth.userName ?? '', diff: { before: '—', after: `R$${formatCurrency(val)}` } })
    setShowExpense(false)
  }

  const addMenuItem = () => {
    const item = menuItem.trim()
    if (!item) return
    mutDinner({ menu: [...dinner.menu, item] })
    setMenuItem('')
  }

  const submitRequest = () => {
    const name = reqName.trim()
    const phone = cleanPhone(reqPhone)
    if (!name) {
      setErr('Digite seu nome.')
      setTimeout(() => focusFirstInvalid(formReqRef), 50)
      return
    }
    if (phone.length < 10) {
      setErr('Telefone inválido.')
      setTimeout(() => focusFirstInvalid(formReqRef), 50)
      return
    }
    if (!reqReason.trim()) {
      setErr('Descreva o motivo.')
      setTimeout(() => focusFirstInvalid(formReqRef), 50)
      return
    }
    if (dinner.authorizedPhones.includes(phone)) { setErr(t.accessRequest.alreadyHasAccess); return }
    const req: AccessRequest = { id: 'r' + Date.now(), name, phone, reason: reqReason.trim(), ts: Date.now() }
    const existing = loadAccessRequests()
    const updated = { ...existing, [req.id]: req }
    saveAccessRequests(updated)
    mutRequests(updated)
    setReqOk(true)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Se não há janta configurada, não exibe nada
  if (!hasDinner && !canManage) return null

  return (
    <div>
      {/* Header card */}
      <div className="card">
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:8 }}>
          <div>
            <div className="card-label">
              {t.dinner.current}
              {dinner.isDonation && <span className="badge-doacao">{t.dinner.donation}</span>}
            </div>
            <div style={{ fontSize:17, fontWeight:600, fontFamily:"'DM Serif Display',serif" }}>
              {dinner.title || (canManage ? '(sem janta configurada)' : '—')}
            </div>
          </div>
          {canManage && (
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              <button className="btn btn-sm" onClick={() => { setEditForm({ ...dinner }); setShowEdit(true) }}>✏️</button>
              <button className="btn btn-sm" onClick={() => { setExpenseVal(String(dinner.expenseAmount||'')); setExpenseDesc(dinner.expenseDesc||''); setShowExpense(true) }}>💸</button>
            </div>
          )}
        </div>
        {dinner.eventDate && <div style={{ fontSize:13, color:'var(--muted)', marginBottom:2 }}>📅 {dinner.eventDate}</div>}
        {dinner.organizer && <div style={{ fontSize:13, color:'var(--muted)', marginBottom:6 }}>👨‍🍳 {dinner.organizer}</div>}

        {hasDinner && (
          <div className="stats" style={{ marginBottom:8 }}>
            <div className="stat"><div className="stat-num">{dinner.attendees.length}</div><div className="stat-lbl">{t.dinner.confirmed}</div></div>
            {auth.canViewTotal() && <div className="stat"><div className="stat-num">R${formatCurrency(totalCollected)}</div><div className="stat-lbl">{t.dinner.collected}</div></div>}
            {auth.canViewTotal() && dinner.expenseAmount > 0 && <div className="stat"><div className="stat-num">R${formatCurrency(dinner.expenseAmount)}</div><div className="stat-lbl">{t.dinner.expense}</div></div>}
          </div>
        )}

        {dinner.deadline && (
          <div className="notice notice-amber" style={{ marginBottom:8 }}>
            <span>⏰</span><span style={{ fontSize:13 }}>{dinner.deadline}</span>
          </div>
        )}

        {/* PIX: botão que abre modal para gerar QR Code */}
        {dinner.pixKey && (
          <button
            className="btn btn-block"
            style={{ marginBottom:8, background:'var(--green-bg)', color:'var(--green-tx)', border:'1px solid var(--green-tx)', fontWeight:600 }}
            onClick={() => { setPixAmount(''); setPixCopied(false); setShowPix(true) }}
          >
            💠 Pagar via PIX
          </button>
        )}
      </div>

      {/* Menu */}
      {hasDinner && (dinner.menu.length > 0 || canManage) && (
        <div className="card">
          <div className="card-label">🍽️ {t.dinner.menu}</div>
          {dinner.menu.map((item, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0' }}>
              <span style={{ flex:1, fontSize:14 }}>• {item}</span>
              {canManage && <button className="btn-remove" onClick={() => mutDinner({ menu: dinner.menu.filter((_,j)=>j!==i) })}>×</button>}
            </div>
          ))}
          {canManage && (
            <div style={{ display:'flex', gap:8, marginTop:6 }}>
              <input className="form-input" type="text" placeholder="Adicionar item" value={menuItem}
                style={{ flex:1, fontSize:13 }} onChange={e => setMenuItem(e.target.value)}
                onKeyDown={e => e.key==='Enter' && addMenuItem()} />
              <button className="btn btn-sm btn-primary" onClick={addMenuItem}>+</button>
            </div>
          )}
        </div>
      )}

      {/* Price options */}
      {hasDinner && dinner.priceOptions.length > 0 && (
        <div className="card">
          <div className="card-label">💰 {t.dinner.pricing}</div>
          {dinner.priceOptions.map((p, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:14 }}>
              <span>{p.label}</span>
              <span style={{ fontWeight:500 }}>R${formatCurrency(p.price)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Registration */}
      {hasDinner && (
        <>
          {err && <div className="error-box">{err}</div>}

          {(isLocked || dinner.closed) && !canManage ? (
            <div className="notice notice-amber">
              <span>🔒</span><span>{dinner.lockMessage || t.dinner.lockedMessage}</span>
            </div>
          ) : canRegister ? (
            <div className="card">
              <div className="card-label">{t.dinner.addToList}</div>
              <div className="form-group" style={{ marginBottom:8 }}>
                <input className="form-input" type="text" placeholder={t.dinner.namePlaceholder}
                  value={addName} list="dancer-list"
                  data-field="addName" data-required="true" onChange={e => { setAddName(e.target.value); setSearchDancer(e.target.value) }}
                />
                <datalist id="dancer-list">
                  {filteredDancers.map(d => <option key={d.id} value={d.name} />)}
                </datalist>
              </div>
              {dinner.priceOptions.length > 1 && (
                <div className="form-group" style={{ marginBottom:8 }}>
                  <select className="form-input" value={addPriceIdx}
                    onChange={e => setAddPriceIdx(Number(e.target.value))}>
                    {dinner.priceOptions.map((p, i) => (
                      <option key={i} value={i}>{p.label} — R${formatCurrency(p.price)}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-primary" style={{ flex:1 }} onClick={() => register(false)}>
                  {t.dinner.addToList}
                </button>
                {canManage && (
                  <button className="btn" onClick={() => register(true)}>👨‍🍳</button>
                )}
              </div>
              {!auth.role && !alreadyIn && (
                <div style={{ marginTop:8, textAlign:'center' }}>
                  <button className="link-btn" onClick={() => setShowRequest(true)}>
                    {t.login.noAccess}
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {/* Attendees list */}
          <div className="card">
            <div className="card-label">{t.dinner.confirmed} ({dinner.attendees.length})</div>
            {dinner.attendees.length === 0 && <p className="empty-state">Nenhum inscrito ainda.</p>}
            {dinner.attendees.map((a, i) => (
              <div key={i} className="dancer-row">
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="dancer-nome">
                    {a.isCook && <span>👨‍🍳 </span>}{a.name}
                    {a.present === true  && <span style={{ color:'var(--green-tx)', marginLeft:6, fontSize:12 }}>✓</span>}
                    {a.present === false && <span style={{ color:'var(--red-tx)',   marginLeft:6, fontSize:12 }}>✗</span>}
                  </div>
                  {a.priceLabel && <div className="dancer-sub">{a.priceLabel} · R${formatCurrency(a.price)}</div>}
                </div>
                {(canManage || a.phone === auth.userPhone) && (
                  <button className="btn-remove" onClick={() => remove(i)}>×</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Modal PIX ─────────────────────────────────────────────────── */}
      {showPix && (
        <div className="overlay" onClick={() => setShowPix(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">💠 Pagar via PIX</span>
              <button className="sheet-close" onClick={() => setShowPix(false)}>×</button>
            </div>
            <div className="sheet-body">
              <div style={{ fontSize:13, color:'var(--muted)', marginBottom:12 }}>
                Chave PIX: <strong>{dinner.pixKey}</strong>
              </div>

              <div className="form-group">
                <label className="form-label">Valor (R$)</label>
                <input
                  className="form-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                  value={pixAmount}
                  onChange={e => { setPixAmount(e.target.value); setPixCopied(false) }}
                  autoFocus
                />
              </div>

              {pixPayload && (
                <>
                  {/* QR Code via API pública */}
                  <div style={{ display:'flex', justifyContent:'center', margin:'16px 0' }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixPayload)}`}
                      alt="QR Code PIX"
                      style={{ width:200, height:200, borderRadius:8, border:'1px solid var(--border)' }}
                    />
                  </div>

                  <div style={{ fontSize:11, color:'var(--muted)', textAlign:'center', marginBottom:12 }}>
                    Escaneie o QR Code com o app do seu banco
                  </div>

                  <div style={{ display:'flex', gap:8 }}>
                    <button
                      className={`btn btn-block ${pixCopied ? 'btn-primary' : ''}`}
                      style={{ flex:1 }}
                      onClick={copyPix}
                    >
                      {pixCopied ? '✓ Código copiado!' : '📋 Copiar código PIX'}
                    </button>
                  </div>

                  <div style={{ marginTop:10, padding:'8px 10px', background:'var(--bg)', borderRadius:8, fontSize:11, color:'var(--muted)', wordBreak:'break-all' }}>
                    {pixPayload.slice(0, 60)}…
                  </div>
                </>
              )}

              {!pixPayload && pixAmount && (
                <div className="notice notice-amber" role="alert">
                  <span>⚠️</span><span style={{ fontSize:13 }}>Digite um valor válido maior que zero.</span>
                </div>
              )}
            </div>
            <div className="sheet-footer">
              <button className="btn btn-block" onClick={() => setShowPix(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit dinner sheet */}
      {showEdit && (
        <div className="overlay" onClick={() => setShowEdit(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">{t.dinner.editDinner}</span>
              <button className="sheet-close" onClick={() => setShowEdit(false)}>×</button>
            </div>
            <div className="sheet-body" ref={formEditRef}>
              {err && <div className="error-box">{err}</div>}
              {([
                ['title',      t.dinner.titleLabel,  'text'],
                ['eventDate',  t.dinner.date,         'date'],
                ['organizer',  t.dinner.organizer,    'text'],
                ['deadline',   t.dinner.deadline,     'text'],
                ['lockAt',     t.dinner.lockTime,     'datetime-local'],
                ['lockMessage',t.dinner.lockMessage,  'text'],
                ['pixKey',     t.dinner.pixKey,       'text'],
              ] as [keyof DinnerEvent, string, string][]).map(([field, label, type]) => (
                <div key={field} className="form-group">
                  <label className="form-label">{label}</label>
                  <input className="form-input" type={type}
                    value={(editForm[field] as string) ?? ''}
                    data-field={field}
                    {...(field === 'title' ? { 'data-required': 'true' } : {})}
                    onChange={e => setEditForm({ ...editForm, [field]: e.target.value })} />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label" style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type="checkbox" checked={editForm.isDonation ?? dinner.isDonation}
                    onChange={e => setEditForm({ ...editForm, isDonation: e.target.checked })} />
                  {t.dinner.donation}
                </label>
              </div>
            </div>
            <div className="sheet-footer">
              <button className="btn" onClick={() => setShowEdit(false)}>{t.app.cancel}</button>
              <button className="btn btn-primary" onClick={saveEdit}>{t.app.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* Expense sheet */}
      {showExpense && (
        <div className="overlay" onClick={() => setShowExpense(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">{t.dinner.registerExpense}</span>
              <button className="sheet-close" onClick={() => setShowExpense(false)}>×</button>
            </div>
            <div className="sheet-body" ref={formExpenseRef}>
              {err && <div className="error-box">{err}</div>}
              <div className="form-group">
                <label className="form-label">{t.dinner.expenseValue}</label>
                <input className="form-input" type="number" step="0.01" value={expenseVal}
                  data-field="expenseVal" data-required="true"
                  onChange={e => setExpenseVal(e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">{t.dinner.expenseDescLabel}</label>
                <input className="form-input" type="text" value={expenseDesc}
                  onChange={e => setExpenseDesc(e.target.value)} />
              </div>
            </div>
            <div className="sheet-footer">
              <button className="btn" onClick={() => setShowExpense(false)}>{t.app.cancel}</button>
              <button className="btn btn-primary" onClick={saveExpense}>{t.app.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* Access request sheet */}
      {showRequest && !reqOk && (
        <div className="overlay" onClick={() => setShowRequest(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">{t.accessRequest.title}</span>
              <button className="sheet-close" onClick={() => setShowRequest(false)}>×</button>
            </div>
            <div className="sheet-body" ref={formReqRef}>
              <p className="sheet-sub">{t.accessRequest.subtitle}</p>
              {err && <div className="error-box">{err}</div>}
              <div className="form-group">
                <label className="form-label">{t.accessRequest.nameLabel}</label>
                <input className="form-input" type="text" value={reqName} data-field="reqName" data-required="true" onChange={e => setReqName(e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">{t.accessRequest.phoneLabel}</label>
                <input className="form-input" type="tel" value={reqPhone} data-field="reqPhone" data-required="true" onChange={e => setReqPhone(e.target.value)} maxLength={15} />
              </div>
              <div className="form-group">
                <label className="form-label">{t.accessRequest.reasonLabel}</label>
                <textarea className="form-input" value={reqReason} data-field="reqReason" data-required="true" onChange={e => setReqReason(e.target.value)}
                  placeholder={t.accessRequest.reasonPlaceholder} style={{ minHeight:72 }} />
              </div>
            </div>
            <div className="sheet-footer">
              <button className="btn" onClick={() => setShowRequest(false)}>{t.app.cancel}</button>
              <button className="btn btn-primary" onClick={submitRequest}>{t.accessRequest.sendBtn}</button>
            </div>
          </div>
        </div>
      )}
      {showRequest && reqOk && (
        <div className="overlay" onClick={() => { setShowRequest(false); setReqOk(false) }}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div style={{ textAlign:'center', padding:'2rem' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
              <p style={{ fontSize:14, color:'var(--muted)', lineHeight:1.6 }}>{t.accessRequest.successMessage}</p>
            </div>
            <div className="sheet-footer">
              <button className="btn btn-block" onClick={() => { setShowRequest(false); setReqOk(false) }}>
                {t.accessRequest.backToLogin}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
