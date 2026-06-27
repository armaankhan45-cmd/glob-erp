import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { HSN_CODES } from '../data/hsnCodes'
import { Save, Plus, X, ArrowLeft } from 'lucide-react'

// Auto-detect HSN from item description keywords
const HSN_KEYWORDS = [
  { keywords: ['TANK', 'TANKER', 'RESERVOIR', 'VAT', 'DRUM', 'CASK'], hsn: '7309' },
  { keywords: ['CHASSIS', 'MOUNTING', 'MUDGUARD', 'EXHAUST', 'BUMPER', 'BRAKE', 'CLUTCH', 'GEAR', 'AXLE', 'SUSPENSION', 'STEERING'], hsn: '8708' },
  { keywords: ['STRUCTURE', 'PLATFORM', 'CATWALK', 'LADDER', 'RAILING', 'FRAME', 'COLUMN', 'BEAM', 'TRUSS', 'GIRDER'], hsn: '7308' },
  { keywords: ['TRAILER', 'SEMI-TRAILER', 'TROLLEY'], hsn: '8716' },
  { keywords: ['BODY', 'CABIN', 'CAB', 'D-BOX', 'DOME', 'COCKPIT'], hsn: '8707' },
  { keywords: ['VALVE', 'COCK', 'TAP', 'FITTING', 'FLANGE', 'MANHOLE'], hsn: '8481' },
  { keywords: ['PIPE', 'TUBE', 'PIPELINE', 'HOSE', 'DUCT'], hsn: '7308' },
  { keywords: ['BOLT', 'NUT', 'SCREW', 'RIVET', 'WASHER', 'STUD', 'ANCHOR'], hsn: '7318' },
  { keywords: ['NAIL', 'TACK', 'STAPLE', 'PIN'], hsn: '7317' },
  { keywords: ['CHAIN', 'HOOK', 'SHACKLE', 'SLING'], hsn: '7315' },
  { keywords: ['ROPE', 'CABLE', 'WIRE', 'STRAND'], hsn: '7312' },
  { keywords: ['CRANE', 'HOIST', 'LIFT', 'CONVEYOR', 'ELEVATOR', 'WINCH'], hsn: '8428' },
  { keywords: ['ALUMINIUM', 'ALUMINUM', 'ALUM'], hsn: '7610' },
  { keywords: ['PLASTIC', 'PVC', 'HDPE', 'PP', 'NYLON'], hsn: '3925' },
  { keywords: ['RUBBER', 'GASKET', 'SEAL', 'O-RING', 'BELT'], hsn: '4016' },
  { keywords: ['PAINT', 'COATING', 'PRIMER', 'VARNISH', 'LACQUER'], hsn: '3208' },
  { keywords: ['WELDING', 'ELECTRODE', 'FILLER', 'FLUX', 'SOLDER'], hsn: '8311' },
  { keywords: ['PUMP', 'COMPRESSOR', 'FAN', 'BLOWER', 'MOTOR', 'ENGINE', 'GENERATOR'], hsn: '8413' },
]

function autoDetectHSN(description) {
  if (!description) return ''
  const upper = description.toUpperCase()
  for (const rule of HSN_KEYWORDS) {
    for (const kw of rule.keywords) {
      if (upper.includes(kw)) return rule.hsn
    }
  }
  return ''
}

