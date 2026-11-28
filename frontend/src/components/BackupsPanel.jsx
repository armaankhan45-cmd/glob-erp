import { useEffect, useRef, useState } from 'react'
import { Download, RotateCcw, Trash2, Loader2, DatabaseBackup, Upload, ShieldCheck } from 'lucide-react'
import api from '../api/client'
import { DataTable, EmptyBlock } from './ui'

const KIND = { auto: 'Daily (automatic)', manual: 'Manual', 'pre-restore': 'Safety copy' }
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const size = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

export default function BackupsPanel() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  const fileRef = useRef(null)

  const load = () => api.get('/backups').then(r => setList(r.data.backups || [])).catch(() => setMsg({ err: true, text: 'Could not load backups' })).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const run = async (key, fn, ok) => {
    setBusy(key); setMsg(null)
    try { const r = await fn(); setMsg({ text: typeof ok === 'function' ? ok(r) : ok }); await load() }
    catch (e) { setMsg({ err: true, text: e.response?.data?.msg || 'Something went wrong' }) }
    finally { setBusy('') }
  }
  const backupNow = () => run('new', () => api.post('/backups', {}), r => `Backup saved — ${r.data.backup.row_count} records.`)
  const restore = (b) => {
    if (!confirm(`Restore the backup from ${when(b.created_at)}?\n\nAll current invoices, customers, purchases and other records will be replaced with this backup. A safety copy of today's data is taken first, so you can undo this.`)) return
    run('r' + b.id, () => api.post(`/backups/${b.id}/restore`), restoredMsg)
  }
  const restoredMsg = (r) => `Restored ${Object.values(r.data.restored || {}).reduce((a, c) => a + c, 0)} records. A safety copy of the previous data was saved.`
  const download = async (b) => {
    setBusy('d' + b.id)
    try {
      const r = await api.get(`/backups/${b.id}/download`, { responseType: 'blob' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(r.data)
      a.download = `glob-erp-backup-${new Date(b.created_at).toISOString().slice(0, 10)}.json.gz`; a.click(); URL.revokeObjectURL(a.href)
    } catch { setMsg({ err: true, text: 'Download failed' }) } finally { setBusy('') }
  }
  const del = (b) => confirm('Delete this backup?') && run('x' + b.id, () => api.delete(`/backups/${b.id}`), 'Backup deleted.')
  const upload = (e) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f || !confirm(`Restore from "${f.name}"?\n\nAll current records will be replaced. A safety copy is taken first.`)) return
    run('upload', () => api.post('/backups/restore-file', f, { headers: { 'Content-Type': 'application/octet-stream' } }), restoredMsg)
  }

  const last = list.find(b => b.kind === 'auto')
  const columns = [
    { key: 'created_at', label: 'When', mobile: 'title', render: b => <b style={{ color: 'var(--text-bright)' }}>{when(b.created_at)}</b>, sortValue: b => b.created_at },
    { key: 'kind', label: 'Type', mobile: 'sub', render: b => KIND[b.kind] || b.kind },
    { key: 'row_count', label: 'Records', align: 'right', render: b => Number(b.row_count).toLocaleString('en-IN') },
    { key: 'size_bytes', label: 'Size', align: 'right', mobile: 'amount', render: b => size(b.size_bytes) },
    { key: 'actions', label: '', align: 'right', sortable: false, render: b => (
      <span className="inline-flex gap-1">
        <button className="ui-icon-btn" title="Download file" onClick={() => download(b)} disabled={!!busy}>{busy === 'd' + b.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}</button>
        <button className="ui-icon-btn" title="Restore this backup" onClick={() => restore(b)} disabled={!!busy}>{busy === 'r' + b.id ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}</button>
        <button className="ui-icon-btn danger" title="Delete" onClick={() => del(b)} disabled={!!busy}><Trash2 size={15} /></button>
      </span>
    ) },
  ]

  return (
    <div className="space-y-4">
      <section className="ui-section">
        <div className="ui-section-title"><span className="flex items-center gap-2"><ShieldCheck size={16} />Backups</span></div>
        <p className="ui-hint" style={{ fontSize: 13 }}>
          Your data is backed up automatically once a day (the last 14 are kept). {last ? `Last automatic backup: ${when(last.created_at)}.` : 'The first automatic backup runs shortly after the server starts.'} Download a copy now and then to keep it safe outside the app.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <button className="btn-primary flex items-center gap-2" onClick={backupNow} disabled={!!busy}>{busy === 'new' ? <Loader2 size={16} className="animate-spin" /> : <DatabaseBackup size={16} />}Back up now</button>
          <button className="btn-secondary flex items-center gap-2" onClick={() => fileRef.current?.click()} disabled={!!busy}>{busy === 'upload' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}Restore from file</button>
          <input ref={fileRef} type="file" accept=".gz,.json,application/gzip,application/json" hidden onChange={upload} />
        </div>
        {msg && <div className={msg.err ? 'ui-error mt-3' : 'ui-hint mt-3'} style={msg.err ? {} : { color: 'var(--pos)', fontWeight: 700 }} role="status">{msg.text}</div>}
      </section>
      <DataTable columns={columns} rows={list} loading={loading} initialSort={{ key: 'created_at', dir: 'desc' }}
        empty={<EmptyBlock icon={DatabaseBackup} title="No backups yet" text="Press “Back up now” to make the first one." />} />
    </div>
  )
}
