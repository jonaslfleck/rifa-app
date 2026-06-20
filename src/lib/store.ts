/**
 * store.ts — Application state types and localStorage persistence.
 * All identifiers are English. UI strings come from src/i18n/pt-BR.ts.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type Attendee = {
  name: string
  price: number
  priceLabel: string
  phone: string
  present: boolean | null
  isCook: boolean
  pixPaid?: boolean
  _dbId?: string
}

export type PriceOption = {
  label: string
  price: number
}

export type DinnerEvent = {
  title: string
  eventDate: string
  organizer: string
  deadline: string
  lockMessage: string
  lockAt: string
  closed: boolean
  menu: string[]
  priceOptions: PriceOption[]
  authorizedPhones: string[]
  organizerPhones: string[]
  participants: Record<string, string>
  attendees: Attendee[]
  expenseAmount: number
  expenseDesc: string
  pixKey: string
  isDonation: boolean
}

export type CalendarEntry = {
  id: string
  date: string
  guardians: string[]
  menu: string
  blocked?: boolean
  blockReason?: string
  createdBy?: string
}

export type Dancer = {
  id: string
  name: string
  group: string
  groups: string[]
  birthDate: string
  phone: string
  guardian1Name: string
  guardian1Phone: string
  guardian2Name: string
  guardian2Phone: string
  walletNumber: string
  walletExpiry: string
  walletCardStatus?: 'ok' | 'pending' | 'expired' | 'none'
  allowOrder?: boolean
  extraContacts: ExtraContact[]
  inactive?: boolean
}

export type ExtraContact = {
  type: string
  name: string
  phone: string
  birthDate?: string
}

export type HistoryEntry = {
  id: string
  title: string
  eventDate: string
  organizer: string
  type: string
  attendeeCount: number
  presentCount: number
  collected: number
  expense: number
  expenseDesc: string
  menu: string[]
  ts: number
  month: number
  year: number
}

export type Order = {
  id: string
  name: string
  date: string
  description: string
  amount: number
  items: OrderItem[]
  paid: boolean
  paymentMethod?: string
  paymentNotes?: string
  receiptUrl?: string
  phone?: string
  createdBy?: string
  ts: number
}

export type OrderItem = {
  description: string
  amount: number
}

export type AuditLog = {
  id: string
  type: 'super' | 'organizer' | 'guardian'
  action: string
  actor: string
  ts: number
  diff?: { before: string; after: string }
}

export type AppUser = {
  id: string
  name: string
  email?: string
  phone?: string
  birthDate?: string
  role: string
  ts?: number
}

export type AccessRequest = {
  id: string
  name: string
  phone: string
  reason?: string
  ts: number
}

export type BirthdayExtra = {
  name: string
  birthDate: string
  type: string
  group: string
  groups: string[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const GROUPS = ['Pre-mirim', 'Mirim', 'Juvenil', 'Adulta', 'Outro'] as const
export type GroupName = typeof GROUPS[number]

export const GROUP_PRICE: Record<string, number> = {
  'Pre-mirim': 7.5, Mirim: 7.5, Juvenil: 7.5, Adulta: 7.5, Outro: 15,
}

export const DEFAULT_DINNER: DinnerEvent = {
  title: '',
  eventDate: '',
  organizer: '',
  deadline: '',
  lockMessage: '',
  lockAt: '',
  closed: false,
  menu: [],
  priceOptions: [],
  authorizedPhones: [],
  organizerPhones: [],
  participants: {},
  attendees: [],
  expenseAmount: 0,
  expenseDesc: '',
  pixKey: '',
  isDonation: false,
}

// ── localStorage helpers ───────────────────────────────────────────────────────

function ls<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key)
    return s ? JSON.parse(s) : fallback
  } catch { return fallback }
}
function lsSet(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch {}
}

// ── Hydration: reads old PT keys so existing data migrates automatically ───────

function hydrateAttendee(r: any): Attendee {
  return {
    name:       r.name       ?? r.nome       ?? '',
    price:      r.price      ?? r.preco      ?? 0,
    priceLabel: r.priceLabel ?? r.labelValor ?? '',
    phone:      r.phone      ?? r.fone       ?? '',
    present:    r.present    ?? r.presente   ?? null,
    isCook:     r.isCook     ?? r.cozinheiro ?? false,
    pixPaid:    r.pixPaid    ?? r.pixPago    ?? false,
    _dbId:      r._dbId,
  }
}

function hydrateDinner(r: any): DinnerEvent {
  return {
    ...DEFAULT_DINNER,
    title:            r.title            ?? r.titulo             ?? DEFAULT_DINNER.title,
    eventDate:        r.eventDate        ?? r.dataEvento         ?? '',
    organizer:        r.organizer        ?? r.org                ?? DEFAULT_DINNER.organizer,
    deadline:         r.deadline         ?? r.prazo              ?? DEFAULT_DINNER.deadline,
    lockMessage:      r.lockMessage      ?? r.msgBloqueio        ?? DEFAULT_DINNER.lockMessage,
    lockAt:           r.lockAt           ?? r.bloqueioEm         ?? '',
    closed:           r.closed           ?? r.encerrado          ?? false,
    menu:             r.menu             ?? r.cardapio           ?? [],
    priceOptions:     (r.priceOptions ?? r.valores ?? []).map((p: any) => ({
      label: p.label,
      price: p.price ?? p.preco ?? 0,
    })),
    authorizedPhones: r.authorizedPhones ?? r.fonesAutorizados   ?? [],
    organizerPhones:  r.organizerPhones  ?? r.organizadoresFones ?? [],
    participants:     r.participants     ?? r.participantes      ?? {},
    attendees:        (r.attendees ?? r.inscritos ?? []).map(hydrateAttendee),
    expenseAmount:    r.expenseAmount    ?? r.gastoValor         ?? 0,
    expenseDesc:      r.expenseDesc      ?? r.gastoDesc          ?? '',
    pixKey:           r.pixKey           ?? r.pixChave           ?? '',
    isDonation:       r.isDonation       ?? r.isDoacao           ?? true,
  }
}

function hydrateDancer(r: any): Dancer {
  return {
    id:              r.id,
    name:            r.name             ?? r.nome          ?? '',
    group:           r.group            ?? r.turma         ?? '',
    groups:          r.groups           ?? r.invernadas    ?? [],
    birthDate:       r.birthDate        ?? r.nasc          ?? '',
    phone:           r.phone            ?? r.fone          ?? '',
    guardian1Name:   r.guardian1Name    ?? r.pai1Nome      ?? '',
    guardian1Phone:  r.guardian1Phone   ?? r.pai1Fone      ?? '',
    guardian2Name:   r.guardian2Name    ?? r.pai2Nome      ?? '',
    guardian2Phone:  r.guardian2Phone   ?? r.pai2Fone      ?? '',
    walletNumber:    r.walletNumber     ?? r.carteira      ?? '',
    walletExpiry:    r.walletExpiry     ?? r.carteiraVenc  ?? '',
    extraContacts:   (r.extraContacts ?? (r.respsExtras ?? []).map((x: any) => ({
      type:      x.type  ?? x.tipo ?? 'Outro',
      name:      x.name  ?? x.nome ?? '',
      phone:     x.phone ?? x.fone ?? '',
      birthDate: x.birthDate ?? x.nasc ?? '',
    }))),
    inactive: r.inactive ?? r.inativo ?? false,
  }
}

function hydrateOrder(r: any): Order {
  return {
    id:            r.id,
    name:          r.name          ?? r.nome   ?? '',
    date:          r.date          ?? r.data   ?? '',
    description:   r.description   ?? r.desc   ?? '',
    amount:        r.amount        ?? r.valor  ?? 0,
    items:         (r.items ?? (r.itens ?? []).map((it: any) => ({
      description: it.description ?? it.desc  ?? '',
      amount:      it.amount      ?? it.valor ?? 0,
    }))),
    paid:          r.paid          ?? r.pago         ?? false,
    paymentMethod: r.paymentMethod ?? r.formaPgto,
    paymentNotes:  r.paymentNotes  ?? r.pgtoObs,
    phone:         r.phone         ?? r.fone,
    createdBy:     r.createdBy     ?? r.criadoPor,
    ts:            r.ts            ?? 0,
  }
}

function hydrateHistory(r: any): HistoryEntry {
  return {
    id:           r.id,
    title:        r.title        ?? r.titulo      ?? '',
    eventDate:    r.eventDate    ?? r.dataEvento  ?? '',
    organizer:    r.organizer    ?? r.org         ?? '',
    type:         r.type         ?? r.tipo        ?? '',
    attendeeCount:r.attendeeCount?? r.inscritos   ?? 0,
    presentCount: r.presentCount ?? r.compareceram?? 0,
    collected:    r.collected    ?? r.arrecadado  ?? 0,
    expense:      r.expense      ?? r.gasto       ?? 0,
    expenseDesc:  r.expenseDesc  ?? r.gastoDesc   ?? '',
    menu:         r.menu         ?? r.cardapio    ?? [],
    ts:           r.ts           ?? 0,
    month:        r.month        ?? r.mes         ?? 0,
    year:         r.year         ?? r.ano         ?? 0,
  }
}

function hydrateCalendarEntry(r: any): CalendarEntry {
  return {
    id:          r.id,
    date:        r.date        ?? r.data           ?? '',
    guardians:   r.guardians   ?? r.pais           ?? [],
    menu:        r.menu        ?? r.cardapio        ?? '',
    blocked:     r.blocked     ?? r.bloqueado      ?? false,
    blockReason: r.blockReason ?? r.motivoBloqueio ?? '',
    createdBy:   r.createdBy   ?? r.criadoPor      ?? '',
  }
}

// ── Persistence ────────────────────────────────────────────────────────────────

const KEYS = {
  dinner:        'jdtg_dinner_event',
  dinnerLegacy:  'jdtg_evento',
  calendar:      'jdtg_calendar',
  calendarLegacy:'jdtg_cal',
  dancers:       'jdtg_dancers',
  dancersLegacy: 'jdtg_dancas',
  history:       'jdtg_history',
  historyLegacy: 'jdtg_hist',
  orders:        'jdtg_orders',
  ordersLegacy:  'jdtg_comandas',
  auditLogs:     'jdtg_audit_logs',
  auditLegacy:   'jdtg_logs',
  users:         'jdtg_usuarios',
  requests:      'jdtg_access_requests',
  requestsLegacy:'jdtg_sol',
  birthdays:     'jdtg_birthday_extras',
  birthdaysLegacy:'jdtg_aniv_extra',
}

export function loadDinner(): DinnerEvent {
  const raw = ls<any>(KEYS.dinner, null) ?? ls<any>(KEYS.dinnerLegacy, {})
  return hydrateDinner(raw)
}
export function saveDinner(updates: Partial<DinnerEvent>): DinnerEvent {
  const merged = { ...loadDinner(), ...updates }
  lsSet(KEYS.dinner, merged)
  lsSet(KEYS.dinnerLegacy, merged)
  return merged
}

export function loadCalendar(): Record<string, CalendarEntry> {
  const raw = ls<Record<string, any>>(KEYS.calendar, null)
    ?? ls<Record<string, any>>(KEYS.calendarLegacy, {})
  return Object.fromEntries(Object.values(raw).map((e: any) => [e.id, hydrateCalendarEntry(e)]))
}
export function saveCalendar(cal: Record<string, CalendarEntry>) {
  lsSet(KEYS.calendar, cal)
  lsSet(KEYS.calendarLegacy, cal)
}

export function loadDancers(): Record<string, Dancer> {
  const raw = ls<Record<string, any>>(KEYS.dancers, null)
    ?? ls<Record<string, any>>(KEYS.dancersLegacy, {})
  return Object.fromEntries(Object.values(raw).map((d: any) => [d.id, hydrateDancer(d)]))
}
export function saveDancers(dancers: Record<string, Dancer>) {
  lsSet(KEYS.dancers, dancers)
  lsSet(KEYS.dancersLegacy, dancers)
}

export function loadHistory(): Record<string, HistoryEntry> {
  const raw = ls<Record<string, any>>(KEYS.history, null)
    ?? ls<Record<string, any>>(KEYS.historyLegacy, {})
  return Object.fromEntries(Object.values(raw).map((h: any) => [h.id, hydrateHistory(h)]))
}
export function saveHistory(history: Record<string, HistoryEntry>) {
  lsSet(KEYS.history, history)
  lsSet(KEYS.historyLegacy, history)
}

export function loadOrders(): Record<string, Order> {
  const raw = ls<Record<string, any>>(KEYS.orders, null)
    ?? ls<Record<string, any>>(KEYS.ordersLegacy, {})
  return Object.fromEntries(Object.values(raw).map((o: any) => [o.id, hydrateOrder(o)]))
}
export function saveOrders(orders: Record<string, Order>) {
  lsSet(KEYS.orders, orders)
  lsSet(KEYS.ordersLegacy, orders)
}

export function loadAuditLogs(): AuditLog[] {
  const raw = ls<any[]>(KEYS.auditLogs, null) ?? ls<any[]>(KEYS.auditLegacy, [])
  return raw.map((l: any) => ({
    id:     l.id,
    type:   (l.type ?? (l.tipo === 'guardian' ? 'guardian' : l.tipo) ?? 'organizer') as AuditLog['type'],
    action: l.action ?? l.acao  ?? '',
    actor:  l.actor  ?? l.quem  ?? '',
    ts:     l.ts     ?? 0,
    diff:   l.diff ? {
      before: l.diff.before ?? l.diff.antes  ?? '',
      after:  l.diff.after  ?? l.diff.depois ?? '',
    } : undefined,
  }))
}
export function appendLog(entry: Omit<AuditLog, 'id' | 'ts'>): AuditLog {
  const log: AuditLog = { ...entry, id: 'l' + Date.now(), ts: Date.now() }
  const updated = [log, ...loadAuditLogs()].slice(0, 500)
  lsSet(KEYS.auditLogs, updated)
  lsSet(KEYS.auditLegacy, updated)
  return log
}
export function clearLogs() {
  lsSet(KEYS.auditLogs, [])
  lsSet(KEYS.auditLegacy, [])
}

export function loadUsers(): Record<string, AppUser> {
  return ls<Record<string, AppUser>>(KEYS.users, {})
}
export function saveUsers(users: Record<string, AppUser>) {
  lsSet(KEYS.users, users)
}

export function loadAccessRequests(): Record<string, AccessRequest> {
  const raw = ls<Record<string, any>>(KEYS.requests, null)
    ?? ls<Record<string, any>>(KEYS.requestsLegacy, {})
  return Object.fromEntries(Object.entries(raw).map(([k, r]: [string, any]) => [k, {
    id:     r.id,
    name:   r.name  ?? r.nome  ?? '',
    phone:  r.phone ?? r.fone  ?? '',
    reason: r.reason ?? r.motivo,
    ts:     r.ts    ?? 0,
  }]))
}
export function saveAccessRequests(requests: Record<string, AccessRequest>) {
  lsSet(KEYS.requests, requests)
  lsSet(KEYS.requestsLegacy, requests)
}

export function loadBirthdayExtras(): BirthdayExtra[] {
  const raw = ls<any[]>(KEYS.birthdays, null) ?? ls<any[]>(KEYS.birthdaysLegacy, [])
  return raw.map((a: any) => ({
    name:      a.name      ?? a.nome      ?? '',
    birthDate: a.birthDate ?? a.nasc      ?? '',
    type:      a.type      ?? a.tipo      ?? '',
    group:     a.group     ?? a.invernada ?? a.turma ?? '',
    groups:    a.groups    ?? a.invernadas ?? [],
  }))
}
export function saveBirthdayExtras(extras: BirthdayExtra[]) {
  lsSet(KEYS.birthdays, extras)
  lsSet(KEYS.birthdaysLegacy, extras)
}

// ── Utility ───────────────────────────────────────────────────────────────────

export function formatCurrency(n: number) {
  return Number(n || 0).toFixed(2).replace('.', ',')
}
export function cleanPhone(s: string) {
  return (s || '').replace(/\D/g, '')
}
export function formatPhone(s: string) {
  const d = cleanPhone(s)
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return s || ''
}
export function initials(name: string) {
  return (name || '?').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}
export function groupLabel(g: string | null | undefined) {
  return g === 'Pre-mirim' ? 'Pré-mirim' : (g || 'Outro')
}
export function groupClass(g: string | null | undefined) {
  const map: Record<string, string> = {
    Adulta: 'turma-adulta', Juvenil: 'turma-juvenil',
    Mirim: 'turma-mirim', 'Pre-mirim': 'turma-premirim',
  }
  return map[g || ''] || 'turma-outro'
}
export function walletStatus(expiry: string | undefined | null) {
  if (!expiry) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const v = new Date(expiry + 'T12:00:00')
  const days = Math.round((v.getTime() - today.getTime()) / 86400000)
  if (days < 0)   return { cls: 'badge-venc-expirada', txt: 'Expirada', days }
  if (days <= 30) return { cls: 'badge-venc-30',       txt: `${days}d`, days }
  if (days <= 60) return { cls: 'badge-venc-60',       txt: `${days}d`, days }
  if (days <= 90) return { cls: 'badge-venc-90',       txt: `${days}d`, days }
  return { cls: 'badge-venc-ok', txt: 'OK', days }
}
export function daysUntilBirthday(birthDate: string) {
  if (!birthDate) return 9999
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const b = new Date(birthDate + 'T12:00:00')
  const next = new Date(today.getFullYear(), b.getMonth(), b.getDate())
  if (next < today) next.setFullYear(next.getFullYear() + 1)
  return Math.round((next.getTime() - today.getTime()) / 86400000)
}
export function birthdayAge(birthDate: string) {
  if (!birthDate) return null
  const today = new Date()
  const b = new Date(birthDate + 'T12:00:00')
  let age = today.getFullYear() - b.getFullYear()
  if (today.getMonth() - b.getMonth() < 0 ||
     (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age--
  return age
}
