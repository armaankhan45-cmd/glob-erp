import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { HSN_CODES } from '../data/hsnCodes'
import { Save, Plus, X, ArrowLeft } from 'lucide-react'

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

export default function PurchaseEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    bill_number: '', supplier_name: '', supplier_gstin: '', supplier_state: '', supplier_state_code: '',
    supplier_address: '', supplier_phone: '',
    bill_date: new Date().toISOString().split('T')[0], discount: 0, round_off: 0, notes: '', payment_status: 'Unpaid'
  })
  const [items, setItems] = useState([{ description: '', hsn_code: '', quantity: 1, unit: 'NOS', rate: 0, cgst_rate: 9, sgst_rate: 9, igst_rate: 0, amount: 0 }])
  const [calculated, setCalculated] = useState({ subtotal: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0 })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/purchases/${id}`).then(res => {
      const p = res.data.purchase
      setForm({
        bill_number: p.bill_number || '',
        supplier_name: p.supplier_name || '',
        supplier_gstin: p.supplier_gstin || '',
        supplier_state: p.supplier_state || '',
        supplier_state_code: p.supplier_state_code || '',
        supplier_address: p.supplier_address || '',
        supplier_phone: p.supplier_phone || '',
        bill_date: (p.bill_date || '').split('T')[0],
        discount: p.discount || 0,
        round_off: p.round_off || 0,
        notes: p.notes || '',
        payment_status: p.payment_status || 'Unpaid'
      })
      const loadedItems = res.data.items?.length > 0
        ? res.data.items
        : [{ description: '', hsn_code: '', quantity: 1, unit: 'NOS', rate: 0, cgst_rate: 9, sgst_rate: 9, igst_rate: 0, amount: 0 }]
      setItems(loadedItems)
      setCalculated({
        subtotal: parseFloat(p.subtotal) || 0,
        cgst_amount: parseFloat(p.cgst_amount) || 0,
        sgst_amount: parseFloat(p.sgst_amount) || 0,
        igst_amount: parseFloat(p.igst_amount) || 0,
        total_amount: parseFloat(p.total_amount) || 0
      })
    }).catch(err => {
      console.error('Load error:', err)
      alert('Failed to load purchase bill')
      navigate('/app/purchases')
    }).finally(() => setLoading(false))
  }, [id])

  const recalc = (itemsList, discountVal, roundOffVal) => {
    const subtotal = itemsList.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
    const cgst = itemsList.reduce((s, i) => s + (parseFloat(i.amount) || 0) * (parseFloat(i.cgst_rate) || 0) / 100, 0)
    const sgst = itemsList.reduce((s, i) => s + (parseFloat(i.amount) || 0) * (parseFloat(i.sgst_rate) || 0) / 100, 0)
    const igst = itemsList.reduce((s, i) => s + (parseFloat(i.amount) || 0) * (parseFloat(i.igst_rate) || 0) / 100, 0)
    const discount = parseFloat(discountVal) || 0
    const roundOff = parseFloat(roundOffVal) || 0
    setCalculated({ subtotal, cgst_amount: cgst, sgst_amount: sgst, igst_amount: igst, total_amount: subtotal + cgst + sgst + igst - discount + roundOff })
  }

  const updateItem = (idx, key, val) => {
    const newItems = [...items]
    newItems[idx] = { ...newItems[idx], [key]: val }
    if (key === 'quantity' || key === 'rate') {
      newItems[idx].amount = (parseFloat(newItems[idx].quantity) || 0) * (parseFloat(newItems[idx].rate) || 0)
    }
    if (key === 'description') {
      const detected = autoDetectHSN(val)
      if (detected && !newItems[idx].hsn_code) {
        newItems[idx].hsn_code = detected
      }
    }
    setItems(newItems)
    recalc(newItems, form.discount, form.round_off)
  }

  const addItem = () => setItems([...items, { description: '', hsn_code: '', quantity: 1, unit: 'NOS', rate: 0, cgst_rate: 9, sgst_rate: 9, igst_rate: 0, amount: 0 }])
  const removeItem = (idx) => { const n = items.filter((_, i) => i !== idx); setItems(n); recalc(n, form.discount, form.round_off) }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/purchases/${id}`, {
        ...form,
        bill_date: form.bill_date || null,
        subtotal: calculated.subtotal,
        cgst_amount: calculated.cgst_amount,
        sgst_amount: calculated.sgst_amount,
        igst_amount: calculated.igst_amount,
        total_amount: calculated.total_amount,
        items: items.map(i => ({
          description: i.description,
          hsn_code: i.hsn_code,
          quantity: parseFloat(i.quantity) || 0,
          unit: i.unit,
          rate: parseFloat(i.rate) || 0,
          cgst_rate: parseFloat(i.cgst_rate) || 0,
          sgst_rate: parseFloat(i.sgst_rate) || 0,
          igst_rate: parseFloat(i.igst_rate) || 0,
          amount: parseFloat(i.amount) || 0
        }))
      })
      navigate(`/app/purchases/${id}`)
    } catch (err) {
      alert(err.response?.data?.msg || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/app/purchases/${id}`)} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-bold">Edit Purchase Bill</h1>
      </div>

      <div className="card space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Bill Number *</label><input value={form.bill_number} onChange={e => setForm({...form, bill_number: e.target.value})} className="input-field" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name *</label><input value={form.supplier_name} onChange={e => setForm({...form, supplier_name: e.target.value})} className="input-field" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Supplier GSTIN</label><input value={form.supplier_gstin} onChange={e => setForm({...form, supplier_gstin: e.target.value.toUpperCase(), supplier_state_code: e.target.value.substring(0,2)})} className="input-field" /></div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Bill Date</label><input type="date" value={form.bill_date} onChange={e => setForm({...form, bill_date: e.target.value})} className="input-field" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Supplier Phone</label><input value={form.supplier_phone} onChange={e => setForm({...form, supplier_phone: e.target.value})} className="input-field" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Supplier Address</label><input value={form.supplier_address} onChange={e => setForm({...form, supplier_address: e.target.value})} className="input-field" /></div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
            <select value={form.payment_status} onChange={e => setForm({...form, payment_status: e.target.value})} className="input-field">
              <option value="Unpaid">Unpaid</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold mb-3">Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-gray-500 text-left">
              <th className="pb-2">Description</th><th className="pb-2">HSN</th><th className="pb-2 w-20">Qty</th><th className="pb-2 w-20">Unit</th><th className="pb-2 w-24">Rate</th><th className="pb-2 w-20">GST%</th><th className="pb-2 w-24 text-right">Amount</th><th className="pb-2 w-10"></th>
            </tr></thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-50">
                  <td className="py-2 pr-2"><input value={item.description || ''} onChange={e => updateItem(idx, 'description', e.target.value)} className="input-field text-sm" placeholder="e.g. SS TANK" /></td>
                  <td className="py-2 pr-2"><input value={item.hsn_code || ''} onChange={e => updateItem(idx, 'hsn_code', e.target.value)} list="hsn-list-pedit" className="input-field text-sm w-32" /><datalist id="hsn-list-pedit">{HSN_CODES.map(h => <option key={h.code} value={h.code}>{h.label}</option>)}</datalist></td>
                  <td className="py-2 pr-2"><input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="input-field text-sm" /></td>
                  <td className="py-2 pr-2"><select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="input-field text-sm">{['NOS','KG','MTR','SET','LOT','PCS'].map(u=><option key={u}>{u}</option>)}</select></td>
                  <td className="py-2 pr-2"><input type="number" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} className="input-field text-sm" /></td>
                  <td className="py-2 pr-2"><input type="number" value={item.igst_rate > 0 ? item.igst_rate : (parseFloat(item.cgst_rate) + parseFloat(item.sgst_rate))} onChange={e => { const r = parseFloat(e.target.value)||0; const sc = form.supplier_state_code; const orgSC = '27'; if(sc===orgSC){updateItem(idx,'cgst_rate',r/2);updateItem(idx,'sgst_rate',r/2);updateItem(idx,'igst_rate',0)}else{updateItem(idx,'igst_rate',r);updateItem(idx,'cgst_rate',0);updateItem(idx,'sgst_rate',0)} }} className="input-field text-sm" /></td>
                  <td className="py-2 text-right font-medium">{(parseFloat(item.amount)||0).toFixed(2)}</td>
                  <td className="py-2">{items.length > 1 && <button onClick={() => removeItem(idx)} className="text-red-400"><X size={16} /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={addItem} className="btn-secondary mt-3 text-sm flex items-center gap-1"><Plus size={14} /> Add Item</button>
      </div>

      <div className="card">
        <div className="max-w-sm ml-auto space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>₹{calculated.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>CGST</span><span>₹{calculated.cgst_amount.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>SGST</span><span>₹{calculated.sgst_amount.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>IGST</span><span>₹{calculated.igst_amount.toFixed(2)}</span></div>
          <div className="flex justify-between items-center"><span>Discount</span><input type="number" value={form.discount} onChange={e => {setForm({...form, discount: e.target.value}); recalc(items, e.target.value, form.round_off)}} className="input-field w-28 text-right text-sm" /></div>
          <div className="flex justify-between items-center"><span>Round Off</span><input type="number" step="0.01" value={form.round_off} onChange={e => {setForm({...form, round_off: e.target.value}); recalc(items, form.discount, e.target.value)}} className="input-field w-28 text-right text-sm" /></div>
          <hr />
          <div className="flex justify-between text-base font-bold"><span>TOTAL</span><span>₹{calculated.total_amount.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} className="input-field" rows={3} />
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={() => navigate(`/app/purchases/${id}`)} className="btn-secondary">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2"><Save size={16} /> {saving ? 'Saving...' : 'Update Purchase Bill'}</button>
      </div>
    </div>
  )
}
