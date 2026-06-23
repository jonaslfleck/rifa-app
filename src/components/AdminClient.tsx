'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Rifa, Reserva } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

interface Props { rifa: Rifa; reservas: Reserva[]; user: User }

export default function AdminClient({ rifa: initialRifa, reservas: initialReservas, user }: Props) {
  const supabase = createClient()
  const [tab, setTab] = useState<'config' | 'reservas' | 'numeros'>('config')
  const [rifa, setRifa] = useState(initialRifa)
  const [reservas, setReservas] = useState(initialReservas)
  const [saving, setSaving] = useState(false)
  const [cfgAlert, setCfgAlert] = useState<{ tipo: 'ok' | 'err'; msg: string } | null>(null)
  const [addQty, setAddQty] = useState(10)
  const [addStart, setAddStart] = useState(initialRifa.start_number + initialRifa.total_numbers)
  const [addAlert, setAddAlert] = useState<{ tipo: 'ok' | 'err'; msg: string } | null>(null)
  const [addSaving, setAddSaving] = useState(false)

  const [form, setForm] = useState({
    title: rifa.title,
    description: rifa.description ?? '',
    total_numbers: rifa.total_numbers,
    start_number: rifa.start_number,
    price: rifa.price,
    draw_date: rifa.draw_date ?? '',
    pix_type: rifa.pix_type ?? 'CPF',
    pix_key: rifa.pix_key ?? '',
    pix_name: rifa.pix_name ?? '',
    pix_city: rifa.pix_city ?? 'SAO PAULO',
    admin_emails: (rifa.admin_emails ?? []).join('\n'),
  })

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  async function saveConfig() {
    setSaving(true)
    const payload = {
      rifaId: rifa.id,
      title: form.title.trim(),
      description: form.description.trim(),
      total_numbers: parseInt(String(form.total_numbers), 10),
      start_number: parseInt(String(form.start_number), 10),
      price: parseFloat(String(form.price)),
      draw_date: form.draw_date || null,
      pix_type: form.pix_type,
      pix_key: form.pix_key.trim(),
      pix_name: form.pix_name.trim(),
      pix_city: form.pix_city.trim() || 'SAO PAULO',
      admin_emails: form.admin_emails.split('\n').map(e => e.trim()).filter(Boolean),
    }
    const res = await fetch('/api/rifa', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false)
    if (!res.ok) { setCfgAlert({ tipo: 'err', msg: 'Erro ao salvar.' }); return }
    setRifa(prev => ({ ...prev, ...payload }))
    setCfgAlert({ tipo: 'ok', msg: 'Configuração salva!' })
    setTimeout(() => setCfgAlert(null), 2500)
  }

  async function addNumeros() {
    const novoTotal = addStart - rifa.start_number + addQty
    setAddSaving(true)
    const res = await fetch('/api/rifa', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rifaId: rifa.id, total_numbers: novoTotal }),
    })
    setAddSaving(false)
    if (!res.ok) { setAddAlert({ tipo: 'err', msg: 'Erro ao adicionar números.' }); return }
    const novoFim = rifa.start_number + novoTotal - 1
    setRifa(prev => ({ ...prev, total_numbers: novoTotal }))
    setForm(prev => ({ ...prev, total_numbers: novoTotal }))
    setAddStart(novoFim + 1)
    setAddAlert({ tipo: 'ok', msg: `${addQty} números adicionados! Agora vai até ${novoFim}.` })
    setTimeout(() => setAddAlert(null), 3000)
  }

  async function updateReserva(id: string, status: 'pago' | 'cancelado') {
    const res = await fetch('/api/reservas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservaId: id, status, rifaId: rifa.id }),
    })
    if (!res.ok) return
    if (status === 'cancelado') setReservas(prev => prev.filter(r => r.id !== id))
    else setReservas(prev => prev.map(r => r.id === id ? { ...r, status } : r))
  }

  // Link wa.me agrupado por telefone — uma mensagem com todos os números do comprador.
  function whatsappLinkGroup(group: Reserva[]) {
    const first = group[0]
    let tel = (first.telefone ?? '').replace(/\D/g, '')
    if (tel.length <= 11) tel = '55' + tel
    const numerosStr = group.map(r => `#${r.numero}`).join(', ')
    const plural = group.length > 1 ? 'dos números' : 'do número'
    const msg = `Olá ${first.nome}! ✅ Confirmamos o pagamento ${plural} ${numerosStr} da "${rifa.title}". Boa sorte no sorteio! 🍀 — DTG Camboatá`
    return `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/admin/login'
  }

  const pending = reservas.filter(r => r.status === 'reservado')
  const paid = reservas.filter(r => r.status === 'pago')
  const fimAtual = rifa.start_number + rifa.total_numbers - 1
  const fimNovo = addStart + addQty - 1
  const paidGroups = paid.reduce<Record<string, Reserva[]>>((acc, r) => {
    const key = (r.telefone ?? '').replace(/\D/g, '') || r.id
    ;(acc[key] ??= []).push(r)
    return acc
  }, {})

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-stone-50'
  const lbl = 'text-xs text-gray-400 block mb-1'

  const TABS = [
    { id: 'config' as const, label: 'Configuração' },
    { id: 'numeros' as const, label: 'Adicionar números' },
    { id: 'reservas' as const, label: `Reservas (${pending.length})` },
  ]

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-emerald-900 text-white px-4 py-5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-emerald-400 text-xs font-medium tracking-widest uppercase mb-0.5">Painel admin</p>
            <h1 className="text-lg font-semibold">Rifa das Pilchas</h1>
            <p className="text-emerald-400 text-xs mt-0.5">{user.email}</p>
          </div>
          <div className="flex gap-2">
            <a href="/" className="border border-emerald-700 rounded-xl px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-800 transition-colors">Ver rifa</a>
            <button onClick={logout} className="border border-emerald-700 rounded-xl px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-800 transition-colors">Sair</button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-2xl p-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${tab === t.id ? 'bg-emerald-700 text-white' : 'text-gray-400 hover:text-gray-600'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* CONFIGURAÇÃO */}
        {tab === 'config' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <div>
              <label className={lbl}>Título</label>
              <input className={inp} value={form.title} onChange={f('title')} />
            </div>
            <div>
              <label className={lbl}>Descrição / prêmio</label>
              <input className={inp} value={form.description} onChange={f('description')} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={lbl}>Qtd números</label><input type="number" className={inp} value={form.total_numbers} onChange={f('total_numbers')} /></div>
              <div><label className={lbl}>Início</label><input type="number" className={inp} value={form.start_number} onChange={f('start_number')} /></div>
              <div><label className={lbl}>Valor (R$)</label><input type="number" step="0.50" className={inp} value={form.price} onChange={f('price')} /></div>
            </div>
            <div>
              <label className={lbl}>Data do sorteio</label>
              <input type="date" className={inp} value={form.draw_date} onChange={f('draw_date')} />
            </div>
            <hr className="border-gray-100" />
            <p className="text-xs font-medium text-gray-500 pt-1">Chave Pix</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Tipo</label>
                <select className={inp} value={form.pix_type} onChange={f('pix_type')}>
                  {['CPF','CNPJ','Telefone','E-mail','Aleatória'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Chave</label><input className={inp} value={form.pix_key} onChange={f('pix_key')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Nome do recebedor</label><input className={inp} value={form.pix_name} onChange={f('pix_name')} placeholder="Máx 25 caracteres" /></div>
              <div><label className={lbl}>Cidade</label><input className={inp} value={form.pix_city} onChange={f('pix_city')} /></div>
            </div>
            <hr className="border-gray-100" />
            <div>
              <label className={lbl}>E-mails admin autorizados (um por linha)</label>
              <textarea className={inp} rows={3} value={form.admin_emails} onChange={f('admin_emails')} />
            </div>
            <button onClick={saveConfig} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl px-5 py-2.5 text-sm font-medium disabled:opacity-50 transition-colors">
              {saving ? 'Salvando...' : 'Salvar configuração'}
            </button>
            {cfgAlert && (
              <div className={`rounded-xl px-4 py-2.5 text-sm ${cfgAlert.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {cfgAlert.msg}
              </div>
            )}
          </div>
        )}

        {/* ADICIONAR NÚMEROS */}
        {tab === 'numeros' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">Início</p>
                <p className="text-xl font-semibold text-gray-800">{rifa.start_number}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">Fim atual</p>
                <p className="text-xl font-semibold text-gray-800">{fimAtual}</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">Total atual</p>
                <p className="text-xl font-semibold text-emerald-700">{rifa.total_numbers}</p>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="text-sm font-medium text-gray-800 mb-1">Liberar mais números para venda</p>
              <p className="text-xs text-gray-400 mb-4">Informe o início da nova faixa e a quantidade de números a adicionar.</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className={lbl}>Início da nova faixa</label>
                  <input
                    type="number" min={rifa.start_number + 1}
                    value={addStart}
                    onChange={e => setAddStart(Math.max(rifa.start_number + 1, parseInt(e.target.value) || rifa.start_number + 1))}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>Quantos números?</label>
                  <input
                    type="number" min={1} max={1000}
                    value={addQty}
                    onChange={e => setAddQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className={inp}
                  />
                </div>
              </div>
              <div className="bg-stone-50 border border-gray-100 rounded-xl px-4 py-3 mb-4">
                <p className="text-xs text-gray-400">Nova faixa a adicionar:</p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">
                  Números <span className="text-emerald-700">{addStart}</span> até <span className="text-emerald-700">{fimNovo}</span> — <span className="text-emerald-700">{addQty}</span> número{addQty > 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={addNumeros} disabled={addSaving} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50 transition-colors">
                {addSaving ? 'Adicionando...' : `Adicionar ${addQty} número${addQty > 1 ? 's' : ''} (${addStart}–${fimNovo})`}
              </button>
              {addAlert && (
                <div className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${addAlert.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {addAlert.msg}
                </div>
              )}
            </div>
          </div>
        )}

        {/* RESERVAS */}
        {tab === 'reservas' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Disponíveis', rifa.total_numbers - pending.length - paid.length, 'text-gray-800'],
                ['Reservados', pending.length, 'text-amber-700'],
                ['Pagos', paid.length, 'text-emerald-700'],
              ].map(([label, val, cls]) => (
                <div key={String(label)} className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className={`text-2xl font-semibold ${cls}`}>{val}</p>
                </div>
              ))}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-amber-50">
                <p className="text-xs font-medium text-amber-800">Pendentes de pagamento ({pending.length})</p>
              </div>
              {pending.length === 0
                ? <p className="text-sm text-gray-400 px-5 py-4">Nenhuma reserva pendente.</p>
                : pending.map(r => (
                  <div key={r.id} className="flex items-start justify-between px-5 py-3.5 border-b border-gray-100 last:border-0 gap-3 hover:bg-stone-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm text-gray-800">#{r.numero}</span>
                        <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-medium">Pendente</span>
                      </div>
                      <p className="text-xs text-gray-500">{r.nome} · {r.telefone}</p>
                      <p className="text-xs text-gray-300 mt-0.5">{new Date(r.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => updateReserva(r.id, 'pago')} className="border border-emerald-300 text-emerald-700 rounded-lg px-2.5 py-1 text-xs hover:bg-emerald-50 font-medium transition-colors">✓ Pago</button>
                      <button onClick={() => updateReserva(r.id, 'cancelado')} className="border border-red-200 text-red-400 rounded-lg px-2 py-1 text-xs hover:bg-red-50 transition-colors">✕</button>
                    </div>
                  </div>
                ))}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-emerald-50">
                <p className="text-xs font-medium text-emerald-800">Pagamentos confirmados ({paid.length})</p>
              </div>
              {paid.length === 0
                ? <p className="text-sm text-gray-400 px-5 py-4">Nenhum pagamento confirmado.</p>
                : Object.values(paidGroups).map(group => {
                  const first = group[0]
                  return (
                    <div key={first.telefone + first.nome} className="border-b border-gray-100 last:border-0 hover:bg-stone-50">
                      <div className="flex items-start justify-between px-5 py-3.5 gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 font-medium mb-1.5">{first.nome} · {first.telefone}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {group.map(r => (
                              <div key={r.id} className="flex items-center gap-1">
                                <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-medium">#{r.numero}</span>
                                <button onClick={() => updateReserva(r.id, 'cancelado')} className="border border-red-200 text-red-400 rounded-lg px-1.5 py-0.5 text-xs hover:bg-red-50 transition-colors leading-none">✕</button>
                              </div>
                            ))}
                          </div>
                        </div>
                        <a href={whatsappLinkGroup(group)} target="_blank" rel="noopener noreferrer" className="border border-emerald-300 text-emerald-700 rounded-lg px-2.5 py-1 text-xs hover:bg-emerald-50 font-medium transition-colors shrink-0">💬 WhatsApp</a>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
