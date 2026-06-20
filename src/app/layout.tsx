import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Rifa das Pilchas — DTG Camboatá',
  description: 'Adquira seus números e ajude a continuar o sonho do Juvenart 2026.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  )
}
