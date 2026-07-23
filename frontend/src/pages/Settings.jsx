import React, { useState, useEffect } from 'react'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'

const S = {
  page: { padding: 24 },
  title: { color: '#06b6d4', fontSize: 24, fontWeight: 700 },
  subtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 },
  badge: { background: '#e8ecf1', color: '#0d1b2a', border: '2px solid #0d1b2a', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, display: 'inline-block' },
  card: { background: 'rgba(14,18,36,0.97)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, marginBottom: 16 },
  cardTitle: { color: '#06b6d4', fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
  input: { width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none' },
  label: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6, display: 'block', fontWeight: 600 },
  btn: { padding: '12px 24px', background: 'linear-gradient(135deg, #06b6d4, #4f8fff)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnDanger: { padding: '10px 20px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, color: '#f87171', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  success: { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: 12, color: '#10b981', fontSize: 13, marginBottom: 16 },
  errBox: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 12, color: '#f87171', fontSize: 13, marginBottom: 16 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 },
  info: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 8, lineHeight: 1.4 },
  loader: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 },
  spin: { width: 24, height: 24, border: '2px solid rgba(6,182,212,0.2)', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin 1s linear infinite' },
}

export default function Settings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [resendApiKey, setResendApiKey] = useState('')
  const [resendFrom, setResendFrom] = useState('GLOB ERP <noreply@globfabrication.com>')

  useEffect(() => {
    api.get('/settings').then(res => {
      setSettings(res.data || {})
      setResendApiKey(res.data?.resendApiKey || '')
      setResendFrom(res.data?.resendFromEmail || 'GLOB ERP <noreply@globfabrication.com>')
      setLoading(false)
    }).catch(() => { setLoading(false) })
  }, [])

  const handleSave = async () => {
    setSaving(true); setMsg(null)
    try {
      await api.put('/settings', {
        ...settings,
        resendApiKey,
        resendFromEmail: resendFrom,
        companyName: settings.companyName || 'GLOB FABRICATION AND ENTERPRISES',
        companyGstin: settings.companyGstin || '27AWAPK1209R1ZC',
        companyAddress: settings.companyAddress || '',
        companyPhone: settings.companyPhone || '',
        companyEmail: settings.companyEmail || '',
      })
      setMsg({ type: 'success', text: 'Settings saved successfully!' })
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.msg || err.message || 'Failed to save' })
    }
    setSaving(false)
  }

  if (loading) return <div style={S.loader}><div style={S.spin} /><style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style></div>

  return (
    <div style={S.page}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={S.title}>Settings</h1>
        <p style={S.subtitle}>Manage your ERP configuration</p>
        <span style={S.badge}>GSTIN: 27AWAPK1209R1ZC</span>
      </div>

      {msg && <div style={msg.type === 'success' ? S.success : S.errBox}>{msg.text}</div>}

      {/* Company Details */}
      <div style={S.card}>
        <div style={S.cardTitle}>🏢 Company Details</div>
        <div style={S.row}>
          <div><label style={S.label}>Company Name</label><input style={S.input} value={settings.companyName || 'GLOB FABRICATION AND ENTERPRISES'} onChange={e => setSettings({...settings, companyName: e.target.value})} /></div>
          <div><label style={S.label}>GSTIN</label><input style={S.input} value={settings.companyGstin || '27AWAPK1209R1ZC'} onChange={e => setSettings({...settings, companyGstin: e.target.value})} /></div>
        </div>
        <div style={S.row}>
          <div><label style={S.label}>Address</label><input style={S.input} value={settings.companyAddress || ''} onChange={e => setSettings({...settings, companyAddress: e.target.value})} placeholder="Business address" /></div>
          <div><label style={S.label}>Phone</label><input style={S.input} value={settings.companyPhone || ''} onChange={e => setSettings({...settings, companyPhone: e.target.value})} placeholder="Phone number" /></div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>Business Email</label>
          <input style={S.input} value={settings.companyEmail || ''} onChange={e => setSettings({...settings, companyEmail: e.target.value})} placeholder="Official email" />
        </div>
      </div>

      {/* Email / Resend Integration */}
      <div style={S.card}>
        <div style={S.cardTitle}>📧 Email (Resend API)</div>
        <p style={S.info}>Render free tier BLOCKS SMTP ports. Use Resend API (HTTPS) instead — free 3,000 emails/month.</p>
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>Resend API Key</label>
          <input style={S.input} value={resendApiKey} onChange={e => setResendApiKey(e.target.value)} placeholder="re_xxxxxxxxxxxx — get from resend.com" />
          <p style={S.info}>Sign up at resend.com → Dashboard → API Keys → Create Key → paste above</p>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>From Email</label>
          <input style={S.input} value={resendFrom} onChange={e => setResendFrom(e.target.value)} placeholder="GLOB ERP <noreply@globfabrication.com>" />
          <p style={S.info}>Must use a verified domain on Resend. Default: onboarding@resend.dev for testing</p>
        </div>
      </div>

      {/* User Info */}
      <div style={S.card}>
        <div style={S.cardTitle}>👤 Your Account</div>
        <div style={S.row}>
          <div><label style={S.label}>Name</label><div style={{ color: '#fff', fontSize: 14 }}>{user?.name || 'Admin'}</div></div>
          <div><label style={S.label}>Email</label><div style={{ color: '#fff', fontSize: 14 }}>{user?.email || 'admin@globfabrication.com'}</div></div>
        </div>
        <div><label style={S.label}>Role</label><div style={{ color: '#06b6d4', fontSize: 14, fontWeight: 600 }}>{user?.role || 'admin'}</div></div>
      </div>

      {/* Database Setup */}
      <div style={S.card}>
        <div style={S.cardTitle}>🔧 Database Setup</div>
        <p style={S.info}>Run initial setup if the database is fresh or after major updates.</p>
        <button style={S.btn} onClick={async () => { try { const res = await api.get('/setup'); setMsg({ type: 'success', text: `Setup complete! Created ${res.data.tables || 'all'} tables.` }) } catch (err) { setMsg({ type: 'error', text: err.response?.data?.msg || err.message }) } }}>Run Database Setup</button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={S.btn} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save All Settings'}</button>
      </div>
    </div>
  )
}
