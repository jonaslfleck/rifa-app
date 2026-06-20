import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n'
import { AppState } from '../App'
import { DinnerEvent, PriceOption, formatCurrency } from '../lib/store'

interface Props {
  state: AppState
  mutDinner: (u: Partial<DinnerEvent>) => DinnerEvent
  mutLog: (l: any) => void
  [k: string]: any
}

export function MenuEditorTab({ state, mutDinner, mutLog }: Props) {
  const auth = useAuth()
  const { t } = useTranslation()
  const canEdit = auth.isSuper() || auth.isBoard() || auth.isOrganizer() || auth.isCoordination() || auth.isSecretariat()
  if (!canEdit) return <div className="empty-state">{t.app.noPermission}</div>

  const dinner = state.dinner
  const [menuItem, setMenuItem]   = useState('')
  const [newLabel, setNewLabel]   = useState('')
  const [newPrice, setNewPrice]   = useState('')
  const [printing, setPrinting]   = useState(false)

  const addMenuItem = () => {
    const item = menuItem.trim()
    if (!item) return
    mutDinner({ menu: [...dinner.menu, item] })
    setMenuItem('')
  }

  const removeMenuItem = (i: number) => {
    mutDinner({ menu: dinner.menu.filter((_, j) => j !== i) })
  }

  const addPriceOption = () => {
    const label = newLabel.trim()
    const price = parseFloat(newPrice.replace(',', '.'))
    if (!label || isNaN(price)) return
    const opt: PriceOption = { label, price }
    mutDinner({ priceOptions: [...dinner.priceOptions, opt] })
    setNewLabel(''); setNewPrice('')
  }

  const removePriceOption = (i: number) => {
    mutDinner({ priceOptions: dinner.priceOptions.filter((_, j) => j !== i) })
  }

  const print = () => {
    setPrinting(true)
    setTimeout(() => { window.print(); setPrinting(false) }, 100)
  }

  return (
    <div>
      <div className="card no-print">
        <div className="card-label">🍽️ {t.dinner.menu}</div>
        {dinner.menu.map((item, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0' }}>
            <span style={{ flex:1 }}>• {item}</span>
            <button className="btn-remove" onClick={() => removeMenuItem(i)}>×</button>
          </div>
        ))}
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <input className="form-input" type="text" placeholder="Adicionar prato..."
            value={menuItem} style={{ flex:1, fontSize:13 }}
            onChange={e => setMenuItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMenuItem()} />
          <button className="btn btn-sm btn-primary" onClick={addMenuItem}>+</button>
        </div>
      </div>

      <div className="card no-print">
        <div className="card-label">💰 {t.dinner.pricing}</div>
        {dinner.priceOptions.map((p, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0' }}>
            <span style={{ flex:1 }}>{p.label}</span>
            <span style={{ fontWeight:500 }}>R${formatCurrency(p.price)}</span>
            <button className="btn-remove" onClick={() => removePriceOption(i)}>×</button>
          </div>
        ))}
        <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
          <input className="form-input" type="text" placeholder="Descrição" value={newLabel}
            style={{ flex:2, minWidth:100, fontSize:13 }}
            onChange={e => setNewLabel(e.target.value)} />
          <input className="form-input" type="number" placeholder="R$" value={newPrice}
            style={{ flex:1, minWidth:70, fontSize:13 }}
            onChange={e => setNewPrice(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPriceOption()} />
          <button className="btn btn-sm btn-primary" onClick={addPriceOption}>+</button>
        </div>
      </div>

      <button className="btn btn-primary btn-block no-print" onClick={print} disabled={printing}>
        🖨️ {printing ? 'Preparando...' : t.nav.printMenu}
      </button>

      {/* Print view */}
      <div className="print-only" style={{ fontFamily:'serif', padding:'2rem', maxWidth:600 }}>
        <h1 style={{ fontFamily:'serif', marginBottom:4 }}>{dinner.title}</h1>
        {dinner.eventDate && <p style={{ color:'#666', marginBottom:8 }}>📅 {dinner.eventDate}</p>}
        {dinner.organizer && <p style={{ color:'#666', marginBottom:16 }}>👨‍🍳 {dinner.organizer}</p>}
        {dinner.menu.length > 0 && (
          <>
            <h2 style={{ borderBottom:'2px solid #333', paddingBottom:4, marginBottom:8 }}>Cardápio</h2>
            <ul style={{ paddingLeft:20, marginBottom:16 }}>
              {dinner.menu.map((item, i) => <li key={i} style={{ marginBottom:4, fontSize:16 }}>{item}</li>)}
            </ul>
          </>
        )}
        {dinner.priceOptions.length > 0 && (
          <>
            <h2 style={{ borderBottom:'2px solid #333', paddingBottom:4, marginBottom:8 }}>Valores</h2>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              {dinner.priceOptions.map((p, i) => (
                <tr key={i}>
                  <td style={{ padding:'4px 0', fontSize:15 }}>{p.label}</td>
                  <td style={{ textAlign:'right', fontWeight:600, fontSize:15 }}>R${formatCurrency(p.price)}</td>
                </tr>
              ))}
            </table>
          </>
        )}
        {dinner.pixKey && (
          <p style={{ marginTop:16, padding:'8px 12px', border:'1px solid #ccc', borderRadius:6 }}>
            💠 PIX: <strong>{dinner.pixKey}</strong>
          </p>
        )}
        {dinner.deadline && (
          <p style={{ marginTop:8, color:'#666', fontSize:13 }}>⏰ {dinner.deadline}</p>
        )}
      </div>
    </div>
  )
}
