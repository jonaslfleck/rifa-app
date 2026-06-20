import { supabase } from './supabase'

// ======================
// HELPERS
// ======================

const isValidUUID = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)

// ======================
// MAPPERS
// ======================

const mapDancerFromDb = (d: any) => ({
  id: d.id,
  name: d.name,
  group: d.group_name ?? '',
  groups: d.groups ?? [],
  birthDate: d.birth_date ?? '',
  phone: d.phone ?? '',
  guardian1Name: d.parent1_name ?? '',
  guardian1Phone: d.parent1_phone ?? '',
  guardian2Name: d.parent2_name ?? '',
  guardian2Phone: d.parent2_phone ?? '',
  walletNumber: d.wallet_number ?? '',
  walletExpiry: d.wallet_expiry ?? '',
  walletCardStatus: d.wallet_card_status ?? 'none',
  allowOrder: d.allow_order ?? true,
  extraContacts: Array.isArray(d.extra_contacts) ? d.extra_contacts : [],
  inactive: d.inactive ?? false,
})

const mapDancerToDb = (d: any) => ({
  name: d.name,
  group_name: d.group_name || d.group,
  groups: d.groups ?? [],
  birth_date: d.birthDate || null,
  phone: d.phone || null,
  parent1_name: d.guardian1Name || null,
  parent1_phone: d.guardian1Phone || null,
  parent2_name: d.guardian2Name || null,
  parent2_phone: d.guardian2Phone || null,
  wallet_number: d.walletNumber || null,
  wallet_expiry: d.walletExpiry || null,
  wallet_card_status: d.walletCardStatus ?? 'none',
  allow_order: d.allowOrder ?? true,
  extra_contacts: Array.isArray(d.extraContacts) ? d.extraContacts : [],
  inactive: d.inactive ?? false,
})

// ======================
// DANCERS
// ======================

export async function fetchDancers() {
  const { data, error } = await supabase.from('dancers').select('*').order('name')
  if (error || !data) return {}

  return Object.fromEntries(
    data.map((d: any) => [d.id, mapDancerFromDb(d)])
  )
}

export async function upsertDancer(d: any) {
  const payload = mapDancerToDb(d)

  const { data, error } =
    d.id && isValidUUID(d.id)
      ? await supabase.from('dancers').update(payload).eq('id', d.id).select()
      : await supabase.from('dancers').insert(payload).select()

  console.log('UPSERT DANCER:', { data, error })
  return { data, error }
}

export async function deleteDancer(id: string) {
  const { error } = await supabase.from('dancers').delete().eq('id', id)
  return { error }
}

// ======================
// DINNERS
// ======================

export async function fetchActiveDinner() {
  const { data, error } = await supabase
    .from('dinners')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  return error || !data?.length ? null : data[0]
}

export async function upsertDinner(id: string | null, payload: any) {
  if (id && isValidUUID(id)) {
    return await supabase.from('dinners').update(payload).eq('id', id).select().single()
  }

  return await supabase.from('dinners').insert({ ...payload, status: 'active' }).select().single()
}

// ======================
// PARTICIPANTS
// ======================

export async function fetchParticipants(dinnerId: string) {
  const { data, error } = await supabase
    .from('dinner_participants')
    .select('*')
    .eq('dinner_id', dinnerId)

  return error || !data ? [] : data
}

export async function addParticipant(dinnerId: string, payload: any) {
  const { data, error } = await supabase
    .from('dinner_participants')
    .insert({
      dinner_id: dinnerId,
      dancer_id: payload.dancer_id || null,
      person_name: payload.person_name || null,
      phone: payload.phone || null,
      price: payload.price ?? 0,
      is_cook: payload.is_cook ?? false,
      attended: null,
      paid: false,
    })
    .select()

  return { data, error }
}

export async function updateParticipant(id: string, updates: any) {
  return await supabase.from('dinner_participants').update(updates).eq('id', id).select()
}

export async function removeParticipant(id: string) {
  return await supabase.from('dinner_participants').delete().eq('id', id)
}

// ======================
// ORDERS
// ======================

export async function fetchOrders(dinnerId?: string) {
  let query = supabase
    .from('orders')
    .select('*, payments:order_payments(*)')
    .order('created_at', { ascending: false })

  if (dinnerId) query = query.eq('dinner_id', dinnerId)

  const { data, error } = await query
  return error || !data ? [] : data
}

export async function createOrder(payload: any) {
  return await supabase.from('orders').insert({
    dancer_id: payload.dancer_id || null,
    dinner_id: payload.dinner_id || null,
    user_id: payload.user_id,
    amount: payload.amount ?? 0,
    description: payload.description || null,
    items: payload.items ?? [],
    paid: false,
    phone: payload.phone || null,
  }).select()
}

