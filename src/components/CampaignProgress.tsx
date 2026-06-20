'use client'

interface CampaignProgressProps {
  meta?: number
  arrecadado?: number
  titulo?: string
}

export default function CampaignProgress({
  meta = 10000,
  arrecadado = 0,
  titulo = 'Meta Juvenart 2026',
}: CampaignProgressProps) {
  const pct = meta > 0 ? Math.min(100, Math.round((arrecadado / meta) * 100)) : 0
  const barWidth = pct === 0 ? 0 : Math.max(pct, 2)

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="bg-white border border-emerald-200 rounded-2xl px-5 py-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-emerald-900">🎯 {titulo}</p>
        <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
          {pct}%
        </span>
      </div>

      <div className="w-full bg-stone-100 rounded-full h-3 mb-3 overflow-hidden">
        <div
          className="h-3 rounded-full bg-gradient-to-r from-emerald-800 to-emerald-500 transition-all duration-700"
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <p className="text-xs text-stone-500">
        <span className="font-bold text-emerald-700">{fmt(arrecadado)}</span>
        {' '}de{' '}
        <span className="font-semibold text-stone-700">{fmt(meta)}</span>
        {' '}arrecadados
      </p>
    </div>
  )
}
