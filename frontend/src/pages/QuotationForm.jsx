import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
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
    customer_name: '',
    additional_info: '',
    actual_notes: '',
    quotation_date: new Date().toISOString().split('T')[0],
    validity_date: new Date(Date.now() + 30*86400000).toISOString().split('T')[0],
    igst_rate: 18,
  })
  const [items, setItems] = useState([{ description: '', quantity: 1, unit: 'Unit', rate: 0, igst_rate: 18, amount: 0 }])
  const [calculated, setCalculated] = useState({ subtotal: 0, igst_amount: 0, total_amount: 0 })
  const [saving, setSaving] = useState(false)
  const [manualOverride, setManualOverride] = useState({ igst: false, total_amount: false })

  useEffect(() => {
    if (isEdit) loadQuotation()
    else loadTemplate()
  }, [])

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
      setForm({
        customer_name: q.customer_name || '',
        additional_info: q.additional_info || '',
        actual_notes: q.actual_notes || '',
        quotation_date: q.quotation_date,
        validity_date: q.validity_date,
        igst_rate: parseFloat(res.data.items?.[0]?.igst_rate || 18),
      })
      setItems(res.data.items?.length > 0 ? res.data.items : [{ description: '', quantity: 1, unit: 'Unit', rate: 0, igst_rate: 18, amount: 0 }])
      setCalculated({ subtotal: q.subtotal, igst_amount: q.igst_amount, total_amount: q.total_amount })
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
        quotation_date: form.quotation_date,
        validity_date: form.validity_date,
        subtotal: calculated.subtotal,
        igst_amount: calculated.igst_amount,
        total_amount: calculated.total_amount,
        notes: `${form.customer_name || ''}|||${form.additional_info || ''}|||${form.actual_notes || ''}`,
        items: items.map(i => ({ ...i, quantity: parseFloat(i.quantity), rate: parseFloat(i.rate), igst_rate: parseFloat(i.igst_rate || form.igst_rate || 18), amount: parseFloat(i.amount) }))
      }
      if (isEdit) {
        await api.put(`/quotations/${id}`, data)
      } else {
        await api.post('/quotations', data)
      }
      navigate('/app/quotations')
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/quotations')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-bold">{isEdit ? 'Edit Quotation' : 'New Quotation'}</h1>
      </div>

      <div className="card space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
            <input value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} className="input-field" placeholder="Customer name (free text)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Info (PAN, Vehicle No.)</label>
            <input value={form.additional_info} onChange={e => setForm({...form, additional_info: e.target.value})} className="input-field" />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Quotation Date</label><input type="date" value={form.quotation_date} onChange={e => setForm({...form, quotation_date: e.target.value})} className="input-field" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Validity Date</label><input type="date" value={form.validity_date} onChange={e => setForm({...form, validity_date: e.target.value})} className="input-field" /></div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">GST Rate</label>
          <div className="flex gap-2">
            {[0, 5, 12, 18, 28].map(r => (
              <button key={r} onClick={() => setGSTSlab(r)} className={`px-4 py-2 rounded-lg text-sm font-medium ${form.igst_rate === r ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{r}%</button>
            ))}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card space-y-4">
        <h3 className="font-bold">Items</h3>
        {items.map((item, idx) => (
          <div key={idx} className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">Item {idx + 1}</span>
              {items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><X size={16} /></button>}
            </div>
            <textarea value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="input-field" rows={6} style={{ minHeight: '150px' }} placeholder="Item description..." />
            <div className="grid grid-cols-4 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">Quantity</label><input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="input-field" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Unit</label><select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="input-field">{['Unit','NOS','KG','SET','LOT'].map(u=><option key={u}>{u}</option>)}</select></div>
              <div><label className="block text-xs text-gray-500 mb-1">Rate</label><input type="number" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} className="input-field" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Amount</label><input type="number" value={item.amount} readOnly className="input-field bg-gray-50" /></div>
            </div>
          </div>
        ))}
        <button onClick={addItem} className="btn-secondary text-sm flex items-center gap-1"><Plus size={14} /> Add Item</button>
      </div>

      {/* Totals */}
      <div className="card">
        <div className="max-w-sm ml-auto space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span className="font-medium">₹{calculated.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between items-center">
            <span>IGST @ {form.igst_rate}%</span>
            <div className="flex items-center gap-2">
              {manualOverride.igst ? (
                <input type="number" value={calculated.igst_amount} onChange={e => setCalculated({...calculated, igst_amount: parseFloat(e.target.value)||0, total_amount: calculated.subtotal + parseFloat(e.target.value||0)})} className="input-field w-28 text-right text-sm" />
              ) : (
                <span className="font-medium">₹{calculated.igst_amount.toFixed(2)}</span>
              )}
              <button onClick={() => setManualOverride({...manualOverride, igst: !manualOverride.igst})} className="text-xs text-primary-600">{manualOverride.igst ? 'Reset' : 'Override'}</button>
            </div>
          </div>
          <hr />
          <div className="flex justify-between items-center text-base font-bold">
            <span>Total</span>
            <div className="flex items-center gap-2">
              {manualOverride.total_amount ? (
                <input type="number" value={calculated.total_amount} onChange={e => setCalculated({...calculated, total: parseFloat(e.target.value)||0})} className="input-field w-32 text-right" />
              ) : (
                <span>₹{calculated.total_amount.toFixed(2)}</span>
              )}
              <button onClick={() => setManualOverride({...manualOverride, total: !manualOverride.total_amount})} className="text-xs text-primary-600">{manualOverride.total_amount ? 'Reset' : 'Override'}</button>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea value={form.actual_notes} onChange={e => setForm({...form, actual_notes: e.target.value})} className="input-field" rows={3} />
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={() => navigate('/app/quotations')} className="btn-secondary">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2"><Save size={16} /> {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'} Quotation</button>
      </div>
    </div>
  )
}
