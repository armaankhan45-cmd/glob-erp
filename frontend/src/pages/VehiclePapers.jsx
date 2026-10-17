import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import { Receipt, FileText, FileSpreadsheet, Truck, Plus, Search, Trash2, Printer, ArrowLeft, Building2, CheckCircle2, Circle, X } from 'lucide-react'

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


const UNASSIGNED = 'No transporter name'
const keyOf = (name) => (name || '').trim().toLowerCase() || '__none__'

export default function VehiclePapers() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [papers, setPapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)

  const selectedKey = params.get('t') ? keyOf(params.get('t')) : null
  const selectedNameParam = params.get('t') || ''

  const load = async () => {
    try {
      setLoading(true)
      const res = await api.get('/vehicle-papers')
      setPapers(res.data.papers || [])
    } catch (e) { console.error('Load vehicle papers', e) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this saved paper?')) return
    try {
      await api.delete(`/vehicle-papers/${id}`)
      setPapers(prev => prev.filter(p => p.id !== id))
    } catch (e) { alert(e.response?.data?.msg || 'Delete failed') }
  }

  // ── Group every paper under its transporter (customer name) ──
  const groups = useMemo(() => {
    const map = new Map()
    papers.forEach(p => {
      const k = keyOf(p.customer_name)
      if (!map.has(k)) map.set(k, { key: k, name: (p.customer_name || '').trim() || UNASSIGNED, papers: [] })
      map.get(k).papers.push(p)
    })
    return Array.from(map.values()).map(g => {
      const vehicles = new Set(g.papers.map(p => (p.vehicle_no || '').trim().toUpperCase()).filter(Boolean))
      const latest = g.papers.reduce((m, p) => { const d = new Date(p.paper_date || p.created_at); return d > m ? d : m }, new Date(0))
      return { ...g, vehicles: Array.from(vehicles), latest }
    }).sort((a, b) => a.name.localeCompare(b.name))
  }, [papers])

  const q = search.trim().toLowerCase()
  const matches = (g) => {
    if (!q) return true
    if (g.name.toLowerCase().includes(q)) return true
    return g.papers.some(p => [p.paper_no, p.vehicle_no, p.chassis_no, p.engine_no, p.title]
      .filter(Boolean).some(v => String(v).toLowerCase().includes(q)))
  }
  const visibleGroups = groups.filter(matches)

  const selected = selectedKey
    ? (groups.find(g => g.key === selectedKey) || { key: selectedKey, name: selectedNameParam || UNASSIGNED, papers: [], vehicles: [] })
    : null

  const openTransporter = (name) => setParams({ t: name === UNASSIGNED ? '' : name }, { replace: false })
  const closeTransporter = () => setParams({})
  const startNew = () => {
    const n = newName.trim()
    if (!n) return
    setShowNew(false); setNewName('')
    setParams({ t: n })
  }
  const createFor = (type, name) => {
    const qs = name && name !== UNASSIGNED ? `?customer=${encodeURIComponent(name)}` : ''
    navigate(`/app/vehicle-papers/new/${type}${qs}`)
  }

  // ════════════════ DETAIL VIEW — one transporter, all four papers ════════════════
  if (selected) {
    const total = selected.papers.length
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={closeTransporter} className="p-2 rounded-xl hover:bg-white/5" style={{ color: 'var(--text-muted)' }} title="Back to all transporters"><ArrowLeft size={20} /></button>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
            <Building2 size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{selected.name}</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {total} paper{total === 1 ? '' : 's'}{selected.vehicles.length > 0 && <> · Vehicles: {selected.vehicles.join(', ')}</>}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.values(PAPER_TYPES).map(t => {
            const Icon = t.icon
            const list = selected.papers.filter(p => p.type === t.key)
            return (
              <div key={t.key} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
                <div className="p-4 flex items-center gap-3" style={{ borderBottom: list.length ? '1px solid var(--border)' : 'none' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${t.accent}1a`, border: `1px solid ${t.accent}40` }}>
                    <Icon size={18} style={{ color: t.accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white text-sm">{t.label}</div>
                    <div className="text-xs flex items-center gap-1" style={{ color: list.length ? t.accent : 'var(--text-muted)' }}>
                      {list.length ? <><CheckCircle2 size={12} /> {list.length} saved</> : <><Circle size={12} /> Not created yet</>}
                    </div>
                  </div>
                  <button onClick={() => createFor(t.key, selected.name)} className="btn-secondary flex items-center gap-1 text-xs px-3 py-1.5"><Plus size={13} /> Add</button>
                </div>
                {list.map(p => (
                  <div key={p.id} className="px-4 py-3 flex items-center gap-3 hover:bg-white/5 cursor-pointer" style={{ borderTop: '1px solid var(--border)' }}
                    onClick={() => navigate(`/app/vehicle-papers/${p.id}`)}>
                    <div className="flex-1 min-w-0 text-sm">
                      <div className="font-semibold text-white">{p.paper_no || `#${p.id}`} <span className="font-normal text-xs" style={{ color: 'var(--text-muted)' }}>· {fmtDate(p.paper_date)}</span></div>
                      <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        {[p.vehicle_no && `Veh: ${p.vehicle_no}`, p.chassis_no && `Chassis: ${p.chassis_no}`, p.engine_no && `Engine: ${p.engine_no}`].filter(Boolean).join('  ·  ') || '—'}
                      </div>
                    </div>
                    {p.amount ? <div className="text-sm font-semibold text-white whitespace-nowrap">₹{fmtAmount(p.amount)}</div> : null}
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/app/vehicle-papers/${p.id}`) }} title="Open / Print" className="p-2 rounded-lg hover:bg-white/10" style={{ color: 'var(--accent)' }}><Printer size={15} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }} title="Delete" className="p-2 rounded-lg hover:bg-red-500/10" style={{ color: '#f87171' }}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ════════════════ HUB VIEW — list of transporters ════════════════
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Truck size={24} style={{ color: 'var(--accent)' }} /> Vehicle Papers
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            All papers are grouped by transporter — open a transporter to see its Margin Money, Form 22-A, Form 17 and Vahan papers together.
          </p>
        </div>
        <button onClick={() => setShowNew(v => !v)} className="btn-primary flex items-center gap-2 btn-shine"><Plus size={16} /> New Transporter</button>
      </div>

      {showNew && (
        <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && startNew()}
            placeholder="Transporter name, e.g. SHIV TRANSPORT"
            list="vp-transporters"
            className="flex-1 min-w-[220px] px-3 py-2 rounded-xl text-sm"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', outline: 'none' }} />
          <datalist id="vp-transporters">{groups.filter(g => g.name !== UNASSIGNED).map(g => <option key={g.key} value={g.name} />)}</datalist>
          <button onClick={startNew} className="btn-primary text-sm px-4 py-2">Open</button>
          <button onClick={() => { setShowNew(false); setNewName('') }} className="p-2 rounded-lg hover:bg-white/10" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
      )}

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transporter, vehicle no, chassis, engine or paper no…"
          className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', outline: 'none' }} />
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : visibleGroups.length === 0 ? (
        <div className="p-10 text-center rounded-2xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{papers.length === 0 ? 'No papers yet. Click “New Transporter” to start.' : 'No transporter matches your search.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleGroups.map(g => (
            <button key={g.key} onClick={() => openTransporter(g.name)} className="text-left p-4 rounded-2xl transition-all hover:scale-[1.01]"
              style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                  <Building2 size={18} style={{ color: 'var(--accent)' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white truncate">{g.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {g.papers.length} paper{g.papers.length === 1 ? '' : 's'}{g.vehicles.length > 0 && ` · ${g.vehicles.length} vehicle${g.vehicles.length === 1 ? '' : 's'}`}{g.latest.getTime() > 0 && ` · last ${fmtDate(g.latest)}`}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {Object.values(PAPER_TYPES).map(t => {
                  const n = g.papers.filter(p => p.type === t.key).length
                  return (
                    <div key={t.key} className="text-center rounded-lg py-1.5 text-[10px] font-bold"
                      style={{ background: n ? `${t.accent}18` : 'rgba(255,255,255,0.03)', color: n ? t.accent : 'var(--text-muted)', border: `1px solid ${n ? `${t.accent}40` : 'var(--border)'}` }}>
                      {t.short.replace('Form ', 'F-').replace(' Paper', '').replace('Margin Money', 'Margin')}{n ? ` ✓${n > 1 ? n : ''}` : ''}
                    </div>
                  )
                })}
              </div>
              {g.vehicles.length > 0 && (
                <div className="mt-2 text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{g.vehicles.slice(0, 3).join(' · ')}{g.vehicles.length > 3 && ` +${g.vehicles.length - 3}`}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
