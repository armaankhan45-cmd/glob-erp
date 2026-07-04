import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Trash2, Printer, Edit, AlertCircle, Share2, MessageCircle, Mail } from 'lucide-react'
import api from '../api/client'
import BoldToggle from '../components/BoldToggle'

function fmt(n) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
}

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return String(d)
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

const STATE_NAMES = {
  '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
  '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh',
  '10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur',
  '15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal',
  '20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh',
  '24':'Gujarat','25':'Daman & Diu','26':'Dadra & Nagar Haveli','27':'Maharashtra',
  '28':'Andhra Pradesh','29':'Karnataka','30':'Goa','31':'Lakshadweep',
  '32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman & Nicobar',
  '36':'Telangana','37':'Ladakh','38':'Other Territory'
}

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [boldOn, setBoldOn] = useState(() => localStorage.getItem('invBold') === 'true')

  useEffect(() => {
    const numId = parseInt(id)
    if (!id || isNaN(numId) || numId <= 0) { setError('Invalid invoice ID'); setLoading(false); return }
    load(numId)
  }, [id])

  const load = async (invoiceId) => {
    setLoading(true); setError('')
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

  const toggleBold = () => { const val = !boldOn; setBoldOn(val); localStorage.setItem('invBold', val) }

  const handleAction = async (action) => {
    setActionLoading(action)
    try {
      const token = localStorage.getItem('token')
      const url = `${api.defaults.baseURL}/invoices/${id}/pdf?token=${token}`
      if (action === 'download' || action === 'preview') window.open(url, '_blank')
      else if (action === 'print') { const w = window.open(url, '_blank'); if (w) w.onload = () => w.print() }
    } catch (e) { alert('Failed: ' + e.message) }
    setActionLoading('')
  }

  // WhatsApp — SAME as QuotationDetail
  const handleWhatsApp = async () => {
    setSharing(true)
    try {
      const inv = data.invoice; const token = localStorage.getItem('token')
      const pdfUrl = `${api.defaults.baseURL}/invoices/${id}/pdf?token=${token}`
      const invNum = inv.invoice_number || ''; const custName = inv.customer_name || ''; const total = fmt(inv.total_amount)
      try {
        const response = await fetch(pdfUrl); const htmlBlob = await response.blob()
        const file = new File([htmlBlob], `Invoice_${invNum.replace(/\//g, '-')}.html`, { type: 'text/html' })
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ text: `*TAX INVOICE ${invNum}*\nCustomer: ${custName}\nTotal: ₹${total}`, files: [file] })
          setShareOpen(false); setSharing(false); return
        }
      } catch (e) { }
      const viewUrl = `${window.location.origin}/app/invoices/${id}`
      const msg = `*TAX INVOICE ${invNum}*\nCustomer: ${custName}\nTotal: ₹${total}\n\n📄 View & Print: ${viewUrl}\n📥 Direct PDF: ${pdfUrl}`
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
    } catch (err) { alert('Share failed: ' + err.message) }
    setShareOpen(false); setSharing(false)
  }

  // Email — SAME as QuotationDetail
  const handleEmail = async () => {
    setSharing(true)
    try {
      const inv = data.invoice; const token = localStorage.getItem('token')
      const pdfUrl = `${api.defaults.baseURL}/invoices/${id}/pdf?token=${token}`
      const invNum = inv.invoice_number || ''; const custName = inv.customer_name || ''; const total = fmt(inv.total_amount)
      const emailTo = prompt('Enter email address to send invoice:')
      if (!emailTo) { setSharing(false); return }
      try {
        await api.post(`/invoices/${id}/share-email`, { to: emailTo }); alert('Invoice sent via email!')
      } catch (e) {
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
  const org = data.organization || {}
  const isIntraState = (parseFloat(inv.cgst_amount) || 0) > 0 || (parseFloat(inv.sgst_amount) || 0) > 0

  // GST state determination for print
  const orgStateCode = org.state_code || (org.gstin ? org.gstin.substring(0, 2) : '27')
  const custGstin = inv.customer_gstin || ''
  const custStateCode = inv.customer_state_code || (custGstin ? custGstin.substring(0, 2) : '')
  const isPrintIntraState = custStateCode ? (custStateCode === orgStateCode) : isIntraState

  const totalCgst = items.reduce((s, it) => s + ((parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0) * (parseFloat(it.cgst_rate) || 0) / 100), 0)
  const totalSgst = items.reduce((s, it) => s + ((parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0) * (parseFloat(it.sgst_rate) || 0) / 100), 0)
  const totalIgst = items.reduce((s, it) => s + ((parseFloat(it.quantity) || 0) * (parseFloat(it.rate) || 0) * (parseFloat(it.igst_rate) || 0) / 100), 0)
  const totalTax = totalCgst + totalSgst + totalIgst

  const invNum = (inv.invoice_number || '').split('/')[0]
  const isPaid = (inv.payment_status || '').toLowerCase() === 'paid'
  const placeOfSupply = custStateCode ? `${custStateCode}-${STATE_NAMES[custStateCode] || inv.customer_state || ''}` : `${orgStateCode}-${org.state || STATE_NAMES[orgStateCode] || ''}`
  const invoiceDate = fmtDate(inv.invoice_date)
  const dueDate = fmtDate(inv.due_date)
  const totalQty = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0), 0)

  // HSN summary map
  const hsnMap = {}
  items.forEach(item => {
    const hsn = item.hsn_code || 'Others'
    if (!hsnMap[hsn]) hsnMap[hsn] = { taxable: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0 }
    const qty = parseFloat(item.quantity) || 0; const rate = parseFloat(item.rate) || 0; const taxable = qty * rate
    hsnMap[hsn].taxable += taxable
    hsnMap[hsn].cgstRate = parseFloat(item.cgst_rate) || 0; hsnMap[hsn].sgstRate = parseFloat(item.sgst_rate) || 0; hsnMap[hsn].igstRate = parseFloat(item.igst_rate) || 0
    hsnMap[hsn].cgstAmt += taxable * (parseFloat(item.cgst_rate) || 0) / 100; hsnMap[hsn].sgstAmt += taxable * (parseFloat(item.sgst_rate) || 0) / 100; hsnMap[hsn].igstAmt += taxable * (parseFloat(item.igst_rate) || 0) / 100
  })

  // UPI QR
  const upiId = org.upi_id || ''
  const upiName = encodeURIComponent((org.name || 'GLOB FABRICATION AND ENTERPRISES').replace(/&/g, 'and'))
  const upiAmount = parseFloat(inv.total_amount || 0).toFixed(2)
  const qrUrl = upiId ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${upiName}&am=${upiAmount}&cu=INR&tn=${encodeURIComponent('Invoice ' + invNum)}`)}` : ''

  const fontFamily = org.invoice_font_family || "'Segoe UI', Arial, sans-serif'"
  const fontSize = org.invoice_font_size || '9pt'
  const descSize = org.invoice_desc_size || '8pt'
  const itemBold = boldOn ? 'font-weight:bold;' : ''

  // Number to words
  function numberToWords(num) {
    const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
    const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
    function inW(n) {
      if (n < 20) return a[n]; if (n < 100) return b[Math.floor(n/10)] + (n%10 ? ' '+a[n%10] : '')
      if (n < 1000) return a[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+inW(n%100) : '')
      if (n < 100000) return inW(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+inW(n%1000) : '')
      if (n < 10000000) return inW(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+inW(n%100000) : '')
      return inW(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+inW(n%10000000) : '')
    }
    const rupees = Math.round(Math.floor(num)); const paise = Math.round((num - Math.floor(num)) * 100)
    let result = inW(rupees) + ' Rupees'; if (paise > 0) result += ' and ' + inW(paise) + ' Paise'; return result + ' Only'
  }

  return (
    <div className="space-y-4">
      {/* Action buttons — no-print */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button onClick={() => navigate('/app/invoices')} className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold flex-1 text-white">Invoice {inv.invoice_number}</h1>
        <button onClick={toggleBold} className={`px-3 py-2 rounded-lg font-medium text-sm ${boldOn ? 'bg-white/10 text-white border border-white/15' : 'btn-secondary'}`}>Bold {boldOn ? 'ON' : 'OFF'}</button>
        <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2"><Printer size={16} /> Print</button>
        <button onClick={() => handleAction('download')} className="btn-secondary flex items-center gap-2"><Download size={16} /> PDF</button>

        {/* SHARE DROPDOWN — SAME AS QUOTATION */}
        <div className="relative">
          <button onClick={() => setShareOpen(!shareOpen)} className="btn-secondary flex items-center gap-2"><Share2 size={16} /> Share</button>
          {shareOpen && (
            <div className="absolute right-0 top-full mt-1 rounded-xl shadow-2xl z-50 min-w-[180px] overflow-hidden" style={{ background: 'rgba(14,18,36,0.97)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <button onClick={handleWhatsApp} disabled={sharing} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 text-green-400 text-sm font-medium"><MessageCircle size={18} /> {sharing ? 'Sharing...' : 'WhatsApp'}</button>
              <button onClick={handleEmail} disabled={sharing} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 text-blue-400 text-sm font-medium border-t border-white/5"><Mail size={18} /> {sharing ? 'Sending...' : 'Email'}</button>
            </div>
          )}
        </div>

        <button onClick={() => navigate('/app/invoices/' + id + '/edit')} className="btn-primary flex items-center gap-2"><Edit size={16} /> Edit</button>
        <button onClick={del} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>
      </div>

      {/* Payment status */}
      <div className="glass rounded-2xl p-3 no-print">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">Payment:</span>
          <select value={inv.payment_status || 'Unpaid'} onChange={e => updateStatus(e.target.value)} className={"px-4 py-2 rounded-xl text-sm font-bold border-2 bg-slate-800/80 " + (inv.payment_status === 'Paid' ? 'text-emerald-400 border-emerald-500/30' : inv.payment_status === 'Partial' ? 'text-amber-400 border-amber-500/30' : 'text-red-400 border-red-500/30')}>
            <option>Unpaid</option><option>Partial</option><option>Paid</option>
          </select>
        </div>
      </div>

      {/* ═══ INVOICE PRINT LAYOUT — MATCHES ITC LIMITED FORMAT FROM IMAGE ═══ */}
      <div className="bg-white shadow-lg mx-auto print-area" style={{ fontFamily, fontSize, color: '#1a1a1a', width: '210mm', minHeight: '297mm', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>

        {/* COMPANY HEADER */}
        <div style={{ display: 'flex', borderBottom: '2.5px solid #000', padding: '10px 14px', flexShrink: 0 }}>
          <div style={{ width: '70px', height: '70px', border: '1.5px solid #bbb', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '14px', flexShrink: 0, background: '#fafafa' }}>
            {org.logo_url ? <img src={org.logo_url} style={{ maxWidth: '60px', maxHeight: '60px', objectFit: 'contain' }} /> : <span style={{ fontSize: '7px', color: '#aaa' }}>LOGO</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16pt', fontWeight: '800', letterSpacing: '0.8px', color: '#111' }}>{(org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()}</div>
            <div style={{ fontSize: '8pt', color: '#333', marginTop: '2px' }}>{[org.address, org.city, org.state, org.pincode ? 'PIN: ' + org.pincode : ''].filter(Boolean).join(', ')}</div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '3px', fontSize: '8pt', color: '#444', flexWrap: 'wrap' }}>
              {org.gstin && <span><b>GSTIN:</b> {org.gstin}</span>}
              {org.phone && <span><b>Mobile:</b> {org.phone}</span>}
              {org.email && <span><b>Email:</b> {org.email}</span>}
            </div>
          </div>
        </div>

        {/* TAX INVOICE TITLE */}
        <div style={{ textAlign: 'center', padding: '5px 0', borderBottom: '2.5px solid #000', flexShrink: 0, background: 'linear-gradient(to right,#f8f8f8,#fff,#f8f8f8)' }}>
          <div style={{ fontSize: '14pt', fontWeight: '800', letterSpacing: '3px', color: '#111' }}>TAX INVOICE</div>
        </div>

        {/* CUSTOMER DETAILS + INVOICE INFO */}
        <div style={{ display: 'flex', borderBottom: '1.5px solid #000', flexShrink: 0 }}>
          <div style={{ flex: 1, padding: '8px 12px', borderRight: '1.5px solid #000' }}>
            <div style={{ fontSize: '9pt', fontWeight: '700', color: '#0a3d6b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #ddd', paddingBottom: '3px', marginBottom: '6px' }}>Customer Details:</div>
            <div style={{ fontSize: '12pt', fontWeight: '700', textTransform: 'uppercase', marginBottom: '3px' }}>{(inv.customer_name || '').toUpperCase()}</div>
            {custGstin && <div style={{ fontSize: '9pt', marginBottom: '2px' }}><span style={{ color: '#555' }}>GSTIN:</span> <b>{custGstin}</b></div>}
            <div style={{ fontSize: '9pt', color: '#333', lineHeight: 1.5, marginBottom: '2px' }}>
              <span style={{ color: '#555' }}>Billing address:</span><br />
              {[inv.customer_address, inv.customer_city, inv.customer_state, inv.customer_pincode].filter(Boolean).join(', ')}
            </div>
            {inv.customer_phone && <div style={{ fontSize: '9pt', color: '#333' }}>Ph: {inv.customer_phone}</div>}
          </div>
          <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', fontSize: '9pt' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
              <div style={{ flex: 1, padding: '5px 8px', borderRight: '1px solid #000' }}>
                <div style={{ color: '#555', fontWeight: '600' }}>Invoice #:</div>
                <div style={{ fontWeight: '800' }}>{invNum}</div>
              </div>
              <div style={{ flex: 1, padding: '5px 8px' }}>
                <div style={{ color: '#555', fontWeight: '600' }}>Date:</div>
                <div style={{ fontWeight: '800' }}>{invoiceDate}</div>
              </div>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
              <div style={{ flex: 1, padding: '5px 8px', borderRight: '1px solid #000' }}>
                <div style={{ color: '#555', fontWeight: '600' }}>Place of Supply:</div>
                <div style={{ fontWeight: '800' }}>{placeOfSupply}</div>
              </div>
              <div style={{ flex: 1, padding: '5px 8px' }}>
                <div style={{ color: '#555', fontWeight: '600' }}>Due Date:</div>
                <div style={{ fontWeight: '800' }}>{dueDate || '—'}</div>
              </div>
            </div>
            <div style={{ display: 'flex' }}>
              <div style={{ flex: 1, padding: '5px 8px', borderRight: '1px solid #000' }}>
                <div style={{ color: '#555', fontWeight: '600' }}>Reverse Charge:</div>
                <div style={{ fontWeight: '800' }}>No</div>
              </div>
              <div style={{ flex: 1, padding: '5px 8px' }}>
                <div style={{ color: '#555', fontWeight: '600' }}>Payment:</div>
                <div style={{ display: 'inline-block', padding: '1px 6px', borderRadius: '3px', fontSize: '8pt', fontWeight: '700', background: isPaid ? '#d4edda' : '#fff3cd', color: isPaid ? '#155724' : '#856404' }}>{isPaid ? '✓ PAID' : '● UNPAID'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ITEMS TABLE */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt', flex: 1 }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'center', fontWeight: '700', fontSize: '7.5pt', width: '4%' }}>#</th>
                <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'left', fontWeight: '700', fontSize: '7.5pt', width: '24%' }}>Item Description</th>
                <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'center', fontWeight: '700', fontSize: '7.5pt', width: '8%' }}>HSN/SAC</th>
                <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'right', fontWeight: '700', fontSize: '7.5pt', width: '10%' }}>Rate (₹)</th>
                <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'center', fontWeight: '700', fontSize: '7.5pt', width: '6%' }}>Qty</th>
                <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'right', fontWeight: '700', fontSize: '7.5pt', width: '12%' }}>Taxable Value (₹)</th>
                <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'center', fontWeight: '700', fontSize: '7.5pt', width: '8%' }}>GST %</th>
                <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'right', fontWeight: '700', fontSize: '7.5pt', width: '12%' }}>Tax Amount (₹)</th>
                <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'right', fontWeight: '700', fontSize: '7.5pt', width: '14%' }}>Total Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const qty = parseFloat(item.quantity) || 0; const rate = parseFloat(item.rate) || 0; const taxable = qty * rate
                const cgstRate = parseFloat(item.cgst_rate) || 0; const sgstRate = parseFloat(item.sgst_rate) || 0; const igstRate = parseFloat(item.igst_rate) || 0
                const taxRate = igstRate > 0 ? igstRate : cgstRate + sgstRate
                const taxAmt = taxable * taxRate / 100; const total = taxable + taxAmt
                return (
                  <tr key={i}>
                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{i + 1}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 4px', lineHeight: 1.3, whiteSpace: 'pre-line', fontSize: descSize, ...itemBold }}>{item.description || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{item.hsn_code || '—'}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(rate)}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qty} {item.unit || ''}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(taxable)}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{taxRate > 0 ? taxRate + '%' : '—'}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(taxAmt)}</td>
                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'top' }}>{fmt(total)}</td>
                  </tr>
                )
              })}
              {/* Empty rows to fill space */}
              {items.length < 10 && Array.from({ length: 10 - items.length }).map((_, i) => (
                <tr key={'e' + i} style={{ height: '20px' }}>
                  {Array.from({ length: 9 }).map((_, j) => <td key={j} style={{ border: '1px solid #000', padding: '2px' }}>&nbsp;</td>)}
                </tr>
              ))}
            </tbody>
          </table>

          {/* TOTALS SECTION */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', flexShrink: 0 }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'left', width: '52%', background: '#f8f8f8', fontWeight: '700', fontSize: '8.5pt' }}>Total items / Qty: {items.length} / {totalQty.toFixed(3)}</td>
                <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', width: '24%', background: '#f8f8f8' }}>Taxable Amount</td>
                <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', width: '24%', background: '#f8f8f8' }}>₹{fmt(inv.subtotal)}</td>
              </tr>
              {isPrintIntraState ? (
                <>
                  <tr style={{ background: '#f0f0ff' }}>
                    <td rowSpan={2} style={{ border: '1px solid #000', padding: '4px 8px', fontSize: '8pt' }}></td>
                    <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>CGST @ {(parseFloat(items[0]?.cgst_rate) || 9).toFixed(1)}%</td>
                    <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>₹{fmt(totalCgst)}</td>
                  </tr>
                  <tr style={{ background: '#f0f0ff' }}>
                    <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>SGST @ {(parseFloat(items[0]?.sgst_rate) || 9).toFixed(1)}%</td>
                    <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>₹{fmt(totalSgst)}</td>
                  </tr>
                </>
              ) : (
                <tr style={{ background: '#fff8f0' }}>
                  <td style={{ border: '1px solid #000', padding: '4px 8px', fontSize: '8pt' }}></td>
                  <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>IGST @ {(parseFloat(items[0]?.igst_rate) || 18).toFixed(1)}%</td>
                  <td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>₹{fmt(totalIgst)}</td>
                </tr>
              )}
              {parseFloat(inv.discount) > 0 && (
                <tr><td style={{ border: '1px solid #000', padding: '4px 8px' }}></td><td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>Discount</td><td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>-₹{fmt(inv.discount)}</td></tr>
              )}
              {parseFloat(inv.round_off) !== 0 && (
                <tr><td style={{ border: '1px solid #000', padding: '4px 8px' }}></td><td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>Round Off</td><td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>{parseFloat(inv.round_off) > 0 ? '+' : ''}₹{fmt(inv.round_off)}</td></tr>
              )}
              <tr style={{ background: '#e8e8e8' }}>
                <td style={{ border: '2px solid #000', padding: '5px 8px', fontWeight: '800' }}></td>
                <td style={{ border: '2px solid #000', padding: '5px 8px', textAlign: 'right', fontSize: '11pt', fontWeight: '900' }}>GRAND TOTAL</td>
                <td style={{ border: '2px solid #000', padding: '5px 8px', textAlign: 'right', fontSize: '11pt', fontWeight: '900' }}>₹{fmt(inv.total_amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* AMOUNT IN WORDS */}
        <div style={{ padding: '5px 10px', fontSize: '8.5pt', borderTop: '1.5px solid #000', flexShrink: 0, display: 'flex', justifyContent: 'space-between', background: '#f8f8f8' }}>
          <div><b>Total amount (in words):</b> INR {numberToWords(inv.total_amount)}</div>
          <div style={{ fontSize: '7pt', color: '#666' }}>E & O.E</div>
        </div>

        {/* HSN-WISE TAX SUMMARY */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: '8pt', fontWeight: '700', padding: '4px 6px 0', color: '#333', letterSpacing: '0.3px' }}>HSN/SAC Wise Tax Summary</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '3px', background: '#e8e8e8', textAlign: 'center', fontSize: '7pt' }}>HSN/SAC</th>
                <th style={{ border: '1px solid #000', padding: '3px', background: '#e8e8e8', textAlign: 'center', fontSize: '7pt' }}>Taxable Value</th>
                {isPrintIntraState ? (
                  <>
                    <th style={{ border: '1px solid #000', padding: '3px', background: '#e8e8e8', textAlign: 'center', fontSize: '7pt' }} colSpan={2}>Central Tax</th>
                    <th style={{ border: '1px solid #000', padding: '3px', background: '#e8e8e8', textAlign: 'center', fontSize: '7pt' }} colSpan={2}>State/UT Tax</th>
                  </>
                ) : (
                  <th style={{ border: '1px solid #000', padding: '3px', background: '#e8e8e8', textAlign: 'center', fontSize: '7pt' }} colSpan={2}>Integrated Tax</th>
                )}
                <th style={{ border: '1px solid #000', padding: '3px', background: '#e8e8e8', textAlign: 'center', fontSize: '7pt' }}>Total Tax Amt</th>
              </tr>
              <tr>
                <th style={{ border: '1px solid #000', padding: '1px', background: '#e8e8e8', fontSize: '6.5pt' }}></th>
                <th style={{ border: '1px solid #000', padding: '1px', background: '#e8e8e8', fontSize: '6.5pt' }}></th>
                {isPrintIntraState ? (
                  <>
                    <th style={{ border: '1px solid #000', padding: '1px', background: '#e8e8e8', fontSize: '6.5pt' }}>Rate</th>
                    <th style={{ border: '1px solid #000', padding: '1px', background: '#e8e8e8', fontSize: '6.5pt' }}>Amount</th>
                    <th style={{ border: '1px solid #000', padding: '1px', background: '#e8e8e8', fontSize: '6.5pt' }}>Rate</th>
                    <th style={{ border: '1px solid #000', padding: '1px', background: '#e8e8e8', fontSize: '6.5pt' }}>Amount</th>
                  </>
                ) : (
                  <>
                    <th style={{ border: '1px solid #000', padding: '1px', background: '#e8e8e8', fontSize: '6.5pt' }}>Rate</th>
                    <th style={{ border: '1px solid #000', padding: '1px', background: '#e8e8e8', fontSize: '6.5pt' }}>Amount</th>
                  </>
                )}
                <th style={{ border: '1px solid #000', padding: '1px', background: '#e8e8e8', fontSize: '6.5pt' }}></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(hsnMap).map(([hsn, d]) => (
                <tr key={hsn}>
                  <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', fontSize: '7pt' }}>{hsn}</td>
                  <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>{fmt(d.taxable)}</td>
                  {isPrintIntraState ? (
                    <>
                      <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', fontSize: '7pt' }}>{d.cgstRate}%</td>
                      <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>{fmt(d.cgstAmt)}</td>
                      <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', fontSize: '7pt' }}>{d.sgstRate}%</td>
                      <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>{fmt(d.sgstAmt)}</td>
                    </>
                  ) : (
                    <>
                      <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', fontSize: '7pt' }}>{d.igstRate}%</td>
                      <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>{fmt(d.igstAmt)}</td>
                    </>
                  )}
                  <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt', fontWeight: 'bold' }}>{fmt(d.cgstAmt + d.sgstAmt + d.igstAmt)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: '700', background: '#f0f0f0' }}>
                <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', fontSize: '7pt' }}>TOTAL</td>
                <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>₹{fmt(inv.subtotal)}</td>
                {isPrintIntraState ? (
                  <>
                    <td style={{ border: '1px solid #000', padding: '1px 3px', fontSize: '7pt' }}></td>
                    <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>₹{fmt(totalCgst)}</td>
                    <td style={{ border: '1px solid #000', padding: '1px 3px', fontSize: '7pt' }}></td>
                    <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>₹{fmt(totalSgst)}</td>
                  </>
                ) : (
                  <>
                    <td style={{ border: '1px solid #000', padding: '1px 3px', fontSize: '7pt' }}></td>
                    <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>₹{fmt(totalIgst)}</td>
                  </>
                )}
                <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>₹{fmt(totalTax)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* BANK DETAILS + QR + SIGNATURE */}
        <div style={{ display: 'flex', borderTop: '1.5px solid #000', marginTop: 'auto', flexShrink: 0 }}>
          <div style={{ width: '40%', padding: '6px 10px', fontSize: '8pt', lineHeight: 1.6, borderRight: '1px solid #000' }}>
            <div style={{ fontWeight: '700', borderBottom: '1px solid #ccc', paddingBottom: '2px', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.3px', fontSize: '7.5pt' }}>Bank Details:</div>
            {org.bank_name && <div><b>Bank:</b> {org.bank_name}</div>}
            {org.account_no && <div><b>A/C No:</b> {org.account_no}</div>}
            {org.ifsc && <div><b>IFSC:</b> {org.ifsc}</div>}
            {org.branch && <div><b>Branch:</b> {org.branch}</div>}
            {org.upi_id && <div><b>UPI ID:</b> {org.upi_id}</div>}
          </div>
          <div style={{ width: '18%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRight: '1px solid #000' }}>
            {qrUrl ? <><img src={qrUrl} style={{ width: '72px', height: '72px' }} /><div style={{ fontSize: '5.5pt', color: '#666', marginTop: '2px', textAlign: 'center' }}>Scan to Pay</div></> : <div style={{ fontSize: '7pt', color: '#aaa', textAlign: 'center' }}>QR Code</div>}
          </div>
          <div style={{ width: '42%', padding: '6px 10px', fontSize: '8pt', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', textAlign: 'right' }}>
            <div style={{ marginBottom: '4px' }}>For <b>{(org.name || '').toUpperCase()}</b></div>
            {/* Signature/stamp area — BLANK for uploaded stamp */}
            <div style={{ width: '100px', height: '60px', display: 'inline-block', marginBottom: '4px', position: 'relative' }}>
              {org.stamp_url && <img src={org.stamp_url} style={{ position: 'absolute', width: '100px', height: '60px', objectFit: 'contain', opacity: 0.85 }} />}
              {org.signature_url && <img src={org.signature_url} style={{ position: 'relative', zIndex: 1, maxHeight: '40px', maxWidth: '80px', objectFit: 'contain' }} />}
            </div>
            <div style={{ borderTop: '1px solid #000', display: 'inline-block', paddingTop: '2px', fontWeight: '600', fontSize: '8pt' }}>Authorized Signatory</div>
          </div>
        </div>

        {/* NOTES */}
        {inv.notes && <div style={{ padding: '4px 10px', fontSize: '7.5pt', borderTop: '1px solid #000', flexShrink: 0, color: '#444', lineHeight: 1.5 }}><b>Notes:</b> {inv.notes}</div>}

        {/* TERMS */}
        <div style={{ padding: '3px 10px', fontSize: '7pt', borderTop: '1px solid #ccc', flexShrink: 0, color: '#777' }}>
          <b>Terms & Conditions:</b> 1. Goods once sold will not be taken back. 2. Interest @ 18% p.a. will be charged on delayed payments. 3. Subject to Maharashtra jurisdiction only.
        </div>

        {/* FOOTER */}
        <div style={{ textAlign: 'center', fontSize: '6.5pt', color: '#999', padding: '3px 0', borderTop: '1px solid #ddd', flexShrink: 0 }}>
          Computer Generated Invoice | {(org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()} | Page 1 of 1
        </div>
      </div>
    </div>
  )
}
