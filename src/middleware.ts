import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Sincroniza a sessão do Supabase entre cliente e servidor a cada request.
// Sem isto, o cookie de auth não é persistido e o /admin "esquece" o login.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (
          cookiesToSet: Array<{
            name: string
            value: string
            options?: Parameters<typeof response.cookies.set>[2]
          }>
        ) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Revalida o usuário; renova tokens e grava os cookies atualizados na resposta.
  await supabase.auth.getUser()

  return response
}

export const config = {
  // Inclui a rota /admin exata além das subrotas (/admin/:path* sozinho pode
  // não casar com /admin, deixando a página que faz o redirect sem sessão).
  matcher: ['/admin', '/admin/:path*'],
}
