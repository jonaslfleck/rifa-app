import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Rifa Online',
  description: 'Escolha seu número da sorte',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
