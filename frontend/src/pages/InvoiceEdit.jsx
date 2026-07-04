import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { findHSN } from '../data/hsnCodes'
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

export default function InvoiceEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [selectedCust, setSelectedCust] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })
  const COMPANY_STATE = '27'
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [discount, setDiscount] = useState('')
  const [roundOff, setRoundOff] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('Pending')
  const [paymentStatus, setPaymentStatus] = useState('Unpaid')
  const [items, setItems] = useState([])
  const [manualCgst, setManualCgst] = useState('')
  const [manualSgst, setManualSgst] = useState('')
  const [manualIgst, setManualIgst] = useState('')
  const [manualTotal, setManualTotal] = useState('')

  useEffect(function () {
    async function loadAll() {
      try {
        const custRes = await api.get('/customers')
        const invRes = await api.get('/invoices/' + id)
        setCustomers(custRes.data.customers || [])
        if (invRes.data.success) {
          const inv = invRes.data.invoice
          const itms = invRes.data.items || []
          setInvoiceNumber(inv.invoice_number || '')
          setCustomerId(String(inv.customer_id || ''))
          setInvoiceDate(inv.invoice_date || '')
          setDueDate(inv.due_date || '')
          setDiscount(inv.discount != null && inv.discount !== 0 ? String(inv.discount) : '')
          setRoundOff(inv.round_off != null && inv.round_off !== 0 ? String(inv.round_off) : '')
          setNotes(inv.notes || '')
          setStatus(inv.status || 'Pending')
          setPaymentStatus(inv.payment_status || 'Unpaid')
          setItems(itms.map(function (it) {
            let tr = '18'
            const cgst = parseFloat(it.cgst_rate) || 0
            const igst = parseFloat(it.igst_rate) || 0
            if (cgst > 0) tr = String(cgst * 2)
            else if (igst > 0) tr = String(igst)
            return {
              description: it.description || '',
              hsn_code: it.hsn_code || '',
              quantity: String(it.quantity || ''),
              unit: it.unit || 'NOS',
              rate: String(it.rate || ''),
              tax_rate: tr
            }
          }))
        }
      } catch (e) { setMessage({ type: 'error', text: 'Failed to load invoice' }) }
      finally { setPageLoading(false) }
    }
    loadAll()
  }, [id])

  useEffect(function () {
    if (customerId && customers.length) {
      const c = customers.find(function (x) { return String(x.id) === String(customerId) })
      setSelectedCust(c || null)
    } else { setSelectedCust(null) }
  }, [customerId, customers])

  const isIntraState = selectedCust ? (selectedCust.state_code || (selectedCust.gstin ? selectedCust.gstin.substring(0, 2) : '27')) === COMPANY_STATE : true

  function addItem() { setItems(function (p) { return [...p, { description: '', hsn_code: '7308', quantity: '1', unit: 'NOS', rate: '', tax_rate: '18' }] }) }
  function removeItem(i) { setItems(function (p) { if (p.length === 1) return p; return p.filter(function (_, x) { return x !== i }) }) }

  function updateItem(idx, field, val) {
    setItems(function (p) {
      const n = [...p]
      n[idx] = { ...n[idx], [field]: val }
      if (field === 'description') {
        const autoHSN = findHSN(val)
        if (autoHSN) n[idx].hsn_code = autoHSN
      }
      return n
    })
  }

  function calc() {
    let sub = 0, autoCgst = 0, autoSgst = 0, autoIgst = 0
    items.forEach(function (it) {
      const qty = parseFloat(it.quantity) || 0
      const rate = parseFloat(it.rate) || 0
      const tr = parseFloat(it.tax_rate) || 0
      const tx = qty * rate
      sub += tx
      if (isIntraState) { autoCgst += (tx * tr / 2) / 100; autoSgst += (tx * tr / 2) / 100 }
      else { autoIgst += (tx * tr) / 100 }
    })
    const d = parseFloat(discount) || 0
    const ro = parseFloat(roundOff) || 0
    const cgst = manualCgst !== '' ? parseFloat(manualCgst) || 0 : autoCgst
    const sgst = manualSgst !== '' ? parseFloat(manualSgst) || 0 : autoSgst
    const igst = manualIgst !== '' ? parseFloat(manualIgst) || 0 : autoIgst
    let total = sub + cgst + sgst + igst - d + ro
    if (manualTotal !== '') total = parseFloat(manualTotal) || 0
    return { sub, cgst, sgst, igst, total, autoCgst, autoSgst, autoIgst }
  }
  const t = calc()

  async function submit(e) {
    e.preventDefault()
    if (!invoiceNumber.trim()) return setMessage({ type: 'error', text: 'Invoice number required' })
    if (!customerId) return setMessage({ type: 'error', text: 'Select customer' })
    const valid = items.filter(function (it) { return it.description && it.quantity && it.rate })
    if (valid.length === 0) return setMessage({ type: 'error', text: 'Add at least one item' })
    setLoading(true)
    try {
      await api.put('/invoices/' + id + '/full', {
        invoice_number: invoiceNumber, customer_id: customerId, invoice_date: invoiceDate, due_date: dueDate,
        status: status, payment_status: paymentStatus,
        items: valid.map(function (it) {
          var tr = parseFloat(it.tax_rate) || 0
          var itemData = {
            description: it.description, hsn_code: it.hsn_code, quantity: parseFloat(it.quantity) || 0,
            unit: it.unit, rate: parseFloat(it.rate) || 0,
            amount: (parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0)
          }
          if (isIntraState) {
            itemData.cgst_rate = tr / 2; itemData.sgst_rate = tr / 2; itemData.igst_rate = 0
          } else {
            itemData.cgst_rate = 0; itemData.sgst_rate = 0; itemData.igst_rate = tr
          }
          return itemData
        }),
        subtotal: t.sub, cgst_amount: t.cgst, sgst_amount: t.sgst, igst_amount: t.igst, total_amount: t.total,
        discount: parseFloat(discount) || 0, round_off: parseFloat(roundOff) || 0, notes: notes,
        manual_cgst: manualCgst !== '' ? parseFloat(manualCgst) : null,
        manual_sgst: manualSgst !== '' ? parseFloat(manualSgst) : null,
        manual_igst: manualIgst !== '' ? parseFloat(manualIgst) : null,
        manual_total: manualTotal !== '' ? parseFloat(manualTotal) : null
      })
      setMessage({ type: 'success', text: 'Invoice updated!' })
      setTimeout(function () { navigate('/app/invoices/' + id) }, 800)
    } catch (err) { setMessage({ type: 'error', text: err.response?.data?.msg || 'Failed' }); setLoading(false) }
  }

  if (pageLoading) return (<div className="flex items-center justify-center h-96"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={function () { navigate('/app/invoices/' + id) }} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white"><ArrowLeft size={16} /></button>
        <div><h1 className="text-2xl font-bold text-white">Edit Invoice</h1><p className="text-slate-400 text-sm">Modify invoice details</p></div>
      </div>

      {message.text && (
        <div className={"p-4 rounded-xl flex items-center gap-2 text-sm font-semibold " + (message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400')}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}{message.text}
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-4">Invoice Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Invoice Number *</label><input type="text" value={invoiceNumber} onChange={function (e) { setInvoiceNumber(e.target.value) }} required className="w-full px-3 py-2.5 rounded-xl text-sm font-mono font-bold bg-slate-800/80 border border-slate-600 text-white placeholder-slate-500" autoComplete="off" /></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Customer *</label><select value={customerId} onChange={function (e) { setCustomerId(e.target.value) }} required className="w-full px-3 py-2.5 rounded-xl text-sm"><option value="">Select Customer</option>{customers.map(function (c) { return <option key={c.id} value={c.id}>{c.name}</option> })}</select></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Invoice Date *</label><input type="date" value={invoiceDate} onChange={function (e) { setInvoiceDate(e.target.value) }} required className="w-full px-3 py-2.5 rounded-xl text-sm" /></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Due Date</label><input type="date" value={dueDate} onChange={function (e) { setDueDate(e.target.value) }} className="w-full px-3 py-2.5 rounded-xl text-sm" /></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Status</label><select value={status} onChange={function (e) { setStatus(e.target.value) }} className="w-full px-3 py-2.5 rounded-xl text-sm"><option>Pending</option><option>Completed</option><option>Cancelled</option></select></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Payment Status</label><select value={paymentStatus} onChange={function (e) { setPaymentStatus(e.target.value) }} className="w-full px-3 py-2.5 rounded-xl text-sm"><option>Unpaid</option><option>Partial</option><option>Paid</option></select></div>
          </div>
          {selectedCust && (<div className={"mt-4 p-3 rounded-xl flex items-center gap-2 text-sm " + (isIntraState ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400' : 'bg-purple-500/10 border border-purple-500/30 text-purple-400')}><Info size={16} />{isIntraState ? <span><strong>Intra-State:</strong> CGST + SGST</span> : <span><strong>Inter-State:</strong> IGST</span>}</div>)}
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold text-white">Items</h3><button type="button" onClick={addItem} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1"><Plus size={14} />Add Item</button></div>
          <div className="space-y-3">
            {items.map(function (item, idx) {
              const qty = parseFloat(item.quantity) || 0; const rate = parseFloat(item.rate) || 0; const tr = parseFloat(item.tax_rate) || 0; const taxable = qty * rate; const total = taxable + (taxable * tr / 100)
              return (
                <div key={idx} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-3"><span className="text-xs font-bold text-blue-400">Item #{idx + 1}</span><button type="button" onClick={function () { removeItem(idx) }} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded"><Trash2 size={14} /></button></div>
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-12 md:col-span-3"><label className="block text-xs text-slate-400 mb-1">Description *</label><input type="text" value={item.description} onChange={function (e) { updateItem(idx, 'description', e.target.value) }} className="w-full px-3 py-2 rounded-lg text-sm bg-slate-800/80 border border-slate-600 text-white placeholder-slate-500" autoComplete="off" /></div>
                    <div className="col-span-6 md:col-span-2"><label className="block text-xs text-slate-400 mb-1">HSN</label><input type="text" value={item.hsn_code} onChange={function (e) { updateItem(idx, 'hsn_code', e.target.value) }} className="w-full px-2 py-2 rounded-lg text-sm font-mono bg-slate-800/80 border border-slate-600 text-white" autoComplete="off" /></div>
                    <div className="col-span-3 md:col-span-1"><label className="block text-xs text-slate-400 mb-1">Qty *</label><input type="text" inputMode="decimal" value={item.quantity} onChange={function (e) { updateItem(idx, 'quantity', e.target.value) }} className="w-full px-2 py-2 rounded-lg text-sm" autoComplete="off" /></div>
                    <div className="col-span-3 md:col-span-1"><label className="block text-xs text-slate-400 mb-1">Unit</label><select value={item.unit} onChange={function (e) { updateItem(idx, 'unit', e.target.value) }} className="w-full px-2 py-2 rounded-lg text-sm">{UNITS.map(function (u) { return <option key={u}>{u}</option> })}</select></div>
                    <div className="col-span-6 md:col-span-2"><label className="block text-xs text-slate-400 mb-1">Rate *</label><input type="text" inputMode="decimal" value={item.rate} onChange={function (e) { updateItem(idx, 'rate', e.target.value) }} className="w-full px-3 py-2 rounded-lg text-sm bg-slate-800/80 border border-slate-600 text-white placeholder-slate-500" autoComplete="off" /></div>
                    <div className="col-span-6 md:col-span-1"><label className="block text-xs text-slate-400 mb-1">GST %</label><select value={item.tax_rate} onChange={function (e) { updateItem(idx, 'tax_rate', e.target.value) }} className="w-full px-2 py-2 rounded-lg text-sm font-bold bg-slate-800/80 border border-slate-600 text-white">{GST_SLABS.map(function (s) { return <option key={s.value} value={s.value}>{s.value}%</option> })}</select></div>
                    <div className="col-span-12 md:col-span-2"><label className="block text-xs text-slate-400 mb-1">Total (incl.GST)</label><div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm font-bold text-emerald-400 text-right">Rs.{total.toFixed(2)}</div></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-1">Adjustments</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Discount (Rs.) - subtracted</label><input type="text" inputMode="decimal" value={discount} onChange={function (e) { setDiscount(e.target.value) }} placeholder="0" className="w-full px-3 py-2.5 rounded-xl text-sm" autoComplete="off" /></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1.5">Round Off (Rs.) - use negative to reduce</label><input type="text" inputMode="decimal" value={roundOff} onChange={function (e) { setRoundOff(e.target.value) }} placeholder="e.g. 0.50 or -0.50" className="w-full px-3 py-2.5 rounded-xl text-sm" autoComplete="off" /></div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-4">Notes & Terms</h3>
          <textarea value={notes} onChange={function (e) { setNotes(e.target.value) }} rows="4" className="w-full px-3 py-2.5 rounded-xl text-sm" placeholder="Type notes and terms here..." />
        </div>

        <div className="bg-gradient-to-r from-amber-600/20 via-orange-500/20 to-red-500/20 border-2 border-amber-500/30 rounded-2xl p-6">
          <div className="text-xs text-amber-400 font-bold mb-3 text-center">Auto-calculated from items. Type in any field below to manually override.</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div><div className="text-xs text-slate-400 font-bold mb-1">SUBTOTAL</div><div className="text-xl font-black text-white">Rs.{t.sub.toFixed(2)}</div></div>
            {isIntraState ? (
              <>
                <div><div className="text-xs text-slate-400 font-bold mb-1">CGST <span className="text-emerald-400 text-xs">(editable)</span></div><input type="text" inputMode="decimal" value={manualCgst} onChange={function (e) { setManualCgst(e.target.value) }} placeholder={t.autoCgst.toFixed(2)} className="w-full px-2 py-1.5 rounded-lg text-sm font-bold text-cyan-400 bg-slate-800 text-center border border-cyan-500/30" autoComplete="off" /><div className="text-xs text-slate-500 mt-1">Auto: {t.autoCgst.toFixed(2)}</div></div>
                <div><div className="text-xs text-slate-400 font-bold mb-1">SGST <span className="text-emerald-400 text-xs">(editable)</span></div><input type="text" inputMode="decimal" value={manualSgst} onChange={function (e) { setManualSgst(e.target.value) }} placeholder={t.autoSgst.toFixed(2)} className="w-full px-2 py-1.5 rounded-lg text-sm font-bold text-blue-400 bg-slate-800 text-center border border-blue-500/30" autoComplete="off" /><div className="text-xs text-slate-500 mt-1">Auto: {t.autoSgst.toFixed(2)}</div></div>
                <div><div className="text-xs text-slate-400 font-bold mb-1">TOTAL TAX</div><div className="text-xl font-black text-purple-400">Rs.{(t.cgst + t.sgst).toFixed(2)}</div></div>
              </>
            ) : (
              <div className="md:col-span-3"><div className="text-xs text-slate-400 font-bold mb-1">IGST <span className="text-emerald-400 text-xs">(editable)</span></div><input type="text" inputMode="decimal" value={manualIgst} onChange={function (e) { setManualIgst(e.target.value) }} placeholder={t.autoIgst.toFixed(2)} className="w-full px-3 py-1.5 rounded-lg text-sm font-bold text-purple-400 bg-slate-800 text-center border border-purple-500/30" autoComplete="off" /><div className="text-xs text-slate-500 mt-1">Auto: {t.autoIgst.toFixed(2)}</div></div>
            )}
            <div className="bg-emerald-500/20 rounded-xl p-3 border border-emerald-500/40">
              <div className="text-xs text-emerald-300 font-bold mb-1">GRAND TOTAL <span className="text-amber-400">(editable)</span></div>
              <input type="text" inputMode="decimal" value={manualTotal} onChange={function (e) { setManualTotal(e.target.value) }} placeholder={t.total.toFixed(2)} className="w-full px-2 py-1.5 rounded-lg text-lg font-black text-emerald-400 bg-slate-900 text-center border border-emerald-500/30" autoComplete="off" />
              {(parseFloat(discount) || 0) > 0 && <div className="text-xs text-red-400 mt-1">Disc:-{(parseFloat(discount) || 0).toFixed(2)}</div>}
              {(parseFloat(roundOff) || 0) !== 0 && <div className="text-xs text-amber-400">{(parseFloat(roundOff) || 0) > 0 ? '+' : ''}{(parseFloat(roundOff) || 0).toFixed(2)} r/o</div>}
              {(manualCgst || manualSgst || manualIgst || manualTotal) && <button type="button" onClick={function () { setManualCgst(''); setManualSgst(''); setManualIgst(''); setManualTotal('') }} className="text-xs text-red-400 mt-1 underline">Reset to Auto</button>}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={function () { navigate('/app/invoices/' + id) }} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl text-sm font-bold">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 bg-gradient-to-r from-amber-600 to-orange-500 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">{loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{loading ? 'Updating...' : 'Update Invoice'}</button>
        </div>
      </form>
    </div>
  )
}
