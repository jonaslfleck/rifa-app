import { useEffect, useCallback } from 'react'
import {
  fetchDancers, fetchActiveDinner, fetchParticipants,
  fetchOrders,
  upsertDancer, deleteDancer as svcDeleteDancer,
  upsertDinner, addParticipant, updateParticipant, removeParticipant,
  createOrder, addPayment, uploadReceipt,
  fetchSchedule, upsertScheduleEntry, upsertScheduleEntries, deleteScheduleEntry,
  fetchHistory, insertHistory, deleteHistoryEntry,
  fetchAuditLogs, insertAuditLog, clearAuditLogsDb,
  fetchAppUsers, upsertAppUser, deleteAppUser,
  fetchBirthdayExtrasDb, saveBirthdayExtrasDb,
} from '../lib/services'
import {
  loadDinner, saveDinner, loadCalendar, saveCalendar,
  loadDancers, saveDancers, loadOrders, saveOrders,
  loadHistory, saveHistory,
  loadUsers, saveUsers,
  loadBirthdayExtras, saveBirthdayExtras,
  Dancer, CalendarEntry, Attendee, Order, HistoryEntry, AuditLog, AppUser, BirthdayExtra,
} from '../lib/store'
import { AppState } from '../App'

type SetState = React.Dispatch<React.SetStateAction<AppState>>

// ── Row mappers ───────────────────────────────────────────────────────────────

function rowToAttendee(r: any): Attendee {
  return {
    name:       r.person_name ?? '',
    price:      r.price       ?? 0,
    priceLabel: r.price_label ?? '',
    phone:      r.phone       ?? '',
    present:    r.attended    ?? null,
    isCook:     r.is_cook     ?? false,
    pixPaid:    r.pix_paid    ?? false,
    _dbId:      r.id,
  }
}

function rowToOrder(r: any): Order {
  return {
    id:            r.id,
    name:          r.person_name   ?? '',
    date:          r.date          ?? '',
    description:   r.description   ?? '',
    amount:        r.amount        ?? 0,
    items:         r.items         ?? [],
    paid:          r.paid          ?? false,
    paymentMethod: r.payment_method,
    paymentNotes:  r.payment_notes,
    receiptUrl:    r.receipt_url   ?? undefined,
    phone:         r.phone,
    createdBy:     r.created_by,
    ts:            r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  }
}

