export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 w-full max-w-sm text-center">
        <p className="text-2xl mb-3">🔒</p>
        <h1 className="text-lg font-medium mb-1">Acesso não autorizado</h1>
        <p className="text-sm text-gray-400 mb-6">Seu e-mail não está na lista de administradores.</p>
        <a href="/" className="text-sm text-violet-600 hover:underline">← Voltar para a rifa</a>
      </div>
    </div>
  )
}
