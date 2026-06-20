import { useState, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n'
import { supabase } from '../lib/supabase'
import { DinnerEvent, cleanPhone, formatPhone } from '../lib/store'
import { validatePhone, validateEmail, focusFirstInvalid } from '../lib/validation'
import logoCamboata   from '../assets/logo-camboata.png'
import logoAtiradores from '../assets/logo-atiradores.png'

interface Props {
  dinner: DinnerEvent
  onSuccess?: () => void
}

type Mode = 'phone' | 'email' | 'forgot' | 'request'

export default function LoginScreen({ dinner, onSuccess }: Props) {
  const auth = useAuth()
  const { t } = useTranslation()

  const [mode,      setMode]      = useState<Mode>('phone')
  const [phone,     setPhone]     = useState('')
  const [email,     setEmail]     = useState('')
  const [pw,        setPw]        = useState('')
  const [reqName,   setReqName]   = useState('')
  const [reqPhone,  setReqPhone]  = useState('')
  const [reqReason, setReqReason] = useState('')
  const [err,       setErr]       = useState('')
  const [ok,        setOk]        = useState('')
  const [loading,   setLoading]   = useState(false)

  const reset = () => { setErr(''); setOk('') }
  const formRef = useRef<HTMLDivElement>(null)

  const focusInvalid = () => setTimeout(() => focusFirstInvalid(formRef), 50)
  const goLogin = () => { setMode('phone'); reset() }

  const checkPhone = async () => {
    reset()
    const raw = cleanPhone(phone)
    if (!validatePhone(raw)) { setErr(t.login.invalidPhone); focusInvalid(); return }
    setLoading(true)
    const { data: guardian } = await supabase
      .from('guardians').select('*').eq('phone', raw).eq('allowed', true).maybeSingle()
    setLoading(false)
    if (!guardian) { setErr(t.login.unauthorized); setTimeout(() => setMode('request'), 600); return }
    auth.setPhoneRole(raw, guardian.name || formatPhone(raw), false)
    onSuccess?.()
  }

  const doEmailLogin = async () => {
    reset()
    if (!validateEmail(email)) { setErr('E-mail inválido.'); focusInvalid(); return }
    setLoading(true)
    const { error } = await auth.signIn(email, pw)
    if (error) setErr(t.login.wrongCredentials)
    else onSuccess?.()
    setLoading(false)
  }

  const doForgot = async () => {
    reset()
    setLoading(true)
    if (!email) { setErr(t.login.enterEmailFirst); setLoading(false); return }
    if (!validateEmail(email)) { setErr('E-mail inválido.'); setLoading(false); return }
    const redirectUrl = window.location.origin + window.location.pathname
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl })
    if (error) setErr(error.message)
    else setOk(t.login.forgotOk)
    setLoading(false)
  }

  const submitRequest = async () => {
    reset()
    const name       = reqName.trim()
    const phoneClean = cleanPhone(reqPhone)
    const reason     = reqReason.trim()
    if (!name)                      { setErr(t.accessRequest.nameRequired); focusInvalid(); return }
    if (!validatePhone(phoneClean)) { setErr(t.accessRequest.invalidPhone); focusInvalid(); return }
    if (!reason)                    { setErr(t.accessRequest.reasonRequired); focusInvalid(); return }

    const { data: existing } = await supabase
      .from('access_requests').select('id').eq('phone', phoneClean).eq('status', 'pending').maybeSingle()
    if (existing) { setErr('Solicitação já enviada'); return }

    const { error } = await supabase.from('access_requests').insert({ name, phone: phoneClean, reason, status: 'pending' })
    if (error) { setErr(error.message); return }
    setOk('ok')
  }

  return (
    <div className="login-screen">
      <div className="login-card">

        {/* LOGO */}
        <div className="login-logo">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 8 }}>
            <img src={logoCamboata}   alt="DTG Camboatá"      style={{ height: 90, width: 'auto', objectFit: 'contain' }} />
            <img src={logoAtiradores} alt="Grêmio Atiradores" style={{ height: 100, width: 'auto', objectFit: 'contain' }} />
          </div>
          <h1>{t.app.name}</h1>
          <p>{t.app.subtitle}</p>
        </div>

        {err && <div className="error-box">{err}</div>}
        {ok && ok !== 'ok' && <div className="success-box">{ok}</div>}

        {/* TABS (apenas nas telas phone/email) */}
        {(mode === 'phone' || mode === 'email') && (
          <div className="login-tabs">
            <button className={`login-tab ${mode === 'phone' ? 'active' : ''}`}
              onClick={() => { setMode('phone'); reset() }}>{t.login.phoneTab}</button>
            <button className={`login-tab ${mode === 'email' ? 'active' : ''}`}
              onClick={() => { setMode('email'); reset() }}>{t.login.teamTab}</button>
          </div>
        )}

        {/* ── PHONE ── */}
        {mode === 'phone' && (
          <div ref={formRef}>
            <p className="sheet-sub">{t.login.phoneSubtitle}</p>
            <div className="form-group">
              <label className="form-label">{t.login.phoneLabel}</label>
              <input className="form-input" type="tel" value={phone} data-field="phone" data-required="true"
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && checkPhone()} autoFocus />
            </div>
            <button className="btn btn-primary btn-block" onClick={checkPhone} disabled={loading}>
              {loading ? 'Entrando...' : t.login.enterBtn}
            </button>
            <div style={{ textAlign: 'center', marginTop: '.75rem' }}>
              <button className="link-btn" onClick={() => { setMode('request'); reset() }}>
                {t.login.noAccess}
              </button>
            </div>
          </div>
        )}

        {/* ── EMAIL ── */}
        {mode === 'email' && (
          <div ref={formRef}>
            <p className="sheet-sub">{t.login.teamSubtitle}</p>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={email} data-field="email" data-required="true" onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <input className="form-input" type="password" value={pw} data-field="password" data-required="true"
                onChange={e => setPw(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doEmailLogin()} />
            </div>
            <button className="btn btn-primary btn-block" onClick={doEmailLogin} disabled={loading}>
              {loading ? 'Entrando...' : t.login.enterBtn}
            </button>
            <div style={{ textAlign: 'center', marginTop: '.75rem' }}>
              <button className="link-btn" onClick={doForgot}>Esqueci minha senha</button>
            </div>
          </div>
        )}

        {/* ── REQUEST ── */}
        {mode === 'request' && ok !== 'ok' && (
          <div ref={formRef}>
            <p className="sheet-sub" style={{ fontWeight: 600 }}>Solicitar acesso</p>
            <div className="form-group">
              <label className="form-label">Nome</label>
              <input className="form-input" value={reqName} data-field="reqName" data-required="true" onChange={e => setReqName(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Telefone</label>
              <input className="form-input" type="tel" value={reqPhone} data-field="reqPhone" data-required="true" onChange={e => setReqPhone(e.target.value)} maxLength={15} />
              {reqPhone && !validatePhone(cleanPhone(reqPhone)) && (
                <div style={{ fontSize:11, color:'var(--dtg-red)', marginTop:3 }}>Telefone inválido. Use: (51) 99999-9999</div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Motivo</label>
              <textarea className="form-input" value={reqReason} data-field="reqReason" data-required="true" onChange={e => setReqReason(e.target.value)}
                style={{ minHeight: 72 }} />
            </div>
            <button className="btn btn-primary btn-block" onClick={submitRequest} disabled={loading}>
              Enviar solicitação
            </button>
            {/* Voltar pro login */}
            <div style={{ textAlign: 'center', marginTop: '.75rem' }}>
              <button className="link-btn" onClick={goLogin}>← Voltar ao login</button>
            </div>
          </div>
        )}

        {/* ── REQUEST SUCCESS ── */}
        {mode === 'request' && ok === 'ok' && (
          <>
            <div className="success-box" style={{ textAlign:'center', padding:'1.5rem 1rem' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>✅</div>
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                Solicitação enviada com sucesso!<br/>Aguarde a aprovação da equipe.
              </p>
            </div>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button className="btn btn-primary btn-block" onClick={goLogin}>← Voltar ao login</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
