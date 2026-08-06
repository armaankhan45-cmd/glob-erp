import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { HSN_CODES } from '../data/hsnCodes'
import { Save, Plus, X, ArrowLeft } from 'lucide-react'
import ItemSuggestInput from '../components/ItemSuggestInput'

export default function PurchaseNew() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    bill_number: '', supplier_name: '', supplier_gstin: '', supplier_state: '', supplier_state_code: '', supplier_address: '', supplier_phone: '',
    bill_date: new Date().toISOString().split('T')[0], discount: 0, round_off: 0, notes: '', payment_status: 'Unpaid'
  })
  const [items, setItems] = useState([{ description: '', hsn_code: '', quantity: 1, unit: 'NOS', rate: 0, cgst_rate: 9, sgst_rate: 9, igst_rate: 0, amount: 0 }])
  const [saving, setSaving] = useState(false)

  const [calculated, setCalculated] = useState({ subtotal: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0 })

  const updateItem = (idx, key, val) => {
    const newItems = [...items]
    newItems[idx] = { ...newItems[idx], [key]: val }
    if (key === 'quantity' || key === 'rate') newItems[idx].amount = (parseFloat(newItems[idx].quantity) || 0) * (parseFloat(newItems[idx].rate) || 0)
    setItems(newItems)
    recalc(newItems)
  }

  const handleItemSuggest = (idx, suggested) => {
    const newItems = [...items]
    newItems[idx] = {
      ...newItems[idx],
      description: suggested.description,
      hsn_code: suggested.hsn_code || newItems[idx].hsn_code,
      unit: suggested.unit || newItems[idx].unit,
      rate: suggested.rate || newItems[idx].rate,
      cgst_rate: suggested.cgst_rate || newItems[idx].cgst_rate,
      sgst_rate: suggested.sgst_rate || newItems[idx].sgst_rate,
      igst_rate: suggested.igst_rate || newItems[idx].igst_rate,
    }
    newItems[idx].amount = (parseFloat(newItems[idx].quantity) || 0) * (parseFloat(newItems[idx].rate) || 0)
    setItems(newItems)
    recalc(newItems)
  }

  const recalc = (itemsList) => {
    const subtotal = itemsList.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
    const cgst = itemsList.reduce((s, i) => s + (parseFloat(i.amount) || 0) * (parseFloat(i.cgst_rate) || 0) / 100, 0)
    const sgst = itemsList.reduce((s, i) => s + (parseFloat(i.amount) || 0) * (parseFloat(i.sgst_rate) || 0) / 100, 0)
    const igst = itemsList.reduce((s, i) => s + (parseFloat(i.amount) || 0) * (parseFloat(i.igst_rate) || 0) / 100, 0)
    const discount = parseFloat(form.discount) || 0
    const roundOff = parseFloat(form.round_off) || 0
    setCalculated({ subtotal, cgst_amount: cgst, sgst_amount: sgst, igst_amount: igst, total_amount: subtotal + cgst + sgst + igst - discount + roundOff })
  }

  const addItem = () => setItems([...items, { description: '', hsn_code: '', quantity: 1, unit: 'NOS', rate: 0, cgst_rate: 9, sgst_rate: 9, igst_rate: 0, amount: 0 }])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.post('/purchases', {
        ...form,
        bill_date: form.bill_date || null,
        ...calculated,
        items: items.map(i => ({ ...i, quantity: parseFloat(i.quantity), rate: parseFloat(i.rate), amount: parseFloat(i.amount) }))
      })
      navigate('/app/purchases')
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/purchases')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-bold">New Purchase Bill</h1>
      </div>

      <div className="card space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div><label className="block text-sm font-medium text-white/70 mb-1">Bill Number *</label><input value={form.bill_number} onChange={e => setForm({...form, bill_number: e.target.value})} className="input-field" required /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1">Supplier Name *</label><input value={form.supplier_name} onChange={e => setForm({...form, supplier_name: e.target.value})} className="input-field" required /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1">Supplier GSTIN</label><input value={form.supplier_gstin} onChange={e => setForm({...form, supplier_gstin: e.target.value.toUpperCase(), supplier_state_code: e.target.value.substring(0,2)})} className="input-field" /></div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div><label className="block text-sm font-medium text-white/70 mb-1">Bill Date</label><input type="date" value={form.bill_date} onChange={e => setForm({...form, bill_date: e.target.value})} className="input-field" /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1">Supplier Phone</label><input value={form.supplier_phone} onChange={e => setForm({...form, supplier_phone: e.target.value})} className="input-field" /></div>
          <div><label className="block text-sm font-medium text-white/70 mb-1">Supplier Address</label><input value={form.supplier_address} onChange={e => setForm({...form, supplier_address: e.target.value})} className="input-field" /></div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold mb-3">Items</h3>
        {items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-7 gap-2 mb-2 items-end">
            <div className="col-span-2">
              <ItemSuggestInput
                value={item.description}
                onChange={(val) => updateItem(idx, 'description', val)}
                onSelect={(suggested) => handleItemSuggest(idx, suggested)}
                placeholder="Description"
                className="input-field text-sm"
              />
            </div>
            <div><input value={item.hsn_code} onChange={e => updateItem(idx, 'hsn_code', e.target.value)} list="hsn-list" className="input-field text-sm" placeholder="HSN" /><datalist id="hsn-list">{HSN_CODES.map(h => <option key={h.code} value={h.code}>{h.label}</option>)}</datalist></div>
            <div><input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="input-field text-sm" placeholder="Qty" /></div>
            <div><input type="number" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} className="input-field text-sm" placeholder="Rate" /></div>
            <div className="text-right font-medium pt-2">₹{(item.amount || 0).toFixed(2)}</div>
            <div>{items.length > 1 && <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400"><X size={16} /></button>}</div>
          </div>
        ))}
        <button onClick={addItem} className="btn-secondary text-sm mt-2 flex items-center gap-1"><Plus size={14} /> Add</button>
      </div>

      <div className="card">
        <div className="max-w-sm ml-auto space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>₹{calculated.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>CGST</span><span>₹{calculated.cgst_amount.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>SGST</span><span>₹{calculated.sgst_amount.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>IGST</span><span>₹{calculated.igst_amount.toFixed(2)}</span></div>
          <div className="flex justify-between items-center"><span>Discount</span><input type="number" value={form.discount} onChange={e => {setForm({...form, discount: e.target.value}); recalc(items)}} className="input-field w-28 text-right text-sm" /></div>
          <hr />
          <div className="flex justify-between font-bold text-base"><span>TOTAL</span><span>₹{calculated.total_amount.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={() => navigate('/app/purchases')} className="btn-secondary">Cancel</9utton>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2"><Save size={16} /> {saving ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  )
}
