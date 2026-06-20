import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type Role =
  | 'super'
  | 'board'
  | 'coordination'
  | 'secretariat'
  | 'kitchen'
  | 'treasury'
  | 'organizer'
  | 'guardian'
  | null

interface AuthContext {
  user: User | null
  role: Role
  userName: string | null
  userPhone: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  setPhoneRole: (phone: string, name: string, isOrganizer: boolean) => void
  clearRole: () => void
  // Role checks
  isSuper:       () => boolean
  isBoard:       () => boolean
  isCoordination:() => boolean
  isSecretariat: () => boolean
  isKitchen:     () => boolean
  isTreasury:    () => boolean
  isOrganizer:   () => boolean
  isGuardian:    () => boolean
  isManagement:  () => boolean
  // Permission checks
  canCaixa:       () => boolean
  canDancas:      () => boolean
  canDash:        () => boolean
  canHist:        () => boolean
  canAniv:        () => boolean
  canLogs:        () => boolean
  canUsuarios:    () => boolean
  canPostergar:   () => boolean
  canViewTotal:   () => boolean
  canPrint:       () => boolean
  isDinnerOrganizer: (organizerPhones: string[], organizerStr: string) => boolean
}

const AuthCtx = createContext<AuthContext>(null!)

const STORAGE_PHONE      = 'jdtg_phone'
const STORAGE_PHONE_NAME = 'jdtg_phone_name'
const STORAGE_PHONE_ROLE = 'jdtg_phone_role'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<User | null>(null)
  const [role,      setRole]      = useState<Role>(null)
  const [userName,  setUserName]  = useState<string | null>(null)
  const [userPhone, setUserPhone] = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      setUser(u)
      if (u) fetchRole(u.id, u.email)
      else { restorePhone(); setLoading(false) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) fetchRole(u.id, u.email)
      else { restorePhone(); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  function restorePhone() {
    const p = localStorage.getItem(STORAGE_PHONE)
    const n = localStorage.getItem(STORAGE_PHONE_NAME)
    const r = localStorage.getItem(STORAGE_PHONE_ROLE) as Role
    if (p && n && r) { setUserPhone(p); setUserName(n); setRole(r) }
  }

  async function fetchRole(uid: string, email?: string) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role_id, roles(name)')
      .eq('user_id', uid)
      .single()
    if (!error && data) {
      const roleName = (data as any).roles?.name as Role ?? null
      setRole(roleName)
    }
    setUserName(email ?? null)
    setLoading(false)
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setRole(null); setUserName(null); setUserPhone(null)
    localStorage.removeItem(STORAGE_PHONE)
    localStorage.removeItem(STORAGE_PHONE_NAME)
    localStorage.removeItem(STORAGE_PHONE_ROLE)
  }

  const setPhoneRole = (phone: string, name: string, isOrganizer: boolean) => {
    const r: Role = isOrganizer ? 'organizer' : 'guardian'
    setUserPhone(phone); setUserName(name); setRole(r)
    localStorage.setItem(STORAGE_PHONE,      phone)
    localStorage.setItem(STORAGE_PHONE_NAME, name)
    localStorage.setItem(STORAGE_PHONE_ROLE, r)
  }

  const clearRole = () => {
    setRole(null); setUserName(null); setUserPhone(null)
    localStorage.removeItem(STORAGE_PHONE)
    localStorage.removeItem(STORAGE_PHONE_NAME)
    localStorage.removeItem(STORAGE_PHONE_ROLE)
  }

  // ── Role checks ──────────────────────────────────────────────────────────────
  const isSuper        = () => role === 'super'
  const isBoard        = () => role === 'board'       || isSuper()
  const isCoordination = () => role === 'coordination'
  const isSecretariat  = () => role === 'secretariat'
  const isKitchen      = () => role === 'kitchen'
  const isTreasury     = () => role === 'treasury'
  const isOrganizer    = () => role === 'organizer'
  const isGuardian     = () => role === 'guardian'
  const isManagement   = () => isSuper() || isBoard() || isCoordination() || isSecretariat()

  // ── Permission checks ─────────────────────────────────────────────────────────
  const canCaixa     = () => isSuper() || isBoard() || isTreasury()
  const canDancas    = () => isManagement()
  const canDash      = () => isSuper() || isBoard() || isTreasury() || isCoordination() || isSecretariat()
  const canHist      = () => isSuper() || isBoard() || isTreasury()
  const canAniv      = () => isSuper() || isBoard() || isTreasury() || isCoordination() || isSecretariat()
  const canLogs      = () => isSuper()
  const canUsuarios  = () => isSuper()
  const canPostergar = () => isSuper() || isBoard() || isCoordination() || isSecretariat() || isTreasury()
  const canViewTotal = () => isSuper() || isBoard() || isTreasury()
  const canPrint     = () => isSuper() || isBoard() || isTreasury() || isCoordination() || isSecretariat()

  const isDinnerOrganizer = (organizerPhones: string[], organizerStr: string) => {
    if (!role || !userName) return false
    return (userPhone ? organizerPhones.includes(userPhone) : false) ||
           organizerStr.toLowerCase().includes((userName || '').toLowerCase())
  }

  return (
    <AuthCtx.Provider value={{
      user, role, userName, userPhone, loading,
      signIn, signOut, setPhoneRole, clearRole,
      isSuper, isBoard, isCoordination, isSecretariat,
      isKitchen, isTreasury, isOrganizer, isGuardian, isManagement,
      canCaixa, canDancas, canDash, canHist, canAniv,
      canLogs, canUsuarios, canPostergar, canViewTotal, canPrint,
      isDinnerOrganizer,
    }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
