import React, { useState, useEffect } from 'react'
import api from '../api/client'

const S = {
  page: { padding: 24 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { color: '#06b6d4', fontSize: 24, fontWeight: 700 },
  badge: { background: '#e8ecf1', color: '#0d1b2a', border: '2px solid #0d1b2a', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, display: 'inline-block' },
  btn: { padding: '10px 20px', background: 'linear-gradient(135deg, #06b6d4, #4f8fff)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  loader: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 },
  spin: { width: 24, height: 24, border: '2px solid rgba(6,182,212,0.2)', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  errBox: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 16, color: '#f87171', fontSize: 13 },
  card: { background: 'rgba(14,18,36,0.97)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 24, marginBottom: 16 },
  statNum: { color: '#06b6d4', fontSize: 28, fontWeight: 700 },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 },
}

export default function GSTReports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/gst/reports').then(res => { setData(res.data); setLoading(false) }).catch(err => { setError(err.message); setLoading(false) })
  }, [])

  if (loading) return <div style={S.loader}><div style={S.spin} /><style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style></div>

  const d = data || {}
  return (
    <div style={S.page}>
      <div style={S.header}><div><h1 style={S.title}>GST Reports</h1><span style={S.badge}>GSTIN: 27AWAPK1209R1ZC</span></div></div>
      {error && <div style={S.errBox}>{error}</div>}
      <div style={S.grid}>
        <div style={S.card}><div style={S.statNum}>₹{(d.outputCGST || 0).toLocaleString('en-IN')}</div><div style={S.statLabel}>Output CGST</div></div>
        <div style={S.card}><div style={S.statNum}>₹{(d.outputSGST || 0).toLocaleString('en-IN')}</div><div style={S.statLabel}>Output SGST</div></div>
        <div style={S.card}><div style={S.statNum}>₹{(d.inputCGST || 0).toLocaleString('en-IN')}</div><div style={S.statLabel}>Input CGST</div></div>
        <div style={S.card}><div style={S.statNum}>₹{(d.inputSGST || 0).toLocaleString('en-IN')}</div><div style={S.statLabel}>Input SGST</div></div>
        <div style={S.card}><div style={{...S.statNum, color: '#10b981'}}>₹{(d.netGST || 0).toLocaleString('en-IN')}</div><div style={S.statLabel}>Net GST Liability</div></div>
        <div style={S.card}><div style={S.statNum}>{d.totalSalesInvoices || 0}</div><div style={S.statLabel}>Sales Invoices (GSTR-1)</div></div>
        <div style={S.card}><div style={S.statNum}>{d.totalPurchaseBills || 0}</div><div style={S.statLabel}>Purchase Bills (GSTR-2)</div></div>
      </div>
    </div>
  )
}
