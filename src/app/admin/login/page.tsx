'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })
    if (error) {
      setCarregando(false)
      setErro(
        /invalid login credentials/i.test(error.message)
          ? 'Email ou senha incorretos.'
          : error.message
      )
      return
    }
    // Navegação completa para o server component reler a sessão dos cookies.
    window.location.href = '/admin'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 w-full max-w-sm">
        <div className="w-12 h-12 bg-emerald-700 rounded-xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-xl">🎟</span>
        </div>
        <h1 className="text-lg font-semibold mb-1 text-center">Painel Admin</h1>
        <p className="text-sm text-gray-400 mb-6 text-center">Entre com email e senha autorizados.</p>

        {erro && (
          <p className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
            {erro}
          </p>
        )}

        <form onSubmit={entrar} className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="voce@email.com"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-stone-50"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Senha</label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-stone-50"
            />
          </div>
          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl py-3 text-base font-semibold disabled:opacity-50 transition-colors"
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
