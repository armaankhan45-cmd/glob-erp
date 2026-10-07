import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { Receipt, FileText, FileSpreadsheet, Truck, Plus, Search, Trash2, Printer, ArrowRight, IndianRupee } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// VEHICLE PAPERS — hub
// Money Margin Receipt · Form 22-A · Form 17 · Vahan Paper
// ═══════════════════════════════════════════════════════════════

export const PAPER_TYPES = {
  money_receipt: {
    key: 'money_receipt',
    label: 'Margin Money Receipt',
    short: 'Margin Money',
    desc: '“WE ARE ACCOUNTING A SUM OF RS:- …” receipt format on letterhead',
    icon: Receipt,
    accent: '#22d3ee',
  },
  form_22a: {
    key: 'form_22a',
    label: 'Form No. 22-A',
    short: 'Form 22-A',
    desc: 'FORM22 (A) tanker body-builder certificate in your exact layout',
    icon: FileText,
    accent: '#6ea8fe',
  },
  form_17: {
    key: 'form_17',
    label: 'Form 17',
    short: 'Form 17',
    desc: 'Scanned Form 17 with Chassis No. & Engine No. printed below the image',
    icon: FileSpreadsheet,
    accent: '#c084fc',
  },
  vahan: {
    key: 'vahan',
    label: 'Vahan Paper',
    short: 'Vahan Paper',
    desc: 'Vahan receipt / paper scan with Chassis No. & Engine No. below the image',
    icon: Truck,
    accent: '#34d399',
  },
}

function fmtAmount(n) {
  if (!n && n !== 0) return ''
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return String(d)
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

export default function VehiclePapers() {
  const navigate = useNavigate()
  const [papers, setPapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const load = async () => {
    try {
      setLoading(true)
      const res = await api.get('/vehicle-papers')
      setPapers(res.data.papers || [])
    } catch (e) {
      console.error('Load vehicle papers', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this saved paper?')) return
    try {
      await api.delete(`/vehicle-papers/${id}`)
      setPapers(prev => prev.filter(p => p.id !== id))
    } catch (e) {
      alert(e.response?.data?.msg || 'Delete failed')
    }
  }

  const counts = papers.reduce((acc, p) => { acc[p.type] = (acc[p.type] || 0) + 1; return acc }, {})

  const q = search.trim().toLowerCase()
  const visible = papers.filter(p => {
    if (filter !== 'all' && p.type !== filter) return false
    if (!q) return true
    return [p.paper_no, p.customer_name, p.vehicle_no, p.chassis_no, p.engine_no, p.title]
      .filter(Boolean).some(v => String(v).toLowerCase().includes(q))
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Truck size={24} style={{ color: 'var(--accent)' }} /> Vehicle Papers
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Generate, save, print &amp; download vehicle documents — money receipts, Form 22-A, Form 17 and Vahan papers.
          </p>
        </div>
        <button onClick={() => navigate('/app/vehicle-papers/new/money_receipt')} className="btn-primary flex items-center gap-2 btn-shine">
          <Plus size={16} /> New Paper
        </button>
      </div>

      {/* Type cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Object.values(PAPER_TYPES).map(t => {
          const Icon = t.icon
          const count = counts[t.key] || 0
          return (
            <button key={t.key} onClick={() => navigate(`/app/vehicle-papers/new/${t.key}`)}
              className="text-left p-4 rounded-2xl transition-all hover:scale-[1.02] group"
              style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${t.accent}1a`, border: `1px solid ${t.accent}40` }}>
                  <Icon size={20} style={{ color: t.accent }} />
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: `${t.accent}18`, color: t.accent }}>{count} saved</span>
              </div>
              <div className="mt-3 font-bold text-white text-sm">{t.label}</div>
              <div className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{t.desc}</div>
              <div className="mt-3 flex items-center gap-1 text-xs font-semibold" style={{ color: t.accent }}>
                Create new <ArrowRight size={13} />
              </div>
            </button>
          )
        })}
      </div>

      {/* Saved papers */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
        <div className="p-4 flex flex-wrap items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-bold text-white flex items-center gap-2"><IndianRupee size={16} style={{ color: 'var(--accent)' }} /> Saved Papers</h2>
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search no / customer / chassis / engine…"
              className="pl-9 pr-3 py-2 rounded-xl text-sm w-72 max-w-full"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', outline: 'none' }} />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}>All</button>
            {Object.values(PAPER_TYPES).map(t => (
              <button key={t.key} onClick={() => setFilter(t.key)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === t.key ? 'btn-primary' : 'btn-secondary'}`}>{t.short}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No saved papers yet. Click a card above to create one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--text-muted)' }} className="text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">No.</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Customer</th>
                  <th className="text-left px-4 py-3">Vehicle</th>
                  <th className="text-left px-4 py-3">Chassis / Engine</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(p => {
                  const meta = PAPER_TYPES[p.type] || PAPER_TYPES.money_receipt
                  const Icon = meta.icon
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-white/5" style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="px-4 py-3 font-bold text-white">{p.paper_no || `#${p.id}`}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: `${meta.accent}18`, color: meta.accent }}>
                          <Icon size={12} /> {meta.short}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{fmtDate(p.paper_date)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.customer_name || '—'}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.vehicle_no || '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {p.chassis_no || '—'}<br />{p.engine_no || ''}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-white">{p.amount ? `₹${fmtAmount(p.amount)}` : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => navigate(`/app/vehicle-papers/${p.id}`)} title="Open"
                            className="p-2 rounded-lg hover:bg-white/10" style={{ color: 'var(--accent)' }}><Printer size={15} /></button>
                          <button onClick={() => handleDelete(p.id)} title="Delete"
                            className="p-2 rounded-lg hover:bg-red-500/10" style={{ color: '#f87171' }}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
