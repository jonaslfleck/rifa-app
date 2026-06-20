import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n'
import { supabase } from '../lib/supabase'
import { formatPhone, cleanPhone } from '../lib/store'

interface AccessRequest {
  id: string
  name: string
  phone: string
  reason?: string
  status: string
  created_at: string
}

export function AccessRequestsTab() {
  const auth = useAuth()
  const { t } = useTranslation()

  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)

  if (!auth.canLogs()) {
    return <div className="empty-state">{t.app.noPermission}</div>
  }

  // ======================
  // LOAD REQUESTS
  // ======================
  async function load() {
    setLoading(true)

    const { data, error } = await supabase
      .from('access_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      setRequests([])
    } else {
      setRequests(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // ======================
  // APPROVE
  // ======================
  const approve = async (req: AccessRequest) => {
    const phone = cleanPhone(req.phone)

    // evita duplicado
    const { data: exists } = await supabase
      .from('guardians')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()

    if (!exists) {
      const { error } = await supabase.from('guardians').insert({
        name: req.name,
        phone,
        allowed: true
      })

      if (error) {
        alert(error.message)
        return
      }
    }

    const { error: updateError } = await supabase
      .from('access_requests')
      .update({
        status: 'approved',
        reviewed_by: auth.userName ?? ''
      })
      .eq('id', req.id)

    if (updateError) {
      alert(updateError.message)
      return
    }

    await load()
  }

  // ======================
  // REJECT
  // ======================
  const reject = async (req: AccessRequest) => {
    if (!confirm(t.accessRequests.rejectConfirm(req.name))) return

    const { error } = await supabase
      .from('access_requests')
      .update({
        status: 'rejected',
        reviewed_by: auth.userName ?? ''
      })
      .eq('id', req.id)

    if (error) {
      alert(error.message)
      return
    }

    await load()
  }

  // ======================
  // UI
  // ======================
  if (loading) {
    return <div className="empty-state">Carregando...</div>
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: '1rem' }}>
        {t.accessRequests.pending}
      </p>

      {requests.length === 0 && (
        <p className="empty-state">{t.accessRequests.none}</p>
      )}

      {requests.map(req => {
        const ts = new Date(req.created_at).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })

        return (
          <div key={req.id} className="card" style={{ marginBottom: '.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--blue-bg)',
                color: 'var(--blue-tx)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                flexShrink: 0
              }}>
                👤
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {req.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {formatPhone(req.phone)} · {ts}
                </div>
              </div>
            </div>

            {req.reason && (
              <div style={{
                background: 'var(--bg)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 13,
                marginBottom: 10,
                color: 'var(--muted)',
                borderLeft: '3px solid var(--border)'
              }}>
                <span style={{ fontWeight: 500, color: 'var(--text)' }}>
                  {t.accessRequests.reason}{' '}
                </span>
                {req.reason}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{ fontSize: 13 }}
                onClick={() => approve(req)}
              >
                {t.accessRequests.approve}
              </button>

              <button
                className="btn btn-danger"
                style={{ fontSize: 13 }}
                onClick={() => reject(req)}
              >
                {t.accessRequests.reject}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
