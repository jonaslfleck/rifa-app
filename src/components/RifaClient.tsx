'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import { buildPixPayload, normalizePixKey } from '@/lib/pix'
import type { Rifa } from '@/lib/types'
import logoCamboata from '@/assets/logo-camboata-header-ofc.png'
import logoAtiradores from '@/assets/logo-atiradores-header.png'
import CampaignProgress from './CampaignProgress'

interface NumeroStatus { numero: number; status: 'reservado' | 'pago' }
interface Props { rifa: Rifa | null; reservas: NumeroStatus[] }

const PRIZES = [
  { n:1,  icon:'🔪', label:'Faca do Camboatá' },
  { n:2,  icon:'👜', label:'Bolsa de couro masculina' },
  { n:3,  icon:'👛', label:'Bolsa de couro feminina' },
  { n:4,  icon:'⚽', label:'Camisa da Seleção Brasileira autografada pelo goleiro Weverton' },
  { n:5,  icon:'🍺', label:'Barril de chopp 30 litros' },
  { n:6,  icon:'🔧', label:'Troca de óleo + revisão de 40 itens' },
  { n:7,  icon:'🥩', label:'Tábua de carne personalizada' },
  { n:8,  icon:'🧰', label:'Kit ferramentas' },
  { n:9,  icon:'🥕', label:'Processador de legumes' },
  { n:10, icon:'🔩', label:'Parafusadeira 12V' },
  { n:11, icon:'🍖', label:'Costelão Rota 77' },
  { n:12, icon:'🚪', label:'Armário 2 portas' },
  { n:13, icon:'👜', label:'Bolsa de couro' },
  { n:14, icon:'⚡', label:'Jarra elétrica' },
  { n:15, icon:'🏟️', label:'Miniatura 3D do estádio (Inter ou Grêmio)' },
  { n:16, icon:'🥤', label:'Liquidificador' },
  { n:17, icon:'🛏️', label:'Jogo de cama casal' },
  { n:18, icon:'👔', label:'Ferro de passar' },
  { n:19, icon:'🧉', label:'Kit Chimarrão Personalizado DTG Camboatá' },
  { n:20, icon:'🧉', label:'Kit Chimarrão (cuia, bomba e garrafa térmica)' },
  { n:21, icon:'🧉', label:'Kit Chimarrão' },
  { n:22, icon:'🛁', label:'Ofurô infantil' },
  { n:23, icon:'🧉', label:'Cantinho do Chima' },
  { n:24, icon:'💪', label:'Avaliação física com nutri + adipômetro' },
  { n:25, icon:'💆', label:'Massagem modeladora' },
  { n:26, icon:'✨', label:'Aplicação de lipo enzimática' },
  { n:27, icon:'🧴', label:'Kit Banho/Spa' },
  { n:28, icon:'✂️', label:'Corte masculino Genuine House' },
  { n:29, icon:'✂️', label:'Corte masculino' },
  { n:30, icon:'✂️', label:'Corte masculino' },
  { n:31, icon:'✂️', label:'Corte masculino' },
  { n:32, icon:'💅', label:'Manicure e Pedicure' },
  { n:33, icon:'🧊', label:'Bolsa térmica' },
  { n:34, icon:'🏖️', label:'Cadeira de praia' },
  { n:35, icon:'🏖️', label:'Cadeira de praia' },
  { n:36, icon:'🥩', label:'Tábua de carne' },
  { n:37, icon:'🥩', label:'Tábua de carne' },
  { n:38, icon:'🥩', label:'Tábua de carne' },
  { n:39, icon:'🥩', label:'Tábua de carne' },
  { n:40, icon:'🍴', label:'Faqueiro 24 peças' },
  { n:41, icon:'🥄', label:'Conjunto de sobremesa inox' },
  { n:42, icon:'🧹', label:'Mop giratório' },
  { n:43, icon:'🖼️', label:'Kit nichos de parede' },
  { n:44, icon:'🖼️', label:'Kit nichos de parede' },
  { n:45, icon:'📦', label:'Organizador 12,5 litros' },
  { n:46, icon:'🪣', label:'Bacia dobrável' },
  { n:47, icon:'🫙', label:'Jarra 2 litros' },
  { n:48, icon:'😴', label:'2 Travesseiros' },
  { n:49, icon:'🍬', label:'Cesta de guloseimas' },
  { n:50, icon:'🍬', label:'Cesta de guloseimas' },
  { n:51, icon:'🍭', label:'Cesta de doces' },
  { n:52, icon:'🎂', label:'Cuca de leite condensado e bombom' },
  { n:53, icon:'🥐', label:'Um cento de salgados' },
  { n:54, icon:'🏠', label:'Jogo de tapete' },
  { n:55, icon:'👟', label:'Par de Alpargatas' },
  { n:56, icon:'👜', label:'Bolsa Feminina' },
  { n:57, icon:'⚡', label:'Jarra Elétrica' },
  { n:58, icon:'☕', label:'Jogo de cafézinho' },
]

