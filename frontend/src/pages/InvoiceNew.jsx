import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Save, Plus, X, ArrowLeft } from 'lucide-react'

const HSN_CODES = [
  { code: '7309', desc: 'Tanks, cisterns, reservoirs (iron/steel)' },
  { code: '7310', desc: 'Tanks, casks, drums (iron/steel < 300L)' },
  { code: '8709', desc: 'Special purpose motor vehicles' },
  { code: '7308', desc: 'Structures of iron/steel' },
  { code: '7610', desc: 'Aluminium structures' },
  { code: '8428', desc: 'Lifting/handling equipment' },
  { code: '7326', desc: 'Other articles of iron/steel' },
  { code: '8431', desc: 'Parts for lifting/construction machinery' },
  { code: '8429', desc: 'Self-propelled bulldozers etc' },
  { code: '6815', desc: 'Articles of other mineral substances' },
]

export default function InvoiceNew() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const orgId = user?.organization_id
  const orgStateCode = user?.organization?.state_code || '27'

  const [customers, setCustomers] = useState([])
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickCustomer, setQuickCustomer] = useState({ name: '', gstin: '', phone: '', state: 'Maharashtra', state_code: '27', address: '', city: '', pincode: '' })

  const [form, setForm] = useState({
    customer_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30*86400000).toISOString().split('T')[0],
    discount: 0,
    round_off: 0,
    notes: 'Terms: Payment due within 30 days.',
    status: 'Pending',
    payment_status: 'Unpaid'
  })

  const [items, setItems] = useState([{ description: '', hsn_code: '', quantity: 1, unit: 'NOS', rate: 0, cgst_rate: 9, sgst_rate: 9, igst_rate: 0, amount: 0 }])
  const [manualOverride, setManualOverride] = useState({ cgst: false, sgst: false, igst: false, total: false })
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
    const cgst = manualOverride.cgst ? calculated.cgst_amount : updatedItems.reduce((s, i) => s + i.amount * i.cgst_rate / 100, 0)
    const sgst = manualOverride.sgst ? calculated.sgst_amount : updatedItems.reduce((s, i) => s + i.amount * i.sgst_rate / 100, 0)
    const igst = manualOverride.igst ? calculated.igst_amount : updatedItems.reduce((s, i) => s + i.amount * i.igst_rate / 100, 0)
    const discount = parseFloat(form.discount) || 0
    const roundOff = parseFloat(form.round_off) || 0
    const total = manualOverride.total ? calculated.total_amount : subtotal + cgst + sgst + igst - discount + roundOff

    setCalculated({ subtotal, cgst_amount: cgst, sgst_amount: sgst, igst_amount: igst, total_amount: total })
  }, [items, form.customer_id, form.discount, form.round_off, customers])

  const updateItem = (idx, key, val) => {
    const newItems = [...items]
    newItems[idx] = { ...newItems[idx], [key]: val }
    setItems(newItems)
  }

  const addItem = () => setItems([...items, { description: '', hsn_code: '', quantity: 1, unit: 'NOS', rate: 0, cgst_rate: 9, sgst_rate: 9, igst_rate: 0, amount: 0 }])
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx))

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.post('/invoices', {
        ...form,
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
        <div className="grid md:grid-cols-3 gap-4">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="input-field" />
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
                  <td className="py-2 pr-2"><input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="input-field text-sm" placeholder="Item description" list="hsn-list" /></td>
                  <td className="py-2 pr-2"><input value={item.hsn_code} onChange={e => updateItem(idx, 'hsn_code', e.target.value)} className="input-field text-sm w-24" placeholder="7309" /></td>
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
        <datalist id="hsn-list">{HSN_CODES.map(h => <option key={h.code} value={h.code}>{h.desc}</option>)}</datalist>
      </div>

      {/* Totals */}
      <div className="card">
        <div className="max-w-sm ml-auto space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span className="font-medium">₹{calculated.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>CGST</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">₹{calculated.cgst_amount.toFixed(2)}</span>
              {manualOverride.cgst && <button onClick={() => setManualOverride({...manualOverride, cgst: false})} className="text-xs text-primary-600">Reset</button>}
            </div>
          </div>
          <div className="flex justify-between"><span>SGST</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">₹{calculated.sgst_amount.toFixed(2)}</span>
              {manualOverride.sgst && <button onClick={() => setManualOverride({...manualOverride, sgst: false})} className="text-xs text-primary-600">Reset</button>}
            </div>
          </div>
          <div className="flex justify-between"><span>IGST</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">₹{calculated.igst_amount.toFixed(2)}</span>
              {manualOverride.igst && <button onClick={() => setManualOverride({...manualOverride, igst: false})} className="text-xs text-primary-600">Reset</button>}
            </div>
          </div>
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
              <input value={quickCustomer.name} onChange={e => setQuickCustomer({...quickCustomer, name: e.target.value})} className="input-field" placeholder="Customer Name *" />
              <input value={quickCustomer.gstin} onChange={e => setQuickCustomer({...quickCustomer, gstin: e.target.value})} className="input-field" placeholder="GSTIN" />
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
