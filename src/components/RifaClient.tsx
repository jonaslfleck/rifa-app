'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import { buildPixPayload, normalizePixKey } from '@/lib/pix'
import type { Rifa } from '@/lib/types'
import logoCamboata from '@/assets/logo-camboata-header-ofc.png'
import logoAtiradores from '@/assets/logo-atiradores-header.png'

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
  const selectionStorageKey = `rifa:selected:${rifa.id}`

  // Restaura seleção ao carregar/recarregar e filtra números inválidos/ocupados.
  useEffect(() => {
    const raw = localStorage.getItem(selectionStorageKey)
    if (!raw) {
      setSelecionados([])
      return
    }

    try {
      const parsed = JSON.parse(raw) as number[]
      if (!Array.isArray(parsed)) {
        setSelecionados([])
        return
      }

      const allowed = new Set(nums)
      const restored = parsed
        .filter(n => Number.isInteger(n) && allowed.has(n) && !statusMap[n])
        .sort((a, b) => a - b)

      setSelecionados(restored)
    } catch {
      setSelecionados([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionStorageKey])

  // Mantém localStorage sincronizado e remove números que ficarem ocupados.
  useEffect(() => {
    const filtered = selecionados
      .filter(n => !statusMap[n])
      .sort((a, b) => a - b)

    if (filtered.length !== selecionados.length) {
      setSelecionados(filtered)
      return
    }

    if (filtered.length === 0) {
      localStorage.removeItem(selectionStorageKey)
      return
    }

    localStorage.setItem(selectionStorageKey, JSON.stringify(filtered))
  }, [selecionados, statusMap, selectionStorageKey])

  function onlyDigits(value: string) {
    return value.replace(/\D/g, '')
  }

  function formatBrazilPhone(value: string) {
    const d = onlyDigits(value).slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }

  function isValidBrazilPhone(value: string) {
    const d = onlyDigits(value)
    return /^[1-9]{2}(?:9\d{8}|\d{8})$/.test(d)
  }

  function toggleNum(n: number) {
    setSelecionados(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n].sort((a, b) => a - b))
  }

  function abrirModal() {
    if (!nome.trim() || !telefone.trim()) { setAlerta({ tipo: 'err', msg: 'Preencha nome e telefone.' }); return }
    if (!isValidBrazilPhone(telefone)) {
      setAlerta({ tipo: 'err', msg: 'Informe um telefone válido no formato brasileiro, com DDD. Ex.: (51) 99999-9999.' })
      return
    }
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
        telefone: onlyDigits(telefone),
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
        telefone: onlyDigits(telefone),
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
      <div className="bg-gradient-to-br from-red-700 via-red-800 to-amber-700 text-white px-4 pt-6 pb-8">
        <div className="max-w-2xl mx-auto">
          <p className="text-amber-400 text-xs font-bold tracking-widest uppercase mb-3">🍀 DTG Camboatá</p>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight bg-white/10 border border-stone-500/30 rounded-2xl px-4 py-3 mb-5">
            {rifa.title}
          </h1>
          <div className="grid grid-cols-[auto,1fr,auto] items-center gap-2 sm:flex sm:items-center sm:gap-5">
            <Image
              src={logoCamboata}
              alt="Logo DTG Camboata"
              className="h-14 min-[380px]:h-16 sm:h-24 w-auto object-contain shrink-0"
              priority
            />
            <div className="flex-1 flex flex-col gap-2 sm:gap-3 min-w-0">
              <div>
                <p className="text-amber-100 text-xs">Valor por número</p>
                <p className="text-white font-bold text-base min-[380px]:text-lg sm:text-xl">R$ {rifa.price.toFixed(2).replace('.', ',')}</p>
              </div>
              {rifa.draw_date && (
                <div>
                  <p className="text-amber-100 text-xs">Data do sorteio</p>
                  <p className="text-white font-bold text-base min-[380px]:text-lg sm:text-xl">{fmtDate(rifa.draw_date)}</p>
                </div>
              )}
              <div>
                <p className="text-amber-100 text-xs">Disponíveis</p>
                <p className="text-white font-bold text-base min-[380px]:text-lg sm:text-xl">{disponiveis} de {nums.length}</p>
              </div>
            </div>
            <Image
              src={logoAtiradores}
              alt="Logo Atiradores"
              className="h-12 min-[380px]:h-14 sm:h-20 w-auto object-contain shrink-0"
              priority
            />
          </div>
        </div>
      </div>

      <div className={`max-w-2xl mx-auto px-4 py-6 space-y-5 ${selecionados.length > 0 ? 'pb-24 sm:pb-6' : ''}`}>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <p className="text-sm font-semibold text-amber-900">⏳ Aviso importante</p>
            <p className="text-sm text-amber-800 mt-1">
              Números reservados permanecem aguardando pagamento por até 24 horas. Após esse prazo, os números voltam a ficar disponíveis para venda.
            </p>
          </div>

          {/* Missão — Juvenart 2026 */}
          <div className="bg-gradient-to-br from-red-50 to-amber-100 border border-amber-200 rounded-2xl px-5 py-4">
            <h2 className="text-base sm:text-lg font-bold leading-snug text-red-800 mb-2">
              Ajude nossa Invernada Juvenil a representar o DTG Camboatá no Juvenart 2026!
            </h2>
            <p className="text-stone-700 text-sm leading-relaxed">
              Cada número vendido ajuda a custear transporte, alimentação, hospedagem e despesas necessárias para que nossos jovens possam levar a tradição gaúcha adiante.
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4 items-stretch">
          {/* Frase destaque */}
          <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-center">
            <p className="text-sm italic font-medium text-red-700">
              &ldquo;Quem apoia nossos jovens, ajuda a manter viva a tradição.&rdquo;
            </p>
          </div>

          {/* Agradecimento */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center justify-center text-center">
            <p className="text-sm font-medium text-amber-900">
              ❤️ Desde já agradecemos o carinho, o apoio e a torcida de todos!
            </p>
          </div>
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

        {/* Descrição dinâmica (admin) */}
        {rifa.description && (
          <div className="bg-gradient-to-r from-amber-50 to-stone-50 border border-stone-200 rounded-2xl px-5 py-4 flex items-start gap-3">
            <span className="text-2xl shrink-0">🌟</span>
            <div>
              <p className="text-sm font-semibold text-stone-800">Informações adicionais</p>
              <p className="text-sm text-stone-700 mt-0.5">{rifa.description}</p>
            </div>
          </div>
        )}

        {/* Consulta: Ver meus números */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowConsulta(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors"
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
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-300 bg-stone-50"
                />
                <button
                  onClick={consultarNumeros}
                  disabled={consultando}
                  className="bg-red-700 hover:bg-red-800 text-white rounded-xl px-5 py-3 text-sm font-medium disabled:opacity-50 transition-colors"
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
                            ? 'bg-stone-100 border-stone-300 text-stone-700'
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
          className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-5 py-4 hover:border-amber-300 hover:bg-amber-50 transition-colors group"
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
            <div className="px-5 py-4 border-b border-gray-100 bg-amber-50">
              <p className="text-sm font-medium text-amber-900">🏆 Relação dos prêmios — 58 chances de ganhar!</p>
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
            <div className="px-5 py-3 bg-amber-50 border-t border-gray-100 text-center">
              <p className="text-xs text-amber-700 font-medium">🍀 58 chances de ganhar!</p>
            </div>
          </div>
        )}

        {/* Área principal: Números da rifa */}
        <div className="bg-white border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-base sm:text-lg font-bold text-red-700">Escolha seus números</h3>
            <span className="text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 rounded-full px-2.5 py-1">
              {disponiveis} disponíveis
            </span>
          </div>

          {/* Legenda */}
          <div className="flex gap-4 flex-wrap text-xs text-gray-500 mb-4">
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border border-gray-200 bg-white inline-block"></span>Disponível</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border-2 border-amber-500 bg-amber-50 inline-block"></span>Selecionado</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border border-amber-300 bg-amber-50 inline-block"></span>Reservado</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border border-gray-200 bg-gray-100 inline-block"></span>Pago</span>
          </div>

          {/* Grid de números */}
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
              else if (sel) cls += 'bg-amber-50 border-2 border-amber-500 text-amber-800 shadow-sm'
              else cls += 'bg-white border-gray-200 text-gray-700 hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50 cursor-pointer active:scale-95'
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
          <div className="bg-white border-2 border-red-200 rounded-2xl p-5 shadow-md">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-stone-700 font-medium mb-1">Números selecionados</p>
                <p className="font-bold text-red-700 text-lg leading-snug">{selecionados.join(', ')}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-stone-700 font-medium mb-1">Total a pagar</p>
                <p className="font-extrabold text-red-700 text-xl">R$ {total.toFixed(2).replace('.', ',')}</p>
              </div>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-sm text-stone-800 font-semibold block mb-1.5">Nome completo</label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Maria da Silva" className="w-full border border-stone-300 rounded-xl px-3.5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white text-stone-900 placeholder:text-stone-500" />
              </div>
              <div>
                <label className="text-sm text-stone-800 font-semibold block mb-1.5">Telefone (WhatsApp)</label>
                <input type="tel" inputMode="numeric" value={telefone} onChange={e => setTelefone(formatBrazilPhone(e.target.value))} maxLength={16} placeholder="Ex.: (51) 99999-9999" className="w-full border border-stone-300 rounded-xl px-3.5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white text-stone-900 placeholder:text-stone-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={abrirModal} className="flex-1 bg-red-700 hover:bg-red-800 active:scale-[0.99] text-white rounded-xl py-3.5 text-base font-semibold transition-all">
                Reservar {selecionados.length} número{selecionados.length > 1 ? 's' : ''}
              </button>
              <button onClick={() => setSelecionados([])} className="border border-gray-200 rounded-xl px-5 py-3.5 text-sm text-gray-400 hover:bg-gray-50 transition-colors">
                Limpar
              </button>
            </div>
          </div>
        )}

        {alerta && (
          <div className={`rounded-xl px-4 py-3 text-sm ${alerta.tipo === 'ok' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {alerta.msg}
          </div>
        )}

        {selecionados.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-white/95 backdrop-blur border-t border-red-200 px-4 py-3">
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-stone-700">Selecionados: <strong className="text-red-700">{selecionados.length}</strong></p>
                <p className="text-base font-extrabold text-red-700">R$ {total.toFixed(2).replace('.', ',')}</p>
              </div>
              <button onClick={abrirModal} className="bg-red-700 hover:bg-red-800 text-white rounded-xl px-4 py-2.5 text-base font-semibold">
                Reservar agora
              </button>
            </div>
          </div>
        )}

        {/* Seção final */}
        <div className="bg-gradient-to-br from-red-50 to-amber-100 border border-amber-200 rounded-2xl px-5 py-7 text-center">
          <p className="text-sm sm:text-base italic font-semibold text-red-700 mb-2 leading-snug">
            &ldquo;Quem apoia nossos jovens, ajuda a manter viva a tradição.&rdquo;
          </p>
          <p className="text-xs text-stone-600 mt-2">DTG Camboatá — Juvenart 2026</p>
        </div>

        {/* Rodapé */}
        <div className="text-center py-4">
          <p className="text-sm font-semibold text-red-700">🍀 Boa sorte e obrigado por apoiar nossa juventude!</p>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-stone-900 mb-2">Confirmar reserva</h2>
            <p className="text-base text-stone-700 mb-4 leading-relaxed">
              {nome}, você está reservando {selecionados.length} número{selecionados.length > 1 ? 's' : ''}: <strong className="text-gray-800">{selecionados.join(', ')}</strong> — total <strong className="text-amber-700">R$ {total.toFixed(2).replace('.', ',')}</strong>.
            </p>

            {rifa.pix_key && rifa.pix_name && (
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mb-4 text-center">
                <p className="text-sm font-semibold text-stone-900 mb-2">Pague via Pix após reservar</p>
                <p className="text-sm text-stone-700">{rifa.pix_type}: <strong className="text-stone-900 break-all">{rifa.pix_key}</strong></p>
                <p className="text-sm text-stone-700">Recebedor: <strong>{rifa.pix_name}</strong></p>
                <p className="text-sm text-stone-700 mb-3">Banco: <strong>Sicredi</strong></p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                  <p className="text-sm text-amber-900 font-semibold leading-relaxed">
                    Após o pagamento, envie o comprovante para confirmar seu número.
                  </p>
                </div>
                <canvas ref={canvasRef} className="rounded-xl mx-auto block mb-3" />
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <button onClick={copyPixKey} className="inline-flex items-center justify-center gap-1.5 border border-stone-400 text-stone-700 rounded-lg px-3 py-2 text-sm hover:bg-stone-100 transition-colors font-semibold">
                    {copiedKey ? '✓ Chave copiada!' : '🔑 Copiar chave PIX'}
                  </button>
                  <button onClick={copyPayload} className="inline-flex items-center justify-center gap-1.5 border border-stone-400 text-stone-700 rounded-lg px-3 py-2 text-sm hover:bg-stone-100 transition-colors font-semibold">
                    {copied ? '✓ Copiado!' : '⧉ Copiar código Pix'}
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={() => setModalOpen(false)} className="flex-1 border border-gray-200 rounded-xl py-3.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmarReserva} disabled={enviando} className="flex-1 bg-red-700 hover:bg-red-800 text-white rounded-xl py-3.5 text-base font-semibold disabled:opacity-50 transition-colors">
                {enviando ? 'Reservando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
