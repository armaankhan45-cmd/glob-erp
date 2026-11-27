import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { findHSN } from '../data/hsnCodes'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2, Loader2, AlertCircle, ChevronDown } from 'lucide-react'
import api from '../api/client'
import ItemSuggestInput from '../components/ItemSuggestInput'
import { PageHeader, inr, num } from '../components/ui'
import { invalidateCache } from '../hooks/useCachedApi'

const GST_SLABS = ['0', '5', '12', '18', '28']
const UNITS = ['NOS', 'KG', 'PCS', 'MTR', 'SET', 'BOX', 'LTR', 'TON', 'BAG', 'SQM']
const blankItem = () => ({ description: '', hsn_code: '7308', quantity: '1', unit: 'NOS', rate: '', tax_rate: '18' })
const iso = (d) => d.toISOString().slice(0, 10)
const addDays = (dateStr, n) => { const d = new Date(dateStr); d.setDate(d.getDate() + n); return iso(d) }
const fyPrefix = (d = new Date()) => { const m = d.getMonth(), y = d.getFullYear(); const s = m >= 3 ? y : y - 1; return String(s % 100).padStart(2, '0') + String((s + 1) % 100).padStart(2, '0') }
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100
const safeGet = (k, d = '') => { try { return localStorage.getItem(k) || d } catch { return d } }

// GST maths. Discount reduces the taxable value, so GST is charged on the discounted amount.
export function computeInvoice(items, { discount = 0, intra = true, autoRound = true, roundOff = 0 } = {}) {
  const lines = items.map(it => ({ amount: num(it.quantity) * num(it.rate), rate: num(it.tax_rate) }))
  const subtotal = lines.reduce((s, l) => s + l.amount, 0)
  const disc = Math.min(Math.max(num(discount), 0), subtotal)
  const factor = subtotal ? (subtotal - disc) / subtotal : 1
  const slabs = {}
  lines.forEach(l => { if (!l.amount) return; const s = slabs[l.rate] ||= { taxable: 0, tax: 0 }; s.taxable += l.amount * factor; s.tax += l.amount * factor * l.rate / 100 })
  const tax = Object.values(slabs).reduce((s, x) => s + x.tax, 0)
  const cgst = intra ? r2(tax / 2) : 0, sgst = intra ? r2(tax / 2) : 0, igst = intra ? 0 : r2(tax)
  const taxable = r2(subtotal - disc)
  const raw = taxable + cgst + sgst + igst
  const round = autoRound ? r2(Math.round(raw) - raw) : num(roundOff)
  return { subtotal: r2(subtotal), discount: r2(disc), taxable, cgst, sgst, igst, round, total: r2(raw + round), slabs }
}

