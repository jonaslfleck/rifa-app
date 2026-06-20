import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(url, key)

// ── Real DB schema types (English column names) ───────────────────────────

export type DbRole = {
  id: string
  name: string   // 'super'|'board'|'coordination'|'secretariat'|'kitchen'|'treasury'|'organizer'|'guardian'
  description?: string
}

export type DbUserRole = {
  id: string
  user_id: string
  role_id: string
  created_at: string
  role?: DbRole
}

export type DbGuardian = {
  id: string
  user_id: string
  name: string
  phone?: string
  birth_date?: string
  created_at: string
}

export type DbDancer = {
  id: string
  name: string
  birth_date?: string
  group_name?: string
  allow_order: boolean
  created_at: string
  // extra cols we add via migration or JSONB
  phone?: string
  groups?: string[]
  wallet_number?: string
  wallet_expiry?: string
  parent1_name?: string
  parent1_phone?: string
  parent2_name?: string
  parent2_phone?: string
  extra_contacts?: { type: string; name: string; phone: string; birth_date?: string }[]
}

export type DbDinner = {
  id: string
  name: string
  date?: string
  lock_time?: string
  status: string
  is_donation: boolean
  created_at: string
  // config fields (stored as JSONB col `config` or extra cols)
  org?: string
  deadline_text?: string
  menu?: string[]
  price_options?: { label: string; price: number }[]
  lock_message?: string
  pix_key?: string
  expense?: number
  expense_desc?: string
  organizer_phones?: string[]
  authorized_phones?: string[]
  participants?: Record<string, string>
}

export type DbDinnerParticipant = {
  id: string
  dinner_id: string
  dancer_id: string
  attended?: boolean | null
  paid?: boolean
  is_cook?: boolean
  price?: number
  person_name?: string
  phone?: string
  created_at: string
  dancer?: DbDancer
}

export type DbOrder = {
  id: string
  amount: number
  user_id: string
  dancer_id?: string
  dinner_id?: string
  created_at: string
  dancer?: DbDancer
  payments?: DbOrderPayment[]
}

export type DbOrderPayment = {
  id: string
  order_id: string
  amount: number
  proof_url?: string
  method?: string
  notes?: string
  created_at: string
}