export default function RifaClient({ rifa, reservas: initialReservas }: Props) {
  const supabase = createClient()
  const [reservas, setReservas] = useState<NumeroStatus[]>(initialReservas)
  const [selecionados, setSelecionados] = useState<number[]>([])
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [alerta, setAlerta] = useState<{ tipo: 'ok' | 'err'; msg: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [showPrizes, setShowPrizes] = useState(false)
  const [showConsulta, setShowConsulta] = useState(false)
  const [consultaTel, setConsultaTel] = useState('')
  const [consultaResult, setConsultaResult] = useState<NumeroStatus[] | null>(null)
  const [consultando, setConsultando] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const payloadRef = useRef('')

  // Atualiza a grade de ocupados via RPC (sem expor nome/telefone).
  async function refreshOcupados() {
    if (!rifa) return
    const { data } = await supabase.rpc('numeros_ocupados', { p_rifa_id: rifa.id })
    if (data) setReservas(data as NumeroStatus[])
  }

  // Polling: atualiza a cada 20s e quando a aba volta ao foco.
  useEffect(() => {
    if (!rifa) return
    const id = setInterval(refreshOcupados, 20000)
    const onVis = () => { if (document.visibilityState === 'visible') refreshOcupados() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rifa])

  useEffect(() => {
    if (!modalOpen || !rifa?.pix_key || !rifa?.pix_name || !canvasRef.current) return
    const total = (rifa.price ?? 0) * selecionados.length
    const payload = buildPixPayload(rifa.pix_key, rifa.pix_name, rifa.pix_city ?? 'SAO PAULO', total)
    payloadRef.current = payload
    QRCode.toCanvas(canvasRef.current, payload, { width: 200, margin: 1, color: { dark: '#166534', light: '#f0fdf4' } })
  }, [modalOpen, rifa, selecionados])

  if (!rifa) return (
    <div className="flex items-center justify-center min-h-screen text-gray-400">Rifa não configurada.</div>
  )

  const nums = Array.from({ length: rifa.total_numbers }, (_, i) => rifa.start_number + i)
  const statusMap = Object.fromEntries(reservas.map(r => [r.numero, r.status]))
  const total = rifa.price * selecionados.length
  const disponiveis = nums.filter(n => !statusMap[n]).length
  const reservados = reservas.filter(r => r.status === 'reservado').length
  const pagos = reservas.filter(r => r.status === 'pago').length

  function toggleNum(n: number) {
    setSelecionados(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n].sort((a, b) => a - b))
  }

  function abrirModal() {
    if (!nome.trim() || !telefone.trim()) { setAlerta({ tipo: 'err', msg: 'Preencha nome e telefone.' }); return }
    const ocupados = selecionados.filter(n => statusMap[n])
    if (ocupados.length > 0) {
      setAlerta({ tipo: 'err', msg: `Número(s) ${ocupados.join(', ')} já reservados. Remova-os.` })
      setSelecionados(prev => prev.filter(n => !ocupados.includes(n)))
      return
    }
    setAlerta(null)
    setModalOpen(true)
  }

  async function confirmarReserva() {
    if (!rifa) {
      setAlerta({
        tipo: 'err',
        msg: 'Rifa não configurada.'
      })
      return
    }

    setEnviando(true)

    const { error } = await supabase.from('reservas').insert(
      selecionados.map(numero => ({
        rifa_id: rifa.id,
        numero,
        nome: nome.trim(),
        telefone: telefone.replace(/\D/g, ''),
        status: 'reservado'
      }))
    )

    setEnviando(false)

    if (error) {
      setModalOpen(false)
      // 23505 = violação do índice único (rifa_id, numero): alguém reservou antes.
      if (error.code === '23505') {
        setAlerta({
          tipo: 'err',
          msg: 'Este número acabou de ser reservado por outra pessoa. Escolha outro número.'
        })
        // Recarrega a ocupação atual e remove da seleção o que já foi tomado.
        const { data: atuais } = await supabase.rpc('numeros_ocupados', { p_rifa_id: rifa.id })
        if (atuais) {
          setReservas(atuais as NumeroStatus[])
          const tomados = new Set((atuais as NumeroStatus[]).map(a => a.numero))
          setSelecionados(prev => prev.filter(n => !tomados.has(n)))
        }
        return
      }
      setAlerta({
        tipo: 'err',
        msg: 'Erro ao reservar. Tente novamente.'
      })
      return
    }

    // Notifica os admins por email (não bloqueia nem falha a reserva).
    fetch('/api/notificar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rifaId: rifa.id,
        nome: nome.trim(),
        telefone: telefone.replace(/\D/g, ''),
        numeros: selecionados,
      }),
    }).catch(() => {})

    setModalOpen(false)
    setSelecionados([])
    setNome('')
    setTelefone('')
    refreshOcupados()
    setAlerta({
      tipo: 'ok',
      msg: 'Reserva feita! Efetue o pagamento via Pix para confirmar.'
    })

    setTimeout(() => setAlerta(null), 6000)
  }

  async function copyPayload() {
    await navigator.clipboard.writeText(payloadRef.current)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function copyPixKey() {
    if (!rifa?.pix_key) return
    await navigator.clipboard.writeText(normalizePixKey(rifa.pix_key))
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  async function consultarNumeros() {
    if (!rifa) return
    const tel = consultaTel.replace(/\D/g, '')
    if (tel.length < 8) {
      setConsultaResult([])
      return
    }
    setConsultando(true)
    const { data } = await supabase.rpc('meus_numeros', { p_rifa_id: rifa.id, p_telefone: tel })
    setConsultando(false)
    setConsultaResult((data ?? []) as NumeroStatus[])
  }

  const fmtDate = (d: string) => { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}` }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white px-4 pt-9 pb-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-4">
            <Image
              src={logoCamboata}
              alt="Logo DTG Camboata"
              className="h-14 sm:h-16 w-auto object-contain"
              priority
            />
            <Image
              src={logoAtiradores}
              alt="Logo Atiradores"
              className="h-12 sm:h-14 w-auto object-contain"
              priority
            />
          </div>
          <p className="text-emerald-300 text-sm font-semibold tracking-widest uppercase mb-3">🍀 DTG Camboatá</p>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight bg-white/10 border border-emerald-400/30 rounded-2xl px-4 py-3">
            {rifa.title}
          </h1>
          <div className="grid grid-cols-2 sm:flex sm:gap-6 gap-3 mt-5">
            <div>
              <p className="text-emerald-400 text-xs">Valor por número</p>
              <p className="text-white font-bold text-xl">R$ {rifa.price.toFixed(2).replace('.', ',')}</p>
            </div>
            {rifa.draw_date && (
              <div>
                <p className="text-emerald-400 text-xs">Data do sorteio</p>
                <p className="text-white font-bold text-xl">{fmtDate(rifa.draw_date)}</p>
              </div>
            )}
            <div>
              <p className="text-emerald-400 text-xs">Disponíveis</p>
              <p className="text-white font-bold text-xl">{disponiveis} de {nums.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
          <p className="text-sm font-semibold text-amber-900">⏳ Aviso importante</p>
          <p className="text-sm text-amber-800 mt-1">
            Números reservados permanecem aguardando pagamento por até 24 horas. Após esse prazo, os números voltam a ficar disponíveis para venda.
          </p>
        </div>

        {/* Missão — Juvenart 2026 */}
        <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 rounded-2xl px-5 py-6 text-white">
          <div className="flex items-start gap-4">
            <span className="text-3xl shrink-0">🤠</span>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-snug mb-2">
                Ajude nossa Invernada Juvenil a representar o DTG Camboatá no Juvenart 2026!
              </h2>
              <p className="text-emerald-200 text-sm leading-relaxed">
                Cada número vendido ajuda a custear transporte, alimentação, hospedagem e despesas necessárias para que nossos jovens possam levar a tradição gaúcha adiante.
              </p>
            </div>
          </div>
        </div>

        {/* Contribuição */}
        <div>
          <p className="text-sm font-semibold text-stone-600 mb-3">Sua contribuição ajuda em:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: '🚌', label: 'Transporte' },
              { icon: '🍽️', label: 'Alimentação' },
              { icon: '🏨', label: 'Hospedagem' },
              { icon: '👘', label: 'Figurinos e manutenção das pilchas' },
              { icon: '🎪', label: 'Despesas do evento' },
            ].map(item => (
              <div key={item.label} className="bg-white border border-amber-200 rounded-xl p-3 flex items-center gap-2 shadow-sm">
                <span className="text-xl shrink-0">{item.icon}</span>
                <span className="text-xs font-medium text-stone-700 leading-tight">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Frase destaque */}
        <div className="border-l-4 border-red-600 pl-4 py-1">
          <p className="text-sm italic font-medium text-red-700">
            &ldquo;Quem apoia nossos jovens, ajuda a manter viva a tradição.&rdquo;
          </p>
        </div>

        {/* Selo 40 anos */}
        <div className="bg-gradient-to-r from-amber-50 to-stone-50 border border-amber-300 rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="bg-gradient-to-br from-amber-500 to-yellow-600 text-white rounded-full w-16 h-16 flex flex-col items-center justify-center shrink-0 shadow-md">
            <p className="text-xl font-extrabold leading-none">40</p>
            <p className="text-xs font-semibold leading-none">anos</p>
          </div>
          <div>
            <p className="text-xs text-amber-600 font-bold tracking-widest uppercase mb-0.5">1986 • 2026</p>
            <p className="text-base font-bold text-stone-800 leading-tight">40 anos do DTG Camboatá</p>
            <p className="text-xs italic text-stone-500 mt-1">&ldquo;Em qualquer chão, nossas raízes brotarão&rdquo;</p>
          </div>
        </div>

        {/* Barra de progresso */}
        <CampaignProgress meta={10000} arrecadado={0} titulo="Meta Juvenart 2026" />

        {/* Agradecimento */}
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-center">
          <p className="text-sm font-medium text-red-800">
            ❤️ Desde já agradecemos o carinho, o apoio e a torcida de todos!
          </p>
        </div>

        {/* Descrição dinâmica (admin) */}
        {rifa.description && (
          <div className="bg-gradient-to-r from-amber-50 to-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 flex items-start gap-3">
            <span className="text-2xl shrink-0">🌟</span>
            <div>
              <p className="text-sm font-semibold text-emerald-900">Informações adicionais</p>
              <p className="text-sm text-emerald-800 mt-0.5">{rifa.description}</p>
            </div>
          </div>
        )}

        {/* Consulta: Ver meus números */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowConsulta(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-emerald-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔎</span>
              <div className="text-left">
                <p className="font-medium text-gray-900 text-sm">Ver meus números</p>
                <p className="text-xs text-gray-400">Consulte pelo seu telefone</p>
              </div>
            </div>
            <span className={`text-gray-400 transition-transform ${showConsulta ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {showConsulta && (
            <div className="px-5 pb-5 pt-1 border-t border-gray-100 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={consultaTel}
                  onChange={e => setConsultaTel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') consultarNumeros() }}
                  placeholder="(00) 00000-0000"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-stone-50"
                />
                <button
                  onClick={consultarNumeros}
                  disabled={consultando}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl px-5 py-3 text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {consultando ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
              {consultaResult !== null && (
                consultaResult.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-2">Nenhum número encontrado para este telefone.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {consultaResult.map(r => (
                      <span
                        key={r.numero}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium border ${
                          r.status === 'pago'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                        }`}
                      >
                        <strong>{r.numero}</strong>
                        <span className="text-xs">{r.status === 'pago' ? '✓ Pago' : '⏳ Reservado'}</span>
                      </span>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* Botão ver prêmios */}
        <button
          onClick={() => setShowPrizes(v => !v)}
          className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-5 py-4 hover:border-emerald-300 hover:bg-emerald-50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div className="text-left">
              <p className="font-medium text-gray-900 text-sm">Ver os 58 prêmios</p>
              <p className="text-xs text-gray-400">Clique para expandir a lista completa</p>
            </div>
          </div>
          <span className={`text-gray-400 transition-transform ${showPrizes ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {/* Lista de prêmios */}
        {showPrizes && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-emerald-50">
              <p className="text-sm font-medium text-emerald-900">🏆 Relação dos prêmios — 58 chances de ganhar!</p>
            </div>
            <div className="divide-y divide-gray-100">
              {PRIZES.map(p => (
                <div key={p.n} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50 transition-colors">
                  <span className="text-xs font-mono text-gray-300 w-6 text-right shrink-0">{p.n}</span>
                  <span className="text-lg shrink-0">{p.icon}</span>
                  <span className="text-sm text-gray-700">{p.label}</span>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 bg-emerald-50 border-t border-gray-100 text-center">
              <p className="text-xs text-emerald-700 font-medium">🍀 58 chances de ganhar!</p>
            </div>
          </div>
        )}

        {/* Legenda */}
        <div className="flex gap-4 flex-wrap text-xs text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border border-gray-200 bg-white inline-block"></span>Disponível</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border-2 border-emerald-500 bg-emerald-50 inline-block"></span>Selecionado</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border border-amber-300 bg-amber-50 inline-block"></span>Reservado</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border border-gray-200 bg-gray-100 inline-block"></span>Pago</span>
        </div>

        {/* Grid de números */}
        <div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(58px, 1fr))' }}>
            {nums.map(n => {
              const st = statusMap[n]
              const sel = selecionados.includes(n)
              if (st === 'pago') return (
                <div key={n} className="h-14 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-base text-gray-300 line-through cursor-not-allowed select-none">
                  {n}
                </div>
              )
              let cls = 'h-14 rounded-xl border text-base font-semibold transition-all select-none '
              if (st === 'reservado') cls += 'bg-amber-50 border-amber-200 text-amber-600 cursor-not-allowed'
              else if (sel) cls += 'bg-emerald-50 border-2 border-emerald-500 text-emerald-800 shadow-sm'
              else cls += 'bg-white border-gray-200 text-gray-700 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer active:scale-95'
              return (
                <button key={n} className={cls} disabled={st === 'reservado'} onClick={() => toggleNum(n)}>
                  {n}
                </button>
              )
            })}
          </div>
        </div>

        {/* Barra de seleção */}
        {selecionados.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Números selecionados</p>
                <p className="font-semibold text-emerald-700 text-base">{selecionados.join(', ')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 mb-0.5">Total</p>
                <p className="font-semibold text-gray-900">R$ {total.toFixed(2).replace('.', ',')}</p>
              </div>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nome completo</label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-stone-50" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Telefone (WhatsApp)</label>
                <input type="text" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-stone-50" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={abrirModal} className="flex-1 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white rounded-xl py-3.5 text-base font-semibold transition-all">
                Reservar {selecionados.length} número{selecionados.length > 1 ? 's' : ''}
              </button>
              <button onClick={() => setSelecionados([])} className="border border-gray-200 rounded-xl px-5 py-3.5 text-sm text-gray-400 hover:bg-gray-50 transition-colors">
                Limpar
              </button>
            </div>
          </div>
        )}

        {alerta && (
          <div className={`rounded-xl px-4 py-3 text-sm ${alerta.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {alerta.msg}
          </div>
        )}

        {/* Seção final */}
        <div className="bg-gradient-to-br from-emerald-900 to-emerald-950 rounded-2xl px-5 py-7 text-center">
          <p className="text-3xl mb-3">🤠</p>
          <p className="text-sm sm:text-base italic font-semibold text-amber-400 mb-2 leading-snug">
            &ldquo;Quem apoia nossos jovens, ajuda a manter viva a tradição.&rdquo;
          </p>
          <p className="text-xs text-emerald-400 mt-2">DTG Camboatá — Juvenart 2026</p>
        </div>

        {/* Rodapé */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-300">🍀 Boa sorte!</p>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold mb-1">Confirmar reserva</h2>
            <p className="text-sm text-gray-500 mb-4">
              {nome}, você está reservando {selecionados.length} número{selecionados.length > 1 ? 's' : ''}: <strong className="text-gray-800">{selecionados.join(', ')}</strong> — total <strong className="text-emerald-700">R$ {total.toFixed(2).replace('.', ',')}</strong>.
            </p>

            {rifa.pix_key && rifa.pix_name && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 text-center">
                <p className="text-xs font-medium text-emerald-800 mb-1">Pague via Pix após reservar</p>
                <p className="text-xs text-emerald-600">{rifa.pix_type}: <strong className="text-emerald-900 break-all">{rifa.pix_key}</strong></p>
                <p className="text-xs text-emerald-600">Recebedor: <strong>{rifa.pix_name}</strong></p>
                <p className="text-xs text-emerald-600 mb-3">Banco: <strong>Sicredi</strong></p>
                <canvas ref={canvasRef} className="rounded-xl mx-auto block mb-3" />
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <button onClick={copyPixKey} className="inline-flex items-center justify-center gap-1.5 border border-emerald-400 text-emerald-700 rounded-lg px-3 py-2 text-xs hover:bg-emerald-100 transition-colors font-medium">
                    {copiedKey ? '✓ Chave copiada!' : '🔑 Copiar chave PIX'}
                  </button>
                  <button onClick={copyPayload} className="inline-flex items-center justify-center gap-1.5 border border-emerald-400 text-emerald-700 rounded-lg px-3 py-2 text-xs hover:bg-emerald-100 transition-colors font-medium">
                    {copied ? '✓ Copiado!' : '⧉ Copiar código Pix'}
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setModalOpen(false)} className="flex-1 border border-gray-200 rounded-xl py-3.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarReserva} disabled={enviando} className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl py-3.5 text-base font-semibold disabled:opacity-50 transition-colors">
                {enviando ? 'Reservando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
