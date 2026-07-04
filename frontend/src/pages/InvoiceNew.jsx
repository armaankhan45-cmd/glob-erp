import { useState, useEffect } from 'react'
import { findHSN } from '../data/hsnCodes'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2, Loader2, CheckCircle, AlertCircle, Info } from 'lucide-react'
import api from '../api/client'

const GST_SLABS = [{ value: '0', label: '0%' }, { value: '5', label: '5%' }, { value: '12', label: '12%' }, { value: '18', label: '18%' }, { value: '28', label: '28%' }]
const UNITS = ['NOS', 'KG', 'PCS', 'MTR', 'SET', 'BOX', 'LTR', 'TON', 'BAG', 'SQM']

export default function InvoiceNew() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [customers, setCustomers] = useState([])
  const [selectedCust, setSelectedCust] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const COMPANY_STATE = '27'
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [customerId, setCustomerId] = useState(params.get('customer') || '')
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
  const [items, setItems] = useState([{ description: '', hsn_code: '7308', quantity: '1', unit: 'NOS', rate: '', tax_rate: '18' }])

  useEffect(() => { loadCustomers(); genNumber() }, [])
  useEffect(() => { if (customerId && customers.length) { const c = customers.find(x => String(x.id) === String(customerId)); setSelectedCust(c || null) } else { setSelectedCust(null) } }, [customerId, customers])

  const loadCustomers = async () => { try { const r = await api.get('/customers'); setCustomers(r.data.customers || []) } catch (e) { } }

  // ═══ FORMAT: 26270014 → next 26270015 ═══
  const genNumber = async () => {
    try {
      const r = await api.get('/invoices/next-number')
      if (r.data && r.data.success && r.data.nextNumber) {
        setInvoiceNumber(r.data.nextNumber)
        return
      }
    } catch (e) { }
    // Fallback: generate locally
    try {
      const r = await api.get('/invoices')
      const all = r.data.invoices || []
      const now = new Date(); const m = now.getMonth(); const y = now.getFullYear()
      const fyStart = m >= 3 ? y : y - 1
      const prefix = String(fyStart % 100) + String((fyStart + 1) % 100)
      let maxSeq = 0
      all.forEach(inv => { if (inv.invoice_number && inv.invoice_number.startsWith(prefix)) { const s = parseInt(inv.invoice_number.substring(prefix.length)); if (!isNaN(s) && s > maxSeq) maxSeq = s } })
      setInvoiceNumber(prefix + String(maxSeq + 1).padStart(4, '0'))
    } catch (e2) { }
  }

  const isIntraState = selectedCust ? (selectedCust.state_code || (selectedCust.gstin ? selectedCust.gstin.substring(0, 2) : '27')) === COMPANY_STATE : true
  const addItem = () => setItems(prev => [...prev, { description: '', hsn_code: '7308', quantity: '1', unit: 'NOS', rate: '', tax_rate: '18' }])
  const removeItem = (i) => setItems(prev => prev.length === 1 ? prev : prev.filter((_, x) => x !== i))
  const updateItem = (index, field, value) => { setItems(prev => { const n = [...prev]; n[index] = { ...n[index], [field]: value }; if (field === 'description') { const h = findHSN(value); if (h) n[index].hsn_code = h } return n }) }

  const calc = () => {
    let sub = 0, cgst = 0, sgst = 0, igst = 0
    items.forEach(it => { const qty = parseFloat(it.quantity) || 0; const rate = parseFloat(it.rate) || 0; const tr = parseFloat(it.tax_rate) || 0; const tx = qty * rate; sub += tx; if (isIntraState) { cgst += (tx * tr / 2) / 100; sgst += (tx * tr / 2) / 100 } else { igst += (tx * tr) / 100 } })
    const d = parseFloat(discount) || 0; const ro = parseFloat(roundOff) || 0
    if (manualCgst !== '') cgst = parseFloat(manualCgst) || 0; if (manualSgst !== '') sgst = parseFloat(manualSgst) || 0; if (manualIgst !== '') igst = parseFloat(manualIgst) || 0
    let total = sub + cgst + sgst + igst - d + ro; if (manualTotal !== '') total = parseFloat(manualTotal) || 0
    return { sub, cgst, sgst, igst, total }
  }
  const t = calc()

  const submit = async (e) => {
    e.preventDefault()
    if (!invoiceNumber.trim()) return setMessage({ type: 'error', text: 'Invoice number required' })
    if (!customerId) return setMessage({ type: 'error', text: 'Select customer' })
    const valid = items.filter(it => it.description && it.quantity && it.rate)
    if (valid.length === 0) return setMessage({ type: 'error', text: 'Add at least one item' })
    setLoading(true)
    try {
      const dbItems = valid.map(it => { const tr = parseFloat(it.tax_rate) || 0; const itemData = { description: it.description, hsn_code: it.hsn_code, quantity: parseFloat(it.quantity) || 0, unit: it.unit, rate: parseFloat(it.rate) || 0, amount: (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0) }; if (isIntraState) { itemData.cgst_rate = tr / 2; itemData.sgst_rate = tr / 2; itemData.igst_rate = 0 } else { itemData.cgst_rate = 0; itemData.sgst_rate = 0; itemData.igst_rate = tr } return itemData })
      await api.post('/invoices', { invoice_number: invoiceNumber, customer_id: customerId, invoice_date: invoiceDate, due_date: dueDate, items: dbItems, subtotal: t.sub, cgst_amount: t.cgst, sgst_amount: t.sgst, igst_amount: t.igst, total_amount: t.total, discount: parseFloat(discount) || 0, round_off: parseFloat(roundOff) || 0, notes: (notes ? notes + '\n' : '') + (terms || '') })
      setMessage({ type: 'success', text: 'Invoice created! Redirecting...' })
      setTimeout(() => navigate('/app/invoices'), 800)
    } catch (err) { setMessage({ type: 'error', text: err.response?.data?.msg || 'Failed' }); setLoading(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/invoices')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white"><ArrowLeft size={16} /></button>
        <div><h1 className="text-2xl font-bold text-white">Create New Invoice</h1><p className="text-slate-400 text-sm">Fill details and save</p></div>
      </div>
      {message.text && (<div className={"p-4 rounded-xl flex items-center gap-2 text-sm font-semibold " + (message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400')}>{message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}{message.text}</div>)}
      <form onSubmit={submit} className="space-y-5">
        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-4">Invoice Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Invoice Number * <span className="text-emerald-400">(Editable)</span></label><input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required className="w-full px-3 py-2.5 rounded-xl text-sm font-mono font-bold bg-slate-800/80 border border-slate-600 text-white placeholder-slate-500" autoComplete="off" /><p className="text-[10px] text-slate-500 mt-1">Format: 26270014 → next will be 26270015</p></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Customer *</label><div className="flex gap-2"><select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-slate-800/80 border border-slate-600 text-white"><option value="">Select Customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.state ? ' (' + c.state + ')' : ''}</option>)}</select><button type="button" onClick={() => navigate('/app/customers/new')} className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold">+ New</button></div></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Invoice Date *</label><input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-800/80 border border-slate-600 text-white [color-scheme:dark]" /></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Due Date</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-800/80 border border-slate-600 text-white [color-scheme:dark]" /></div>
          </div>
          {selectedCust && (<div className={"mt-4 p-3 rounded-xl flex items-center gap-2 text-sm " + (isIntraState ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400' : 'bg-purple-500/10 border border-purple-500/30 text-purple-400')}><Info size={16} />{isIntraState ? <span><strong>Intra-State:</strong> CGST + SGST</span> : <span><strong>Inter-State:</strong> IGST</span>}</div>)}
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold text-white">Items</h3><button type="button" onClick={addItem} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1"><Plus size={14} />Add Item</button></div>
          <div className="space-y-3">{items.map((item, idx) => { const qty = parseFloat(item.quantity) || 0; const rate = parseFloat(item.rate) || 0; const tr = parseFloat(item.tax_rate) || 0; const taxable = qty * rate; const total = taxable + (taxable * tr / 100); return (<div key={idx} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700"><div className="flex items-center justify-between mb-3"><span className="text-xs font-bold text-blue-400">Item #{idx + 1}</span><button type="button" onClick={() => removeItem(idx)} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded"><Trash2 size={14} /></button></div><div className="grid grid-cols-12 gap-2"><div className="col-span-12 md:col-span-3"><label className="block text-xs text-slate-400 mb-1">Description *</label><input type="text" value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} placeholder="Steel Structure" className="w-full px-3 py-2 rounded-lg text-sm bg-slate-800/80 border border-slate-600 text-white placeholder-slate-500" autoComplete="off" /></div><div className="col-span-6 md:col-span-2"><label className="block text-xs text-slate-400 mb-1">HSN</label><input type="text" value={item.hsn_code} onChange={(e) => updateItem(idx, 'hsn_code', e.target.value)} className="w-full px-2 py-2 rounded-lg text-sm font-mono bg-slate-800/80 border border-slate-600 text-white" autoComplete="off" /></div><div className="col-span-3 md:col-span-1"><label className="block text-xs text-slate-400 mb-1">Qty *</label><input type="text" inputMode="decimal" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className="w-full px-2 py-2 rounded-lg text-sm bg-slate-800/80 border border-slate-600 text-white" autoComplete="off" /></div><div className="col-span-3 md:col-span-1"><label className="block text-xs text-slate-400 mb-1">Unit</label><select value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} className="w-full px-2 py-2 rounded-lg text-sm bg-slate-800/80 border border-slate-600 text-white">{UNITS.map(u => <option key={u}>{u}</option>)}</select></div><div className="col-span-6 md:col-span-2"><label className="block text-xs text-slate-400 mb-1">Rate *</label><input type="text" inputMode="decimal" value={item.rate} onChange={(e) => updateItem(idx, 'rate', e.target.value)} placeholder="2500" className="w-full px-3 py-2 rounded-lg text-sm bg-slate-800/80 border border-slate-600 text-white placeholder-slate-500" autoComplete="off" /></div><div className="col-span-6 md:col-span-1"><label className="block text-xs text-slate-400 mb-1">GST %</label><select value={item.tax_rate} onChange={(e) => updateItem(idx, 'tax_rate', e.target.value)} className="w-full px-2 py-2 rounded-lg text-sm font-bold bg-slate-800/80 border border-slate-600 text-white">{GST_SLABS.map(s => <option key={s.value} value={s.value}>{s.value}%</option>)}</select></div><div className="col-span-12 md:col-span-2"><label className="block text-xs text-slate-400 mb-1">Total</label><div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm font-bold text-emerald-400 text-right">Rs.{total.toFixed(2)}</div></div></div></div>) })}</div>
        </div>
        <div className="glass rounded-2xl p-5"><h3 className="text-sm font-bold text-white mb-4">Adjustments</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Discount (Rs.)</label><input type="text" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-800/80 border border-slate-600 text-white placeholder-slate-500" autoComplete="off" /></div><div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Round Off (Rs.)</label><input type="text" inputMode="decimal" value={roundOff} onChange={(e) => setRoundOff(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-800/80 border border-slate-600 text-white placeholder-slate-500" autoComplete="off" /></div></div></div>
        <div className="glass rounded-2xl p-5"><h3 className="text-sm font-bold text-white mb-4">Notes</h3><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="2" className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-800/80 border border-slate-600 text-white placeholder-slate-500" placeholder="Any notes..." /></div>
        <div className="glass rounded-2xl p-5"><h3 className="text-sm font-bold text-white mb-4">Terms and Conditions</h3><textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows="5" className="w-full px-3 py-2.5 rounded-xl text-sm bg-slate-800/80 border border-slate-600 text-white placeholder-slate-500" placeholder="Type your terms and conditions here..." /></div>
        <div className="bg-gradient-to-r from-blue-600/20 via-cyan-500/20 to-emerald-500/20 border-2 border-blue-500/30 rounded-2xl p-6">
          <div className="text-xs text-amber-400 font-bold mb-3 text-center">Auto-calculated. Type in any field to manually override.</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            <div><div className="text-xs text-slate-400 font-bold mb-1">SUBTOTAL</div><div className="text-lg font-black text-white">Rs.{t.sub.toFixed(2)}</div></div>
            {isIntraState ? (<><div><div className="text-xs text-slate-400 font-bold mb-1">CGST <span className="text-emerald-400">(edit)</span></div><input type="text" inputMode="decimal" value={manualCgst} onChange={(e) => setManualCgst(e.target.value)} placeholder={t.cgst.toFixed(2)} className="w-full px-2 py-1.5 rounded-lg text-sm font-bold text-cyan-400 bg-slate-800 text-center border border-slate-600" autoComplete="off" /></div><div><div className="text-xs text-slate-400 font-bold mb-1">SGST <span className="text-emerald-400">(edit)</span></div><input type="text" inputMode="decimal" value={manualSgst} onChange={(e) => setManualSgst(e.target.value)} placeholder={t.sgst.toFixed(2)} className="w-full px-2 py-1.5 rounded-lg text-sm font-bold text-blue-400 bg-slate-800 text-center border border-slate-600" autoComplete="off" /></div><div><div className="text-xs text-slate-400 font-bold mb-1">TOTAL TAX</div><div className="text-lg font-black text-purple-400">Rs.{(t.cgst + t.sgst).toFixed(2)}</div></div></>) : (<div className="md:col-span-3"><div className="text-xs text-slate-400 font-bold mb-1">IGST <span className="text-emerald-400">(edit)</span></div><input type="text" inputMode="decimal" value={manualIgst} onChange={(e) => setManualIgst(e.target.value)} placeholder={t.igst.toFixed(2)} className="w-full px-3 py-1.5 rounded-lg text-sm font-bold text-purple-400 bg-slate-800 text-center border border-slate-600" autoComplete="off" /></div>)}
            <div className="bg-emerald-500/20 rounded-xl p-2 border border-emerald-500/40"><div className="text-xs text-emerald-300 font-bold mb-1">GRAND TOTAL <span className="text-amber-400">(edit)</span></div><input type="text" inputMode="decimal" value={manualTotal} onChange={(e) => setManualTotal(e.target.value)} placeholder={t.total.toFixed(2)} className="w-full px-2 py-1.5 rounded-lg text-lg font-black text-emerald-400 bg-slate-900 text-center border border-slate-600" autoComplete="off" /></div>
          </div>
        </div>
        <div className="flex gap-3"><button type="button" onClick={() => navigate('/app/invoices')} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl text-sm font-bold">Cancel</button><button type="submit" disabled={loading} className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:shadow-lg text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">{loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{loading ? 'Saving...' : 'Save Invoice'}</button></div>
      </form>
    </div>
  )
}
