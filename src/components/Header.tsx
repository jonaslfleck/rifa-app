import { useState, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n'
import { Tab } from '../App'
import logoCamboata   from '../assets/logo-camboata-header.png'
import logoAtiradores from '../assets/logo-atiradores-header.png'

interface Props { tab: Tab; onTab: (t: Tab) => void; requestCount: number }

export default function Header({ tab, onTab, requestCount }: Props) {
  const auth = useAuth()
  const { t } = useTranslation()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [dropPos, setDropPos]   = useState({ top: 0, left: 0 })
  const [showProfile, setShowProfile] = useState(false)
  const [showLogin, setShowLogin]     = useState(false)
  const [loginEmail, setLoginEmail]   = useState('')
  const [loginPw, setLoginPw]         = useState('')
  const [loginErr, setLoginErr]       = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginMode, setLoginMode]     = useState<'email'|'forgot'>('email')
  const [loginOk, setLoginOk]         = useState('')
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  type NavItem = { id: Tab; label: string; show: boolean; badge?: number }
  type NavGroup = { id: string; label: string; items: NavItem[] }

  const groups: NavGroup[] = [
    { id: 'home', label: t.nav.home, items: [
      { id: 'welcome', label: t.nav.home, show: true },
    ]},
    { id: 'dinners', label: t.nav.dinners, items: [
      { id: 'dinner',   label: t.nav.currentDinner, show: true },
      { id: 'history',  label: t.nav.history,  show: auth.canHist() },
      { id: 'calendar', label: t.nav.calendar, show: true },
    ]},
    { id: 'registrations', label: t.nav.registrations, items: [
      { id: 'dancers',   label: t.nav.dancers,   show: auth.canDancas() || auth.isGuardian() },
      { id: 'guardians', label: t.nav.guardians, show: auth.canDancas() },
      { id: 'users',     label: t.nav.teamUsers, show: auth.canUsuarios() },
      { id: 'requests',  label: t.nav.access,    show: auth.canLogs(), badge: requestCount },
    ]},
    { id: 'financial', label: t.nav.financial, items: [
      { id: 'cashregister', label: t.nav.cashRegister, show: auth.canCaixa() },
      { id: 'orders',       label: t.nav.orders,       show: auth.canCaixa() || auth.isGuardian() || auth.isOrganizer() },
      { id: 'checkin',      label: t.nav.checkIn,      show: auth.canCaixa() },
    ]},
    { id: 'reports', label: t.nav.reports, items: [
      { id: 'dashboard',  label: t.nav.dashboard,  show: auth.canDash() || auth.isGuardian() },
      { id: 'birthdays',  label: t.nav.birthdays,  show: auth.canAniv() },
      { id: 'menu',       label: t.nav.printMenu,  show: auth.isSuper() || auth.isBoard() || auth.isOrganizer() || auth.isCoordination() || auth.isSecretariat() },
      { id: 'auditlogs',  label: t.nav.logs,       show: auth.canLogs() },
    ]},
  ]

  const visible = groups
    .map(g => ({ ...g, items: g.items.filter(i => i.show) }))
    .filter(g => g.items.length > 0)

  const allItems  = visible.flatMap(g => g.items)
  const activeGrp = visible.find(g => g.items.some(i => i.id === tab))?.id ?? null

  const go = (id: Tab) => { onTab(id); setOpenMenu(null) }
  const toggleMenu = (gid: string) => {
    if (openMenu === gid) { setOpenMenu(null); return }
    const btn = btnRefs.current[gid]
    if (btn) { const r = btn.getBoundingClientRect(); setDropPos({ top: r.bottom + 2, left: r.left }) }
    setOpenMenu(gid)
  }

  const doLogin = async () => {
    setLoginErr(''); setLoginLoading(true)
    const { error } = await auth.signIn(loginEmail, loginPw)
    if (error) setLoginErr(t.login.wrongCredentials)
    else setShowLogin(false)
    setLoginLoading(false)
  }
  const doForgot = async () => {
    setLoginErr(''); setLoginLoading(true)
    if (!loginEmail) { setLoginErr(t.login.enterEmailFirst); setLoginLoading(false); return }
    const { supabase } = await import('../lib/supabase')
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: window.location.origin + window.location.pathname,
    })
    if (error) setLoginErr(error.message); else setLoginOk(t.login.forgotOk)
    setLoginLoading(false)
  }

  const roleIcon  = auth.role ? (t.roleEmoji[auth.role] ?? '👤') : '🔐'
  const roleLabel = auth.role ? (t.roles[auth.role]    ?? auth.role) : ''

  return (
    <>
      <div className="topbar">
        <div className="topbar-inner">
          <img src={logoCamboata} alt="DTG Camboatá"
            className="topbar-logo"
            style={{ height: 38, width: 'auto', objectFit: 'contain' }} />
          <div className="topbar-title">
            <h1>{t.app.name}</h1>
            <p>{t.app.subtitle}</p>
          </div>
          <button
            className={`topbar-avatar ${auth.role ? 'active' : ''}`}
            onClick={() => auth.role ? setShowProfile(true) : setShowLogin(true)}
            title={auth.userName ?? t.nav.signIn}>
            {roleIcon}
          </button>
          <img src={logoAtiradores} alt="Grêmio Atiradores"
            style={{ height: 38, width: 'auto', objectFit: 'contain', marginLeft: 4, flexShrink: 0 }} />
        </div>

        <nav className="navbar">
          <select className="navbar-select" value={tab} onChange={e => go(e.target.value as Tab)}>
            {allItems.map(i => (
              <option key={i.id} value={i.id}>{i.label}{i.badge ? ` (${i.badge})` : ''}</option>
            ))}
          </select>
          <div className="navbar-inner">
            {visible.map(group => {
              if (group.items.length === 1) {
                const item = group.items[0]
                return (
                  <div key={group.id} className="nav-menu">
                    <button className={`nav-btn ${tab === item.id ? 'active' : ''}`} onClick={() => go(item.id)}>
                      {item.label}
                      {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                    </button>
                  </div>
                )
              }
              const isOpen = openMenu === group.id
              return (
                <div key={group.id} className="nav-menu">
                  <button
                    ref={el => { btnRefs.current[group.id] = el }}
                    className={`nav-btn ${activeGrp === group.id ? 'active' : ''} ${isOpen ? 'open' : ''}`}
                    onClick={() => toggleMenu(group.id)}>
                    {group.label}
                    {group.items.some(i => (i.badge ?? 0) > 0) && (
                      <span className="nav-badge">{group.items.reduce((s,i) => s+(i.badge??0), 0)}</span>
                    )}
                    <span className="nav-caret">▾</span>
                  </button>
                </div>
              )
            })}
          </div>
        </nav>
      </div>

      {/* Dropdown */}
      {openMenu && (() => {
        const group = visible.find(g => g.id === openMenu)
        if (!group) return null
        return (
          <>
            <div style={{ position:'fixed', inset:0, zIndex:199 }} onClick={() => setOpenMenu(null)} />
            <div className="nav-dropdown" style={{ top: dropPos.top, left: dropPos.left }}>
              {group.items.map(item => (
                <button key={item.id} className={`nav-item ${tab === item.id ? 'active' : ''}`}
                  onClick={() => go(item.id)}>
                  {item.label}
                  {item.badge ? <span className="nav-badge" style={{ float:'right' }}>{item.badge}</span> : null}
                </button>
              ))}
            </div>
          </>
        )
      })()}

      {/* Profile */}
      {showProfile && (
        <div className="overlay" onClick={() => setShowProfile(false)}>
          <div className="sheet" style={{ maxWidth:380 }} onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">{t.profile.title}</span>
              <button className="sheet-close" onClick={() => setShowProfile(false)}>×</button>
            </div>
            <div className="sheet-body">
              <div style={{ textAlign:'center', padding:'1rem 0' }}>
                <div style={{ fontSize:48, marginBottom:8 }}>{roleIcon}</div>
                <div style={{ fontWeight:500, fontSize:16 }}>{auth.userName}</div>
                {auth.userPhone && <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>📱 {auth.userPhone}</div>}
                {roleLabel && <div style={{ fontSize:13, color:'var(--muted)', marginTop:4 }}>{roleLabel}</div>}
              </div>
            </div>
            <div className="sheet-footer">
              <button className="btn btn-danger" onClick={() => { auth.user ? auth.signOut() : auth.clearRole(); setShowProfile(false) }}>
                {t.nav.signOut}
              </button>
              <button className="btn" onClick={() => setShowProfile(false)}>{t.app.close}</button>
            </div>
          </div>
        </div>
      )}

      {/* Login modal */}
      {showLogin && (
        <div className="overlay" onClick={() => setShowLogin(false)}>
          <div className="sheet" style={{ maxWidth:380 }} onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <span className="sheet-title">{t.nav.signIn}</span>
              <button className="sheet-close" onClick={() => setShowLogin(false)}>×</button>
            </div>
            <div className="sheet-body">
              {loginErr && <div className="error-box">{loginErr}</div>}
              {loginOk  && <div className="success-box">{loginOk}</div>}
              <div className="form-group">
                <label className="form-label">{t.login.emailLabel}</label>
                <input className="form-input" type="email" value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)} autoFocus />
              </div>
              {loginMode === 'email' && (
                <div className="form-group">
                  <label className="form-label">{t.login.passwordLabel}</label>
                  <input className="form-input" type="password" value={loginPw}
                    onChange={e => setLoginPw(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doLogin()} />
                </div>
              )}
            </div>
            <div className="sheet-footer">
              <button className="btn" onClick={() => setShowLogin(false)}>{t.app.cancel}</button>
              <button className="btn btn-primary" onClick={loginMode === 'email' ? doLogin : doForgot} disabled={loginLoading}>
                {loginLoading ? t.login.enteringBtn : loginMode === 'email' ? t.login.enterBtn : t.login.sendEmailBtn}
              </button>
            </div>
            <div style={{ textAlign:'center', padding:'0 1.5rem 1rem' }}>
              <button className="link-btn"
                onClick={() => setLoginMode(loginMode === 'email' ? 'forgot' : 'email')}>
                {loginMode === 'email' ? t.login.forgotPassword : t.app.back}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
