import { useState, useEffect, useCallback } from 'react'
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
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`
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

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [boldOn, setBoldOn] = useState(() => localStorage.getItem('invBold') === 'true')

  // Listen for bold changes from BoldToggle component
  useEffect(() => {
    const handler = () => setBoldOn(localStorage.getItem('invBold') === 'true')
    window.addEventListener('invBoldChanged', handler)
    return () => window.removeEventListener('invBoldChanged', handler)
  }, [])

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

  const handleAction = async (action) => {
    try {
      const token = localStorage.getItem('token')
      const url = `${api.defaults.baseURL}/invoices/${id}/pdf?token=${token}`
      if (action === 'download' || action === 'preview') window.open(url, '_blank')
      else if (action === 'print') { const w = window.open(url, '_blank'); if (w) w.onload = () => w.print() }
    } catch (e) { alert('Failed: ' + e.message) }
  }

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

  const hsnMap = {}
  items.forEach(item => {
    const hsn = item.hsn_code || 'Others'
    if (!hsnMap[hsn]) hsnMap[hsn] = { taxable: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0 }
    const qty = parseFloat(item.quantity) || 0; const rate = parseFloat(item.rate) || 0; const taxable = qty * rate
    hsnMap[hsn].taxable += taxable
    hsnMap[hsn].cgstRate = parseFloat(item.cgst_rate) || 0; hsnMap[hsn].sgstRate = parseFloat(item.sgst_rate) || 0; hsnMap[hsn].igstRate = parseFloat(item.igst_rate) || 0
    hsnMap[hsn].cgstAmt += taxable * (parseFloat(item.cgst_rate) || 0) / 100; hsnMap[hsn].sgstAmt += taxable * (parseFloat(item.sgst_rate) || 0) / 100; hsnMap[hsn].igstAmt += taxable * (parseFloat(item.igst_rate) || 0) / 100
  })

  const upiId = org.upi_id || ''
  const upiName = encodeURIComponent((org.name || 'GLOB FABRICATION AND ENTERPRISES').replace(/&/g, 'and'))
  const upiAmount = parseFloat(inv.total_amount || 0).toFixed(2)
  const qrUrl = upiId ? `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${upiName}&am=${upiAmount}&cu=INR&tn=${encodeURIComponent('Invoice ' + invNum)}`)}` : ''

  const fontFamily = org.invoice_font_family || "'Segoe UI', Arial, sans-serif"
  const itemBoldStyle = boldOn ? { fontWeight: 'bold' } : {}
  const bdr = '1.5px solid #1a1a1a'

  return (
    <div className="space-y-4">
      {/* Action buttons — no-print */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button onClick={() => navigate('/app/invoices')} className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold flex-1 text-white">Invoice {inv.invoice_number}</h1>
        <BoldToggle />
        <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2"><Printer size={16} /> Print</button>
        <button onClick={() => handleAction('download')} className="btn-secondary flex items-center gap-2"><Download size={16} /> PDF</button>

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

      {/* ═══════════════════════════════════════════════════════
          INVOICE — EXACT HUL/ITC FORMAT WITH PROPER ALIGNMENT
          ═══════════════════════════════════════════════════════ */}
      <div className="bg-white shadow-lg mx-auto print-area" style={{ fontFamily, maxWidth: '900px', margin: '0 auto', background: '#fff', border: '1.5px solid #1a1a1a', color: '#1a1a1a', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>

        {/* ═══ TAX INVOICE TITLE BAR ═══ */}
        <div style={{ textAlign: 'center', padding: '14px 0 8px', position: 'relative', borderBottom: bdr }}>
          <h1 style={{ fontSize: '22px', letterSpacing: '6px', margin: 0, fontWeight: 800, color: '#1a1a1a' }}>TAX INVOICE</h1>
          <span style={{ position: 'absolute', right: '20px', top: '16px', fontSize: '12px', color: '#444', letterSpacing: '1px', fontWeight: 600 }}>ORIGINAL FOR RECIPIENT</span>
        </div>

        {/* ═══ TOP GRID — Company | Invoice# | Date ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', borderBottom: bdr }}>
          {/* Company Block */}
          <div style={{ padding: '16px 20px', borderRight: bdr, display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <div style={{ width: '70px', height: '70px', flexShrink: 0 }}>
              {org.logo_url
                ? <img src={org.logo_url} style={{ width: '70px', height: '70px', objectFit: 'contain' }} />
                : <div style={{ width: '70px', height: '70px', border: '1.5px solid #bbb', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#aaa' }}>LOGO</div>
              }
            </div>
            <div>
              <p style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px', lineHeight: 1.2 }}>{(org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()}</p>
              {org.gstin && <p style={{ margin: '2px 0', fontSize: '12.5px', color: '#222', lineHeight: 1.4 }}><strong>GSTIN {org.gstin}</strong></p>}
              <p style={{ margin: '2px 0', fontSize: '12.5px', color: '#222', lineHeight: 1.4 }}>{[org.address, org.city].filter(Boolean).join(', ')}</p>
              <p style={{ margin: '2px 0', fontSize: '12.5px', color: '#222', lineHeight: 1.4 }}>{[org.state, org.pincode ? 'PIN: ' + org.pincode : ''].filter(Boolean).join(', ')}</p>
              {org.phone && <p style={{ margin: '2px 0', fontSize: '12.5px', color: '#222', lineHeight: 1.4 }}>Mobile {org.phone}</p>}
            </div>
          </div>

          {/* Invoice # / Place of Supply */}
          <div style={{ padding: '16px 18px', borderRight: bdr }}>
            <div style={{ fontSize: '13px', color: '#333', marginBottom: '2px' }}>Invoice #:</div>
            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '16px', lineHeight: 1.3 }}>{invNum}</div>
            <div style={{ fontSize: '13px', color: '#333', marginBottom: '2px' }}>Place of Supply:</div>
            <div style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.3 }}>{placeOfSupply}</div>
          </div>

          {/* Invoice Date / Due Date */}
          <div style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: '13px', color: '#333', marginBottom: '2px' }}>Invoice Date:</div>
            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '16px', lineHeight: 1.3 }}>{invoiceDate}</div>
            <div style={{ fontSize: '13px', color: '#333', marginBottom: '2px' }}>Due Date:</div>
            <div style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.3 }}>{dueDate || '—'}</div>
          </div>
        </div>

        {/* ═══ ADDRESS GRID — Customer | Shipping ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: bdr }}>
          <div style={{ padding: '14px 20px', borderRight: bdr, fontSize: '12.5px', lineHeight: 1.5 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 700, color: '#1a1a1a' }}>Customer Details:</h3>
            <p style={{ fontWeight: 700, margin: '0 0 2px', fontSize: '13px' }}>{(inv.customer_name || '').toUpperCase()}</p>
            {custGstin && <p style={{ margin: '2px 0' }}><strong>GSTIN:</strong> {custGstin}</p>}
            <p style={{ margin: '2px 0' }}><strong>Billing address:</strong></p>
            <p style={{ margin: '2px 0' }}>{[inv.customer_address, inv.customer_city].filter(Boolean).join(', ')}</p>
            <p style={{ margin: '2px 0' }}>{[inv.customer_state, inv.customer_pincode].filter(Boolean).join(', ')}</p>
            {inv.customer_phone && <p style={{ margin: '2px 0' }}>Ph: {inv.customer_phone}</p>}
          </div>
          <div style={{ padding: '14px 20px', fontSize: '12.5px', lineHeight: 1.5 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 700, color: '#1a1a1a' }}>Shipping address:</h3>
            <p style={{ margin: '2px 0' }}>{[inv.customer_address, inv.customer_city].filter(Boolean).join(', ')}</p>
            <p style={{ margin: '2px 0' }}>{[inv.customer_state, inv.customer_pincode].filter(Boolean).join(', ')}</p>
          </div>
        </div>

        {/* ═══ ITEMS TABLE ═══ */}
        <div style={{ borderBottom: bdr }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: bdr }}>
                <th style={{ textAlign: 'left', padding: '10px 10px', fontSize: '12.5px', fontWeight: 700, borderBottom: bdr, whiteSpace: 'nowrap' }}>#</th>
                <th style={{ textAlign: 'left', padding: '10px 10px', fontSize: '12.5px', fontWeight: 700, borderBottom: bdr }}>Item</th>
                <th style={{ textAlign: 'left', padding: '10px 10px', fontSize: '12.5px', fontWeight: 700, borderBottom: bdr }}>HSN/SAC</th>
                <th style={{ textAlign: 'right', padding: '10px 10px', fontSize: '12.5px', fontWeight: 700, borderBottom: bdr, whiteSpace: 'nowrap' }}>Tax</th>
                <th style={{ textAlign: 'right', padding: '10px 10px', fontSize: '12.5px', fontWeight: 700, borderBottom: bdr, whiteSpace: 'nowrap' }}>Qty</th>
                <th style={{ textAlign: 'center', padding: '10px 10px', fontSize: '12.5px', fontWeight: 700, borderBottom: bdr, whiteSpace: 'nowrap' }}>Rate/Item</th>
                <th style={{ textAlign: 'center', padding: '10px 10px', fontSize: '12.5px', fontWeight: 700, borderBottom: bdr }}>Per</th>
                <th style={{ textAlign: 'right', padding: '10px 10px', fontSize: '12.5px', fontWeight: 700, borderBottom: bdr }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const qty = parseFloat(item.quantity) || 0
                const rate = parseFloat(item.rate) || 0
                const taxable = qty * rate
                const cgstRate = parseFloat(item.cgst_rate) || 0
                const sgstRate = parseFloat(item.sgst_rate) || 0
                const igstRate = parseFloat(item.igst_rate) || 0
                const taxRate = igstRate > 0 ? igstRate : cgstRate + sgstRate
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <td style={{ padding: '8px 10px', ...itemBoldStyle }}>{i + 1}</td>
                    <td style={{ padding: '8px 10px', lineHeight: 1.4, ...itemBoldStyle }}>{item.description || ''}</td>
                    <td style={{ padding: '8px 10px' }}>{item.hsn_code || '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{taxRate > 0 ? `${taxRate}%` : '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{qty} {item.unit || 'NOS'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>{fmt(rate)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>{item.unit || 'NOS'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmt(taxable)}</td>
                  </tr>
                )
              })}
              {/* Summary rows inside items table */}
              <tr style={{ fontStyle: 'italic' }}>
                <td style={{ borderTop: '1px solid #ddd', padding: '8px 10px', fontWeight: 600 }}></td>
                <td colSpan={6} style={{ borderTop: '1px solid #ddd', padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>Taxable Amount</td>
                <td style={{ borderTop: '1px solid #ddd', padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>₹{fmt(inv.subtotal)}</td>
              </tr>
              {isPrintIntraState && (
                <tr style={{ fontStyle: 'italic' }}>
                  <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px' }}></td>
                  <td colSpan={6} style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>CGST {(parseFloat(items[0]?.cgst_rate) || 9).toFixed(1)}%</td>
                  <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>₹{fmt(totalCgst)}</td>
                </tr>
              )}
              {isPrintIntraState && (
                <tr style={{ fontStyle: 'italic' }}>
                  <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px' }}></td>
                  <td colSpan={6} style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>SGST {(parseFloat(items[0]?.sgst_rate) || 9).toFixed(1)}%</td>
                  <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>₹{fmt(totalSgst)}</td>
                </tr>
              )}
              {!isPrintIntraState && (
                <tr style={{ fontStyle: 'italic' }}>
                  <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px' }}></td>
                  <td colSpan={6} style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>IGST {(parseFloat(items[0]?.igst_rate) || 18).toFixed(1)}%</td>
                  <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>₹{fmt(totalIgst)}</td>
                </tr>
              )}
              {parseFloat(inv.discount) > 0 && (
                <tr style={{ fontStyle: 'italic' }}>
                  <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px' }}></td>
                  <td colSpan={6} style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Discount</td>
                  <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>-₹{fmt(inv.discount)}</td>
                </tr>
              )}
              {parseFloat(inv.round_off) !== 0 && (
                <tr style={{ fontStyle: 'italic' }}>
                  <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px' }}></td>
                  <td colSpan={6} style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>Round Off</td>
                  <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>{parseFloat(inv.round_off) > 0 ? '+' : ''}₹{fmt(Math.abs(inv.round_off))}</td>
                </tr>
              )}
              {/* TOTAL ROW */}
              <tr style={{ borderTop: bdr }}>
                <td style={{ padding: '10px 10px' }}></td>
                <td colSpan={3} style={{ fontWeight: 700, fontSize: '15px', padding: '10px 10px' }}>Total</td>
                <td style={{ fontWeight: 700, fontSize: '15px', padding: '10px 10px', textAlign: 'right' }}>{totalQty.toFixed(3)}</td>
                <td style={{ padding: '10px 10px' }}></td>
                <td style={{ padding: '10px 10px' }}></td>
                <td style={{ fontWeight: 700, fontSize: '15px', padding: '10px 10px', textAlign: 'right' }}>₹{fmt(inv.total_amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ═══ AMOUNT IN WORDS ═══ */}
        <div style={{ padding: '10px 20px', fontSize: '13px', borderBottom: bdr, lineHeight: 1.5 }}>
          Amount Chargeable (in words): <strong>INR {numberToWords(inv.total_amount)}</strong> &nbsp;<em style={{ fontSize: '12px', color: '#666' }}>E & O.E</em>
        </div>

        {/* ═══ TAX SUMMARY TABLE ═══ */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', borderBottom: bdr }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'left', background: '#f8f8f8' }} rowSpan={2}>HSN/SAC</th>
              <th style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', background: '#f8f8f8' }} rowSpan={2}>Taxable Value</th>
              {isPrintIntraState ? (
                <>
                  <th style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', background: '#f8f8f8' }} colSpan={2}>Central Tax</th>
                  <th style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', background: '#f8f8f8' }} colSpan={2}>State Tax</th>
                </>
              ) : (
                <th style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', background: '#f8f8f8' }} colSpan={2}>Integrated Tax</th>
              )}
              <th style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', background: '#f8f8f8' }} rowSpan={2}>Total Tax Amount</th>
            </tr>
            <tr>
              <th style={{ border: '1px solid #999', padding: '4px 10px', textAlign: 'right', background: '#f8f8f8' }}>Rate</th>
              <th style={{ border: '1px solid #999', padding: '4px 10px', textAlign: 'right', background: '#f8f8f8' }}>Amount</th>
              {isPrintIntraState && (
                <>
                  <th style={{ border: '1px solid #999', padding: '4px 10px', textAlign: 'right', background: '#f8f8f8' }}>Rate</th>
                  <th style={{ border: '1px solid #999', padding: '4px 10px', textAlign: 'right', background: '#f8f8f8' }}>Amount</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {Object.entries(hsnMap).map(([hsn, d]) => (
              <tr key={hsn}>
                <td style={{ border: '1px solid #999', padding: '6px 10px' }}>{hsn}</td>
                <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right' }}>{fmt(d.taxable)}</td>
                {isPrintIntraState ? (
                  <>
                    <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right' }}>{d.cgstRate}%</td>
                    <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right' }}>{fmt(d.cgstAmt)}</td>
                    <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right' }}>{d.sgstRate}%</td>
                    <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right' }}>{fmt(d.sgstAmt)}</td>
                  </>
                ) : (
                  <>
                    <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right' }}>{d.igstRate}%</td>
                    <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right' }}>{fmt(d.igstAmt)}</td>
                  </>
                )}
                <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', fontWeight: 'bold' }}>{fmt(d.cgstAmt + d.sgstAmt + d.igstAmt)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700, background: '#f5f5f5' }}>
              <td style={{ border: '1px solid #999', padding: '6px 10px' }}>TOTAL</td>
              <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right' }}>{fmt(inv.subtotal)}</td>
              {isPrintIntraState ? (
                <>
                  <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right' }}></td>
                  <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right' }}>{fmt(totalCgst)}</td>
                  <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right' }}></td>
                  <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right' }}>{fmt(totalSgst)}</td>
                </>
              ) : (
                <>
                  <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right' }}></td>
                  <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right' }}>{fmt(totalIgst)}</td>
                </>
              )}
              <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right' }}>{fmt(totalTax)}</td>
            </tr>
          </tbody>
        </table>

        {/* ═══ PAID BLOCK ═══ */}
        {isPaid && (
          <div style={{ textAlign: 'right', padding: '10px 20px', borderBottom: bdr, fontSize: '13px' }}>
            <span style={{ color: '#1a7d3a', fontWeight: 700 }}>✔ Amount Paid</span><br />
            ₹{fmt(inv.total_amount)} Paid
          </div>
        )}

        {/* ═══ BOTTOM GRID — Bank | QR | Signature ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', borderBottom: bdr }}>
          <div style={{ padding: '16px 20px', borderRight: bdr, fontSize: '13px' }}>
            <h4 style={{ margin: '0 0 8px', fontWeight: 700 }}>Bank Details:</h4>
            {org.bank_name && <p style={{ margin: '3px 0' }}><strong>Bank:</strong> {org.bank_name}</p>}
            {org.account_no && <p style={{ margin: '3px 0' }}><strong>Account #:</strong> {org.account_no}</p>}
            {org.ifsc && <p style={{ margin: '3px 0' }}><strong>IFSC:</strong> {org.ifsc}</p>}
            {org.branch && <p style={{ margin: '3px 0' }}><strong>Branch:</strong> {org.branch}</p>}
            {org.upi_id && <p style={{ margin: '3px 0' }}><strong>UPI ID:</strong> {org.upi_id}</p>}
          </div>
          <div style={{ padding: '16px 20px', borderRight: bdr, fontSize: '13px' }}>
            <h4 style={{ margin: '0 0 8px', fontWeight: 700 }}>Pay using UPI:</h4>
            {qrUrl
              ? <img src={qrUrl} style={{ width: '130px', height: '130px', marginTop: '6px' }} />
              : <div style={{ width: '130px', height: '130px', border: '1px solid #999', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#888', marginTop: '6px' }}>QR CODE</div>
            }
          </div>
          <div style={{ padding: '16px 20px', fontSize: '13px', textAlign: 'right' }}>
            <h4 style={{ margin: '0 0 8px', fontWeight: 700 }}>For {(org.name || '').toUpperCase()}</h4>
            <div style={{ width: '140px', height: '80px', display: 'inline-block', position: 'relative', marginTop: '10px' }}>
              {org.stamp_url && <img src={org.stamp_url} style={{ position: 'absolute', width: '140px', height: '80px', objectFit: 'contain', opacity: 0.85 }} />}
              {org.signature_url && <img src={org.signature_url} style={{ position: 'relative', zIndex: 1, maxHeight: '55px', maxWidth: '110px', objectFit: 'contain' }} />}
            </div>
            <div style={{ borderTop: '1px solid #1a1a1a', display: 'inline-block', paddingTop: '4px', fontWeight: 600, fontSize: '12px', marginTop: '8px' }}>Authorized Signatory</div>
          </div>
        </div>

        {/* ═══ FOOTER GRID — Notes | Terms ═══ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ padding: '14px 20px', borderRight: bdr, fontSize: '12.5px', lineHeight: 1.6 }}>
            <h4 style={{ margin: '0 0 6px', fontWeight: 700 }}>Notes:</h4>
            <p style={{ margin: 0 }}>{inv.notes || 'Thank you for the Business'}</p>
          </div>
          <div style={{ padding: '14px 20px', fontSize: '12.5px', lineHeight: 1.6 }}>
            <h4 style={{ margin: '0 0 6px', fontWeight: 700 }}>Terms and Conditions:</h4>
            <ol style={{ margin: 0, paddingLeft: '18px' }}>
              <li>Goods once sold cannot be taken back or exchanged.</li>
              <li>Interest @18% p.a. will be charged for uncleared bills beyond 15 days.</li>
              <li>Subject to Maharashtra jurisdiction only.</li>
            </ol>
          </div>
        </div>

        {/* ═══ PAGE NOTE ═══ */}
        <div style={{ textAlign: 'left', padding: '8px 20px', fontSize: '11.5px', color: '#555', borderTop: bdr }}>
          Page 1 / 1 &nbsp; This is a computer generated invoice.
        </div>
      </div>
    </div>
  )
}
