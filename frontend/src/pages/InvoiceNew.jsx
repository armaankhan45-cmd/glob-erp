import { useState, useEffect } from 'react'
import { findHSN } from '../data/hsnCodes'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2, Loader2, CheckCircle, AlertCircle, Info } from 'lucide-react'
import api from '../api/client'

const GST_SLABS = [
  { value: '0', label: '0%' },
  { value: '5', label: '5%' },
  { value: '12', label: '12%' },
  { value: '18', label: '18%' },
  { value: '28', label: '28%' }
]

const UNITS = ['NOS', 'KG', 'PCS', 'MTR', 'SET', 'BOX', 'LTR', 'TON', 'BAG', 'SQM']

export default function InvoiceNew() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [customers, setCustomers] = useState([])
  const [selectedCust, setSelectedCust] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  // FIX #7: Pull state code from org settings instead of hardcoding '27' (Maharashtra)
  // This makes the ERP work for ANY organization, not just Maharashtra-based ones
  const [orgStateCode, setOrgStateCode] = useState(localStorage.getItem('orgStateCode') || '27')

  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [customerId, setCustomerId] = useState(params.get('customer') || localStorage.getItem('lastInvoiceCustomer') || '')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [discount, setDiscount] = useState('')
  const [roundOff, setRoundOff] = useState('')
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')
  const [manualCgst, setManualCgst] = useState('')
  const [manualSgst, setManualSgst] = useState('')
  const [manualIgst, setManualIgst] = useState('')
  const [manualTotal, setManualTotal] = useState('')

  const [items, setItems] = useState([
    { description: '', hsn_code: '7308', quantity: '1', unit: 'NOS', rate: '', tax_rate: '18' }
  ])

  useEffect(() => {
    loadCustomers()
    genNumber()
    loadOrgState()
  }, [])

  // Load org state code from settings API (instead of hardcoded '27')
  const loadOrgState = async () => {
    try {
      const res = await api.get('/settings')
      const org = res.data.organization || {}
      const code = org.state_code || (org.gstin ? org.gstin.substring(0, 2) : '27')
      setOrgStateCode(code)
      localStorage.setItem('orgStateCode', code)
    } catch (e) { /* fallback to localStorage or '27' */ }
  }

  useEffect(() => {
    if (customerId && customers.length) {
      const c = customers.find(x => String(x.id) === String(customerId))
      setSelectedCust(c || null)
    } else {
      setSelectedCust(null)
    }
  }, [customerId, customers])

  const loadCustomers = async () => {
    try {
      const r = await api.get('/customers')
      setCustomers(r.data.customers || [])
    } catch (e) { }
  }

  // ═══════════════════════════════════════════
  // FIXED: Invoice number = YY+nextYY+4-digit sequential
  // e.g. FY 2026-27 → "2627" + "0014" = "26270014"
  // Next = "26270015"
  // ═══════════════════════════════════════════
  const genNumber = async () => {
    try {
      const r = await api.get('/invoices')
      const invoices = r.data.invoices || []
      const now = new Date()
      const m = now.getMonth()
      const y = now.getFullYear()
      // FY prefix: 2026-27 → "2627", 2025-26 → "2526"
      const fyPrefix = m >= 3
        ? String(y % 100).padStart(2, '0') + String((y + 1) % 100).padStart(2, '0')
        : String((y - 1) % 100).padStart(2, '0') + String(y % 100).padStart(2, '0')

      // Find max sequential number ONLY from new-format invoices (e.g. "26270014")
      let maxSeq = 0
      invoices.forEach(inv => {
        const num = inv.invoice_number || ''
        if (num.startsWith(fyPrefix)) {
          const seqStr = num.slice(fyPrefix.length)
          const seq = parseInt(seqStr, 10)
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq
        }
      })

      const nextSeq = maxSeq > 0 ? maxSeq + 1 : 1
      setInvoiceNumber(fyPrefix + String(nextSeq).padStart(4, '0'))
    } catch (e) {
      // Fallback: FY prefix + 0001
      const now = new Date()
      const m = now.getMonth()
      const y = now.getFullYear()
      const fyPrefix = m >= 3
        ? String(y % 100).padStart(2, '0') + String((y + 1) % 100).padStart(2, '0')
        : String((y - 1) % 100).padStart(2, '0') + String(y % 100).padStart(2, '0')
      setInvoiceNumber(fyPrefix + '0001')
    }
  }

  const isIntraState = selectedCust
    ? (selectedCust.state_code || (selectedCust.gstin ? selectedCust.gstin.substring(0, 2) : orgStateCode)) === orgStateCode
    : true

  const addItem = () => {
    setItems(prev => [...prev, { description: '', hsn_code: '7308', quantity: '1', unit: 'NOS', rate: '', tax_rate: '18' }])
  }

  const removeItem = (i) => {
    setItems(prev => {
      if (prev.length === 1) return prev
      return prev.filter((_, x) => x !== i)
    })
  }

  const updateItem = (index, field, value) => {
    setItems(prev => {
      const n = [...prev]
      n[index] = { ...n[index], [field]: value }
      if (field === 'description') {
        const autoHSN = findHSN(value)
        if (autoHSN) n[index].hsn_code = autoHSN
      }
      return n
    })
  }

  const calcSubtotal = () => items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0), 0)
  const calcGST = () => {
    const sub = calcSubtotal()
    const disc = parseFloat(discount) || 0
    const taxable = sub - disc
    const roundVal = parseFloat(roundOff) || 0
    if (manualCgst || manualSgst || manualIgst || manualTotal) {
      return {
        cgst: parseFloat(manualCgst) || 0,
        sgst: parseFloat(manualSgst) || 0,
        igst: parseFloat(manualIgst) || 0,
        total: parseFloat(manualTotal) || 0
      }
    }
    if (isIntraState) {
      const cgst = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0) * (parseFloat(it.tax_rate) || 0) / 200, 0)
      const sgst = cgst
      const total = taxable + cgst + sgst + roundVal
      return { cgst, sgst, igst: 0, total }
    } else {
      const igst = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0) * (parseFloat(it.tax_rate) || 0) / 100, 0)
      const total = taxable + igst + roundVal
      return { cgst: 0, sgst: 0, igst, total }
    }
  }
  const gst = calcGST()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!invoiceNumber.trim()) return setMessage({ type: 'error', text: 'Invoice number required' })
    if (!customerId) return setMessage({ type: 'error', text: 'Please select a customer' })

    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      const data = {
        invoice_number: invoiceNumber,
        customer_id: parseInt(customerId),
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        subtotal: calcSubtotal(),
        cgst_amount: gst.cgst,
        sgst_amount: gst.sgst,
        igst_amount: gst.igst,
        discount: parseFloat(discount) || 0,
        round_off: parseFloat(roundOff) || 0,
        total_amount: gst.total,
        status: 'Sent',
        payment_status: 'Unpaid',
        notes: notes,
        items: items.map(it => ({
          description: it.description,
          hsn_code: it.hsn_code,
          quantity: parseFloat(it.quantity) || 0,
          unit: it.unit,
          rate: parseFloat(it.rate) || 0,
          cgst_rate: isIntraState ? (parseFloat(it.tax_rate) || 0) / 2 : 0,
          sgst_rate: isIntraState ? (parseFloat(it.tax_rate) || 0) / 2 : 0,
          igst_rate: isIntraState ? 0 : (parseFloat(it.tax_rate) || 0),
          amount: (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0)
        }))
      }
      await api.post('/invoices', data)
      localStorage.setItem('lastInvoiceCustomer', customerId)
      setMessage({ type: 'success', text: 'Invoice created successfully!' })
      setTimeout(() => navigate('/app/invoices'), 800)
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.msg || err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6" style={{ animation: 'entranceUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/invoices')} className="p-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all duration-200 btn-shine">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">New GST Invoice</h1>
          <p className="text-white/35 text-sm">Create a tax-compliant invoice</p>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl flex items-center gap-2 text-sm card-premium ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Invoice Info */}
        <div className="card card-premium space-y-4" style={{ animation: 'entranceScale 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both' }}>
          <h3 className="font-bold text-white text-sm">Invoice Details</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-white/55 font-semibold mb-1.5">Invoice Number *</label>
              <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required
                className="w-full px-3 py-2.5 rounded-xl text-sm font-mono font-bold input-field" autoComplete="off" />
              <p className="text-[10px] text-white/30 mt-1">Format: YY+nextYY+4-digit (e.g. 26270015)</p>
            </div>
            <div>
              <label className="block text-xs text-white/55 font-semibold mb-1.5">Invoice Date *</label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required className="input-field" />
            </div>
            <div>
              <label className="block text-xs text-white/55 font-semibold mb-1.5">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input-field" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/55 font-semibold mb-1.5">Customer *</label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required className="input-field">
              <option value="">Select Customer</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.gstin ? `(${c.gstin})` : ''}</option>)}
            </select>
          </div>

          {selectedCust && (
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-2.5 py-1 rounded-lg font-semibold ${isIntraState ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
                {isIntraState ? '📊 Intra-State (CGST+SGST)' : '🌍 Inter-State (IGST)'}
              </span>
              <span className="text-white/35">State: {selectedCust.state_code || '27'} — {selectedCust.state || 'Maharashtra'}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="card card-premium space-y-4" style={{ animation: 'entranceScale 0.5s cubic-bezier(0.16,1,0.3,1) 0.15s both' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-sm">Items</h3>
            <button type="button" onClick={addItem} className="btn-secondary text-xs flex items-center gap-1 btn-shine"><Plus size={14} /> Add Item</button>
          </div>

          {items.map((item, i) => (
            <div key={i} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/50">Item {i + 1}</span>
                {items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300 transition-colors"><Trash2 size={14} /></button>}
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 font-semibold mb-1">Description</label>
                  <input value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} className="input-field text-sm" placeholder="Item description" />
                </div>
                <div>
                  <label className="block text-xs text-white/40 font-semibold mb-1">HSN Code</label>
                  <input value={item.hsn_code} onChange={(e) => updateItem(i, 'hsn_code', e.target.value)} className="input-field text-sm font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs text-white/40 font-semibold mb-1">Qty</label>
                  <input type="number" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} className="input-field text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-white/40 font-semibold mb-1">Unit</label>
                  <select value={item.unit} onChange={(e) => updateItem(i, 'unit', e.target.value)} className="input-field text-sm">
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/40 font-semibold mb-1">Rate (₹)</label>
                  <input type="number" value={item.rate} onChange={(e) => updateItem(i, 'rate', e.target.value)} className="input-field text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-white/40 font-semibold mb-1">GST %</label>
                  <select value={item.tax_rate} onChange={(e) => updateItem(i, 'tax_rate', e.target.value)} className="input-field text-sm">
                    {GST_SLABS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/40 font-semibold mb-1">Amount</label>
                  <input type="number" value={((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0)).toFixed(2)} readOnly className="input-field text-sm" style={{ background: 'rgba(255,255,255,0.03)' }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Manual GST Override + Summary */}
        <div className="card card-premium space-y-4" style={{ animation: 'entranceScale 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s both' }}>
          <div className="flex items-center gap-2">
            <Info size={14} className="text-white/30" />
            <span className="text-xs text-white/30">Leave manual fields blank to auto-calculate</span>
          </div>
          <div className="grid md:grid-cols-4 gap-3">
            <div><label className="block text-xs text-white/40 font-semibold mb-1">Manual CGST</label><input type="number" value={manualCgst} onChange={e => setManualCgst(e.target.value)} className="input-field text-sm" placeholder="Auto" /></div>
            <div><label className="block text-xs text-white/40 font-semibold mb-1">Manual SGST</label><input type="number" value={manualSgst} onChange={e => setManualSgst(e.target.value)} className="input-field text-sm" placeholder="Auto" /></div>
            <div><label className="block text-xs text-white/40 font-semibold mb-1">Manual IGST</label><input type="number" value={manualIgst} onChange={e => setManualIgst(e.target.value)} className="input-field text-sm" placeholder="Auto" /></div>
            <div><label className="block text-xs text-white/40 font-semibold mb-1">Manual Total</label><input type="number" value={manualTotal} onChange={e => setManualTotal(e.target.value)} className="input-field text-sm" placeholder="Auto" /></div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div><label className="block text-xs text-white/40 font-semibold mb-1">Discount</label><input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="input-field text-sm" placeholder="0" /></div>
            <div><label className="block text-xs text-white/40 font-semibold mb-1">Round Off</label><input type="number" value={roundOff} onChange={e => setRoundOff(e.target.value)} className="input-field text-sm" placeholder="0" /></div>
            <div><label className="block text-xs text-white/40 font-semibold mb-1">Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} className="input-field text-sm" placeholder="Thank you for business" /></div>
          </div>

          <div className="mt-4 p-4 rounded-xl space-y-2" style={{ background: 'rgba(var(--accent-rgb),0.04)', border: '1px solid rgba(var(--accent-rgb),0.12)' }}>
            <div className="flex justify-between text-sm text-white/60"><span>Subtotal</span><span className="font-semibold text-white">₹{calcSubtotal().toFixed(2)}</span></div>
            {isIntraState ? (
              <>
                <div className="flex justify-between text-sm text-white/60"><span>CGST</span><span className="font-semibold accent-text">₹{gst.cgst.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm text-white/60"><span>SGST</span><span className="font-semibold accent-text">₹{gst.sgst.toFixed(2)}</span></div>
              </>
            ) : (
              <div className="flex justify-between text-sm text-white/60"><span>IGST</span><span className="font-semibold text-orange-400">₹{gst.igst.toFixed(2)}</span></div>
            )}
            {discount && <div className="flex justify-between text-sm text-white/60"><span>Discount</span><span className="font-semibold text-red-400">-₹{(parseFloat(discount) || 0).toFixed(2)}</span></div>}
            <div className="glow-line"></div>
            <div className="flex justify-between text-lg font-extrabold text-white"><span>Total</span><span>₹{gst.total.toFixed(2)}</span></div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/app/invoices')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 btn-shine">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {loading ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  )
}
