import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Save, Plus, X, ArrowLeft } from 'lucide-react'

export default function InvoiceEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const orgStateCode = user?.organization?.state_code || '27'

  const [customers, setCustomers] = useState([])
  const [form, setForm] = useState({})
  const [items, setItems] = useState([])
  const [calculated, setCalculated] = useState({ subtotal: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total: 0 })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/customers'),
      api.get(`/invoices/${id}`)
    ]).then(([custRes, invRes]) => {
      setCustomers(custRes.data.customers || [])
      const inv = invRes.data.invoice
      setForm({
        customer_id: inv.customer_id,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        discount: inv.discount || 0,
        round_off: inv.round_off || 0,
        notes: inv.notes || '',
        status: inv.status,
        payment_status: inv.payment_status
      })
      setItems(invRes.data.items.length > 0 ? invRes.data.items : [{ description: '', hsn_code: '', quantity: 1, unit: 'NOS', rate: 0, cgst_rate: 9, sgst_rate: 9, igst_rate: 0, amount: 0 }])
      setCalculated({ subtotal: inv.subtotal, cgst_amount: inv.cgst_amount, sgst_amount: inv.sgst_amount, igst_amount: inv.igst_amount, total: inv.total_amount })
    }).catch(() => navigate('/app/invoices')).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (items.length === 0) return
    const customer = customers.find(c => c.id === parseInt(form.customer_id))
    const cStateCode = customer?.state_code || customer?.gstin?.substring(0, 2) || orgStateCode
    const isIntra = cStateCode === orgStateCode

    const updatedItems = items.map(item => {
      const qty = parseFloat(item.quantity) || 0
      const rate = parseFloat(item.rate) || 0
      const amount = qty * rate
      if (isIntra) {
        const taxRate = (parseFloat(item.igst_rate) || parseFloat(item.cgst_rate) * 2 || 18)
        return { ...item, cgst_rate: taxRate / 2, sgst_rate: taxRate / 2, igst_rate: 0, amount }
      } else {
        const taxRate = (parseFloat(item.cgst_rate) * 2 || parseFloat(item.igst_rate) || 18)
        return { ...item, cgst_rate: 0, sgst_rate: 0, igst_rate: taxRate, amount }
      }
    })

    const subtotal = updatedItems.reduce((s, i) => s + i.amount, 0)
    const cgst = updatedItems.reduce((s, i) => s + i.amount * i.cgst_rate / 100, 0)
    const sgst = updatedItems.reduce((s, i) => s + i.amount * i.sgst_rate / 100, 0)
    const igst = updatedItems.reduce((s, i) => s + i.amount * i.igst_rate / 100, 0)
    const discount = parseFloat(form.discount) || 0
    const roundOff = parseFloat(form.round_off) || 0
    const total = subtotal + cgst + sgst + igst - discount + roundOff

    setItems(updatedItems)
    setCalculated({ subtotal, cgst_amount: cgst, sgst_amount: sgst, igst_amount: igst, total })
  }, [form.customer_id, form.discount, form.round_off])

  const updateItem = (idx, key, val) => {
    const newItems = [...items]
    newItems[idx] = { ...newItems[idx], [key]: val }
    if (key === 'quantity' || key === 'rate') {
      newItems[idx].amount = (parseFloat(newItems[idx].quantity) || 0) * (parseFloat(newItems[idx].rate) || 0)
    }
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
    setCalculated({ subtotal, cgst_amount: cgst, sgst_amount: sgst, igst_amount: igst, total: subtotal + cgst + sgst + igst - discount + roundOff })
  }

  const addItem = () => setItems([...items, { description: '', hsn_code: '', quantity: 1, unit: 'NOS', rate: 0, cgst_rate: 9, sgst_rate: 9, igst_rate: 0, amount: 0 }])
  const removeItem = (idx) => { const n = items.filter((_, i) => i !== idx); setItems(n); recalc(n) }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/invoices/${id}/full`, {
        ...form,
        ...calculated,
        items: items.map(i => ({ ...i, quantity: parseFloat(i.quantity), rate: parseFloat(i.rate), amount: parseFloat(i.amount) }))
      })
      navigate(`/app/invoices/${id}`)
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
        <button onClick={() => navigate(`/app/invoices/${id}`)} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-bold">Edit Invoice</h1>
      </div>

      <div className="card space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <select value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})} className="input-field">
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label><input type="date" value={form.invoice_date} onChange={e => setForm({...form, invoice_date: e.target.value})} className="input-field" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label><input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} className="input-field" /></div>
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
                  <td className="py-2 pr-2"><input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="input-field text-sm" /></td>
                  <td className="py-2 pr-2"><input value={item.hsn_code} onChange={e => updateItem(idx, 'hsn_code', e.target.value)} className="input-field text-sm w-24" /></td>
                  <td className="py-2 pr-2"><input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="input-field text-sm" /></td>
                  <td className="py-2 pr-2"><select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="input-field text-sm">{['NOS','KG','MTR','SET','LOT','PCS'].map(u=><option key={u}>{u}</option>)}</select></td>
                  <td className="py-2 pr-2"><input type="number" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} className="input-field text-sm" /></td>
                  <td className="py-2 pr-2"><input type="number" value={item.igst_rate > 0 ? item.igst_rate : (item.cgst_rate + item.sgst_rate)} onChange={e => { const r = parseFloat(e.target.value)||0; const cust = customers.find(c=>c.id===parseInt(form.customer_id)); const cs = cust?.state_code||orgStateCode; if(cs===orgStateCode){updateItem(idx,'cgst_rate',r/2);updateItem(idx,'sgst_rate',r/2);updateItem(idx,'igst_rate',0)}else{updateItem(idx,'igst_rate',r);updateItem(idx,'cgst_rate',0);updateItem(idx,'sgst_rate',0)} }} className="input-field text-sm" /></td>
                  <td className="py-2 text-right font-medium">{(item.amount||0).toFixed(2)}</td>
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
          <div className="flex justify-between items-center"><span>Discount</span><input type="number" value={form.discount} onChange={e => setForm({...form, discount: e.target.value})} className="input-field w-28 text-right text-sm" /></div>
          <div className="flex justify-between items-center"><span>Round Off</span><input type="number" step="0.01" value={form.round_off} onChange={e => setForm({...form, round_off: e.target.value})} className="input-field w-28 text-right text-sm" /></div>
          <hr />
          <div className="flex justify-between text-base font-bold"><span>TOTAL</span><span>₹{calculated.total.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input-field" rows={3} />
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={() => navigate(`/app/invoices/${id}`)} className="btn-secondary">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2"><Save size={16} /> {saving ? 'Saving...' : 'Update Invoice'}</button>
      </div>
    </div>
  )
}
