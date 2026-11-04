import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import { Receipt, FileText, FileSpreadsheet, Truck, Plus, Search, Trash2, Printer, ArrowLeft, ArrowRight, Building2, CheckCircle2, Circle, Pencil, Check, Loader2, Sparkles } from 'lucide-react'

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
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/app/vehicle-papers/${p.id}?view=preview`) }} title="Open / Print" className="p-2 rounded-lg hover:bg-white/10" style={{ color: 'var(--accent)' }}><Printer size={15} /></button>
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

  // ════════════════ HUB VIEW — guided wizard + saved papers ════════════════
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Truck size={24} style={{ color: 'var(--accent)' }} /> Vehicle Papers
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Enter the party and vehicle once, pick the paper — it fills itself in, ready to download, print or share.
        </p>
      </div>

      <PaperWizard groups={groups} papers={papers} onCreated={(id) => navigate(`/app/vehicle-papers/${id}?view=preview`)} />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <h2 className="text-lg font-bold text-white flex-1">Saved papers</h2>
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search party, chassis, engine, paper no…"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm"
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', outline: 'none' }} />
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : visibleGroups.length === 0 ? (
        <div className="p-10 text-center rounded-2xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{papers.length === 0 ? 'Nothing saved yet — create your first paper above.' : 'No party matches your search.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleGroups.map(g => (
            <div key={g.key} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
              <button onClick={() => openTransporter(g.name)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5">
                <Building2 size={18} style={{ color: 'var(--accent)' }} />
                <span className="font-bold text-white flex-1 truncate">{g.name}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{g.papers.length} paper{g.papers.length === 1 ? '' : 's'}</span>
              </button>
              {g.papers.slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 6).map(p => {
                const t = PAPER_TYPES[p.type]; const Icon = t?.icon || FileText
                return (
                  <div key={p.id} className="px-4 py-2.5 flex items-center gap-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <Icon size={15} style={{ color: t?.accent }} />
                    <div className="flex-1 min-w-0 text-sm">
                      <span className="font-semibold text-white">{t?.short || p.type}</span>
                      <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>{p.paper_no} · {fmtDate(p.paper_date)}</span>
                      <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        {[p.model, p.chassis_no && `Chassis ${p.chassis_no}`, p.engine_no && `Engine ${p.engine_no}`].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                    <button onClick={() => navigate(`/app/vehicle-papers/${p.id}?view=preview`)} title="Open · download · print · share" className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"><Printer size={13} /> Open</button>
                    <button onClick={() => navigate(`/app/vehicle-papers/${p.id}`)} title="Edit" className="p-2 rounded-lg hover:bg-white/10" style={{ color: 'var(--accent)' }}><Pencil size={15} /></button>
                    <button onClick={() => handleDelete(p.id)} title="Delete" className="p-2 rounded-lg hover:bg-red-500/10" style={{ color: '#f87171' }}><Trash2 size={15} /></button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 3-step wizard:  1 Party  →  2 Chassis / Engine / Model  →  3 Pick the paper
// Creating saves the paper (auto-filled) and opens it ready to download/print/share.
// ═══════════════════════════════════════════════════════════════
function PaperWizard({ groups, papers, onCreated }) {
  const [step, setStep] = useState(1)
  const [party, setParty] = useState('')
  const [chassis, setChassis] = useState('')
  const [engine, setEngine] = useState('')
  const [model, setModel] = useState('')
  const [type, setType] = useState('')
  const [amount, setAmount] = useState('')
  const [bank, setBank] = useState('')
  const [customers, setCustomers] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { api.get('/customers').then(r => setCustomers(r.data.customers || [])).catch(() => {}) }, [])

  const names = useMemo(() => {
    const set = new Map()
    customers.forEach(c => c.name && set.set(c.name.trim().toLowerCase(), c.name.trim()))
    groups.forEach(g => g.name !== UNASSIGNED && set.set(g.name.toLowerCase(), g.name))
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b))
  }, [customers, groups])

  // vehicles already entered for this party → one-tap autofill
  const knownVehicles = useMemo(() => {
    const k = keyOf(party); const seen = new Map()
    papers.filter(p => keyOf(p.customer_name) === k && (p.chassis_no || p.engine_no)).forEach(p => {
      const id = `${p.chassis_no}|${p.engine_no}`
      if (!seen.has(id)) seen.set(id, { chassis: p.chassis_no || '', engine: p.engine_no || '', model: p.model || '' })
    })
    return Array.from(seen.values()).slice(0, 4)
  }, [papers, party])

  const upper = (v) => v.toUpperCase()
  const canNext1 = party.trim().length > 0
  const canNext2 = chassis.trim() && engine.trim()
  const steps = [['1', 'Party'], ['2', 'Vehicle'], ['3', 'Paper']]

  const reset = () => { setStep(1); setParty(''); setChassis(''); setEngine(''); setModel(''); setType(''); setAmount(''); setBank(''); setErr('') }

  const create = async () => {
    if (!type) return
    setBusy(true); setErr('')
    try {
      const c = customers.find(x => (x.name || '').trim().toLowerCase() === party.trim().toLowerCase())
      let paper_no = ''
      try { paper_no = (await api.get('/vehicle-papers/next-number', { params: { type } })).data.nextNumber || '' } catch { /* optional */ }
      const payload = {
        type, paper_no, paper_date: new Date().toISOString().slice(0, 10),
        customer_id: c?.id || null, customer_name: party.trim(),
        customer_address: c?.address || '', customer_gstin: c?.gstin || '', customer_phone: c?.phone || '',
        chassis_no: chassis.trim(), engine_no: engine.trim(), model: model.trim(), vehicle_no: '',
        amount: type === 'money_receipt' && amount ? Number(amount) : null,
        data: type === 'money_receipt' ? { hypothecation: bank.trim() } : {},
      }
      const res = await api.post('/vehicle-papers', payload)
      onCreated(res.data.paper.id)
    } catch (e) {
      setErr(e.response?.data?.msg || 'Could not create the paper. Please try again.')
    } finally { setBusy(false) }
  }

  const inputStyle = { background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', outline: 'none' }
  const label = 'block text-xs font-semibold mb-1.5'

  return (
    <div className="rounded-2xl p-5 md:p-6" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
      {/* stepper */}
      <div className="flex items-center gap-2 mb-6">
        {steps.map(([n, name], i) => {
          const done = step > i + 1, active = step === i + 1
          return (
            <div key={n} className="flex items-center gap-2 flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: done || active ? 'var(--accent)' : 'var(--bg-input)', color: done || active ? '#fff' : 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {done ? <Check size={14} /> : n}
                </span>
                <span className="text-sm font-semibold hidden sm:inline" style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>{name}</span>
              </div>
              {i < steps.length - 1 && <div className="h-px flex-1" style={{ background: 'var(--border)' }} />}
            </div>
          )
        })}
      </div>

      {step === 1 && (
        <div className="space-y-4 max-w-xl">
          <div>
            <label className={label} style={{ color: 'var(--text-muted)' }}>Party name</label>
            <input autoFocus value={party} onChange={e => setParty(upper(e.target.value))} list="vp-parties"
              onKeyDown={e => e.key === 'Enter' && canNext1 && setStep(2)}
              placeholder="e.g. SHIV TRANSPORT" className="w-full px-4 py-3 rounded-xl text-base font-semibold" style={inputStyle} />
            <datalist id="vp-parties">{names.map(n => <option key={n} value={n.toUpperCase()} />)}</datalist>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>Pick an existing customer or type a new one.</p>
          </div>
          <button disabled={!canNext1} onClick={() => setStep(2)} className="btn-primary flex items-center gap-2 disabled:opacity-40">Next <ArrowRight size={16} /></button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 max-w-xl">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Party: <b className="text-white">{party}</b></p>
          {knownVehicles.length > 0 && (
            <div>
              <p className={label} style={{ color: 'var(--text-muted)' }}>Used before for this party — tap to fill</p>
              <div className="flex flex-wrap gap-2">
                {knownVehicles.map((v, i) => (
                  <button key={i} type="button" onClick={() => { setChassis(v.chassis); setEngine(v.engine); setModel(v.model) }}
                    className="text-xs px-3 py-1.5 rounded-lg text-left" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-secondary)' }}>
                    {v.model || 'Vehicle'} · {v.chassis.slice(-8)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className={label} style={{ color: 'var(--text-muted)' }}>Chassis no.</label>
            <input autoFocus value={chassis} onChange={e => setChassis(upper(e.target.value.replace(/\s/g, '')))} placeholder="MAT566136T1H24001"
              className="w-full px-4 py-2.5 rounded-xl text-sm font-mono tracking-wide" style={inputStyle} />
          </div>
          <div>
            <label className={label} style={{ color: 'var(--text-muted)' }}>Engine no.</label>
            <input value={engine} onChange={e => setEngine(upper(e.target.value.replace(/\s/g, '')))} placeholder="B6.7B62320D14162H64616434"
              className="w-full px-4 py-2.5 rounded-xl text-sm font-mono tracking-wide" style={inputStyle} />
          </div>
          <div>
            <label className={label} style={{ color: 'var(--text-muted)' }}>Model no.</label>
            <input value={model} onChange={e => setModel(upper(e.target.value))} placeholder="TATA SIGNA 4832 BSVI 10X2"
              onKeyDown={e => e.key === 'Enter' && canNext2 && setStep(3)}
              className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setStep(1)} className="btn-secondary flex items-center gap-2"><ArrowLeft size={16} /> Back</button>
            <button disabled={!canNext2} onClick={() => setStep(3)} className="btn-primary flex items-center gap-2 disabled:opacity-40">Next <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <b className="text-white">{party}</b> · {model || 'Model —'} · Chassis {chassis} · Engine {engine}
          </p>
          <div>
            <p className={label} style={{ color: 'var(--text-muted)' }}>Which paper do you want?</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[['form_22a', 'Form 22'], ['vahan', 'Vahan'], ['form_17', 'Form 17'], ['money_receipt', 'Money Margin']].map(([k, name]) => {
                const t = PAPER_TYPES[k]; const Icon = t.icon; const on = type === k
                return (
                  <button key={k} type="button" onClick={() => setType(k)} className="text-left p-4 rounded-2xl transition-all"
                    style={{ background: on ? `${t.accent}1f` : 'var(--bg-input)', border: `1.5px solid ${on ? t.accent : 'var(--border-input)'}` }}>
                    <Icon size={22} style={{ color: t.accent }} />
                    <div className="font-bold text-white mt-2">{name}</div>
                    <div className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>{k === 'form_22a' ? 'Tanker body certificate' : k === 'vahan' ? 'Vahan paper + chassis/engine' : k === 'form_17' ? 'Form 17 + chassis/engine' : 'Margin money receipt'}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {type === 'money_receipt' && (
            <div className="grid sm:grid-cols-2 gap-3 max-w-xl">
              <div>
                <label className={label} style={{ color: 'var(--text-muted)' }}>Amount received (Rs.)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="500000" className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle} />
              </div>
              <div>
                <label className={label} style={{ color: 'var(--text-muted)' }}>Hypothecation bank</label>
                <input value={bank} onChange={e => setBank(upper(e.target.value))} placeholder="STATE BANK OF INDIA" className="w-full px-4 py-2.5 rounded-xl text-sm" style={inputStyle} />
              </div>
            </div>
          )}

          {err && <p className="text-sm" style={{ color: '#f87171' }}>{err}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setStep(2)} className="btn-secondary flex items-center gap-2"><ArrowLeft size={16} /> Back</button>
            <button disabled={!type || busy} onClick={create} className="btn-primary btn-shine flex items-center gap-2 disabled:opacity-40">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {busy ? 'Filling in…' : 'Create paper'}
            </button>
            <button onClick={reset} className="text-xs underline ml-2" style={{ color: 'var(--text-muted)' }}>Start over</button>
          </div>
        </div>
      )}
    </div>
  )
}
