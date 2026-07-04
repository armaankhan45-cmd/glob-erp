import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Trash2, Printer, Edit, AlertCircle, Share2, MessageCircle, Mail, LayoutTemplate } from 'lucide-react'
import api from '../api/client'

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
  '10':'Dihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur',
  '15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal',
  '20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh',
  '24':'Gujarat','25':'Daman & Diu','26':'Dadra & Nagar Haveli','27':'Maharashtra',
  '28':'Andhra Pradesh','29':'Karnataka','30':'Goa','31':'Lakshadweep',
  '32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman & Nicobar',
  '36':'Telangana','37':'Ladakh','38':'Other Territory'
}

const TEMPLATES = [
  { id: 'standard', name: 'Standard GST', desc: 'ITC-style full GST invoice' },
  { id: 'bordered', name: 'Bordered Box', desc: 'Boxed sections like quotation' },
  { id: 'compact', name: 'Modern Compact', desc: 'Clean minimalist design' },
]

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
  const [template, setTemplate] = useState(() => localStorage.getItem('invTemplate') || 'standard')
  const [templateOpen, setTemplateOpen] = useState(false)

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

  const del = async () => { if (!confirm('Delete?')) return; try { await api.delete('/invoices/' + id); navigate('/app/invoices') } catch (e) { alert('Failed') } }
  const updateStatus = async (payment_status) => { try { await api.put('/invoices/' + id, { status: data.invoice.status, payment_status }); load(parseInt(id)) } catch (e) { alert('Failed') } }
  const toggleBold = () => { const val = !boldOn; setBoldOn(val); localStorage.setItem('invBold', val) }
  const selectTemplate = (id) => { setTemplate(id); localStorage.setItem('invTemplate', id); setTemplateOpen(false) }

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
      try { const response = await fetch(pdfUrl); const htmlBlob = await response.blob(); const file = new File([htmlBlob], `Invoice_${invNum.replace(/\//g, '-')}.html`, { type: 'text/html' }); if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ text: `*TAX INVOICE ${invNum}*\nCustomer: ${custName}\nTotal: ₹${total}`, files: [file] }); setShareOpen(false); setSharing(false); return } } catch (e) { }
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
      try { await api.post(`/invoices/${id}/share-email`, { to: emailTo }); alert('Invoice sent via email!') } catch (e) {
        const org = data.organization; const subject = `Tax Invoice ${invNum} - ${org?.name || 'Our Company'}`; const body = `Dear ${custName},\n\nInvoice No: ${invNum}\nTotal: ₹${total}\n\n📄 View: ${window.location.origin}/app/invoices/${id}\n📥 PDF: ${pdfUrl}\n\nBest regards,\n${org?.name || 'Our Company'}`; window.open(`mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
      }
    } catch (err) { alert('Email share failed: ' + err.message) }
    setShareOpen(false); setSharing(false)
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
  if (error || !data) return (<div className="flex flex-col items-center justify-center h-96"><AlertCircle size={48} className="text-red-400 mb-3" /><h2 className="text-white text-lg font-bold">{error}</h2><button onClick={() => navigate('/app/invoices')} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold mt-4">Go Back</button></div>)

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
  items.forEach(item => { const hsn = item.hsn_code || 'Others'; if (!hsnMap[hsn]) hsnMap[hsn] = { taxable: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0 }; const qty = parseFloat(item.quantity) || 0; const rate = parseFloat(item.rate) || 0; const taxable = qty * rate; hsnMap[hsn].taxable += taxable; hsnMap[hsn].cgstRate = parseFloat(item.cgst_rate) || 0; hsnMap[hsn].sgstRate = parseFloat(item.sgst_rate) || 0; hsnMap[hsn].igstRate = parseFloat(item.igst_rate) || 0; hsnMap[hsn].cgstAmt += taxable * (parseFloat(item.cgst_rate) || 0) / 100; hsnMap[hsn].sgstAmt += taxable * (parseFloat(item.sgst_rate) || 0) / 100; hsnMap[hsn].igstAmt += taxable * (parseFloat(item.igst_rate) || 0) / 100 })
  const upiId = org.upi_id || ''
  const upiName = encodeURIComponent((org.name || 'GLOB FABRICATION AND ENTERPRISES').replace(/&/g, 'and'))
  const upiAmount = parseFloat(inv.total_amount || 0).toFixed(2)
  const qrUrl = upiId ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${upiName}&am=${upiAmount}&cu=INR&tn=${encodeURIComponent('Invoice ' + invNum)}`)}` : ''
  const fontFamily = org.invoice_font_family || "'Segoe UI', Arial, sans-serif"
  const fontSize = org.invoice_font_size || '9pt'
  const descSize = org.invoice_desc_size || '8pt'
  // ═══ FIX: itemBold is now an OBJECT, not a string — prevents CSSStyleDeclaration crash ═══
  const itemBoldStyle = boldOn ? { fontWeight: 'bold' } : {}

  const S = { fontFamily, fontSize, color: '#1a1a1a', width: '210mm', minHeight: '297mm', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }

  // ═══════════════════════════════════════
  // TEMPLATE 1: STANDARD GST (ITC STYLE)
  // ═══════════════════════════════════════
  const renderStandard = () => (
    <div className="bg-white shadow-lg mx-auto print-area" style={S}>
      {/* HEADER */}
      <div style={{ display: 'flex', borderBottom: '3px solid #000', padding: '10px 14px', flexShrink: 0 }}>
        <div style={{ width: '72px', height: '72px', border: '2px solid #000', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '14px', flexShrink: 0, background: '#fafafa' }}>
          {org.logo_url ? <img src={org.logo_url} style={{ maxWidth: '62px', maxHeight: '62px', objectFit: 'contain' }} /> : <span style={{ fontSize: '7px', color: '#aaa' }}>LOGO</span>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '17pt', fontWeight: '900', letterSpacing: '1px', color: '#111' }}>{(org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()}</div>
          <div style={{ fontSize: '8pt', color: '#333', marginTop: '2px' }}>{[org.address, org.city, org.state, org.pincode ? 'PIN: ' + org.pincode : ''].filter(Boolean).join(', ')}</div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '3px', fontSize: '8pt', color: '#444', flexWrap: 'wrap' }}>
            {org.gstin && <span><b>GSTIN:</b> {org.gstin}</span>}
            {org.phone && <span><b>Mobile:</b> {org.phone}</span>}
            {org.email && <span><b>Email:</b> {org.email}</span>}
          </div>
        </div>
      </div>
      {/* TITLE */}
      <div style={{ textAlign: 'center', padding: '5px 0', borderBottom: '3px solid #000', flexShrink: 0, background: '#f0f0f0' }}>
        <div style={{ fontSize: '14pt', fontWeight: '900', letterSpacing: '3px', color: '#111' }}>TAX INVOICE</div>
        <div style={{ fontSize: '7pt', fontWeight: '700', color: '#555' }}>ORIGINAL FOR RECIPIENT</div>
      </div>
      {/* CUSTOMER + INVOICE INFO */}
      <div style={{ display: 'flex', borderBottom: '2px solid #000', flexShrink: 0 }}>
        <div style={{ flex: 1, padding: '8px 12px', borderRight: '2px solid #000' }}>
          <div style={{ fontSize: '9pt', fontWeight: '700', color: '#0a3d6b', textTransform: 'uppercase', borderBottom: '1px solid #ddd', paddingBottom: '3px', marginBottom: '6px' }}>Customer Details</div>
          <div style={{ fontSize: '12pt', fontWeight: '700', textTransform: 'uppercase', marginBottom: '3px' }}>{(inv.customer_name || '').toUpperCase()}</div>
          {custGstin && <div style={{ fontSize: '9pt', marginBottom: '2px' }}><span style={{ color: '#555' }}>GSTIN:</span> <b>{custGstin}</b></div>}
          <div style={{ fontSize: '9pt', color: '#333', lineHeight: 1.5 }}><span style={{ color: '#555' }}>Billing address:</span><br />{[inv.customer_address, inv.customer_city, inv.customer_state, inv.customer_pincode].filter(Boolean).join(', ')}</div>
          {inv.customer_phone && <div style={{ fontSize: '9pt', color: '#333', marginTop: '2px' }}>Ph: {inv.customer_phone}</div>}
        </div>
        <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', fontSize: '9pt' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
            <div style={{ flex: 1, padding: '5px 8px', borderRight: '1px solid #000' }}><div style={{ color: '#555', fontWeight: '600' }}>Invoice #:</div><div style={{ fontWeight: '800' }}>{invNum}</div></div>
            <div style={{ flex: 1, padding: '5px 8px' }}><div style={{ color: '#555', fontWeight: '600' }}>Date:</div><div style={{ fontWeight: '800' }}>{invoiceDate}</div></div>
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid #000' }}>
            <div style={{ flex: 1, padding: '5px 8px', borderRight: '1px solid #000' }}><div style={{ color: '#555', fontWeight: '600' }}>Place of Supply:</div><div style={{ fontWeight: '800' }}>{placeOfSupply}</div></div>
            <div style={{ flex: 1, padding: '5px 8px' }}><div style={{ color: '#555', fontWeight: '600' }}>Reverse Charge:</div><div style={{ fontWeight: '800' }}>No</div></div>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ flex: 1, padding: '5px 8px', borderRight: '1px solid #000' }}><div style={{ color: '#555', fontWeight: '600' }}>Payment:</div><div style={{ display: 'inline-block', padding: '1px 6px', borderRadius: '3px', fontSize: '8pt', fontWeight: '700', background: isPaid ? '#d4edda' : '#fff3cd', color: isPaid ? '#155724' : '#856404' }}>{isPaid ? '✓ PAID' : '● UNPAID'}</div></div>
            <div style={{ flex: 1, padding: '5px 8px' }}><div style={{ color: '#555', fontWeight: '600' }}>State:</div><div style={{ fontWeight: '800' }}>{isPrintIntraState ? 'Intra' : 'Inter'}</div></div>
          </div>
        </div>
      </div>
      {/* ITEMS TABLE */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt', flex: 1 }}>
          <thead><tr>
            <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'center', fontWeight: '700', fontSize: '7.5pt', width: '4%' }}>#</th>
            <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'left', fontWeight: '700', fontSize: '7.5pt', width: '24%' }}>Item Description</th>
            <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'center', fontWeight: '700', fontSize: '7.5pt', width: '8%' }}>HSN/SAC</th>
            <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'right', fontWeight: '700', fontSize: '7.5pt', width: '10%' }}>Rate (₹)</th>
            <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'center', fontWeight: '700', fontSize: '7.5pt', width: '6%' }}>Qty</th>
            <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'right', fontWeight: '700', fontSize: '7.5pt', width: '12%' }}>Taxable (₹)</th>
            <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'center', fontWeight: '700', fontSize: '7.5pt', width: '8%' }}>GST %</th>
            <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'right', fontWeight: '700', fontSize: '7.5pt', width: '12%' }}>Tax Amt (₹)</th>
            <th style={{ border: '1px solid #000', padding: '4px 3px', background: '#e8e8e8', textAlign: 'right', fontWeight: '700', fontSize: '7.5pt', width: '14%' }}>Total (₹)</th>
          </tr></thead>
          <tbody>
            {items.map((item, i) => { const qty = parseFloat(item.quantity) || 0; const rate = parseFloat(item.rate) || 0; const taxable = qty * rate; const cgstRate = parseFloat(item.cgst_rate) || 0; const sgstRate = parseFloat(item.sgst_rate) || 0; const igstRate = parseFloat(item.igst_rate) || 0; const taxRate = igstRate > 0 ? igstRate : cgstRate + sgstRate; const taxAmt = taxable * taxRate / 100; const total = taxable + taxAmt; return (<tr key={i}><td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{i + 1}</td><td style={{ border: '1px solid #000', padding: '3px 4px', lineHeight: 1.3, whiteSpace: 'pre-line', fontSize: descSize, ...itemBoldStyle }}>{item.description || ''}</td><td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{item.hsn_code || '—'}</td><td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(rate)}</td><td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{qty} {item.unit || ''}</td><td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(taxable)}</td><td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{taxRate > 0 ? taxRate + '%' : '—'}</td><td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(taxAmt)}</td><td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'top' }}>{fmt(total)}</td></tr>) })}
            {items.length < 10 && Array.from({ length: 10 - items.length }).map((_, i) => (<tr key={'e' + i} style={{ height: '20px' }}>{Array.from({ length: 9 }).map((_, j) => <td key={j} style={{ border: '1px solid #000', padding: '2px' }}>&nbsp;</td>)}</tr>))}
          </tbody>
        </table>
        {/* TOTALS */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', flexShrink: 0 }}><tbody>
          <tr><td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'left', width: '52%', background: '#f8f8f8', fontWeight: '700', fontSize: '8.5pt' }}>Total items / Qty: {items.length} / {totalQty.toFixed(3)}</td><td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', width: '24%', background: '#f8f8f8' }}>Taxable Amount</td><td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right', width: '24%', background: '#f8f8f8' }}>₹{fmt(inv.subtotal)}</td></tr>
          {isPrintIntraState ? (<><tr style={{ background: '#f0f0ff' }}><td rowSpan={2} style={{ border: '1px solid #000', padding: '4px 8px' }}></td><td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>CGST @ {(parseFloat(items[0]?.cgst_rate) || 9).toFixed(1)}%</td><td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>₹{fmt(totalCgst)}</td></tr><tr style={{ background: '#f0f0ff' }}><td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>SGST @ {(parseFloat(items[0]?.sgst_rate) || 9).toFixed(1)}%</td><td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>₹{fmt(totalSgst)}</td></tr></>) : (<tr style={{ background: '#fff8f0' }}><td style={{ border: '1px solid #000', padding: '4px 8px' }}></td><td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>IGST @ {(parseFloat(items[0]?.igst_rate) || 18).toFixed(1)}%</td><td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>₹{fmt(totalIgst)}</td></tr>)}
          {parseFloat(inv.discount) > 0 && <tr><td style={{ border: '1px solid #000', padding: '4px 8px' }}></td><td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>Discount</td><td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>-₹{fmt(inv.discount)}</td></tr>}
          {parseFloat(inv.round_off) !== 0 && <tr><td style={{ border: '1px solid #000', padding: '4px 8px' }}></td><td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>Round Off</td><td style={{ border: '1px solid #000', padding: '4px 8px', textAlign: 'right' }}>{parseFloat(inv.round_off) > 0 ? '+' : ''}₹{fmt(inv.round_off)}</td></tr>}
          <tr style={{ background: '#e8e8e8' }}><td style={{ border: '2px solid #000', padding: '5px 8px', fontWeight: '800' }}></td><td style={{ border: '2px solid #000', padding: '5px 8px', textAlign: 'right', fontSize: '11pt', fontWeight: '900' }}>GRAND TOTAL</td><td style={{ border: '2px solid #000', padding: '5px 8px', textAlign: 'right', fontSize: '11pt', fontWeight: '900' }}>₹{fmt(inv.total_amount)}</td></tr>
        </tbody></table>
      </div>
      {/* AMOUNT IN WORDS */}
      <div style={{ padding: '5px 10px', fontSize: '8.5pt', borderTop: '2px solid #000', flexShrink: 0, display: 'flex', justifyContent: 'space-between', background: '#f8f8f8' }}><div><b>Total amount (in words):</b> INR {numberToWords(inv.total_amount)}</div><div style={{ fontSize: '7pt', color: '#666' }}>E & O.E</div></div>
      {/* HSN SUMMARY */}
      <div style={{ flexShrink: 0 }}><div style={{ fontSize: '8pt', fontWeight: '700', padding: '4px 6px 0', color: '#333' }}>HSN/SAC Wise Tax Summary</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}><thead><tr><th style={{ border: '1px solid #000', padding: '3px', background: '#e8e8e8', textAlign: 'center', fontSize: '7pt' }}>HSN</th><th style={{ border: '1px solid #000', padding: '3px', background: '#e8e8e8', textAlign: 'center', fontSize: '7pt' }}>Taxable</th>{isPrintIntraState ? <><th style={{ border: '1px solid #000', padding: '3px', background: '#e8e8e8', textAlign: 'center', fontSize: '7pt' }} colSpan={2}>Central Tax</th><th style={{ border: '1px solid #000', padding: '3px', background: '#e8e8e8', textAlign: 'center', fontSize: '7pt' }} colSpan={2}>State Tax</th></> : <th style={{ border: '1px solid #000', padding: '3px', background: '#e8e8e8', textAlign: 'center', fontSize: '7pt' }} colSpan={2}>Integrated Tax</th>}<th style={{ border: '1px solid #000', padding: '3px', background: '#e8e8e8', textAlign: 'center', fontSize: '7pt' }}>Total Tax</th></tr></thead>
          <tbody>{Object.entries(hsnMap).map(([hsn, d]) => (<tr key={hsn}><td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', fontSize: '7pt' }}>{hsn}</td><td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>{fmt(d.taxable)}</td>{isPrintIntraState ? <><td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', fontSize: '7pt' }}>{d.cgstRate}%</td><td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>{fmt(d.cgstAmt)}</td><td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', fontSize: '7pt' }}>{d.sgstRate}%</td><td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>{fmt(d.sgstAmt)}</td></> : <><td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', fontSize: '7pt' }}>{d.igstRate}%</td><td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>{fmt(d.igstAmt)}</td></>}<td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt', fontWeight: 'bold' }}>{fmt(d.cgstAmt + d.sgstAmt + d.igstAmt)}</td></tr>))}
            <tr style={{ fontWeight: '700', background: '#f0f0f0' }}><td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', fontSize: '7pt' }}>TOTAL</td><td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>₹{fmt(inv.subtotal)}</td>{isPrintIntraState ? <><td style={{ border: '1px solid #000', padding: '1px 3px', fontSize: '7pt' }}></td><td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>₹{fmt(totalCgst)}</td><td style={{ border: '1px solid #000', padding: '1px 3px', fontSize: '7pt' }}></td><td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>₹{fmt(totalSgst)}</td></> : <><td style={{ border: '1px solid #000', padding: '1px 3px', fontSize: '7pt' }}></td><td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>₹{fmt(totalIgst)}</td></>}<td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'right', fontSize: '7pt' }}>₹{fmt(totalTax)}</td></tr>
          </tbody></table>
      </div>
      {/* BANK + QR + SIGN */}
      <div style={{ display: 'flex', borderTop: '2px solid #000', marginTop: 'auto', flexShrink: 0 }}>
        <div style={{ width: '40%', padding: '6px 10px', fontSize: '8pt', lineHeight: 1.6, borderRight: '1px solid #000' }}><div style={{ fontWeight: '700', borderBottom: '1px solid #ccc', paddingBottom: '2px', marginBottom: '3px', fontSize: '7.5pt' }}>Bank Details:</div>{org.bank_name && <div><b>Bank:</b> {org.bank_name}</div>}{org.account_no && <div><b>A/C No:</b> {org.account_no}</div>}{org.ifsc && <div><b>IFSC:</b> {org.ifsc}</div>}{org.branch && <div><b>Branch:</b> {org.branch}</div>}{org.upi_id && <div><b>UPI ID:</b> {org.upi_id}</div>}</div>
        <div style={{ width: '18%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRight: '1px solid #000' }}>{qrUrl ? <><img src={qrUrl} style={{ width: '72px', height: '72px' }} /><div style={{ fontSize: '5.5pt', color: '#666', marginTop: '2px' }}>Scan to Pay</div></> : <div style={{ fontSize: '7pt', color: '#aaa' }}>QR Code</div>}</div>
        <div style={{ width: '42%', padding: '6px 10px', fontSize: '8pt', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', textAlign: 'right' }}><div style={{ marginBottom: '4px' }}>For <b>{(org.name || '').toUpperCase()}</b></div><div style={{ width: '100px', height: '60px', display: 'inline-block', marginBottom: '4px', position: 'relative' }}>{org.stamp_url && <img src={org.stamp_url} style={{ position: 'absolute', width: '100px', height: '60px', objectFit: 'contain', opacity: 0.85 }} />}{org.signature_url && <img src={org.signature_url} style={{ position: 'relative', zIndex: 1, maxHeight: '40px', maxWidth: '80px', objectFit: 'contain' }} />}</div><div style={{ borderTop: '1px solid #000', display: 'inline-block', paddingTop: '2px', fontWeight: '600', fontSize: '8pt' }}>Authorized Signatory</div></div>
      </div>
      {inv.notes && <div style={{ padding: '4px 10px', fontSize: '7.5pt', borderTop: '1px solid #000', flexShrink: 0, color: '#444' }}><b>Notes:</b> {inv.notes}</div>}
      <div style={{ padding: '3px 10px', fontSize: '7pt', borderTop: '1px solid #ccc', flexShrink: 0, color: '#777' }}><b>Terms:</b> 1. Goods once sold will not be taken back. 2. Interest @ 18% p.a. on delayed payments. 3. Subject to Maharashtra jurisdiction.</div>
      <div style={{ textAlign: 'center', fontSize: '6.5pt', color: '#999', padding: '3px 0', borderTop: '1px solid #ddd', flexShrink: 0 }}>Computer Generated Invoice | {(org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()} | Page 1 of 1</div>
    </div>
  )

  // ═══════════════════════════════════════
  // TEMPLATE 2: BORDERED BOX (LIKE QUOTATION)
  // ═══════════════════════════════════════
  const renderBordered = () => (
    <div className="bg-white shadow-lg mx-auto print-area" style={{ ...S, border: '2px solid #000', margin: '0 auto' }}>
      {/* LETTERHEAD SPACE */}
      <div style={{ padding: '12px 16px', borderBottom: '2px solid #000', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {org.logo_url && <img src={org.logo_url} style={{ width: '55px', height: '55px', objectFit: 'contain' }} />}
          <div><div style={{ fontSize: '15pt', fontWeight: '900', color: '#111' }}>{(org.name || '').toUpperCase()}</div><div style={{ fontSize: '7.5pt', color: '#555' }}>{[org.address, org.city, org.state].filter(Boolean).join(', ')}</div></div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '8pt', color: '#555' }}>{org.gstin && <div><b>GSTIN:</b> {org.gstin}</div>}{org.phone && <div><b>Ph:</b> {org.phone}</div>}</div>
      </div>
      {/* TITLE */}
      <div style={{ textAlign: 'center', padding: '6px 0', borderBottom: '2px solid #000', background: '#f5f5f5' }}><div style={{ fontSize: '13pt', fontWeight: '900', letterSpacing: '2px' }}>TAX INVOICE</div></div>
      {/* CUSTOMER + INFO — inside bordered box */}
      <div style={{ padding: '8px 14px', borderBottom: '1px solid #000', display: 'flex' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10pt', fontWeight: '700', color: '#0a3d6b', marginBottom: '4px' }}>Customer:</div>
          <div style={{ fontSize: '12pt', fontWeight: '700', textTransform: 'uppercase' }}>{(inv.customer_name || '').toUpperCase()}</div>
          {custGstin && <div style={{ fontSize: '8pt', marginTop: '2px' }}>GSTIN: <b>{custGstin}</b></div>}
          <div style={{ fontSize: '8.5pt', color: '#333', marginTop: '2px' }}>{[inv.customer_address, inv.customer_city, inv.customer_state, inv.customer_pincode].filter(Boolean).join(', ')}</div>
        </div>
        <div style={{ width: '220px', fontSize: '8.5pt', lineHeight: 1.8 }}>
          <div><b>Invoice #:</b> {invNum}</div><div><b>Date:</b> {invoiceDate}</div><div><b>Place of Supply:</b> {placeOfSupply}</div><div><b>State:</b> {isPrintIntraState ? 'Intra-State' : 'Inter-State'}</div>
        </div>
      </div>
      {/* ITEMS */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt' }}>
        <thead><tr><th style={{ border: '1px solid #000', padding: '4px', background: '#f0f0f0', fontSize: '7.5pt' }}>#</th><th style={{ border: '1px solid #000', padding: '4px', background: '#f0f0f0', fontSize: '7.5pt' }}>Description</th><th style={{ border: '1px solid #000', padding: '4px', background: '#f0f0f0', fontSize: '7.5pt' }}>HSN</th><th style={{ border: '1px solid #000', padding: '4px', background: '#f0f0f0', fontSize: '7.5pt' }}>Qty</th><th style={{ border: '1px solid #000', padding: '4px', background: '#f0f0f0', fontSize: '7.5pt' }}>Rate</th><th style={{ border: '1px solid #000', padding: '4px', background: '#f0f0f0', fontSize: '7.5pt' }}>Taxable</th><th style={{ border: '1px solid #000', padding: '4px', background: '#f0f0f0', fontSize: '7.5pt' }}>GST%</th><th style={{ border: '1px solid #000', padding: '4px', background: '#f0f0f0', fontSize: '7.5pt' }}>Tax</th><th style={{ border: '1px solid #000', padding: '4px', background: '#f0f0f0', fontSize: '7.5pt' }}>Total</th></tr></thead>
        <tbody>
          {items.map((item, i) => { const qty = parseFloat(item.quantity) || 0; const rate = parseFloat(item.rate) || 0; const taxable = qty * rate; const cgstR = parseFloat(item.cgst_rate) || 0; const igstR = parseFloat(item.igst_rate) || 0; const taxR = igstR > 0 ? igstR : cgstR + parseFloat(item.sgst_rate); const taxA = taxable * taxR / 100; return (<tr key={i}><td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{i + 1}</td><td style={{ border: '1px solid #000', padding: '3px', ...itemBoldStyle }}>{item.description || ''}</td><td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{item.hsn_code || '—'}</td><td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{qty}</td><td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>{fmt(rate)}</td><td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>{fmt(taxable)}</td><td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{taxR}%</td><td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>{fmt(taxA)}</td><td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', fontWeight: 'bold' }}>{fmt(taxable + taxA)}</td></tr>) })}
          {items.length < 10 && Array.from({ length: 10 - items.length }).map((_, i) => <tr key={'e' + i} style={{ height: '18px' }}>{Array.from({ length: 9 }).map((_, j) => <td key={j} style={{ border: '1px solid #000', padding: '2px' }}></td>)}</tr>)}
        </tbody>
      </table>
      {/* TOTALS inside box */}
      <div style={{ display: 'flex', borderTop: '1px solid #000', flexShrink: 0 }}>
        <div style={{ flex: 1, padding: '6px 12px', fontSize: '8pt' }}>
          <div><b>Amount in words:</b> INR {numberToWords(inv.total_amount)}</div>
        </div>
        <div style={{ width: '280px', fontSize: '8.5pt' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #000' }}><div style={{ flex: 1, padding: '4px 8px' }}>Taxable</div><div style={{ padding: '4px 8px', textAlign: 'right' }}>₹{fmt(inv.subtotal)}</div></div>
          {isPrintIntraState ? (<><div style={{ display: 'flex', borderBottom: '1px solid #000', background: '#f0f0ff' }}><div style={{ flex: 1, padding: '4px 8px' }}>CGST</div><div style={{ padding: '4px 8px', textAlign: 'right' }}>₹{fmt(totalCgst)}</div></div><div style={{ display: 'flex', borderBottom: '1px solid #000', background: '#f0f0ff' }}><div style={{ flex: 1, padding: '4px 8px' }}>SGST</div><div style={{ padding: '4px 8px', textAlign: 'right' }}>₹{fmt(totalSgst)}</div></div></>) : (<div style={{ display: 'flex', borderBottom: '1px solid #000', background: '#fff8f0' }}><div style={{ flex: 1, padding: '4px 8px' }}>IGST</div><div style={{ padding: '4px 8px', textAlign: 'right' }}>₹{fmt(totalIgst)}</div></div>)}
          <div style={{ display: 'flex', background: '#e8e8e8', fontWeight: '900', fontSize: '10pt' }}><div style={{ flex: 1, padding: '5px 8px' }}>TOTAL</div><div style={{ padding: '5px 8px', textAlign: 'right' }}>₹{fmt(inv.total_amount)}</div></div>
        </div>
      </div>
      {/* BANK + SIGN — 30mm space */}
      <div style={{ display: 'flex', borderTop: '2px solid #000', marginTop: 'auto', minHeight: '30mm', flexShrink: 0 }}>
        <div style={{ flex: 1, padding: '8px 12px', fontSize: '8pt' }}><b>Bank Details:</b><br />{org.bank_name && <span>Bank: {org.bank_name} | </span>}{org.account_no && <span>A/C: {org.account_no} | </span>}{org.ifsc && <span>IFSC: {org.ifsc}</span>}</div>
        <div style={{ width: '200px', padding: '8px 12px', textAlign: 'right', fontSize: '8pt' }}><div>For <b>{(org.name || '').toUpperCase()}</b></div><div style={{ height: '50px', position: 'relative' }}>{org.stamp_url && <img src={org.stamp_url} style={{ position: 'absolute', right: 0, width: '80px', height: '50px', objectFit: 'contain', opacity: 0.8 }} />}{org.signature_url && <img src={org.signature_url} style={{ position: 'relative', zIndex: 1, maxHeight: '35px', objectFit: 'contain' }} />}</div><div style={{ borderTop: '1px solid #000', display: 'inline-block', paddingTop: '2px' }}>Authorized Signatory</div></div>
      </div>
      <div style={{ textAlign: 'center', fontSize: '6.5pt', color: '#999', padding: '3px 0', borderTop: '1px solid #ddd' }}>Computer Generated Invoice | Page 1 of 1</div>
    </div>
  )

  // ═══════════════════════════════════════
  // TEMPLATE 3: MODERN COMPACT
  // ═══════════════════════════════════════
  const renderCompact = () => (
    <div className="bg-white shadow-lg mx-auto print-area" style={{ ...S, padding: '8px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #1a5276', paddingBottom: '8px', marginBottom: '8px' }}>
        <div>{org.logo_url && <img src={org.logo_url} style={{ width: '45px', height: '45px', objectFit: 'contain', marginBottom: '4px' }} />}<div style={{ fontSize: '14pt', fontWeight: '900', color: '#1a5276' }}>{(org.name || '').toUpperCase()}</div><div style={{ fontSize: '7pt', color: '#666' }}>{[org.address, org.city, org.state, org.pincode].filter(Boolean).join(', ')}</div><div style={{ fontSize: '7pt', color: '#666', marginTop: '2px' }}>{org.gstin && <span>GSTIN: {org.gstin}</span>} {org.phone && <span>| {org.phone}</span>}</div></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontSize: '11pt', fontWeight: '800', color: '#1a5276', letterSpacing: '1px' }}>TAX INVOICE</div><div style={{ fontSize: '8pt', marginTop: '4px', color: '#555' }}>#{invNum}</div><div style={{ fontSize: '8pt', color: '#555' }}>{invoiceDate}</div><div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '3px', fontSize: '7pt', fontWeight: '700', marginTop: '4px', background: isPaid ? '#d4edda' : '#fff3cd', color: isPaid ? '#155724' : '#856404' }}>{isPaid ? 'PAID' : 'UNPAID'}</div></div>
      </div>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '8px', fontSize: '8pt' }}>
        <div style={{ flex: 1, background: '#f8f9fa', borderRadius: '4px', padding: '6px 8px' }}><div style={{ fontWeight: '700', color: '#1a5276', marginBottom: '2px' }}>Bill To</div><div style={{ fontWeight: '700' }}>{(inv.customer_name || '').toUpperCase()}</div>{custGstin && <div style={{ color: '#666' }}>GSTIN: {custGstin}</div>}<div style={{ color: '#555' }}>{[inv.customer_address, inv.customer_city, inv.customer_state].filter(Boolean).join(', ')}</div></div>
        <div style={{ width: '180px', background: '#f8f9fa', borderRadius: '4px', padding: '6px 8px' }}><div><b>Supply:</b> {placeOfSupply}</div><div><b>Type:</b> {isPrintIntraState ? 'Intra-State' : 'Inter-State'}</div></div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt', marginBottom: '8px' }}>
        <thead><tr style={{ background: '#1a5276', color: '#fff' }}><th style={{ padding: '4px 3px', textAlign: 'center', fontSize: '7pt' }}>#</th><th style={{ padding: '4px 3px', textAlign: 'left', fontSize: '7pt' }}>Item</th><th style={{ padding: '4px 3px', textAlign: 'center', fontSize: '7pt' }}>HSN</th><th style={{ padding: '4px 3px', textAlign: 'center', fontSize: '7pt' }}>Qty</th><th style={{ padding: '4px 3px', textAlign: 'right', fontSize: '7pt' }}>Rate</th><th style={{ padding: '4px 3px', textAlign: 'right', fontSize: '7pt' }}>Taxable</th><th style={{ padding: '4px 3px', textAlign: 'center', fontSize: '7pt' }}>GST</th><th style={{ padding: '4px 3px', textAlign: 'right', fontSize: '7pt' }}>Total</th></tr></thead>
        <tbody>
          {items.map((item, i) => { const qty = parseFloat(item.quantity) || 0; const rate = parseFloat(item.rate) || 0; const taxable = qty * rate; const cgstR = parseFloat(item.cgst_rate) || 0; const igstR = parseFloat(item.igst_rate) || 0; const taxR = igstR > 0 ? igstR : cgstR + parseFloat(item.sgst_rate); const taxA = taxable * taxR / 100; return (<tr key={i} style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '3px', textAlign: 'center' }}>{i + 1}</td><td style={{ padding: '3px', ...itemBoldStyle }}>{item.description}</td><td style={{ padding: '3px', textAlign: 'center', color: '#666' }}>{item.hsn_code || '—'}</td><td style={{ padding: '3px', textAlign: 'center' }}>{qty}</td><td style={{ padding: '3px', textAlign: 'right' }}>{fmt(rate)}</td><td style={{ padding: '3px', textAlign: 'right' }}>{fmt(taxable)}</td><td style={{ padding: '3px', textAlign: 'center' }}>{taxR}%</td><td style={{ padding: '3px', textAlign: 'right', fontWeight: 'bold' }}>{fmt(taxable + taxA)}</td></tr>) })}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
        <div style={{ width: '250px', fontSize: '8pt' }}>
          <div style={{ display: 'flex', padding: '3px 0' }}><div style={{ flex: 1 }}>Taxable</div><div style={{ textAlign: 'right' }}>₹{fmt(inv.subtotal)}</div></div>
          {isPrintIntraState ? (<><div style={{ display: 'flex', padding: '3px 0', color: '#6b5ce7' }}><div style={{ flex: 1 }}>CGST</div><div style={{ textAlign: 'right' }}>₹{fmt(totalCgst)}</div></div><div style={{ display: 'flex', padding: '3px 0', color: '#6b5ce7' }}><div style={{ flex: 1 }}>SGST</div><div style={{ textAlign: 'right' }}>₹{fmt(totalSgst)}</div></div></>) : (<div style={{ display: 'flex', padding: '3px 0', color: '#e74c3c' }}><div style={{ flex: 1 }}>IGST</div><div style={{ textAlign: 'right' }}>₹{fmt(totalIgst)}</div></div>)}
          <div style={{ display: 'flex', borderTop: '2px solid #1a5276', marginTop: '4px', paddingTop: '4px', fontWeight: '900', fontSize: '11pt', color: '#1a5276' }}><div style={{ flex: 1 }}>TOTAL</div><div style={{ textAlign: 'right' }}>₹{fmt(inv.total_amount)}</div></div>
        </div>
      </div>
      <div style={{ fontSize: '7.5pt', color: '#555', borderTop: '1px solid #eee', paddingTop: '4px', marginBottom: '8px' }}><b>Amount in words:</b> INR {numberToWords(inv.total_amount)}</div>
      <div style={{ display: 'flex', gap: '12px', fontSize: '7pt', color: '#666', borderTop: '1px solid #eee', paddingTop: '6px', marginTop: 'auto' }}>
        <div style={{ flex: 1 }}>{org.bank_name && <div><b>Bank:</b> {org.bank_name}</div>}{org.account_no && <div><b>A/C:</b> {org.account_no}</div>}{org.ifsc && <div><b>IFSC:</b> {org.ifsc}</div>}</div>
        <div style={{ textAlign: 'right' }}>{qrUrl && <img src={qrUrl} style={{ width: '50px', height: '50px' }} />}<div style={{ marginTop: '4px' }}>For <b>{(org.name || '').toUpperCase()}</b></div><div style={{ height: '30px' }}>{org.signature_url && <img src={org.signature_url} style={{ maxHeight: '25px', objectFit: 'contain' }} />}</div><div style={{ borderTop: '1px solid #000', display: 'inline-block', fontSize: '7pt' }}>Signatory</div></div>
      </div>
      {inv.notes && <div style={{ fontSize: '7pt', color: '#666', borderTop: '1px solid #eee', paddingTop: '4px' }}><b>Notes:</b> {inv.notes}</div>}
      <div style={{ textAlign: 'center', fontSize: '6pt', color: '#bbb', padding: '3px 0', borderTop: '1px solid #eee', marginTop: '4px' }}>Computer Generated Invoice | Page 1 of 1</div>
    </div>
  )

  const renderTemplate = () => {
    if (template === 'bordered') return renderBordered()
    if (template === 'compact') return renderCompact()
    return renderStandard()
  }

  return (
    <div className="space-y-4">
      {/* ACTION BAR */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button onClick={() => navigate('/app/invoices')} className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold flex-1 text-white">Invoice {inv.invoice_number}</h1>
        <button onClick={toggleBold} className={`px-3 py-2 rounded-lg font-medium text-sm ${boldOn ? 'bg-white/10 text-white border border-white/15' : 'btn-secondary'}`}>Bold {boldOn ? 'ON' : 'OFF'}</button>
        {/* TEMPLATE SELECTOR */}
        <div className="relative">
          <button onClick={() => setTemplateOpen(!templateOpen)} className="btn-secondary flex items-center gap-2"><LayoutTemplate size={14} /> {TEMPLATES.find(t => t.id === template)?.name}</button>
          {templateOpen && (<><div className="fixed inset-0 z-40" onClick={() => setTemplateOpen(false)} /><div className="absolute right-0 top-full mt-1 z-50 rounded-xl p-2 min-w-[220px]" style={{ background: 'rgba(14,18,36,0.97)', border: '1px solid rgba(255,255,255,0.10)' }}>{TEMPLATES.map(t => (<button key={t.id} onClick={() => selectTemplate(t.id)} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition ${template === t.id ? 'bg-blue-500/20 text-blue-400' : 'text-white/70 hover:bg-white/5'}`}><div className="font-bold">{t.name}</div><div style={{ fontSize: '10px', color: '#94a3b8' }}>{t.desc}</div></button>))}</div></>)}
        </div>
        <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2"><Printer size={16} /> Print</button>
        <button onClick={() => handleAction('download')} className="btn-secondary flex items-center gap-2"><Download size={16} /> PDF</button>
        {/* SHARE */}
        <div className="relative">
          <button onClick={() => setShareOpen(!shareOpen)} className="btn-secondary flex items-center gap-2"><Share2 size={16} /> Share</button>
          {shareOpen && (<div className="absolute right-0 top-full mt-1 rounded-xl shadow-2xl z-50 min-w-[180px] overflow-hidden" style={{ background: 'rgba(14,18,36,0.97)', border: '1px solid rgba(255,255,255,0.10)' }}><button onClick={handleWhatsApp} disabled={sharing} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 text-green-400 text-sm font-medium"><MessageCircle size={18} /> {sharing ? 'Sharing...' : 'WhatsApp'}</button><button onClick={handleEmail} disabled={sharing} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 text-blue-400 text-sm font-medium border-t border-white/5"><Mail size={18} /> {sharing ? 'Sending...' : 'Email'}</button></div>)}
        </div>
        <button onClick={() => navigate('/app/invoices/' + id + '/edit')} className="btn-primary flex items-center gap-2"><Edit size={16} /> Edit</button>
        <button onClick={del} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>
      </div>
      {/* PAYMENT STATUS */}
      <div className="glass rounded-2xl p-3 no-print">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">Payment:</span>
          <select value={inv.payment_status || 'Unpaid'} onChange={e => updateStatus(e.target.value)} className={"px-4 py-2 rounded-xl text-sm font-bold border-2 bg-slate-800/80 " + (inv.payment_status === 'Paid' ? 'text-emerald-400 border-emerald-500/30' : inv.payment_status === 'Partial' ? 'text-amber-400 border-amber-500/30' : 'text-red-400 border-red-500/30')}><option>Unpaid</option><option>Partial</option><option>Paid</option></select>
        </div>
      </div>
      {/* INVOICE — SELECTED TEMPLATE */}
      {renderTemplate()}
    </div>
  )
}
