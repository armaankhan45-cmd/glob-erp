import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { HSN_CODES } from '../data/hsnCodes'
import { Save, Plus, X, ArrowLeft } from 'lucide-react'

export default function PurchaseNew() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    bill_number: '', supplier_name: '', supplier_gstin: '', supplier_state: '', supplier_state_code: '', supplier_address: '', supplier_phone: '',
    bill_date: new Date().toISOString().split('T')[0], discount: 0, round_off: 0, notes: '', payment_status: 'Unpaid'
  })
  const [items, setItems] = useState([{ description: '', hsn_code: '', quantity: 1, unit: 'NOS', rate: 0, cgst_rate: 9, sgst_rate: 9, igst_rate: 0, amount: 0 }])
  const [saving, setSaving] = useState(false)
  const [calculated, setCalculated] = useState({ subtotal: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0 })

  // ═══════════════════════════════════════════
  // AUTO-FILL: Fetch previous suppliers so user can pick
  // a previous supplier and auto-fill all their details
  // ═══════════════════════════════════════════
  const [suppliers, setSuppliers] = useState([])
  const [supplierSearch, setSupplierSearch] = useState('')
  const [showSupplierList, setShowSupplierList] = useState(false)

  useEffect(() => {
    loadSuppliers()
  }, [])

  const loadSuppliers = async () => {
    try {
      const res = await api.get('/purchases')
      const purchases = res.data.purchases || res.data || []
      // Build unique supplier list from previous purchases
      const supplierMap = {}
      purchases.forEach(p => {
        const key = (p.supplier_name || '').toLowerCase().trim()
        if (key && !supplierMap[key]) {
          supplierMap[key] = {
            name: p.supplier_name,
            gstin: p.supplier_gstin || '',
            state: p.supplier_state || '',
            state_code: p.supplier_state_code || '',
            address: p.supplier_address || '',
            phone: p.supplier_phone || '',
          }
        }
      })
      setSuppliers(Object.values(supplierMap))
    } catch (e) {
      console.error('Load suppliers error:', e)
    }
  }

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    (s.gstin && s.gstin.toLowerCase().includes(supplierSearch.toLowerCase()))
  )

  const selectSupplier = (supplier) => {
    setForm({
      ...form,
      supplier_name: supplier.name,
      supplier_gstin: supplier.gstin,
      supplier_state: supplier.state,
      supplier_state_code: supplier.state_code || (supplier.gstin ? supplier.gstin.substring(0, 2) : ''),
      supplier_address: supplier.address,
      supplier_phone: supplier.phone,
    })
    setSupplierSearch('')
    setShowSupplierList(false)
  }

  const updateItem = (idx, key, val) => {
    const newItems = [...items]
    newItems[idx] = { ...newItems[idx], [key]: val }
    if (key === 'quantity' || key === 'rate') newItems[idx].amount = (parseFloat(newItems[idx].quantity) || 0) * (parseFloat(newItems[idx].rate) || 0)
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

  // Auto-detect GST type based on supplier state code
  const orgStateCode = '27' // Maharashtra
  const isInterState = form.supplier_state_code && form.supplier_state_code !== orgStateCode

  const handleGSTChange = () => {
    const newItems = items.map(item => {
      if (isInterState) {
        return { ...item, cgst_rate: 0, sgst_rate: 0, igst_rate: parseFloat(item.cgst_rate || 0) + parseFloat(item.sgst_rate || 0) || 18 }
      } else {
        const igst = parseFloat(item.igst_rate || 0)
        return { ...item, cgst_rate: igst > 0 ? igst / 2 : 9, sgst_rate: igst > 0 ? igst / 2 : 9, igst_rate: 0 }
      }
    })
    setItems(newItems)
    recalc(newItems)
  }

  // Auto-switch GST when supplier state changes
  useEffect(() => {
    if (form.supplier_state_code) {
      handleGSTChange()
    }
  }, [form.supplier_state_code])

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/purchases')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-bold">New Purchase Bill</h1>
      </div>

      {/* ═══ SUPPLIER AUTO-FILL ═══ */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-bold text-white">Supplier Details</h3>
          {suppliers.length > 0 && (
            <button onClick={() => setShowSupplierList(!showSupplierList)}
              className="btn-secondary text-xs flex items-center gap-1 btn-shine">
              <span>📋 Previous Suppliers ({suppliers.length})</span>
            </button>
          )}
        </div>

        {/* Supplier quick-pick dropdown */}
        {showSupplierList && (
          <div className="relative mb-3">
            <input
              value={supplierSearch}
              onChange={e => setSupplierSearch(e.target.value)}
              placeholder="Search previous suppliers by name or GSTIN..."
              className="input-field w-full"
              autoFocus
            />
            {filteredSuppliers.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl shadow-xl z-50 max-h-[200px] overflow-y-auto"
                style={{ background: 'rgba(12,16,32,0.98)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {filteredSuppliers.map((s, i) => (
                  <button key={i} onClick={() => selectSupplier(s)}
                    className="flex items-center justify-between w-full px-4 py-3 hover:bg-white/5 transition-colors text-sm">
                    <div>
                      <span className="font-semibold text-white">{s.name}</span>
                      {s.gstin && <span className="text-white/40 ml-2 text-xs">{s.gstin}</span>}
                    </div>
                    <span className="text-white/30 text-xs">{s.state || s.address || ''}</span>
                  </button>
                ))}
              </div>
            )}
            {filteredSuppliers.length === 0 && supplierSearch && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl p-4 text-center text-white/30 text-sm"
                style={{ background: 'rgba(12,16,32,0.98)', border: '1px solid rgba(255,255,255,0.1)' }}>
                No previous supplier found. Type details manually.
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Bill Number *</label>
            <input value={form.bill_number} onChange={e => setForm({...form, bill_number: e.target.value})} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Supplier Name *</label>
            <input value={form.supplier_name} onChange={e => setForm({...form, supplier_name: e.target.value})} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Supplier GSTIN</label>
            <input value={form.supplier_gstin} onChange={e => {
              const val = e.target.value.toUpperCase()
              setForm({...form, supplier_gstin: val, supplier_state_code: val.substring(0, 2)})
            }} className="input-field" />
            {form.supplier_state_code && (
              <span className="text-xs text-white/30 mt-1">
                State: {form.supplier_state_code} {isInterState ? '(Inter-State → IGST)' : '(Intra-State → CGST+SGST)'}
              </span>
            )}
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Bill Date</label>
            <input type="date" value={form.bill_date} onChange={e => setForm({...form, bill_date: e.target.value})} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Supplier Phone</label>
            <input value={form.supplier_phone} onChange={e => setForm({...form, supplier_phone: e.target.value})} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1">Supplier Address</label>
            <input value={form.supplier_address} onChange={e => setForm({...form, supplier_address: e.target.value})} className="input-field" />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold mb-3 text-white">Items</h3>
        {items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-7 gap-2 mb-2 items-end">
            <div className="col-span-2"><input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="input-field text-sm" placeholder="Description" /></div>
            <div><input value={item.hsn_code} onChange={e => updateItem(idx, 'hsn_code', e.target.value)} list="hsn-list" className="input-field text-sm" placeholder="HSN" /><datalist id="hsn-list">{HSN_CODES.map(h => <option key={h.code} value={h.code}>{h.label}</option>)}</datalist></div>
            <div><input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="input-field text-sm" placeholder="Qty" /></div>
            <div><input type="number" value={item.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} className="input-field text-sm" placeholder="Rate" /></div>
            <div className="text-right font-medium pt-2 text-white">₹{(item.amount || 0).toFixed(2)}</div>
            <div>{items.length > 1 && <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400"><X size={16} /></button>}</div>
          </div>
        ))}
        <button onClick={addItem} className="btn-secondary text-sm mt-2 flex items-center gap-1 btn-shine"><Plus size={14} /> Add</button>
      </div>

      <div className="card">
        <div className="max-w-sm ml-auto space-y-2 text-sm text-white">
          <div className="flex justify-between"><span>Subtotal</span><span>₹{calculated.subtotal.toFixed(2)}</span></div>
          {isInterState ? (
            <div className="flex justify-between text-red-400"><span>IGST</span><span>₹{calculated.igst_amount.toFixed(2)}</span></div>
          ) : (
            <>
              <div className="flex justify-between text-blue-400"><span>CGST</span><span>₹{calculated.cgst_amount.toFixed(2)}</span></div>
              <div className="flex justify-between text-purple-400"><span>SGST</span><span>₹{calculated.sgst_amount.toFixed(2)}</span></div>
            </>
          )}
          <div className="flex justify-between items-center"><span>Discount</span><input type="number" value={form.discount} onChange={e => {setForm({...form, discount: e.target.value}); recalc(items)}} className="input-field w-28 text-right text-sm" /></div>
          <hr className="border-white/10" />
          <div className="flex justify-between font-bold text-base"><span>TOTAL</span><span>₹{calculated.total_amount.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={() => navigate('/app/purchases')} className="btn-secondary">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 btn-shine"><Save size={16} /> {saving ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  )
}