// ======================
// PAYMENTS
// ======================

export async function addPayment(orderId: string, amount: number, method?: string, notes?: string, proofUrl?: string) {
  return await supabase.from('order_payments').insert({
    order_id: orderId,
    amount,
    method: method || null,
    notes: notes || null,
    proof_url: proofUrl || null,
  }).select()
}

// ======================
// STORAGE
// ======================

export async function uploadReceipt(file: File, orderId: string) {
  const path = `${orderId}/${Date.now()}.${file.name.split('.').pop()}`
  const { error } = await supabase.storage.from('payment_receipts').upload(path, file)
  if (error) return null
  return supabase.storage.from('payment_receipts').getPublicUrl(path).data.publicUrl
}

// ======================
// SCHEDULE
// ======================

export async function fetchSchedule() {
  const { data, error } = await supabase.from('dinner_schedule').select('*').order('date')
  if (error || !data) return {}

  return Object.fromEntries(
    data.map((r: any) => [
      r.id,
      {
        id: r.id,
        date: r.date,
        guardians: r.guardians ?? [],
        menu: r.menu ?? '',
        blocked: r.blocked ?? false,
        blockReason: r.block_reason ?? '',
        createdBy: r.created_by ?? '',
      },
    ])
  )
}

export async function upsertScheduleEntry(entry: any) {
  return await supabase.from('dinner_schedule').upsert({
    id: entry.id,
    date: entry.date,
    guardians: entry.guardians,
    menu: entry.menu ?? '',
    blocked: entry.blocked ?? false,
    block_reason: entry.blockReason ?? null,
    created_by: entry.createdBy ?? null,
  })
}

export async function upsertScheduleEntries(entries: any[]) {
  if (!entries.length) return { error: null }

  return await supabase.from('dinner_schedule').upsert(
    entries.map(e => ({
      id: e.id,
      date: e.date,
      guardians: e.guardians,
      menu: e.menu ?? '',
      blocked: e.blocked ?? false,
      block_reason: e.blockReason ?? null,
      created_by: e.createdBy ?? null,
    }))
  )
}

export async function deleteScheduleEntry(id: string) {
  return await supabase.from('dinner_schedule').delete().eq('id', id)
}
// ======================
// DINNER HISTORY
// ======================

export async function fetchHistory() {
  const { data, error } = await supabase
    .from('dinner_history')
    .select('*')
    .order('ts', { ascending: false })
  if (error || !data) return {}

  return Object.fromEntries(
    data.map((r: any) => [
      r.id,
      {
        id:            r.id,
        title:         r.title          ?? '',
        eventDate:     r.event_date     ?? '',
        organizer:     r.organizer      ?? '',
        type:          r.type           ?? '',
        attendeeCount: r.attendee_count ?? 0,
        presentCount:  r.present_count  ?? 0,
        collected:     r.collected      ?? 0,
        expense:       r.expense        ?? 0,
        expenseDesc:   r.expense_desc   ?? '',
        menu:          r.menu           ?? [],
        ts:            r.ts             ?? (r.created_at ? new Date(r.created_at).getTime() : 0),
        month:         r.month          ?? 0,
        year:          r.year           ?? 0,
      },
    ])
  )
}

export async function insertHistory(entry: any) {
  const { data, error } = await supabase.from('dinner_history').insert({
    id:             entry.id,
    title:          entry.title,
    event_date:     entry.eventDate,
    organizer:      entry.organizer,
    type:           entry.type,
    attendee_count: entry.attendeeCount,
    present_count:  entry.presentCount,
    collected:      entry.collected,
    expense:        entry.expense,
    expense_desc:   entry.expenseDesc,
    menu:           entry.menu,
    ts:             entry.ts,
    month:          entry.month,
    year:           entry.year,
  }).select()
  return { data, error }
}

export async function deleteHistoryEntry(id: string) {
  const { error } = await supabase.from('dinner_history').delete().eq('id', id)
  return { error }
}

// ======================
// AUDIT LOGS
// ======================

export async function fetchAuditLogs() {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('ts', { ascending: false })
    .limit(500)
  if (error || !data) return []

  return data.map((l: any) => ({
    id:     l.id,
    type:   l.type   ?? 'organizer',
    action: l.action ?? '',
    actor:  l.actor  ?? '',
    ts:     l.ts     ?? (l.created_at ? new Date(l.created_at).getTime() : 0),
    diff:   l.diff   ?? undefined,
  }))
}