export default function InvoiceNew() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const orgId = user?.organization_id
  const orgStateCode = user?.organization?.state_code || '27'

  const [customers, setCustomers] = useState([])
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickCustomer, setQuickCustomer] = useState({ name: '', gstin: '', phone: '', state: 'Maharashtra', state_code: '27', address: '', city: '', pincode: '' })
  const [gstinLookup, setGstinLookup] = useState('')
  const [gstinLoading, setGstinLoading] = useState(false)
  const [gstinMsg, setGstinMsg] = useState('')

  const [form, setForm] = useState({
    customer_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    discount: 0,
    round_off: 0,
    notes: 'Terms: Payment due within 30 days.',
    status: 'Pending',
    payment_status: 'Unpaid'
  })

  const [items, setItems] = useState([{ description: '', hsn_code: '', quantity: 1, unit: 'NOS', rate: 0, cgst_rate: 9, sgst_rate: 9, igst_rate: 0, amount: 0 }])
  const [calculated, setCalculated] = useState({ subtotal: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0 })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/customers').then(res => setCustomers(res.data.customers || [])).catch(() => {})
  }, [])

  useEffect(() => {
    const customer = customers.find(c => c.id === parseInt(form.customer_id))
    const cStateCode = customer?.state_code || customer?.gstin?.substring(0, 2) || orgStateCode
    const isIntra = cStateCode === orgStateCode

    const updatedItems = items.map(item => {
      const qty = parseFloat(item.quantity) || 0
      const rate = parseFloat(item.rate) || 0
      const amount = qty * rate
      const taxRate = isIntra ? (parseFloat(item.igst_rate) || 18) : (parseFloat(item.cgst_rate) * 2 || 18)
      
      if (isIntra) {
        return { ...item, cgst_rate: taxRate / 2, sgst_rate: taxRate / 2, igst_rate: 0, amount }
      } else {
        return { ...item, cgst_rate: 0, sgst_rate: 0, igst_rate: taxRate, amount }
      }
    })
    setItems(updatedItems)

    const subtotal = updatedItems.reduce((s, i) => s + i.amount, 0)
    const cgst = updatedItems.reduce((s, i) => s + i.amount * i.cgst_rate / 100, 0)
    const sgst = updatedItems.reduce((s, i) => s + i.amount * i.sgst_rate / 100, 0)
    const igst = updatedItems.reduce((s, i) => s + i.amount * i.igst_rate / 100, 0)
    const discount = parseFloat(form.discount) || 0
    const roundOff = parseFloat(form.round_off) || 0
    const total = subtotal + cgst + sgst + igst - discount + roundOff

    setCalculated({ subtotal, cgst_amount: cgst, sgst_amount: sgst, igst_amount: igst, total_amount: total })
  }, [items, form.customer_id, form.discount, form.round_off, customers])

  const updateItem = (idx, key, val) => {
    const newItems = [...items]
    newItems[idx] = { ...newItems[idx], [key]: val }

    // Auto-detect HSN when description changes
    if (key === 'description') {
      const detected = autoDetectHSN(val)
      if (detected && !newItems[idx].hsn_code) {
        newItems[idx].hsn_code = detected
      }
    }
    setItems(newItems)
  }

  const addItem = () => setItems([...items, { description: '', hsn_code: '', quantity: 1, unit: 'NOS', rate: 0, cgst_rate: 9, sgst_rate: 9, igst_rate: 0, amount: 0 }])
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx))

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.post('/invoices', {
        ...form,
        due_date: null,
        ...calculated,
        items: items.map(i => ({ ...i, quantity: parseFloat(i.quantity), rate: parseFloat(i.rate), cgst_rate: parseFloat(i.cgst_rate), sgst_rate: parseFloat(i.sgst_rate), igst_rate: parseFloat(i.igst_rate), amount: parseFloat(i.amount) }))
      })
      navigate('/app/invoices')
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to create invoice')
    } finally {
      setSaving(false)
    }
  }

  const addQuickCustomer = async () => {
    try {
      const res = await api.post('/customers', quickCustomer)
      setCustomers([...customers, res.data.customer])
      setForm({ ...form, customer_id: res.data.customer.id })
      setShowQuickAdd(false)
    } catch (err) {
      alert('Failed to add customer')
    }
  }

  const fetchGstinForCustomer = async () => {
    const gstin = gstinLookup.trim().toUpperCase()
    if (!gstin || gstin.length < 15) { setGstinMsg('Enter valid 15-digit GSTIN'); return }
    setGstinLoading(true); setGstinMsg('')
    try {
      const res = await api.get(`/gst/lookup/${gstin}`)
      if (res.data.success) {
        const d = res.data
        setQuickCustomer(prev => ({
          ...prev,
          name: d.name || d.trade_name || prev.name,
          gstin: gstin,
          state: d.state || prev.state,
          state_code: d.state_code || gstin.substring(0, 2),
          address: d.address || prev.address,
          city: d.city || prev.city,
          pincode: d.pincode || prev.pincode,
          phone: d.phone || prev.phone,
        }))
        setGstinMsg(d.name ? `✓ Found: ${d.name}` : 'State found. Fill name manually.')
      } else {
        setGstinMsg('Not found. Fill details manually.')
      }
    } catch { setGstinMsg('Lookup failed. Fill manually.') }
    setGstinLoading(false)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/invoices')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <div>
          <h1 className="text-2xl font-bold">New GST Invoice</h1>
          <p className="text-gray-500 text-sm">Create a new sales invoice</p>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
            <div className="flex gap-2">
              <select value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })} className="input-field flex-1" required>
                <option value="">Select Customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.gstin ? ` (${c.gstin.substring(0,2)}...)` : ''}</option>)}
              </select>
              <button onClick={() => setShowQuickAdd(true)} className="btn-secondary text-sm whitespace-nowrap" title="Quick Add Customer"><Plus size={16} /></button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
            <input type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} className="input-field" />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card">
        <h3 className="font-bold text-gray-800 mb-3">Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500 text-left">
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 font-medium">HSN</th>
              <th className="pb-2 font-medium w-20">Qty</th>
              <th className="pb-2 font-medium w-20">Unit</th>
              <th className="pb-2 font-medium w-24">Rate</th>
              <th className="pb-2 font-medium w-20">GST%</th>
              <th className="pb-2 font-medium w-24 text-right">Amount</th>
              <th className="pb-2 font-medium w-10"></th>
            </tr></thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-50">
                  <td className="py-2 pr-2"><input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="input-field text-sm" placeholder="e.g. SS TANK" /></td>
                  <td className="py-2 pr-2"><input value={item.hsn_code} onChange={e => updateItem(idx, 'hsn_code', e.target.value)} list="hsn-list" className="input-field text-sm w-32" placeholder="7309" /><datalist id="hsn-list">{HSN_CODES.map(h => <option key={h.code} value={h.code}>{h.label}</option>)}</datalist></td>
                  <td className="py-2 pr-2"><input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="input-field text-sm" /></td>
                  <td className="py-2 pr-2"><select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="input-field text-sm">
                    {['NOS','KG','MTR','SET','LOT','PCS','LTR'].map(u => <option key={u}>{u}</option>)}
                  </select></td>
                  <td className="py-2 pr-2"><input type="number" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} className="input-field text-sm" /></td>
                  <td className="py-2 pr-2">
                    <input type="number" value={item.igst_rate > 0 ? item.igst_rate : (item.cgst_rate + item.sgst_rate)} onChange={e => {
                      const rate = parseFloat(e.target.value) || 0
                      const customer = customers.find(c => c.id === parseInt(form.customer_id))
                      const cState = customer?.state_code || orgStateCode
                      if (cState === orgStateCode) {
                        updateItem(idx, 'cgst_rate', rate/2); updateItem(idx, 'sgst_rate', rate/2); updateItem(idx, 'igst_rate', 0)
                      } else {
                        updateItem(idx, 'igst_rate', rate); updateItem(idx, 'cgst_rate', 0); updateItem(idx, 'sgst_rate', 0)
                      }
                    }} className="input-field text-sm" />
                  </td>
                  <td className="py-2 text-right font-medium">{(item.amount || 0).toFixed(2)}</td>
                  <td className="py-2">{items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><X size={16} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={addItem} className="btn-secondary mt-3 text-sm flex items-center gap-1"><Plus size={14} /> Add Item</button>
      </div>

      {/* Totals */}
      <div className="card">
        <div className="max-w-sm ml-auto space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span className="font-medium">₹{calculated.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>CGST</span><span className="font-medium">₹{calculated.cgst_amount.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>SGST</span><span className="font-medium">₹{calculated.sgst_amount.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>IGST</span><span className="font-medium">₹{calculated.igst_amount.toFixed(2)}</span></div>
          <div className="flex justify-between items-center">
            <span>Discount</span>
            <input type="number" value={form.discount} onChange={e => setForm({...form, discount: e.target.value})} className="input-field w-28 text-right text-sm" />
          </div>
          <div className="flex justify-between items-center">
            <span>Round Off</span>
            <input type="number" step="0.01" value={form.round_off} onChange={e => setForm({...form, round_off: e.target.value})} className="input-field w-28 text-right text-sm" />
          </div>
          <hr />
          <div className="flex justify-between text-base font-bold"><span>TOTAL</span><span>₹{calculated.total_amount.toFixed(2)}</span></div>
        </div>
      </div>

      {/* Notes */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes & Terms</label>
        <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input-field" rows={3} />
      </div>

      {/* Save */}
      <div className="flex justify-end gap-3">
        <button onClick={() => navigate('/app/invoices')} className="btn-secondary">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          <Save size={16} /> {saving ? 'Saving...' : 'Save Invoice'}
        </button>
      </div>

      {/* Quick Add Customer Modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Quick Add Customer</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Auto-fetch via GSTIN</label>
                <div className="flex gap-2">
                  <input value={gstinLookup} onChange={e => setGstinLookup(e.target.value.toUpperCase())} className="input-field flex-1" placeholder="Enter GSTIN" maxLength={15} />
                  <button onClick={fetchGstinForCustomer} disabled={gstinLoading} className="btn-primary whitespace-nowrap text-sm">{gstinLoading ? '...' : 'Fetch'}</button>
                </div>
                {gstinMsg && <p className="text-xs text-blue-600 mt-1">{gstinMsg}</p>}
              </div>
              <input value={quickCustomer.name} onChange={e => setQuickCustomer({...quickCustomer, name: e.target.value})} className="input-field" placeholder="Customer Name *" />
              <input value={quickCustomer.gstin} onChange={e => setQuickCustomer({...quickCustomer, gstin: e.target.value, state_code: e.target.value.substring(0,2)})} className="input-field" placeholder="GSTIN" />
              <input value={quickCustomer.phone} onChange={e => setQuickCustomer({...quickCustomer, phone: e.target.value})} className="input-field" placeholder="Phone" />
              <input value={quickCustomer.address} onChange={e => setQuickCustomer({...quickCustomer, address: e.target.value})} className="input-field" placeholder="Address" />
              <div className="grid grid-cols-2 gap-3">
                <input value={quickCustomer.city} onChange={e => setQuickCustomer({...quickCustomer, city: e.target.value})} className="input-field" placeholder="City" />
                <input value={quickCustomer.pincode} onChange={e => setQuickCustomer({...quickCustomer, pincode: e.target.value})} className="input-field" placeholder="Pincode" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowQuickAdd(false)} className="btn-secondary">Cancel</button>
              <button onClick={addQuickCustomer} className="btn-primary">Add Customer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
