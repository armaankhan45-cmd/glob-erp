import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { ShieldCheck, ChevronLeft, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react'

const COLORS = { CREATE: '#10b981', INSERT: '#10b981', UPDATE: '#f59e0b', DELETE: '#ef4444', LOGIN: '#06b6d4' }
const colorFor = a => COLORS[String(a || '').toUpperCase().split('_')[0]] || 'var(--accent)'
const fmt = d => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function Json({ v }) {
  if (v == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return <pre className="text-[11px] whitespace-pre-wrap break-all m-0" style={{ color: 'var(--text-bright)' }}>{JSON.stringify(v, null, 2)}</pre>
}

export default function AuditLog() {
  const [data, setData] = useState({ rows: [], total: 0, actions: [], tables: [] })
  const [f, setF] = useState({ action: '', table: '', from: '', to: '', q: '' })
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(null)
  const limit = 50

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const params = { page, limit }
      Object.entries(f).forEach(([k, v]) => { if (v) params[k] = v })
      const res = await api.get('/audit', { params })
      setData(res.data)
    } catch (e) { setErr(e.response?.data?.msg || 'Could not load audit log (admin only, or you are offline)') }
    finally { setLoading(false) }
  }, [f, page])

  useEffect(() => { load() }, [load])
  const set = (k, v) => { setPage(1); setF(p => ({ ...p, [k]: v })) }
  const pages = Math.max(1, Math.ceil(data.total / limit))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} style={{ color: 'var(--accent)' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-bright)' }}>Audit Log</h1>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{data.total} records</span>
        </div>
        <button className="btn-secondary flex items-center gap-1.5" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className="card p-3 grid grid-cols-2 md:grid-cols-5 gap-2">
        <select className="input-field" value={f.action} onChange={e => set('action', e.target.value)}>
          <option value="">All actions</option>{data.actions.map(a => <option key={a}>{a}</option>)}
        </select>
        <select className="input-field" value={f.table} onChange={e => set('table', e.target.value)}>
          <option value="">All tables</option>{data.tables.map(a => <option key={a}>{a}</option>)}
        </select>
        <input type="date" className="input-field" value={f.from} onChange={e => set('from', e.target.value)} />
        <input type="date" className="input-field" value={f.to} onChange={e => set('to', e.target.value)} />
        <input className="input-field" placeholder="Record ID / table" value={f.q} onChange={e => set('q', e.target.value)} />
      </div>

      {err && <div className="card p-3 text-sm" style={{ color: '#ef4444' }}>{err}</div>}

      <div className="card overflow-x-auto">
        <table className="nebula-table w-full text-sm">
          <thead><tr><th></th><th>When</th><th>User</th><th>Action</th><th>Table</th><th>Record</th><th>IP</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</td></tr>}
            {!loading && data.rows.length === 0 && <tr><td colSpan={7} className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>No audit entries</td></tr>}
            {!loading && data.rows.map(r => (
              <>
                <tr key={r.id} className="cursor-pointer" onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <td><ChevronDown size={14} style={{ transform: open === r.id ? 'none' : 'rotate(-90deg)', transition: '0.15s' }} /></td>
                  <td className="whitespace-nowrap">{fmt(r.created_at)}</td>
                  <td>{r.user_name || r.user_email || (r.user_id ? `#${r.user_id}` : 'System')}</td>
                  <td><span className="px-2 py-0.5 rounded-md text-[11px] font-semibold" style={{ color: colorFor(r.action), background: 'rgba(128,128,128,0.12)' }}>{r.action}</span></td>
                  <td>{r.table_name}</td><td>{r.record_id ?? '—'}</td>
                  <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.ip_address || '—'}</td>
                </tr>
                {open === r.id && (
                  <tr key={r.id + 'd'}><td colSpan={7}>
                    <div className="grid md:grid-cols-2 gap-3 p-2">
                      <div><p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>BEFORE</p><Json v={r.old_value} /></div>
                      <div><p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>AFTER</p><Json v={r.new_value} /></div>
                    </div>
                  </td></tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></button>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Page {page} / {pages}</span>
        <button className="btn-secondary" disabled={page >= pages} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></button>
      </div>
    </div>
  )
}
