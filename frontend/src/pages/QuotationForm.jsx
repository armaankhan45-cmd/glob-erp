import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { HSN_CODES } from '../data/hsnCodes'
import { Save, Plus, X, ArrowLeft } from 'lucide-react'

const DEFAULT_TEMPLATE = `DESIGN, MANUFACTURE & FABRICATION OF TOP-LOADING SS304CR TANK USING JINDAL-CERTIFIED MATERIAL WITH TC REPORT. TANKER CAPACITY: 37KL DIVIDED INTO 6 COMPARTMENTS
CONSTRUCTED WITH:
• SHELL: 3.5 MM THICK
• DISH END: 3.5 MM THICK
• 76 OD SS304 DELIVERY PIPELINE
• 6 VALVE SS304 TOP FITTINGS
• LADDER, CATWALK, REAR MUDGUARD
• GI SHEET FITTING, SS304 WALL BOX FITTING
• DEEP ROD CARRIER, FIRE EXTINGUISHER HOLDER
• MODIFIED EXHAUST LINE WITH SPARK ARRESTOR
• MANHOLES ALL BOLT WELDED WITH P.V. VALVES, AIR VENTS, AND EMERGENCY VALVES SS304 FITTING
• REAR BOTTOM LEVER ARRANGEMENT WITH FUSIBLE LINK MS FITTING
• SIDE PLATFORM WITH SS304 RAILING & SS304 PIPE RAILING FITTING
• D-BOX DOME COVER BOX IN SS304 FITTING
• MOUNTING OF SS304 TANK ON CHASSIS FULL PAINTING
ADDITIONAL INCLUSIONS:
• EXPLOSIVE LICENSE (9NO) WE PROVIDE PAPER READY ONLY FOR 3 YEARS
• FORM 22 & 17`

