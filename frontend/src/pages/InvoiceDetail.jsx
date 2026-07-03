import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Trash2, User, Calendar, Printer, Edit, AlertCircle, Eye, Share2, MessageCircle, Mail } from 'lucide-react'
import api from '../api/client'
import TemplateSelector from '../components/TemplateSelector'
import BoldToggle from '../components/BoldToggle'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    const numId = parseInt(id)
    if (!id || isNaN(numId) || numId <= 0) {
      setError('Invalid invoice ID')
      setLoading(false)
      return
    }
    load(numId)
  }, [id])

  const load = async (invoiceId) => {
    setLoading(true)
    setError('')
    try {
      const r = await api.get('/invoices/' + invoiceId)
      if (r.data && r.data.success) setData(r.data)
      else setError(r.data?.msg || 'Not found')
    } catch (e) {
      if (e.response?.status === 404) setError('Invoice not found')
      else if (e.response?.status === 401) navigate('/login')
      else setError('Failed: ' + (e.response?.data?.msg || e.message))
    } finally { setLoading(false) }
  }

  const del = async () => {
    if (!confirm('Delete?')) return
    try { await api.delete('/invoices/' + id); navigate('/app/invoices') } catch (e) { alert('Failed') }
  }

  const updateStatus = async (payment_status) => {
    try { await api.put('/invoices/' + id, { status: data.invoice.status, payment_status }); load(parseInt(id)) } catch (e) { alert('Failed') }
  }

  const handleAction = async (action) => {
    setActionLoading(action)
    try {
      if (action === 'download') {
        const token = localStorage.getItem('token')
        window.open(`${api.defaults.baseURL}/invoices/${id}/pdf?token=${token}`, '_blank')
      } else if (action === 'print') {
        const token = localStorage.getItem('token')
        const printWin = window.open(`${api.defaults.baseURL}/invoices/${id}/pdf?token=${token}`, '_blank')
        if (printWin) printWin.onload = () => printWin.print()
      } else if (action === 'preview') {
        const token = localStorage.getItem('token')
        window.open(`${api.defaults.baseURL}/invoices/${id}/pdf?token=${token}`, '_blank')
      }
    } catch (e) { alert('Failed: ' + e.message) }
    setActionLoading('')
  }

  const handleWhatsApp = async () => {
    setSharing(true)
    try {
      const inv = data.invoice
      const token = localStorage.getItem('token')
      const pdfUrl = `${api.defaults.baseURL}/invoices/${id}/pdf?token=${token}`
      const invNum = inv.invoice_number || ''
      const custName = inv.customer_name || ''
      const total = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(inv.total_amount)
      try {
        const response = await fetch(pdfUrl)
        const htmlBlob = await response.blob()
        const file = new File([htmlBlob], `Invoice_${invNum.replace(/\//g, '-')}.html`, { type: 'text/html' })
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ text: `*TAX INVOICE ${invNum}*\nCustomer: ${custName}\nTotal: ₹${total}`, files: [file] })
          setShareOpen(false); setSharing(false); return
        }
      } catch (shareErr) { }
      const viewUrl = `${window.location.origin}/app/invoices/${id}`
      const msg = `*TAX INVOICE ${invNum}*\nCustomer: ${custName}\nTotal: ₹${total}\n\n📄 View & Print: ${viewUrl}\n📥 Direct PDF: ${pdfUrl}`
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
    } catch (err) { alert('Share failed: ' + err.message) }
    setShareOpen(false); setSharing(false)
  }

  const handleEmail = async () => {
    setSharing(true)
    try {
      const inv = data.invoice
      const token = localStorage.getItem('token')
      const pdfUrl = `${api.defaults.baseURL}/invoices/${id}/pdf?token=${token}`
      const invNum = inv.invoice_number || ''
      const custName = inv.customer_name || ''
      const total = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(inv.total_amount)
      const emailTo = prompt('Enter email address to send invoice:')
      if (!emailTo) { setSharing(false); return }
      try {
        await api.post(`/invoices/${id}/share-email`, { to: emailTo })
        alert('Invoice sent via email!')
      } catch (backendErr) {
        const org = data.organization
        const subject = `Tax Invoice ${invNum} - ${org?.name || 'Our Company'}`
        const body = `Dear ${custName},\n\nPlease find your tax invoice below:\n\nInvoice No: ${invNum}\nTotal Amount: ₹${total}\n\n📄 View: ${window.location.origin}/app/invoices/${id}\n📥 PDF: ${pdfUrl}\n\nBest regards,\n${org?.name || 'Our Company'}`
        window.open(`mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
      }
    } catch (err) { alert('Email share failed: ' + err.message) }
    setShareOpen(false); setSharing(false)
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center h-96">
      <AlertCircle size={48} className="text-red-400 mb-3" />
      <h2 className="text-white text-lg font-bold">{error}</h2>
      <button onClick={() => navigate('/app/invoices')} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold mt-4">Go Back</button>
    </div>
  )

  const inv = data.invoice || {}
  const items = data.items || []
  const isIntraState = (parseFloat(inv.cgst_amount) || 0) > 0 || (parseFloat(inv.sgst_amount) || 0) > 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => navigate('/app/invoices')} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-white"><ArrowLeft size={14} /></button>
          <span className="text-slate-500">Invoices</span>
          <span className="text-slate-700">›</span>
          <span className="text-white font-bold">{inv.invoice_number}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <BoldToggle />
          <TemplateSelector />
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs text-white/70 font-bold tracking-widest">TAX INVOICE</div>
            <h1 className="text-3xl font-black text-white font-mono mt-1">{inv.invoice_number}</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-white/90">
              <div className="flex items-center gap-1"><Calendar size={12} />{inv.invoice_date}</div>
              <span>•</span>
              <div className="flex items-center gap-1"><User size={12} />{inv.customer_name}</div>
              <span>•</span>
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold">{isIntraState ? 'CGST+SGST' : 'IGST'}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/app/invoices/' + id + '/edit')} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold flex items-center gap-2"><Edit size={14} />Edit</button>
            <button onClick={() => handleAction('preview')} disabled={actionLoading === 'preview'} className="px-4 py-2 bg-white/20 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-white/30"><Eye size={14} />{actionLoading === 'preview' ? '...' : 'Preview'}</button>
            <button onClick={() => handleAction('download')} disabled={actionLoading === 'download'} className="px-4 py-2 bg-white text-blue-600 rounded-xl text-sm font-bold flex items-center gap-2 hover:shadow-lg"><Download size={14} />{actionLoading === 'download' ? '...' : 'Download'}</button>
            <button onClick={() => handleAction('print')} disabled={actionLoading === 'print'} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold flex items-center gap-2"><Printer size={14} />{actionLoading === 'print' ? '...' : 'Print'}</button>

            <div className="relative">
              <button onClick={() => setShareOpen(!shareOpen)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center gap-2"><Share2 size={14} />Share</button>
              {shareOpen && (
                <div className="absolute right-0 top-full mt-1 rounded-xl shadow-2xl z-50 min-w-[180px] overflow-hidden" style={{ background: 'rgba(14,18,36,0.97)', border: '1px solid rgba(255,255,255,0.10)' }}>
                  <button onClick={handleWhatsApp} disabled={sharing} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 text-green-400 text-sm font-medium">
                    <MessageCircle size={18} /> {sharing ? 'Sharing...' : 'WhatsApp'}
                  </button>
                  <button onClick={handleEmail} disabled={sharing} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 text-blue-400 text-sm font-medium border-t border-white/5">
                    <Mail size={18} /> {sharing ? 'Sending...' : 'Email'}
                  </button>
                </div>
              )}
            </div>

            <button onClick={del} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold flex items-center gap-2"><Trash2 size={14} />Delete</button>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">Payment Status:</span>
          <select value={inv.payment_status || 'Unpaid'} onChange={e => updateStatus(e.target.value)} className={"px-4 py-2 rounded-xl text-sm font-bold border-2 bg-slate-800/80 " + (inv.payment_status === 'Paid' ? 'text-emerald-400 border-emerald-500/30' : inv.payment_status === 'Partial' ? 'text-amber-400 border-amber-500/30' : 'text-red-400 border-red-500/30')}>
            <option>Unpaid</option>
            <option>Partial</option>
            <option>Paid</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="glass rounded-2xl p-4 border-l-4 border-blue-500"><div className="text-xs text-slate-400">Subtotal</div><div className="text-xl font-bold text-white mt-1">Rs.{Math.round(inv.subtotal || 0).toLocaleString('en-IN')}</div></div>
        {isIntraState ? (
          <>
            <div className="glass rounded-2xl p-4 border-l-4 border-cyan-500"><div className="text-xs text-slate-400">CGST</div><div className="text-xl font-bold text-cyan-400 mt-1">Rs.{Math.round(inv.cgst_amount || 0).toLocaleString('en-IN')}</div></div>
            <div className="glass rounded-2xl p-4 border-l-4 border-blue-500"><div className="text-xs text-slate-400">SGST</div><div className="text-xl font-bold text-blue-400 mt-1">Rs.{Math.round(inv.sgst_amount || 0).toLocaleString('en-IN')}</div></div>
          </>
        ) : (
          <div className="glass rounded-2xl p-4 border-l-4 border-purple-500 col-span-2"><div className="text-xs text-slate-400">IGST</div><div className="text-xl font-bold text-purple-400 mt-1">Rs.{Math.round(inv.igst_amount || 0).toLocaleString('en-IN')}</div></div>
        )}
        <div className="glass rounded-2xl p-4 border-l-4 border-amber-500"><div className="text-xs text-slate-400">Tax</div><div className="text-xl font-bold text-amber-400 mt-1">Rs.{Math.round((inv.cgst_amount || 0) + (inv.sgst_amount || 0) + (inv.igst_amount || 0)).toLocaleString('en-IN')}</div></div>
        <div className="glass rounded-2xl p-4 border-l-4 border-emerald-500"><div className="text-xs text-slate-400">Total</div><div className="text-xl font-bold text-emerald-400 mt-1">Rs.{Math.round(inv.total_amount || 0).toLocaleString('en-IN')}</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-3">Customer</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Name:</span><span className="text-white font-semibold">{inv.customer_name || '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">GSTIN:</span><span className="text-blue-400 font-mono">{inv.customer_gstin || '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">State:</span><span className="text-white">{inv.customer_state || '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Phone:</span><span className="text-white">{inv.customer_phone || '-'}</span></div>
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-3">Invoice Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Invoice No:</span><span className="text-blue-400 font-mono font-bold">{inv.invoice_number}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Date:</span><span className="text-white">{inv.invoice_date}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Due:</span><span className="text-white">{inv.due_date || '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">GST:</span><span className={isIntraState ? 'text-blue-400 font-bold' : 'text-purple-400 font-bold'}>{isIntraState ? 'Intra-State' : 'Inter-State'}</span></div>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-3">Items ({items.length})</h3>
        {items.length === 0 ? <p className="text-slate-500 text-center py-8">No items</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="text-left py-2 px-3 text-slate-400 text-xs">Sr.</th>
                  <th className="text-left py-2 px-3 text-slate-400 text-xs">Description</th>
                  <th className="text-left py-2 px-3 text-slate-400 text-xs">HSN</th>
                  <th className="text-right py-2 px-3 text-slate-400 text-xs">Qty</th>
                  <th className="text-right py-2 px-3 text-slate-400 text-xs">Rate</th>
                  <th className="text-right py-2 px-3 text-slate-400 text-xs">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const qty = parseFloat(it.quantity) || 0
                  const rate = parseFloat(it.rate) || 0
                  const taxable = qty * rate
                  const cgst = (taxable * (parseFloat(it.cgst_rate) || 0)) / 100
                  const sgst = (taxable * (parseFloat(it.sgst_rate) || 0)) / 100
                  const igst = (taxable * (parseFloat(it.igst_rate) || 0)) / 100
                  const total = taxable + cgst + sgst + igst
                  return (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-3 px-3 text-white">{i + 1}</td>
                      <td className="py-3 px-3 text-white font-semibold">{it.description}</td>
                      <td className="py-3 px-3 text-blue-400 font-mono">{it.hsn_code}</td>
                      <td className="py-3 px-3 text-right text-white">{qty} {it.unit}</td>
                      <td className="py-3 px-3 text-right text-white">Rs.{rate.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right text-emerald-400 font-bold">Rs.{total.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
