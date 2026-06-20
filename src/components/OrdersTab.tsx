import { useState, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n'
import { AppState } from '../App'
import { Order, formatCurrency, cleanPhone } from '../lib/store'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 20

interface Props { state: AppState; mutComandas: (o: Record<string, Order>) => void; mutLog: (l: any) => void; [k: string]: any }

export function ComandasTab({ state, mutComandas, mutLog }: Props) {
  const auth = useAuth()
  const { t } = useTranslation()

  const orders  = state.orders
  const dancers = state.dancers

  const [search,        setSearch]        = useState('')
  const [filter,        setFilter]        = useState<'open'|'paid'|'all'>('open')
  const [showForm,      setShowForm]      = useState(false)
  const [showPay,       setShowPay]       = useState<string|null>(null)
  const [editingId,     setEditingId]     = useState<string|null>(null)
  const [orderName,     setOrderName]     = useState('')
  const [orderDate,     setOrderDate]     = useState(new Date().toISOString().slice(0,10))
  const [items,         setItems]         = useState<{desc:string;amount:number;qty:number}[]>([{desc:'',amount:0,qty:1}])
  const [existingAlert, setExistingAlert] = useState(false)
  const [formErr,       setFormErr]       = useState('')
  const [payMethod,     setPayMethod]     = useState('')
  const [payNotes,      setPayNotes]      = useState('')
  const [page,          setPage]          = useState(0)
  const [receiptFile,   setReceiptFile]   = useState<File | null>(null)
  const [receiptPreview,setReceiptPreview]= useState<string | null>(null)
  const [uploading,     setUploading]     = useState(false)
  const [showView,      setShowView]      = useState<string | null>(null)
  const receiptInputRef = useRef<HTMLInputElement>(null)

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setReceiptFile(file)
    if (file) {
      const reader = new FileReader()
      reader.onload = ev => setReceiptPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setReceiptPreview(null)
    }
  }

  const uploadReceipt = async (orderId: string, file: File): Promise<string | null> => {
    const BUCKET = 'order-receipts'
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `receipts/${orderId}_${Date.now()}.${ext}`

    // Tentar criar bucket caso não exista (idempotente)
    try {
      await supabase.storage.createBucket(BUCKET, { public: true })
    } catch (_) { /* já existe ou sem permissão — tudo bem */ }

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
    if (error) {
      console.warn('Upload storage falhou, usando base64 local:', error.message)
      // Fallback: armazenar como data-URL (fica só no estado local)
      return new Promise(resolve => {
        const r = new FileReader()
        r.onload = () => resolve(r.result as string)
        r.onerror = () => resolve(null)
        r.readAsDataURL(file)
      })
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
  }

  // Dancers linked to current user (guardian)
  const myDancers = (() => {
    if (!auth.userPhone) return Object.values(dancers)
    if (auth.isGuardian()) {
      return Object.values(dancers).filter(d => {
        const phones = [cleanPhone(d.phone), cleanPhone(d.guardian1Phone), cleanPhone(d.guardian2Phone), ...d.extraContacts.map(c => cleanPhone(c.phone))]
        return phones.includes(auth.userPhone!)
      })
    }
    return Object.values(dancers)
  })()
  const myDancerNames = myDancers.map(d => d.name.toLowerCase())

  // Autocomplete names (scoped to visible dancers)
  const knownNames = [...new Set([
    ...myDancers.map(d => d.name),
    ...myDancers.flatMap(d => [d.guardian1Name, d.guardian2Name].filter(Boolean)),
  ])] as string[]

  const canSee = (o: Order) => {
    if (auth.canCaixa()) return true
    if (auth.isGuardian() || auth.isOrganizer()) {
      if (o.phone === auth.userPhone || o.createdBy === auth.userPhone) return true
      return myDancerNames.some(n => o.name.toLowerCase().includes(n) || n.includes(o.name.toLowerCase()))
    }
    return false
  }

  const filtered = Object.values(orders)
    .filter(o => canSee(o))
    .filter(o => {
      if (filter === 'open') return !o.paid
      if (filter === 'paid') return  o.paid
      return true
    })
    .filter(o => {
      if (!search) return true
      const q = search.toLowerCase()
      return (o.name||'').toLowerCase().includes(q) || (o.description||'').toLowerCase().includes(q)
    })
    .sort((a, b) => (b.ts||0) - (a.ts||0))

  const totalOpen  = filtered.filter(o => !o.paid).reduce((s, o) => s + (o.amount||0), 0)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageOrders = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const checkExisting = (name: string, date: string) => {
    const ex = Object.values(orders).find(o => !o.paid && o.name === name && o.date === date && canSee(o))
    if (ex) { setEditingId(ex.id); setItems((ex.items||[{desc:ex.description||'',amount:ex.amount||0}]).map(it => ({...it,qty:1}))); setExistingAlert(true) }
    else    { setEditingId(null); setExistingAlert(false) }
  }

  const openNew = () => {
    setFormErr(''); setOrderName(''); setOrderDate(new Date().toISOString().slice(0,10))
    setItems([{desc:'',amount:0,qty:1}]); setEditingId(null); setExistingAlert(false); setShowForm(true)
  }

  const openEdit = (id: string) => {
    const o = orders[id]; if (!o || o.paid) return
    setEditingId(id); setOrderName(o.name||''); setOrderDate(o.date||new Date().toISOString().slice(0,10))
    setItems((o.items||[{desc:o.description||'',amount:o.amount||0,qty:1}]).map(it => ({...it,qty:1})))
    setExistingAlert(false); setFormErr(''); setShowForm(true)
  }

  const saveOrder = () => {
    setFormErr('')
    const name = orderName.trim()
    if (!name) { setFormErr(t.orders.nameRequired); return }
    const validItems = items.filter(it => it.desc && it.amount > 0)
    if (!validItems.length) { setFormErr(t.orders.itemRequired); return }
    const expanded = validItems.map(it => ({ description: it.qty > 1 ? `${it.desc} (x${it.qty})` : it.desc, amount: (parseFloat(String(it.amount))||0) * (it.qty||1) }))
    const total = expanded.reduce((s, it) => s + it.amount, 0)
    const id = editingId || 'o' + Date.now()
    const existing = orders[id]
    const order: Order = {
      id, name, date: orderDate,
      description: expanded.map(it => it.description).join(', '),
      amount: total, items: expanded,
      paid: existing?.paid || false,
      paymentMethod: existing?.paymentMethod, paymentNotes: existing?.paymentNotes,
      phone: existing?.phone || auth.userPhone || undefined,
      createdBy: existing?.createdBy || auth.userPhone || auth.userName || undefined,
      ts: existing?.ts || Date.now(),
    }
    mutComandas({ ...orders, [id]: order })
    mutLog({ type: 'super', action: editingId ? 'Comanda editada' : 'Comanda aberta', actor: auth.userName??'', diff: { before: '—', after: `${name} R$${formatCurrency(total)}` } })
    setEditingId(null); setShowForm(false)
  }

  const confirmPayment = async () => {
    if (!payMethod) { alert(t.orders.methodRequired); return }
    const o = orders[showPay!]; if (!o) return
    setUploading(true)
    let receiptUrl: string | undefined
    if (receiptFile) {
      const url = await uploadReceipt(o.id, receiptFile)
      if (url) receiptUrl = url
    }
    setUploading(false)
    mutComandas({ ...orders, [showPay!]: { ...o, paid: true, paymentMethod: payMethod, paymentNotes: payNotes.trim(), receiptUrl } })
    mutLog({ type: 'super', action: 'Comanda paga', actor: auth.userName??'', diff: { before: o.name, after: `R$${formatCurrency(o.amount)} via ${payMethod}` } })
    setShowPay(null); setPayMethod(''); setPayNotes(''); setReceiptFile(null); setReceiptPreview(null)
  }

  const reversePayment = (id: string) => {
    const o = orders[id]; if (!o || !o.paid) return
    if (!confirm(t.orders.reverseConfirm(formatCurrency(o.amount), o.name))) return
    const { paymentMethod: _, ...rest } = o
    mutComandas({ ...orders, [id]: { ...rest, paid: false } })
    mutLog({ type: 'super', action: 'Pagamento estornado', actor: auth.userName??'', diff: { before: `R$${formatCurrency(o.amount)} pago`, after: 'Em aberto' } })
  }

  const deleteOrder = (id: string) => {
    const o = orders[id]
    if (!o || !confirm(t.orders.deleteConfirm(o.name))) return
    const updated = { ...orders }; delete updated[id]; mutComandas(updated)
    mutLog({ type: 'super', action: 'Comanda excluída', actor: auth.userName??'', diff: { before: `${o.name} R$${formatCurrency(o.amount)}`, after: '—' } })
  }

  const canDelete = auth.canCaixa() || auth.isCoordination() || auth.isSecretariat()
  const canCreate = auth.canCaixa()

  return (
    <div>
      {(auth.isGuardian() || auth.isOrganizer()) && totalOpen > 0 && (
        <div className="notice notice-amber" style={{ marginBottom: '1rem' }}>
          <span>💳</span>
          <div>{t.orders.openAlert(`R$${formatCurrency(totalOpen)}`)}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        <input className="search-box"
          placeholder={auth.isGuardian() ? t.orders.searchMine : t.orders.searchAll}
          value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
          style={{ flex: 1, marginBottom: 0 }} />
        {canCreate && (
          <button className="btn btn-primary" onClick={openNew} style={{ whiteSpace: 'nowrap' }}>
            + {t.orders.openOrder}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: '1rem', flexWrap: 'wrap' }}>
        {(['open','paid','all'] as const).map(f => (
          <button key={f} className={`log-filter ${filter===f?'active':''}`}
            onClick={() => { setFilter(f); setPage(0) }}>
            {f==='open' ? t.orders.filterOpen : f==='paid' ? t.orders.filterPaid : t.orders.filterAll}
          </button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center', marginLeft: 4 }}>
          {filtered.length}
        </span>
      </div>

      {filtered.length === 0 && <p className="empty-state">{t.orders.noneFound}</p>}

      {pageOrders.map(o => {
        const dtStr = o.date ? new Date(o.date+'T12:00:00').toLocaleDateString('pt-BR',{day:'numeric',month:'short'}) : ''
        const methodLabel = o.paymentMethod ? (t.orders.methodLabels[o.paymentMethod] || o.paymentMethod) : ''
        const paidInfo = o.paid ? ` · ${methodLabel}${o.paymentNotes ? ' · '+o.paymentNotes : ''}` : ` · ${t.orders.filterOpen}`
        return (
          <div key={o.id} className={`comanda-row ${o.paid?'paga':'aberta'}`}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="comanda-nome">{o.name} <span style={{ fontSize: 10, color: 'var(--muted)' }}>{dtStr}</span></div>
              {o.items && o.items.length > 1
                ? o.items.map((it,i) => (
                    <div key={i} className="comanda-data" style={{ display:'flex',justifyContent:'space-between' }}>
                      <span>{it.description}</span><span>R${formatCurrency(it.amount)}</span>
                    </div>
                  ))
                : <div className="comanda-data">{o.description||''}{paidInfo}</div>}
              {o.items && o.items.length > 1 && (
                <div className="comanda-data" style={{ fontSize: 10, color: 'var(--muted)' }}>{paidInfo}</div>
              )}
            </div>
            <div className="comanda-valor">R${formatCurrency(o.amount||0)}</div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
              {!o.paid && (auth.canCaixa() || auth.isGuardian() || auth.isOrganizer()) && (
                <button className="btn btn-sm btn-primary" style={{ margin:0, padding:'4px 8px', fontSize:11 }}
                  onClick={() => { setShowPay(o.id); setPayMethod(''); setPayNotes(''); setReceiptFile(null); setReceiptPreview(null) }}>
                  {t.orders.payBtn}
                </button>
              )}
              {!o.paid && auth.canCaixa() && (
                <button className="btn btn-sm" style={{ margin:0, padding:'4px 8px', fontSize:11 }}
                  onClick={() => openEdit(o.id)}>✏️</button>
              )}
              {o.paid && auth.canCaixa() && (
                <button className="btn btn-sm" style={{ margin:0, padding:'4px 8px', fontSize:11, color:'var(--amber-tx)', borderColor:'var(--amber-tx)' }}
                  onClick={() => reversePayment(o.id)}>{t.orders.reverseBtn}</button>
              )}
              {o.paid && (
                <button className="btn btn-sm" style={{ margin:0, padding:'4px 8px', fontSize:11 }}
                  onClick={() => setShowView(o.id)} title="Ver detalhes">👁</button>
              )}
              {(o as any).receiptUrl && (
                <a href={(o as any).receiptUrl} target="_blank" rel="noopener noreferrer"
                  className="btn btn-sm" style={{ margin:0, padding:'4px 8px', fontSize:11, textDecoration:'none' }}
                  title="Ver comprovante">🧾</a>
              )}
              {o.paid && <span style={{ fontSize:10, padding:'2px 6px', borderRadius:20, background:'var(--green-bg)', color:'var(--green-tx)', fontWeight:500 }}>✓</span>}
              {canDelete && <button className="btn-remove" style={{ fontSize:16 }} onClick={() => deleteOrder(o.id)}>🗑</button>}
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

      {/* New/edit order sheet */}
      {showForm && (
        <div className="overlay" onClick={() => setShowForm(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">{t.orders.openOrder}</span>
              <button className="sheet-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div className="sheet-body">
              <p className="sheet-sub">{t.orders.existingNote}</p>
              {formErr && <div className="error-box">{formErr}</div>}
              <div className="form-group">
                <label className="form-label">{t.orders.personLabel}</label>
                <input className="form-input" type="text" placeholder={t.orders.namePlaceholder}
                  value={orderName} list="order-name-list" autoFocus
                  onChange={e => { setOrderName(e.target.value); checkExisting(e.target.value, orderDate) }} />
                <datalist id="order-name-list">{knownNames.map(n => <option key={n} value={n}/>)}</datalist>
              </div>
              <div className="form-group">
                <label className="form-label">{t.orders.dateLabel}</label>
                <input className="form-input" type="date" value={orderDate}
                  onChange={e => { setOrderDate(e.target.value); checkExisting(orderName, e.target.value) }} />
              </div>
              {existingAlert && (
                <div style={{ background:'var(--amber-bg)', color:'var(--amber-tx)', borderRadius:8, padding:'8px 12px', fontSize:12, marginBottom:8 }}>
                  {t.orders.existingAlert}
                </div>
              )}
              <div className="mini-label" style={{ marginBottom: 6 }}>{t.orders.itemsLabel}</div>
              {items.map((it, i) => (
                <div key={i} style={{ display:'flex', gap:6, marginBottom:8, alignItems:'center' }}>
                  <input className="form-input" type="text" value={it.desc} placeholder={t.orders.descPlaceholder}
                    style={{ flex:1, fontSize:13, padding:'7px 10px' }}
                    onChange={e => { const a=[...items]; a[i]={...a[i],desc:e.target.value}; setItems(a) }} />
                  <div style={{ display:'flex', alignItems:'center', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', overflow:'hidden', background:'var(--surface)', flexShrink:0 }}>
                    <span style={{ padding:'7px 6px 7px 8px', fontSize:12, color:'var(--muted)', borderRight:'1px solid var(--border)', background:'var(--bg)' }}>R$</span>
                    <input type="number" value={it.amount||''} placeholder="0,00" min="0" step="0.01"
                      style={{ width:70, fontSize:13, padding:'7px 8px', textAlign:'right', border:'none', outline:'none', background:'transparent', fontFamily:'inherit' }}
                      onChange={e => { const a=[...items]; a[i]={...a[i],amount:parseFloat(e.target.value)||0}; setItems(a) }} />
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:3, flexShrink:0 }}>
                    <button style={{ width:24, height:28, border:'1px solid var(--border)', borderRadius:4, background:'var(--bg)', cursor:'pointer', fontSize:14, lineHeight:1 }}
                      onClick={() => { const a=[...items]; a[i]={...a[i],qty:Math.max(1,(a[i].qty||1)-1)}; setItems(a) }}>−</button>
                    <span style={{ minWidth:20, textAlign:'center', fontSize:13, fontWeight:500 }}>{it.qty||1}</span>
                    <button style={{ width:24, height:28, border:'1px solid var(--border)', borderRadius:4, background:'var(--bg)', cursor:'pointer', fontSize:14, lineHeight:1 }}
                      onClick={() => { const a=[...items]; a[i]={...a[i],qty:(a[i].qty||1)+1}; setItems(a) }}>+</button>
                  </div>
                  {items.length > 1 && <button className="btn-remove" style={{ fontSize:16 }} onClick={() => setItems(items.filter((_,j)=>j!==i))}>×</button>}
                </div>
              ))}
              <button className="add-link" onClick={() => setItems([...items, {desc:'',amount:0,qty:1}])}>
                {t.orders.addItem}
              </button>
            </div>
            <div className="sheet-footer">
              <button className="btn" onClick={() => setShowForm(false)}>{t.app.cancel}</button>
              <button className="btn btn-primary" onClick={saveOrder}>{t.orders.saveOrder}</button>
            </div>
          </div>
        </div>
      )}

      {/* View paid order sheet */}
      {showView && orders[showView] && (() => {
        const o = orders[showView]
        const methodLabel = o.paymentMethod ? (t.orders.methodLabels?.[o.paymentMethod] || o.paymentMethod) : ''
        const dtStr = o.date ? new Date(o.date+'T12:00:00').toLocaleDateString('pt-BR',{dateStyle:'long'}) : ''
        return (
          <div className="overlay" onClick={() => setShowView(null)}>
            <div className="sheet" onClick={e => e.stopPropagation()}>
              <div className="sheet-header">
                <span className="sheet-title">Comanda — {o.name}</span>
                <button className="sheet-close" onClick={() => setShowView(null)}>×</button>
              </div>
              <div className="sheet-body">
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                    <span style={{ color:'var(--muted)' }}>Data</span>
                    <span>{dtStr || '—'}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                    <span style={{ color:'var(--muted)' }}>Status</span>
                    <span style={{ color:'var(--green-tx)', fontWeight:600 }}>✓ Pago</span>
                  </div>
                  {methodLabel && (
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                      <span style={{ color:'var(--muted)' }}>Forma de pagamento</span>
                      <span>{methodLabel}</span>
                    </div>
                  )}
                  {o.paymentNotes && (
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                      <span style={{ color:'var(--muted)' }}>Observação</span>
                      <span>{o.paymentNotes}</span>
                    </div>
                  )}
                  <hr style={{ border:'none', borderTop:'1px solid var(--border)', margin:'4px 0' }} />
                  {o.items && o.items.length > 1
                    ? o.items.map((it,i) => (
                        <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                          <span>{it.description}</span>
                          <span>R${formatCurrency(it.amount)}</span>
                        </div>
                      ))
                    : <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                        <span>{o.description}</span>
                        <span>R${formatCurrency(o.amount)}</span>
                      </div>
                  }
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:700, marginTop:4, borderTop:'2px solid var(--border)', paddingTop:8 }}>
                    <span>Total</span>
                    <span style={{ color:'var(--dtg-brown)' }}>R${formatCurrency(o.amount)}</span>
                  </div>
                  {(o as any).receiptUrl && !(o as any).receiptUrl.startsWith('data:image') && (
                    <a href={(o as any).receiptUrl} target="_blank" rel="noopener noreferrer"
                      className="btn btn-sm" style={{ textDecoration:'none', textAlign:'center', marginTop:8 }}>
                      🧾 Ver comprovante
                    </a>
                  )}
                  {(o as any).receiptUrl?.startsWith('data:image') && (
                    <img src={(o as any).receiptUrl} alt="Comprovante"
                      style={{ maxWidth:'100%', borderRadius:8, marginTop:4, border:'1px solid var(--border)' }} />
                  )}
                </div>
              </div>
              <div className="sheet-footer">
                {auth.canCaixa() && (
                  <button className="btn" style={{ color:'var(--amber-tx)' }}
                    onClick={() => { reversePayment(o.id); setShowView(null) }}>
                    {t.orders.reverseBtn}
                  </button>
                )}
                <button className="btn btn-primary" onClick={() => setShowView(null)}>Fechar</button>
              </div>
            </div>
          </div>
        )
      })()}

      {showPay && orders[showPay] && (
        <div className="overlay" onClick={() => setShowPay(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">{t.orders.payOrder}</span>
              <button className="sheet-close" onClick={() => setShowPay(null)}>×</button>
            </div>
            <div className="sheet-body">
              {(() => { const o = orders[showPay]; return (
                <>
                  <div style={{ background:'var(--bg)', borderRadius:8, padding:12, marginBottom:'1rem', fontSize:14 }}>
                    <strong>{o.name}</strong><br />
                    {o.description||''} · <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, color:'var(--dtg-brown)' }}>R${formatCurrency(o.amount)}</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.orders.paymentMethod}</label>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:4 }}>
                      {[['pix',t.orders.pix],['dinheiro',t.orders.cash],['cartao_debito',t.orders.debit],['cartao_credito',t.orders.credit]].map(([v,label]) => (
                        <button key={v} className={`forma-pgto-btn ${payMethod===v?'selected':''}`}
                          onClick={() => setPayMethod(v)}>{label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.orders.obsLabel}</label>
                    <input className="form-input" type="text" placeholder={t.orders.obsPlaceholder}
                      value={payNotes} onChange={e => setPayNotes(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Comprovante <span style={{ fontWeight:400, color:'var(--muted)', fontSize:12 }}>(opcional)</span></label>
                    <input ref={receiptInputRef} type="file" accept="image/*,application/pdf"
                      style={{ display:'none' }} onChange={handleReceiptChange} />
                    <button className="btn btn-sm" style={{ width:'100%', marginTop:4 }}
                      onClick={() => receiptInputRef.current?.click()}>
                      📎 {receiptFile ? receiptFile.name : 'Anexar comprovante'}
                    </button>
                    {receiptPreview && receiptPreview.startsWith('data:image') && (
                      <img src={receiptPreview} alt="Comprovante"
                        style={{ marginTop:8, maxWidth:'100%', maxHeight:180, borderRadius:8, objectFit:'contain', border:'1px solid var(--border)' }} />
                    )}
                    {receiptFile && !receiptPreview?.startsWith('data:image') && (
                      <div style={{ fontSize:12, color:'var(--muted)', marginTop:6 }}>📄 {receiptFile.name}</div>
                    )}
                  </div>
                </>
              )})()}
            </div>
            <div className="sheet-footer">
              <button className="btn" onClick={() => setShowPay(null)}>{t.app.cancel}</button>
              <button className="btn btn-primary" onClick={confirmPayment} disabled={uploading}>
                {uploading ? 'Enviando...' : t.orders.confirmPayment}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