export async function insertAuditLog(entry: any) {
  const { error } = await supabase.from('audit_logs').insert({
    id:     entry.id,
    type:   entry.type,
    action: entry.action,
    actor:  entry.actor,
    ts:     entry.ts,
    diff:   entry.diff ?? null,
  })
  return { error }
}

export async function clearAuditLogsDb() {
  const { error } = await supabase.from('audit_logs').delete().neq('id', '')
  return { error }
}

// ======================
// APP USERS
// Lê auth.users via admin view + user_roles + roles
// ======================

export async function fetchAppUsers() {
  // Busca user_roles com join em roles para pegar o nome do papel
  const { data, error } = await supabase
    .from('user_roles')
    .select(`
      id,
      user_id,
      created_at,
      roles ( name )
    `)
    .order('created_at', { ascending: false })
  if (error || !data) return {}

  return Object.fromEntries(
    data.map((u: any) => [
      u.user_id,
      {
        id:   u.user_id,
        role: u.roles?.name ?? 'guardian',
        ts:   u.created_at ? new Date(u.created_at).getTime() : 0,
        // name/email/phone são lidos do auth.users via useAuth — não disponíveis aqui
        name:  '',
        email: undefined,
        phone: undefined,
      },
    ])
  )
}

export async function upsertAppUser(user: any) {
  // Busca o role_id pelo nome do papel
  const { data: roleRow, error: roleErr } = await supabase
    .from('roles')
    .select('id')
    .eq('name', user.role)
    .single()
  if (roleErr || !roleRow) return { data: null, error: roleErr ?? new Error('Role não encontrado') }

  const { data, error } = await supabase
    .from('user_roles')
    .upsert({ user_id: user.id, role_id: roleRow.id }, { onConflict: 'user_id,role_id' })
    .select()
  return { data, error }
}

export async function deleteAppUser(userId: string) {
  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
  return { error }
}

// ======================
// BIRTHDAY EXTRAS
// ======================

// birthday_extras don't have a dedicated table in the current schema,
// so we persist them as a single JSON blob inside audit_logs using a sentinel type.
const BIRTHDAY_SENTINEL_ID = 'birthday_extras_blob'
const BIRTHDAY_SENTINEL_TYPE = '__birthday_extras__'

export async function fetchBirthdayExtrasDb() {
  const { data } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('type', BIRTHDAY_SENTINEL_TYPE)
    .maybeSingle()

  if (data?.diff?.after) {
    try { return JSON.parse(data.diff.after) } catch { return [] }
  }
  return []
}

export async function saveBirthdayExtrasDb(extras: any[]) {
  await supabase.from('audit_logs').delete().eq('type', BIRTHDAY_SENTINEL_TYPE)
  if (extras.length === 0) return { error: null }
  const { error } = await supabase.from('audit_logs').insert({
    id:     BIRTHDAY_SENTINEL_ID,
    type:   BIRTHDAY_SENTINEL_TYPE,
    action: 'birthday_extras',
    actor:  'system',
    ts:     Date.now(),
    diff:   { before: '', after: JSON.stringify(extras) },
  })
  return { error }
}

// ======================
// AUTH SIMPLES (TELEFONE)
// ======================

export async function loginWithPhone(phone: string) {
  const clean = phone.replace(/\D/g, '')

  const { data: guardian } = await supabase
    .from('guardians')
    .select('*')
    .eq('phone', clean)
    .eq('allowed', true)
    .maybeSingle()

  if (guardian) {
    localStorage.setItem('guardian', JSON.stringify(guardian))
    return { status: 'ok', guardian }
  }

  return { status: 'not_found' }
}

export async function requestAccess(name: string, phone: string, reason?: string) {
  const clean = phone.replace(/\D/g, '')

  const existing = await supabase
    .from('access_requests')
    .select('id')
    .eq('phone', clean)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing.data) {
    throw new Error('Solicitação já enviada')
  }

  const { error } = await supabase
    .from('access_requests')
    .insert({
      name,
      phone: clean,
      reason,
      status: 'pending'
    })

  return { error }
}

export async function approveRequest(request: any, adminName: string) {
  await supabase.from('guardians').insert({
    name: request.name,
    phone: request.phone,
    allowed: true
  })

  await supabase
    .from('access_requests')
    .update({
      status: 'approved',
      reviewed_by: adminName
    })
    .eq('id', request.id)
}

export async function rejectRequest(id: string, adminName: string) {
  await supabase
    .from('access_requests')
    .update({
      status: 'rejected',
      reviewed_by: adminName
    })
    .eq('id', id)
}