function rowToCalendarEntry(r: any): CalendarEntry {
  return {
    id:          r.id,
    date:        r.date         ?? r.data             ?? '',
    guardians:   r.guardians    ?? r.pais             ?? [],
    menu:        r.menu         ?? r.cardapio         ?? '',
    blocked:     r.blocked      ?? r.bloqueado        ?? false,
    blockReason: r.block_reason ?? r.motivo_bloqueio  ?? r.blockReason ?? '',
    createdBy:   r.created_by   ?? r.criado_por       ?? r.createdBy   ?? '',
  }
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useSupabaseSync(setState: SetState) {

  const loadAll = useCallback(async () => {
    const [
      dancersRaw, dinner, ordersRaw, scheduleRaw,
      historyRaw, auditRaw, usersRaw, birthdayRaw,
    ] = await Promise.all([
      fetchDancers(),
      fetchActiveDinner(),
      fetchOrders(),
      fetchSchedule(),
      fetchHistory(),
      fetchAuditLogs(),
      fetchAppUsers(),
      fetchBirthdayExtrasDb(),
    ])

    // ── Dancers ──────────────────────────────────────────────────────────────
    const dancers: Record<string, Dancer> = {}
    Object.values(dancersRaw).forEach((d: any) => { dancers[d.id] = d as Dancer })
    if (Object.keys(dancers).length) saveDancers(dancers)

    // ── Orders ───────────────────────────────────────────────────────────────
    const orders: Record<string, Order> = {}
    ;(ordersRaw as any[]).forEach((r: any) => { const o = rowToOrder(r); orders[o.id] = o })
    if (Object.keys(orders).length) saveOrders(orders)

    // ── Calendar — merge DB over local ────────────────────────────────────────
    const localCal = loadCalendar()
    const calendar: Record<string, CalendarEntry> = { ...localCal }
    Object.values(scheduleRaw as any).forEach((r: any) => {
      const e = rowToCalendarEntry(r); calendar[e.id] = e
    })
    if (Object.keys(calendar).length) saveCalendar(calendar)

    // ── History ──────────────────────────────────────────────────────────────
    const history: Record<string, HistoryEntry> = {}
    if (Object.keys(historyRaw as any).length) {
      Object.assign(history, historyRaw)
      saveHistory(history)
    } else {
      Object.assign(history, loadHistory())
    }

    // ── Audit logs ─────────────────────────────────────────────────────────
    // Filter out birthday_extras sentinel rows
    const auditLogs: AuditLog[] = (auditRaw as any[]).filter(
      (l: any) => l.type !== '__birthday_extras__'
    )

    // ── App users ─────────────────────────────────────────────────────────────
    const users: Record<string, AppUser> = {}
    if (Object.keys(usersRaw as any).length) {
      Object.assign(users, usersRaw)
      saveUsers(users)
    } else {
      Object.assign(users, loadUsers())
    }

    // ── Birthday extras ───────────────────────────────────────────────────────
    const birthdayExtras: BirthdayExtra[] = Array.isArray(birthdayRaw) && birthdayRaw.length
      ? birthdayRaw
      : loadBirthdayExtras()
    if (birthdayExtras.length) saveBirthdayExtras(birthdayExtras)

    // ── Dinner + participants ─────────────────────────────────────────────────
    // Only use local data as seed while DB loads; if DB has no active dinner,
    // leave dinner blank (DEFAULT_DINNER) so the app doesn't show a phantom event.
    let updatedDinner = loadDinner()
    let dinnerId: string | null = null
    let attendees: Attendee[] = []

    if (dinner) {
      dinnerId = dinner.id
      const merged = saveDinner({
        title:            dinner.name                ?? updatedDinner.title,
        eventDate:        dinner.date ? fmtDatePtBR(dinner.date) : updatedDinner.eventDate,
        organizer:        (dinner as any).org        ?? updatedDinner.organizer,
        deadline:         dinner.deadline_text       ?? updatedDinner.deadline,
        menu:             dinner.menu                ?? updatedDinner.menu,
        priceOptions:     (dinner.price_options ?? []).map((p: any) => ({ label: p.label, price: p.price ?? 0 })),
        lockMessage:      dinner.lock_message        ?? updatedDinner.lockMessage,
        lockAt:           dinner.lock_time           ?? updatedDinner.lockAt,
        closed:           dinner.status === 'closed',
        pixKey:           dinner.pix_key             ?? updatedDinner.pixKey,
        expenseAmount:    dinner.expense             ?? updatedDinner.expenseAmount,
        expenseDesc:      dinner.expense_desc        ?? updatedDinner.expenseDesc,
        organizerPhones:  dinner.organizer_phones    ?? updatedDinner.organizerPhones,
        authorizedPhones: dinner.authorized_phones   ?? updatedDinner.authorizedPhones,
        participants:     dinner.participants        ?? updatedDinner.participants,
      })
      updatedDinner = merged

      const rows = await fetchParticipants(dinner.id)
      if (rows.length) {
        attendees = rows.map(rowToAttendee)
        saveDinner({ attendees })
        updatedDinner = { ...updatedDinner, attendees }
      }
    } else {
      // Sem janta ativa no banco — limpar estado local para não exibir fantasma
      const { DEFAULT_DINNER } = await import('../lib/store')
      updatedDinner = { ...DEFAULT_DINNER }
      saveDinner(DEFAULT_DINNER)
    }

    setState(s => ({
      ...s,
      dinner:         updatedDinner,
      dinnerEvent:    updatedDinner,
      dancers:        Object.keys(dancers).length      ? dancers        : s.dancers,
      orders:         Object.keys(orders).length        ? orders         : s.orders,
      calendar:       Object.keys(calendar).length      ? calendar       : s.calendar,
      history:        Object.keys(history).length       ? history        : s.history,
      auditLogs:      auditLogs.length                  ? auditLogs      : s.auditLogs,
      users:          Object.keys(users).length         ? users          : s.users,
      birthdayExtras: birthdayExtras.length             ? birthdayExtras : s.birthdayExtras,
      _dinnerId:      dinnerId ?? s._dinnerId,
    }))
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Dancers ────────────────────────────────────────────────────────────────

  const saveDancerToDb = async (dancer: Dancer) => {
    const { error } = await upsertDancer(dancer as any)
    if (!error) {
      const fresh = await fetchDancers()
      saveDancers(fresh as any)
      setState(s => ({ ...s, dancers: fresh as any }))
    }
    return { error }
  }

  const deleteDancerFromDb = async (id: string) => {
    const { error } = await svcDeleteDancer(id)
    if (!error) {
      const fresh = await fetchDancers()
      saveDancers(fresh as any)
      setState(s => ({ ...s, dancers: fresh as any }))
    }
    return { error }
  }

  // ── Calendar ───────────────────────────────────────────────────────────────

  const saveCalEntry = async (entry: CalendarEntry, allCal: Record<string, CalendarEntry>) => {
    const dbEntry = {
      id: entry.id, date: entry.date, guardians: entry.guardians,
      menu: entry.menu, blocked: entry.blocked ?? false,
      blockReason: entry.blockReason ?? null, createdBy: entry.createdBy ?? null,
    }
    const { error } = await upsertScheduleEntry(dbEntry as any)
    if (!error) {
      const fresh = await fetchSchedule()
      const merged = { ...allCal }
      Object.values(fresh as any).forEach((r: any) => { const e = rowToCalendarEntry(r); merged[e.id] = e })
      saveCalendar(merged)
      setState(s => ({ ...s, calendar: merged }))
    }
    return { error }
  }

  const saveCalEntries = async (entries: CalendarEntry[], allCal: Record<string, CalendarEntry>) => {
    const dbEntries = entries.map(e => ({
      id: e.id, date: e.date, guardians: e.guardians,
      menu: e.menu ?? '', blocked: e.blocked ?? false,
      blockReason: e.blockReason ?? null, createdBy: e.createdBy ?? null,
    }))
    const { error } = await upsertScheduleEntries(dbEntries as any)
    if (!error) {
      const fresh = await fetchSchedule()
      const merged = { ...allCal }
      Object.values(fresh as any).forEach((r: any) => { const e = rowToCalendarEntry(r); merged[e.id] = e })
      saveCalendar(merged)
      setState(s => ({ ...s, calendar: merged }))
    }
    return { error }
  }

  const deleteCalEntry = async (id: string) => deleteScheduleEntry(id)

  // ── Dinner participants ────────────────────────────────────────────────────

  const addAttendee = async (dinnerId: string, attendee: Attendee, dancerId?: string) => {
    const { error } = await addParticipant(dinnerId, {
      dancer_id:   dancerId,
      person_name: attendee.name,
      phone:       attendee.phone || undefined,
      price:       attendee.price,
      is_cook:     attendee.isCook,
    })
    if (!error) {
      const rows = await fetchParticipants(dinnerId)
      const attendees = rows.map(rowToAttendee)
      saveDinner({ attendees })
      setState(s => ({ ...s, dinner: { ...s.dinner, attendees }, dinnerEvent: { ...s.dinner, attendees } }))
    }
    return { error }
  }

  const togglePresence = async (dbId: string, present: boolean | null, dinnerId: string) => {
    const { error } = await updateParticipant(dbId, { attended: present })
    if (!error) {
      const rows = await fetchParticipants(dinnerId)
      const attendees = rows.map(rowToAttendee)
      saveDinner({ attendees })
      setState(s => ({ ...s, dinner: { ...s.dinner, attendees }, dinnerEvent: { ...s.dinner, attendees } }))
    }
    return { error }
  }

  const removeAttendee = async (dbId: string, dinnerId: string) => {
    const { error } = await removeParticipant(dbId)
    if (!error) {
      const rows = await fetchParticipants(dinnerId)
      const attendees = rows.map(rowToAttendee)
      saveDinner({ attendees })
      setState(s => ({ ...s, dinner: { ...s.dinner, attendees }, dinnerEvent: { ...s.dinner, attendees } }))
    }
    return { error }
  }

  // ── History ────────────────────────────────────────────────────────────────

  const saveHistoryEntry = async (entry: HistoryEntry, currentHistory: Record<string, HistoryEntry>) => {
    const { error } = await insertHistory(entry)
    const updated = { ...currentHistory, [entry.id]: entry }
    saveHistory(updated)
    setState(s => ({ ...s, history: updated }))
    return { error }
  }

  const removeHistoryEntry = async (id: string, currentHistory: Record<string, HistoryEntry>) => {
    const { error } = await deleteHistoryEntry(id)
    if (!error) {
      const updated = { ...currentHistory }
      delete updated[id]
      saveHistory(updated)
      setState(s => ({ ...s, history: updated }))
    }
    return { error }
  }

  // ── Audit logs ─────────────────────────────────────────────────────────────

  const appendLogToDb = async (entry: Omit<AuditLog, 'id' | 'ts'>) => {
    const log: AuditLog = { ...entry, id: 'l' + Date.now(), ts: Date.now() }
    await insertAuditLog(log)
    setState(s => ({ ...s, auditLogs: [log, ...s.auditLogs].slice(0, 500) }))
    return log
  }

  const clearLogsFromDb = async () => {
    await clearAuditLogsDb()
    setState(s => ({ ...s, auditLogs: [] }))
  }

  // ── App users ──────────────────────────────────────────────────────────────

  const saveUserToDb = async (user: AppUser) => {
    const { error } = await upsertAppUser(user)
    if (!error) {
      const fresh = await fetchAppUsers()
      saveUsers(fresh as any)
      setState(s => ({ ...s, users: fresh as any }))
    }
    return { error }
  }

  const deleteUserFromDb = async (id: string) => {
    const { error } = await deleteAppUser(id)
    if (!error) {
      const fresh = await fetchAppUsers()
      saveUsers(fresh as any)
      setState(s => ({ ...s, users: fresh as any }))
    }
    return { error }
  }

  // ── Birthday extras ────────────────────────────────────────────────────────

  const saveBirthdayExtrasToDb = async (extras: BirthdayExtra[]) => {
    const { error } = await saveBirthdayExtrasDb(extras)
    saveBirthdayExtras(extras)
    setState(s => ({ ...s, birthdayExtras: extras }))
    return { error }
  }

  return {
    reload: loadAll,
    // Dancers
    saveDancerToDb,
    deleteDancerFromDb,
    // Calendar
    saveCalEntry,
    saveCalEntries,
    deleteCalEntry,
    // Dinner participants
    addAttendee,
    togglePresence,
    removeAttendee,
    // History
    saveHistoryEntry,
    removeHistoryEntry,
    // Audit logs
    appendLogToDb,
    clearLogsFromDb,
    // Users
    saveUserToDb,
    deleteUserFromDb,
    // Birthday extras
    saveBirthdayExtrasToDb,
  }
}

function fmtDatePtBR(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
  return `${days[d.getDay()]}, ${d.getDate()}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}