export default function InvoiceNew() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [customers, setCustomers] = useState([])
  const [orgStateCode, setOrgStateCode] = useState(safeGet('orgStateCode', '27'))
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [customerId, setCustomerId] = useState(params.get('customer') || safeGet('lastInvoiceCustomer'))
  const [invoiceDate, setInvoiceDate] = useState(iso(new Date()))
  const [dueDate, setDueDate] = useState('')
  const [items, setItems] = useState([blankItem()])
  const [discount, setDiscount] = useState('')
  const [autoRound, setAutoRound] = useState(true)
  const [roundOff, setRoundOff] = useState('')
  const [notes, setNotes] = useState('')
  const [override, setOverride] = useState({ open: false, cgst: '', sgst: '', igst: '', total: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const rowRefs = useRef([])

  useEffect(() => {
    api.get('/customers').then(r => setCustomers(r.data.customers || [])).catch(() => {})
    api.get('/settings').then(r => {
      const org = r.data.organization || {}
      const code = org.state_code || (org.gstin ? org.gstin.substring(0, 2) : '27')
      setOrgStateCode(code); try { localStorage.setItem('orgStateCode', code) } catch {}
    }).catch(() => {})
    api.get('/invoices').then(r => {
      const p = fyPrefix()
      const max = (r.data.invoices || []).reduce((m, inv) => {
        const n = inv.invoice_number || ''
        const seq = n.startsWith(p) ? parseInt(n.slice(p.length), 10) : NaN
        return Number.isFinite(seq) && seq > m ? seq : m
      }, 0)
      setInvoiceNumber(p + String(max + 1).padStart(4, '0'))
    }).catch(() => setInvoiceNumber(fyPrefix() + '0001'))
  }, [])

  const customer = customers.find(c => String(c.id) === String(customerId)) || null
  const custState = customer ? (customer.state_code || (customer.gstin || '').substring(0, 2) || orgStateCode) : orgStateCode
  const intra = String(custState).padStart(2, '0') === String(orgStateCode).padStart(2, '0')

  const calc = useMemo(() => computeInvoice(items, { discount, intra, autoRound, roundOff }), [items, discount, intra, autoRound, roundOff])
  const useOverride = override.open && (override.cgst || override.sgst || override.igst || override.total)
  const final = useOverride
    ? { ...calc, cgst: num(override.cgst), sgst: num(override.sgst), igst: num(override.igst), total: num(override.total) || calc.total }
    : calc

  const updateItem = (i, field, value) => setItems(prev => prev.map((it, x) => {
    if (x !== i) return it
    const next = { ...it, [field]: value }
    if (field === 'description') { const h = findHSN(value); if (h) next.hsn_code = h }
    return next
  }))
  const fromSuggestion = (i, s) => setItems(prev => prev.map((it, x) => x !== i ? it : {
    ...it, description: s.description, hsn_code: s.hsn_code || it.hsn_code, unit: s.unit || it.unit, rate: s.rate != null ? String(s.rate) : it.rate,
    tax_rate: s.igst_rate ? String(num(s.igst_rate)) : (s.cgst_rate ? String(num(s.cgst_rate) * 2) : it.tax_rate),
  }))
  const addRow = useCallback((focus = true) => {
    setItems(prev => [...prev, blankItem()])
    if (focus) setTimeout(() => rowRefs.current[rowRefs.current.length - 1]?.querySelector('input')?.focus(), 30)
  }, [])
  const removeRow = (i) => setItems(prev => (prev.length === 1 ? [blankItem()] : prev.filter((_, x) => x !== i)))
  // Enter on the last field of the last row adds a new row
  const onRateKey = (i, e) => { if (e.key === 'Enter') { e.preventDefault(); if (i === items.length - 1) addRow() } }

  const save = async () => {
    setError('')
    if (!invoiceNumber.trim()) return setError('Invoice number is required')
    if (!customerId) return setError('Pick a customer')
    const filled = items.filter(it => it.description.trim() || num(it.rate))
    if (!filled.length) return setError('Add at least one item')
    if (filled.some(it => !it.description.trim())) return setError('Every item needs a description')
    setSaving(true)
    try {
      await api.post('/invoices', {
        invoice_number: invoiceNumber.trim(), customer_id: parseInt(customerId), invoice_date: invoiceDate, due_date: dueDate || null,
        subtotal: final.subtotal, discount: final.discount, cgst_amount: final.cgst, sgst_amount: final.sgst, igst_amount: final.igst,
        round_off: final.round, total_amount: final.total, status: 'Sent', payment_status: 'Unpaid', notes,
        items: filled.map(it => {
          const rate = num(it.tax_rate)
          return { description: it.description.trim(), hsn_code: it.hsn_code, quantity: num(it.quantity), unit: it.unit, rate: num(it.rate),
            cgst_rate: intra ? rate / 2 : 0, sgst_rate: intra ? rate / 2 : 0, igst_rate: intra ? 0 : rate, amount: r2(num(it.quantity) * num(it.rate)) }
        }),
      })
      try { localStorage.setItem('lastInvoiceCustomer', customerId) } catch {}
      invalidateCache('/invoices')
      navigate('/app/invoices')
    } catch (err) {
      setError(err.response?.data?.msg || err.message)
    } finally { setSaving(false) }
  }

  // Ctrl/Cmd + S saves
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (!saving) save() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="inv-form space-y-5">
      <PageHeader title="New invoice" subtitle={customer ? `${customer.name} · ${intra ? 'Intra-state (CGST + SGST)' : 'Inter-state (IGST)'}` : 'GST tax invoice'}
        actions={<>
          <button className="btn-secondary flex items-center gap-2" onClick={() => navigate('/app/invoices')}><ArrowLeft size={16} />Cancel</button>
          <button className="btn-primary flex items-center gap-2" onClick={save} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Save invoice</button>
        </>} />

      {error && <div className="inv-alert" role="alert"><AlertCircle size={16} />{error}</div>}

      <div className="inv-layout">
        <div className="space-y-5 min-w-0">
          <section className="ui-section">
            <div className="ui-fields">
              <label className="ui-field" style={{ gridColumn: 'span 2' }}><span>Customer</span>
                <select value={customerId} onChange={e => setCustomerId(e.target.value)} autoFocus={!customerId}>
                  <option value="">Select customer…</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.city ? ` — ${c.city}` : ''}</option>)}
                </select>
                {customer?.gstin ? <span className="ui-hint">GSTIN {customer.gstin}</span> : <Link to="/app/customers/new" className="ui-hint ui-link">+ Add a new customer</Link>}
              </label>
              <label className="ui-field"><span>Invoice no.</span><input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} /></label>
              <label className="ui-field"><span>Invoice date</span><input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></label>
              <label className="ui-field"><span>Due date</span><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                <span className="inv-quick">{[0, 15, 30, 45].map(n => <button type="button" key={n} onClick={() => setDueDate(addDays(invoiceDate, n))}>{n ? `+${n}d` : 'Today'}</button>)}</span>
              </label>
            </div>
          </section>

          <section className="ui-section">
            <div className="ui-section-title">Items<span className="ui-hint">Press Enter in Rate to add a row · Ctrl+S to save</span></div>
            <div className="inv-items">
              <div className="inv-row inv-head"><span>Description</span><span>HSN</span><span>Qty</span><span>Unit</span><span>Rate</span><span>GST</span><span className="al-r">Amount</span><span /></div>
              {items.map((it, i) => (
                <div className="inv-row" key={i} ref={el => (rowRefs.current[i] = el)}>
                  <ItemSuggestInput value={it.description} onChange={v => updateItem(i, 'description', v)} onSelect={s => fromSuggestion(i, s)} placeholder="Item or service" className="ui-input" />
                  <input className="ui-input" value={it.hsn_code} onChange={e => updateItem(i, 'hsn_code', e.target.value)} aria-label="HSN" />
                  <input className="ui-input" type="number" min="0" step="any" value={it.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} aria-label="Quantity" />
                  <select className="ui-input" value={it.unit} onChange={e => updateItem(i, 'unit', e.target.value)} aria-label="Unit">{UNITS.map(u => <option key={u}>{u}</option>)}</select>
                  <input className="ui-input" type="number" min="0" step="any" value={it.rate} onChange={e => updateItem(i, 'rate', e.target.value)} onKeyDown={e => onRateKey(i, e)} placeholder="0.00" aria-label="Rate" />
                  <select className="ui-input" value={it.tax_rate} onChange={e => updateItem(i, 'tax_rate', e.target.value)} aria-label="GST rate">{GST_SLABS.map(s => <option key={s} value={s}>{s}%</option>)}</select>
                  <span className="inv-amt">{inr(num(it.quantity) * num(it.rate), 2)}</span>
                  <button type="button" className="ui-icon-btn danger" onClick={() => removeRow(i)} title="Remove item"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <button type="button" className="btn-secondary flex items-center gap-2 mt-3" onClick={() => addRow()}><Plus size={15} />Add item</button>
          </section>

          <section className="ui-section">
            <div className="ui-fields">
              <label className="ui-field"><span>Discount (₹)</span><input type="number" min="0" step="any" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" /></label>
              <label className="ui-field"><span>Round off</span>
                <span className="flex gap-2 items-center">
                  <input type="number" step="any" value={autoRound ? calc.round : roundOff} disabled={autoRound} onChange={e => setRoundOff(e.target.value)} />
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap"><input type="checkbox" checked={autoRound} onChange={e => setAutoRound(e.target.checked)} style={{ width: 'auto' }} />Auto</label>
                </span>
              </label>
              <label className="ui-field" style={{ gridColumn: 'span 2' }}><span>Notes</span><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Thank you for your business" /></label>
            </div>
            <button type="button" className="inv-toggle" onClick={() => setOverride(o => ({ ...o, open: !o.open }))}><ChevronDown size={14} style={{ transform: override.open ? 'rotate(180deg)' : 'none' }} />Override tax amounts manually</button>
            {override.open && <div className="ui-fields mt-3">
              {['cgst', 'sgst', 'igst', 'total'].map(k => <label key={k} className="ui-field"><span>{k.toUpperCase()}</span><input type="number" step="any" value={override[k]} placeholder="Auto" onChange={e => setOverride(o => ({ ...o, [k]: e.target.value }))} /></label>)}
            </div>}
          </section>
        </div>

        <aside className="inv-summary ui-section" aria-label="Invoice summary">
          <div className="ui-section-title">Summary</div>
          <dl>
            <div><dt>Items total</dt><dd>{inr(final.subtotal, 2)}</dd></div>
            {final.discount > 0 && <div><dt>Discount</dt><dd>− {inr(final.discount, 2)}</dd></div>}
            <div><dt>Taxable value</dt><dd>{inr(final.taxable, 2)}</dd></div>
            {Object.entries(calc.slabs).length > 1 && Object.entries(calc.slabs).map(([rate, s]) => <div key={rate} className="sub"><dt>GST {rate}% on {inr(s.taxable)}</dt><dd>{inr(s.tax, 2)}</dd></div>)}
            {intra ? <>
              <div><dt>CGST</dt><dd>{inr(final.cgst, 2)}</dd></div>
              <div><dt>SGST</dt><dd>{inr(final.sgst, 2)}</dd></div>
            </> : <div><dt>IGST</dt><dd>{inr(final.igst, 2)}</dd></div>}
            {!useOverride && final.round !== 0 && <div><dt>Round off</dt><dd>{final.round > 0 ? '+' : '−'} {inr(Math.abs(final.round), 2)}</dd></div>}
          </dl>
          <div className="inv-total"><span>Total</span><b>{inr(final.total, 2)}</b></div>
          {useOverride && <div className="ui-hint">Using manual tax amounts</div>}
          <button className="btn-primary w-full flex items-center justify-center gap-2 mt-4" onClick={save} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Save invoice</button>
        </aside>
      </div>
    </div>
  )
}