export default function QuotationForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id

  const [form, setForm] = useState({
    customer_name: localStorage.getItem('lastQuotationCustomer') || '',
    additional_info: '',
    actual_notes: '',
    igst_rate: 18,
    quotation_number: '',
  })
  const [customerId, setCustomerId] = useState(null)
  const [selectedCust, setSelectedCust] = useState(null)
  const [customers, setCustomers] = useState([])
  const [items, setItems] = useState([{ description: '', quantity: 1, unit: 'Unit', rate: 0, igst_rate: 18, amount: 0 }])
  const [calculated, setCalculated] = useState({ subtotal: 0, igst_amount: 0, total_amount: 0 })
  const [saving, setSaving] = useState(false)
  const [nextQuotationNo, setNextQuotationNo] = useState('')

  const [gstinInput, setGstinInput] = useState('')
  const [gstinLoading, setGstinLoading] = useState(false)
  const [gstinError, setGstinError] = useState('')

  useEffect(() => {
    if (isEdit) loadQuotation()
    else { loadTemplate(); fetchNextQuotationNo(); }
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    try {
      const r = await api.get('/customers')
      setCustomers(r.data.customers || [])
    } catch (e) {}
  }

  useEffect(() => {
    if (customerId && customers.length) {
      const c = customers.find(x => String(x.id) === String(customerId))
      setSelectedCust(c || null)
    } else {
      setSelectedCust(null)
    }
  }, [customerId, customers])

  const fetchNextQuotationNo = async () => {
    try {
      const res = await api.get('/quotations')
      const quotations = res.data.quotations || []
      let maxNum = 0
      quotations.forEach(q => {
        const rawNum = (q.quotation_number || '').split('/')[0]
        const num = parseInt(rawNum.replace(/^[A-Za-z\-]+/, '').replace(/^0+/, '')) || 0
        if (num > maxNum) maxNum = num
      })
      const suggested = maxNum > 0 ? maxNum + 1 : 1
      setNextQuotationNo(String(suggested))
      setForm(prev => ({ ...prev, quotation_number: String(suggested) }))
    } catch (err) {
      setNextQuotationNo('1')
      setForm(prev => ({ ...prev, quotation_number: '1' }))
    }
  }

  const loadTemplate = async () => {
    try {
      const res = await api.get('/settings')
      const template = res.data.settings?.quotation_template
      if (template) {
        setItems([{ description: template, quantity: 1, unit: 'Unit', rate: 0, igst_rate: 18, amount: 0 }])
      } else {
        setItems([{ description: DEFAULT_TEMPLATE, quantity: 1, unit: 'Unit', rate: 0, igst_rate: 18, amount: 0 }])
      }
    } catch {
      setItems([{ description: DEFAULT_TEMPLATE, quantity: 1, unit: 'Unit', rate: 0, igst_rate: 18, amount: 0 }])
    }
  }

  const loadQuotation = async () => {
    try {
      const res = await api.get(`/quotations/${id}`)
      const q = res.data.quotation
      const rawNum = (q.quotation_number || '').split('/')[0]
      const qNum = rawNum.replace(/^[A-Za-z\-]+/, '').replace(/^0+/, '') || rawNum
      setForm(prev => ({
        ...prev,
        customer_name: q.customer_name || '',
        additional_info: q.additional_info || '',
        actual_notes: q.actual_notes || '',
        igst_rate: parseFloat(res.data.items?.[0]?.igst_rate || 18),
        quotation_number: qNum,
      }))
      setCustomerId(q.customer_id || null)
      setItems(res.data.items?.length > 0 ? res.data.items : [{ description: '', quantity: 1, unit: 'Unit', rate: 0, igst_rate: 18, amount: 0 }])
      setCalculated({ subtotal: parseFloat(q.subtotal) || 0, igst_amount: parseFloat(q.igst_amount) || 0, total_amount: parseFloat(q.total_amount) || 0 })
    } catch {
      navigate('/app/quotations')
    }
  }

  const updateItem = (idx, key, val) => {
    const newItems = [...items]
    newItems[idx] = { ...newItems[idx], [key]: val }
    if (key === 'quantity' || key === 'rate') {
      newItems[idx].amount = (parseFloat(newItems[idx].quantity) || 0) * (parseFloat(newItems[idx].rate) || 0)
    }
    setItems(newItems)
    recalc(newItems, form.igst_rate)
  }

  const recalc = (itemsList, gstRate) => {
    const subtotal = itemsList.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
    const igst = itemsList.reduce((s, i) => s + (parseFloat(i.amount) || 0) * (parseFloat(i.igst_rate || gstRate) || 0) / 100, 0)
    setCalculated({ subtotal, igst_amount: igst, total_amount: subtotal + igst })
  }

  const setGSTSlab = (rate) => {
    setForm({ ...form, igst_rate: rate })
    const newItems = items.map(i => ({ ...i, igst_rate: rate }))
    setItems(newItems)
    recalc(newItems, rate)
  }

  const addItem = () => setItems([...items, { description: '', quantity: 1, unit: 'Unit', rate: 0, igst_rate: form.igst_rate, amount: 0 }])
  const removeItem = (idx) => { const n = items.filter((_, i) => i !== idx); setItems(n); recalc(n, form.igst_rate) }

  const handleSave = async () => {
    setSaving(true)
    try {
      const data = {
        customer_id: customerId || null,
        quotation_date: new Date().toISOString().split('T')[0],
        validity_date: null,
        quotation_number: form.quotation_number,
        subtotal: calculated.subtotal,
        cgst_amount: 0,
        sgst_amount: 0,
        igst_amount: calculated.igst_amount,
        total_amount: calculated.total_amount,
        customer_name: form.customer_name,
        additional_info: form.additional_info,
        actual_notes: form.actual_notes,
        items: items.map(i => ({
          description: i.description,
          hsn_code: '7309',
          quantity: parseFloat(i.quantity),
          unit: i.unit || 'Unit',
          rate: parseFloat(i.rate),
          igst_rate: parseFloat(i.igst_rate || form.igst_rate || 18),
          amount: parseFloat(i.amount)
        }))
      }
      if (isEdit) {
        await api.put(`/quotations/${id}`, data)
      } else {
        await api.post('/quotations', data)
      }
      localStorage.setItem('lastQuotationCustomer', form.customer_name)
      navigate('/app/quotations')
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const selectQuotationCustomer = (id) => {
    const c = customers.find(x => String(x.id) === String(id))
    if (c) {
      setCustomerId(c.id)
      setForm({ ...form, customer_name: c.name })
    }
  }

  const fetchGstinDetails = async () => {
    const gstin = gstinInput.trim().toUpperCase()
    if (!gstin || gstin.length < 15) {
      setGstinError('Enter valid 15-digit GSTIN')
      return
    }
    setGstinLoading(true)
    setGstinError('')
    try {
      const res = await api.get(`/gst/lookup/${gstin}`)
      if (res.data.success && res.data.name) {
        setForm({ ...form, customer_name: res.data.name })
        setGstinError('')
      } else if (res.data.success && res.data.source === 'parsed') {
        setGstinError(`GSTIN valid. State: ${res.data.state}. Type customer name manually.`)
      } else {
        setGstinError('No name found. Type customer name manually.')
      }
    } catch {
      setGstinError('Lookup failed. Type name manually.')
    }
    setGstinLoading(false)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/quotations')} className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-bold text-white">{isEdit ? 'Edit Quotation' : 'New Quotation'}</h1>
      </div>

      <div className="card space-y-4">
        {/* Quotation Number */}
        <div>
          <label className="block text-sm font-semibold text-white/80 mb-1">Quotation Number *</label>
          <div className="flex items-center gap-3">
            <input 
              type="number" 
              value={form.quotation_number} 
              onChange={e => setForm({...form, quotation_number: e.target.value})} 
              className="input-field w-40" 
              placeholder="e.g. 871"
              min="1"
            />
            <span className="text-sm text-white/55 font-medium">
              {nextQuotationNo ? `(Auto-suggested: ${nextQuotationNo})` : '(Next number will auto-fill)'}
            </span>
          </div>
          <p className="text-xs text-white/45 mt-1">Type your quotation number. Next time it will auto-suggest the next number.</p>
        </div>

        {/* Customer Name — Dropdown + Text */}
        <div>
          <label className="block text-sm font-semibold text-white/80 mb-1">Customer Name *</label>
          {customers.length > 0 && (
            <select onChange={e => selectQuotationCustomer(e.target.value)} className="input-field mb-2" value="">
              <option value="">— Pick from Customer Database —</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.gstin ? `(${c.gstin})` : ''}</option>)}
            </select>
          )}
          <input value={form.customer_name} onChange={e => { setForm({...form, customer_name: e.target.value}); setCustomerId(null); }} className="input-field" placeholder="Type customer name or select above" />
          {selectedCust && (
            <div className="mt-2 p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/55 space-y-0.5">
              {selectedCust.gstin && <div>GSTIN: <span className="text-white/75 font-medium">{selectedCust.gstin}</span></div>}
              {selectedCust.address && <div>Address: <span className="text-white/75">{selectedCust.address}</span></div>}
              <div>State: {selectedCust.state_code || '27'} — {selectedCust.state || 'Maharashtra'}</div>
              {selectedCust.phone && <div>Phone: <span className="text-white/75">{selectedCust.phone}</span></div>}
            </div>
          )}
        </div>

        {/* GSTIN Auto-fetch */}
        <div>
          <label className="block text-sm font-semibold text-white/80 mb-1">Customer GSTIN (optional — auto-fetch name)</label>
          <div className="flex gap-2">
            <input value={gstinInput} onChange={e => setGstinInput(e.target.value.toUpperCase())} className="input-field flex-1" placeholder="e.g. 27AFLPB0085N2Z8" maxLength={15} />
            <button onClick={fetchGstinDetails} disabled={gstinLoading} className="btn-primary whitespace-nowrap">
              {gstinLoading ? 'Fetching...' : 'Auto Fetch'}
            </button>
          </div>
          {gstinError && <p className="text-sm text-red-400 mt-1">{gstinError}</p>}
        </div>

        {/* Additional Info */}
        <div>
          <label className="block text-sm font-semibold text-white/80 mb-1">Additional Info (PAN, Vehicle No.)</label>
          <input value={form.additional_info} onChange={e => setForm({...form, additional_info: e.target.value})} className="input-field" />
        </div>

        {/* GST Rate */}
        <div>
          <label className="block text-sm font-semibold text-white/80 mb-2">GST Rate</label>
          <div className="flex gap-2">
            {[0, 5, 12, 18, 28].map(r => (
              <button key={r} onClick={() => setGSTSlab(r)} className={`px-4 py-2 rounded-lg text-sm font-bold ${form.igst_rate === r ? 'accent-text' : 'text-white/55 hover:text-white/70'}`}
                style={{ background: form.igst_rate === r ? 'rgba(var(--accent-rgb),0.15)' : 'rgba(255,255,255,0.04)', border: form.igst_rate === r ? '1px solid rgba(var(--accent-rgb),0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
                {r}%
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="font-bold text-white">Items</h3>
        {items.map((item, idx) => (
          <div key={idx} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white text-sm">Item {idx + 1}</span>
              {items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300"><X size={16} /></button>}
            </div>
            <textarea value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="input-field" rows={6} style={{ minHeight: '150px' }} placeholder="Item description..." />
            <div className="grid grid-cols-4 gap-3">
              <div><label className="block text-xs text-white/55 mb-1 font-semibold">Quantity</label><input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="input-field" /></div>
              <div><label className="block text-xs text-white/55 mb-1 font-semibold">Unit</label><select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="input-field">{['Unit','NOS','KG','SET','LOT'].map(u=><option key={u}>{u}</option>)}</select></div>
              <div><label className="block text-xs text-white/55 mb-1 font-semibold">Rate</label><input type="number" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} className="input-field" /></div>
              <div><label className="block text-xs text-white/55 mb-1 font-semibold">Amount</label><input type="number" value={item.amount} readOnly className="input-field" style={{ background: 'rgba(255,255,255,0.03)' }} /></div>
            </div>
          </div>
        ))}
        <button onClick={addItem} className="btn-secondary text-sm flex items-center gap-1"><Plus size={14} /> Add Item</button>
      </div>

      <div className="card">
        <div className="max-w-sm ml-auto space-y-2 text-sm">
          <div className="flex justify-between text-white/70"><span>Subtotal</span><span className="font-semibold text-white">₹{calculated.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-white/70"><span>IGST @ {form.igst_rate}%</span><span className="font-semibold accent-text">₹{calculated.igst_amount.toFixed(2)}</span></div>
          <hr className="border-white/10" />
          <div className="flex justify-between text-base font-bold text-white"><span>Total</span><span>₹{calculated.total_amount.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={() => navigate('/app/quotations')} className="btn-secondary">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2"><Save size={16} /> {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'} Quotation</button>
      </div>
    </div>
  )
}
