export interface Rifa {
  id: string
  title: string
  description: string | null
  total_numbers: number
  start_number: number
  price: number
  draw_date: string | null
  pix_type: string | null
  pix_key: string | null
  pix_name: string | null
  pix_city: string | null
  admin_emails?: string[]
  prizes: string[]
  created_at: string
}

export interface Reserva {
  id: string
  rifa_id: string
  numero: number
  nome: string
  telefone: string
  status: 'reservado' | 'pago' | 'cancelado'
  created_at: string
  updated_at: string
}
