import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Trash2, Printer, Edit, AlertCircle, Share2, MessageCircle, Mail, LayoutTemplate } from 'lucide-react'
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
  const [layout, setLayout] = useState(() => localStorage.getItem('invLayout') || 'pro')

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
      const url = `${api.defaults.baseURL}/invoices/${id}/pdf?token=${token}&layout=${layout}`
      if (action === 'download' || action === 'preview') window.open(url, '_blank')
      else if (action === 'print') { const w = window.open(url, '_blank'); if (w) w.onload = () => w.print() }
    } catch (e) { alert('Failed: ' + e.message) }
  }

  const handleWhatsApp = async () => {
    setSharing(true)
    try {
      const inv = data.invoice; const token = localStorage.getItem('token')
      const pdfUrl = `${api.defaults.baseURL}/invoices/${id}/pdf?token=${token}&layout=${layout}`
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
      const pdfUrl = `${api.defaults.baseURL}/invoices/${id}/pdf?token=${token}&layout=${layout}`
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

  const switchLayout = (val) => {
    setLayout(val)
    localStorage.setItem('invLayout', val)
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

  // ═══════════════════════════════════════════
  //  SHARED DATA for both layouts
  // ═══════════════════════════════════════════
  const shared = { inv, items, org, invNum, isPaid, placeOfSupply, invoiceDate, totalQty, isPrintIntraState, totalCgst, totalSgst, totalIgst, totalTax, hsnMap, qrUrl, custGstin, custStateCode, orgStateCode, fontFamily, boldOn, fmt }

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button onClick={() => navigate('/app/invoices')} className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold flex-1 text-white">Invoice {inv.invoice_number}</h1>

        {/* Layout Switcher */}
        <div className="relative">
          <button
            onClick={(e) => {
              const next = layout === 'pro' ? 'classic' : 'pro'
              switchLayout(next)
            }}
            className="btn-secondary flex items-center gap-2"
            title="Switch layout"
          >
            <LayoutTemplate size={16} />
            <span className="text-xs font-bold tracking-wide uppercase">{layout === 'pro' ? 'PRO' : 'Classic'}</span>
          </button>
        </div>

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

      {/* ═══════════════════════════════════════
          LAYOUT SWITCH
          ═══════════════════════════════════════ */}
      {layout === 'pro' ? <ProLayout {...shared} /> : <ClassicLayout {...shared} />}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PRO LAYOUT — Dark Navy Header, Accent Stripes, Modern
   ═══════════════════════════════════════════════════════════════ */
function ProLayout({ inv, items, org, invNum, isPaid, placeOfSupply, invoiceDate, totalQty, isPrintIntraState, totalCgst, totalSgst, totalIgst, totalTax, hsnMap, qrUrl, custGstin, custStateCode, orgStateCode, fontFamily, boldOn, fmt }) {
  const NAVY = '#0d1b2a'
  const B = `1.5px solid ${NAVY}`
  const DIVIDER = '1.5px solid #ccc'

  return (
    <div className="bg-white shadow-lg mx-auto print-area" style={{ fontFamily, maxWidth: 900, margin: '0 auto', background: '#fff', border: `2px solid ${NAVY}`, color: '#000', fontWeight: 600, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>

      {/* ═══ HEADER BAR — Navy with high-contrast white text ═══ */}
      <div style={{ background: `linear-gradient(135deg, #0f2744 0%, #1a3a5c 100%)`, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 68, height: 68, flexShrink: 0, borderRadius: 6, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.4)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          {org.logo_url
            ? <img src={org.logo_url} style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 4 }} alt="Logo" />
            : <span style={{ fontSize: 9, color: '#0f2744', fontWeight: 800 }}>LOGO</span>
          }
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: 2, lineHeight: 1.2, margin: '0 0 3px', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{(org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()}</h1>
          {org.gstin && <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '2px 10px', borderRadius: 3, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>GSTIN: {org.gstin}</span>}
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.95)', marginTop: 3, lineHeight: 1.5, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{[org.address, org.city, org.state, org.pincode ? 'PIN: ' + org.pincode : ''].filter(Boolean).join(', ')}</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.95)', marginTop: 1, lineHeight: 1.5, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{org.phone ? `📞 ${org.phone}` : ''}{org.email ? `  ✉ ${org.email}` : ''}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: 4, textShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>TAX INVOICE</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.9)', letterSpacing: 1, fontWeight: 600, marginTop: 3, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>ORIGINAL FOR RECIPIENT</div>
        </div>
      </div>

      {/* Accent stripe */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6, #06b6d4)' }} />

      {/* ═══ META ROW — Invoice # | Date | Place of Supply ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: B }}>
        <div style={{ padding: '12px 20px', borderRight: DIVIDER }}>
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: 1, color: '#666', fontWeight: 700, marginBottom: 2 }}>Invoice #</div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#000' }}>{invNum}</div>
        </div>
        <div style={{ padding: '12px 20px', borderRight: DIVIDER }}>
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: 1, color: '#666', fontWeight: 700, marginBottom: 2 }}>Invoice Date</div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#000' }}>{invoiceDate}</div>
        </div>
        <div style={{ padding: '12px 20px' }}>
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: 1, color: '#666', fontWeight: 700, marginBottom: 2 }}>Place of Supply</div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#000' }}>{placeOfSupply}</div>
        </div>
      </div>

      {/* ═══ ADDRESS GRID — Bill To | Ship To ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: B }}>
        <div style={{ padding: '12px 20px', borderRight: DIVIDER, fontSize: 12, lineHeight: 1.5, color: '#000' }}>
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: 1, color: '#666', fontWeight: 700, marginBottom: 4 }}>Bill To</div>
          <p style={{ fontWeight: 800, fontSize: 14, color: '#000', margin: '0 0 2px' }}>{(inv.customer_name || '').toUpperCase()}</p>
          {custGstin && <p style={{ margin: '1px 0', fontWeight: 700, color: '#000' }}><strong>GSTIN:</strong> {custGstin}</p>}
          <p style={{ margin: '1px 0', fontWeight: 600, color: '#000' }}>{[inv.customer_address, inv.customer_city].filter(Boolean).join(', ')}</p>
          <p style={{ margin: '1px 0', fontWeight: 600, color: '#000' }}>{[inv.customer_state, inv.customer_pincode].filter(Boolean).join(', ')}</p>
          {inv.customer_phone && <p style={{ margin: '1px 0', fontWeight: 600, color: '#000' }}>Ph: {inv.customer_phone}</p>}
        </div>
        <div style={{ padding: '12px 20px', fontSize: 12, lineHeight: 1.5, color: '#000' }}>
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: 1, color: '#666', fontWeight: 700, marginBottom: 4 }}>Ship To</div>
          <p style={{ margin: '1px 0', fontWeight: 600, color: '#000' }}>{[inv.customer_address, inv.customer_city].filter(Boolean).join(', ')}</p>
          <p style={{ margin: '1px 0', fontWeight: 600, color: '#000' }}>{[inv.customer_state, inv.customer_pincode].filter(Boolean).join(', ')}</p>
        </div>
      </div>

      {/* ═══ ITEMS TABLE — Dark Header ═══ */}
      <div style={{ borderBottom: B }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', color: '#000' }}>
          <thead>
            <tr>
              {['#','Item Description','HSN/SAC','Tax','Qty','Rate/Item','Per','Amount'].map((h, i) => (
                <th key={h} style={{
                  padding: '10px 10px', fontSize: '10.5px', fontWeight: 800,
                  textTransform: 'uppercase', letterSpacing: 0.8, color: '#fff',
                  background: NAVY, textAlign: i <= 2 ? 'left' : i === 5 || i === 6 ? 'center' : 'right',
                  whiteSpace: i === 0 || i === 3 || i === 4 || i === 5 ? 'nowrap' : 'normal'
                }}>{h}</th>
              ))}
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
              const itemFW = boldOn ? 800 : 600
              const rowBg = i % 2 === 1 ? '#fafbfc' : '#fff'
              return (
                <tr key={i} style={{ borderBottom: '1px solid #e8e8e8', background: rowBg }}>
                  <td style={{ padding: '8px 10px', fontWeight: itemFW, color: '#000' }}>{i + 1}</td>
                  <td style={{ padding: '8px 10px', lineHeight: 1.4, fontWeight: itemFW, color: '#000' }}>{item.description || ''}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#000' }}>{item.hsn_code || '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{taxRate > 0 ? `${taxRate}%` : '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{qty} {item.unit || 'NOS'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#000' }}>{fmt(rate)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#000' }}>{item.unit || 'NOS'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>{fmt(taxable)}</td>
                </tr>
              )
            })}
            {/* Summary rows */}
            <tr style={{ background: '#f5f7fa' }}>
              <td style={{ borderTop: '1px solid #e2e8f0', padding: '8px 10px' }}></td>
              <td colSpan={6} style={{ borderTop: '1px solid #e2e8f0', padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>Taxable Amount</td>
              <td style={{ borderTop: '1px solid #e2e8f0', padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>₹{fmt(inv.subtotal)}</td>
            </tr>
            {isPrintIntraState && (
              <>
                <tr style={{ background: '#f5f7fa' }}>
                  <td style={{ borderTop: '1px solid #e2e8f0', padding: '6px 10px' }}></td>
                  <td colSpan={6} style={{ borderTop: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>CGST {(parseFloat(items[0]?.cgst_rate) || 9).toFixed(1)}%</td>
                  <td style={{ borderTop: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>₹{fmt(totalCgst)}</td>
                </tr>
                <tr style={{ background: '#f5f7fa' }}>
                  <td style={{ borderTop: '1px solid #e2e8f0', padding: '6px 10px' }}></td>
                  <td colSpan={6} style={{ borderTop: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>SGST {(parseFloat(items[0]?.sgst_rate) || 9).toFixed(1)}%</td>
                  <td style={{ borderTop: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>₹{fmt(totalSgst)}</td>
                </tr>
              </>
            )}
            {!isPrintIntraState && (
              <tr style={{ background: '#f5f7fa' }}>
                <td style={{ borderTop: '1px solid #e2e8f0', padding: '6px 10px' }}></td>
                <td colSpan={6} style={{ borderTop: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>IGST {(parseFloat(items[0]?.igst_rate) || 18).toFixed(1)}%</td>
                <td style={{ borderTop: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>₹{fmt(totalIgst)}</td>
              </tr>
            )}
            {parseFloat(inv.discount) > 0 && (
              <tr style={{ background: '#f5f7fa' }}>
                <td style={{ borderTop: '1px solid #e2e8f0', padding: '6px 10px' }}></td>
                <td colSpan={6} style={{ borderTop: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>Discount</td>
                <td style={{ borderTop: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>-₹{fmt(inv.discount)}</td>
              </tr>
            )}
            {parseFloat(inv.round_off) !== 0 && (
              <tr style={{ background: '#f5f7fa' }}>
                <td style={{ borderTop: '1px solid #e2e8f0', padding: '6px 10px' }}></td>
                <td colSpan={6} style={{ borderTop: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>Round Off</td>
                <td style={{ borderTop: '1px solid #e2e8f0', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>{parseFloat(inv.round_off) > 0 ? '+' : ''}₹{fmt(Math.abs(inv.round_off))}</td>
              </tr>
            )}
            {/* TOTAL ROW */}
            <tr style={{ borderTop: `2px solid ${NAVY}`, background: '#f0f2f5' }}>
              <td style={{ padding: '10px' }}></td>
              <td colSpan={3} style={{ fontWeight: 900, fontSize: 14, padding: '10px', color: '#000' }}>Total</td>
              <td style={{ fontWeight: 900, fontSize: 14, padding: '10px', textAlign: 'right', color: '#000' }}>{totalQty.toFixed(3)}</td>
              <td style={{ padding: '10px' }}></td>
              <td style={{ padding: '10px' }}></td>
              <td style={{ fontWeight: 900, fontSize: 14, padding: '10px', textAlign: 'right', color: '#000' }}>₹{fmt(inv.total_amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* AMOUNT IN WORDS */}
      <div style={{ padding: '10px 20px', fontSize: '12.5px', borderBottom: B, lineHeight: 1.5, color: '#000', fontWeight: 600, background: '#fafbfc' }}>
        Amount Chargeable (in words): <strong style={{ fontWeight: 800 }}>INR {numberToWords(inv.total_amount).toUpperCase()}</strong> &nbsp;<em style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>E & O.E</em>
      </div>

      {/* TAX SUMMARY TABLE */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, borderBottom: B, color: '#000' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #bbb', padding: '6px 10px', textAlign: 'left', background: '#e8ecf1', fontWeight: 800, color: NAVY, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }} rowSpan={2}>HSN/SAC</th>
            <th style={{ border: '1px solid #bbb', padding: '6px 10px', textAlign: 'right', background: '#e8ecf1', fontWeight: 800, color: NAVY, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }} rowSpan={2}>Taxable Value</th>
            {isPrintIntraState ? (
              <>
                <th style={{ border: '1px solid #bbb', padding: '6px 10px', textAlign: 'right', background: '#e8ecf1', fontWeight: 800, color: NAVY, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }} colSpan={2}>Central Tax</th>
                <th style={{ border: '1px solid #bbb', padding: '6px 10px', textAlign: 'right', background: '#e8ecf1', fontWeight: 800, color: NAVY, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }} colSpan={2}>State Tax</th>
              </>
            ) : (
              <th style={{ border: '1px solid #bbb', padding: '6px 10px', textAlign: 'right', background: '#e8ecf1', fontWeight: 800, color: NAVY, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }} colSpan={2}>Integrated Tax</th>
            )}
            <th style={{ border: '1px solid #bbb', padding: '6px 10px', textAlign: 'right', background: '#e8ecf1', fontWeight: 800, color: NAVY, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }} rowSpan={2}>Total Tax</th>
          </tr>
          <tr>
            <th style={{ border: '1px solid #bbb', padding: '4px 10px', textAlign: 'right', background: '#e8ecf1', fontWeight: 700, color: NAVY }}>Rate</th>
            <th style={{ border: '1px solid #bbb', padding: '4px 10px', textAlign: 'right', background: '#e8ecf1', fontWeight: 700, color: NAVY }}>Amount</th>
            {isPrintIntraState && (
              <>
                <th style={{ border: '1px solid #bbb', padding: '4px 10px', textAlign: 'right', background: '#e8ecf1', fontWeight: 700, color: NAVY }}>Rate</th>
                <th style={{ border: '1px solid #bbb', padding: '4px 10px', textAlign: 'right', background: '#e8ecf1', fontWeight: 700, color: NAVY }}>Amount</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {Object.entries(hsnMap).map(([hsn, d]) => (
            <tr key={hsn}>
              <td style={{ border: '1px solid #ccc', padding: '6px 10px', fontWeight: 700, color: '#000' }}>{hsn}</td>
              <td style={{ border: '1px solid #ccc', padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{fmt(d.taxable)}</td>
              {isPrintIntraState ? (
                <>
                  <td style={{ border: '1px solid #ccc', padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{d.cgstRate}%</td>
                  <td style={{ border: '1px solid #ccc', padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{fmt(d.cgstAmt)}</td>
                  <td style={{ border: '1px solid #ccc', padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{d.sgstRate}%</td>
                  <td style={{ border: '1px solid #ccc', padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{fmt(d.sgstAmt)}</td>
                </>
              ) : (
                <>
                  <td style={{ border: '1px solid #ccc', padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{d.igstRate}%</td>
                  <td style={{ border: '1px solid #ccc', padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{fmt(d.igstAmt)}</td>
                </>
              )}
              <td style={{ border: '1px solid #ccc', padding: '6px 10px', textAlign: 'right', fontWeight: 800, color: '#000' }}>{fmt(d.cgstAmt + d.sgstAmt + d.igstAmt)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 800, background: '#e8ecf1' }}>
            <td style={{ border: '1px solid #bbb', padding: '6px 10px', color: '#000' }}>TOTAL</td>
            <td style={{ border: '1px solid #bbb', padding: '6px 10px', textAlign: 'right', color: '#000' }}>{fmt(inv.subtotal)}</td>
            {isPrintIntraState ? (
              <>
                <td style={{ border: '1px solid #bbb', padding: '6px 10px' }}></td>
                <td style={{ border: '1px solid #bbb', padding: '6px 10px', textAlign: 'right', color: '#000' }}>{fmt(totalCgst)}</td>
                <td style={{ border: '1px solid #bbb', padding: '6px 10px' }}></td>
                <td style={{ border: '1px solid #bbb', padding: '6px 10px', textAlign: 'right', color: '#000' }}>{fmt(totalSgst)}</td>
              </>
            ) : (
              <>
                <td style={{ border: '1px solid #bbb', padding: '6px 10px' }}></td>
                <td style={{ border: '1px solid #bbb', padding: '6px 10px', textAlign: 'right', color: '#000' }}>{fmt(totalIgst)}</td>
              </>
            )}
            <td style={{ border: '1px solid #bbb', padding: '6px 10px', textAlign: 'right', color: '#000' }}>{fmt(totalTax)}</td>
          </tr>
        </tbody>
      </table>

      {/* PAID BLOCK */}
      {isPaid && (
        <div style={{ textAlign: 'right', padding: '10px 20px', borderBottom: B, fontSize: 13, color: '#000', fontWeight: 800, background: '#f0fdf4' }}>
          <span style={{ color: '#15803d', fontWeight: 900 }}>✔ Amount Paid</span><br />
          ₹{fmt(inv.total_amount)} Paid
        </div>
      )}

      {/* BOTTOM GRID — Bank | QR | Signature */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', borderBottom: B }}>
        <div style={{ padding: '14px 20px', borderRight: DIVIDER, fontSize: '12.5px', color: '#000' }}>
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: 1, color: '#666', fontWeight: 700, marginBottom: 6 }}>Bank Details</div>
          {org.bank_name && <p style={{ margin: '2px 0', fontWeight: 600, color: '#000' }}><strong>Bank:</strong> {org.bank_name}</p>}
          {org.account_no && <p style={{ margin: '2px 0', fontWeight: 600, color: '#000' }}><strong>A/C #:</strong> {org.account_no}</p>}
          {org.ifsc && <p style={{ margin: '2px 0', fontWeight: 600, color: '#000' }}><strong>IFSC:</strong> {org.ifsc}</p>}
          {org.branch && <p style={{ margin: '2px 0', fontWeight: 600, color: '#000' }}><strong>Branch:</strong> {org.branch}</p>}
          {org.upi_id && <p style={{ margin: '2px 0', fontWeight: 600, color: '#000' }}><strong>UPI ID:</strong> {org.upi_id}</p>}
        </div>
        <div style={{ padding: '14px 20px', borderRight: DIVIDER, fontSize: '12.5px', color: '#000' }}>
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: 1, color: '#666', fontWeight: 700, marginBottom: 6 }}>Pay using UPI</div>
          {qrUrl
            ? <img src={qrUrl} style={{ width: 120, height: 120, marginTop: 4, borderRadius: 4 }} alt="QR" />
            : <div style={{ width: 120, height: 120, border: '1px solid #ccc', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#999', fontWeight: 600, marginTop: 4, background: '#fafbfc' }}>QR CODE</div>
          }
        </div>
        <div style={{ padding: '14px 20px', fontSize: '12.5px', textAlign: 'right', color: '#000' }}>
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: 1, color: '#666', fontWeight: 700, marginBottom: 6 }}>For {(org.name || '').toUpperCase()}</div>
          <div style={{ width: 130, height: 70, display: 'inline-block', position: 'relative', marginTop: 8 }}>
            {org.stamp_url && <img src={org.stamp_url} style={{ position: 'absolute', width: 130, height: 70, objectFit: 'contain', opacity: 0.85 }} alt="Stamp" />}
            {org.signature_url && <img src={org.signature_url} style={{ position: 'relative', zIndex: 1, maxHeight: 50, maxWidth: 100, objectFit: 'contain' }} alt="Sign" />}
          </div>
          <div style={{ borderTop: '1.5px solid #000', display: 'inline-block', paddingTop: 4, fontWeight: 800, fontSize: 11, marginTop: 6, color: '#000' }}>Authorized Signatory</div>
        </div>
      </div>

      {/* FOOTER — Notes | Terms */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ padding: '12px 20px', borderRight: DIVIDER, fontSize: 12, lineHeight: 1.6, color: '#000', fontWeight: 600 }}>
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: 1, color: '#666', fontWeight: 700, marginBottom: 4 }}>Notes</div>
          <p style={{ margin: 0, color: '#000' }}>{inv.notes || 'Thank you for the Business'}</p>
        </div>
        <div style={{ padding: '12px 20px', fontSize: 12, lineHeight: 1.6, color: '#000', fontWeight: 600 }}>
          <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: 1, color: '#666', fontWeight: 700, marginBottom: 4 }}>Terms and Conditions</div>
          <ol style={{ margin: 0, paddingLeft: 16, color: '#000' }}>
            <li>Goods once sold cannot be taken back or exchanged.</li>
            <li>Interest @18% p.a. will be charged for uncleared bills beyond 15 days.</li>
            <li>Subject to Maharashtra jurisdiction only.</li>
          </ol>
        </div>
      </div>

      {/* Accent stripe bottom */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6, #06b6d4)' }} />

      {/* PAGE NOTE */}
      <div style={{ textAlign: 'center', padding: '8px 20px', fontSize: 10, color: '#999', borderTop: B, fontWeight: 600, letterSpacing: 0.5 }}>
        PAGE 1 / 1 &nbsp;•&nbsp; This is a computer generated invoice.
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   CLASSIC LAYOUT — Original HUL/ITC style, all-black borders
   ═══════════════════════════════════════════════════════════════ */
function ClassicLayout({ inv, items, org, invNum, isPaid, placeOfSupply, invoiceDate, totalQty, isPrintIntraState, totalCgst, totalSgst, totalIgst, totalTax, hsnMap, qrUrl, custGstin, custStateCode, orgStateCode, fontFamily, boldOn, fmt }) {
  const B = '1.5px solid #1a1a1a'

  return (
    <div className="bg-white shadow-lg mx-auto print-area" style={{ fontFamily, maxWidth: 900, margin: '0 auto', background: '#fff', border: B, color: '#000', fontWeight: 600, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>

      {/* TAX INVOICE TITLE */}
      <div style={{ textAlign: 'center', padding: '14px 0 8px', position: 'relative', borderBottom: B }}>
        <h1 style={{ fontSize: 22, letterSpacing: 6, margin: 0, fontWeight: 900, color: '#000' }}>TAX INVOICE</h1>
        <span style={{ position: 'absolute', right: 20, top: 16, fontSize: 12, color: '#000', letterSpacing: 1, fontWeight: 700 }}>ORIGINAL FOR RECIPIENT</span>
      </div>

      {/* TOP GRID — Company | Invoice# | Date */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', borderBottom: B }}>
        {/* Company Block */}
        <div style={{ padding: '16px 20px', borderRight: B, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ width: 70, height: 70, flexShrink: 0 }}>
            {org.logo_url
              ? <img src={org.logo_url} style={{ width: 70, height: 70, objectFit: 'contain' }} alt="Logo" />
              : <div style={{ width: 70, height: 70, border: '1.5px solid #333', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#000', fontWeight: 800 }}>LOGO</div>
            }
          </div>
          <div>
            <p style={{ fontSize: 20, fontWeight: 900, margin: '0 0 4px', lineHeight: 1.2, color: '#000' }}>{(org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()}</p>
            {org.gstin && <p style={{ margin: '2px 0', fontSize: '12.5px', color: '#000', lineHeight: 1.4, fontWeight: 700 }}>GSTIN {org.gstin}</p>}
            <p style={{ margin: '2px 0', fontSize: '12.5px', color: '#000', lineHeight: 1.4, fontWeight: 600 }}>{[org.address, org.city].filter(Boolean).join(', ')}</p>
            <p style={{ margin: '2px 0', fontSize: '12.5px', color: '#000', lineHeight: 1.4, fontWeight: 600 }}>{[org.state, org.pincode ? 'PIN: ' + org.pincode : ''].filter(Boolean).join(', ')}</p>
            {org.phone && <p style={{ margin: '2px 0', fontSize: '12.5px', color: '#000', lineHeight: 1.4, fontWeight: 600 }}>Mobile {org.phone}</p>}
          </div>
        </div>

        {/* Invoice # / Place of Supply */}
        <div style={{ padding: '16px 18px', borderRight: B }}>
          <div style={{ fontSize: 13, color: '#000', marginBottom: 2, fontWeight: 700 }}>Invoice #:</div>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 16, lineHeight: 1.3, color: '#000' }}>{invNum}</div>
          <div style={{ fontSize: 13, color: '#000', marginBottom: 2, fontWeight: 700 }}>Place of Supply:</div>
          <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.3, color: '#000' }}>{placeOfSupply}</div>
        </div>

        {/* Invoice Date only — NO Due Date */}
        <div style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 13, color: '#000', marginBottom: 2, fontWeight: 700 }}>Invoice Date:</div>
          <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.3, color: '#000' }}>{invoiceDate}</div>
        </div>
      </div>

      {/* ADDRESS GRID — Customer | Shipping */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: B }}>
        <div style={{ padding: '14px 20px', borderRight: B, fontSize: '12.5px', lineHeight: 1.5, color: '#000' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: '#000' }}>Customer Details:</h3>
          <p style={{ fontWeight: 800, margin: '0 0 2px', fontSize: 13, color: '#000' }}>{(inv.customer_name || '').toUpperCase()}</p>
          {custGstin && <p style={{ margin: '2px 0', fontWeight: 700, color: '#000' }}>GSTIN: {custGstin}</p>}
          <p style={{ margin: '2px 0', fontWeight: 700, color: '#000' }}>Billing address:</p>
          <p style={{ margin: '2px 0', fontWeight: 600, color: '#000' }}>{[inv.customer_address, inv.customer_city].filter(Boolean).join(', ')}</p>
          <p style={{ margin: '2px 0', fontWeight: 600, color: '#000' }}>{[inv.customer_state, inv.customer_pincode].filter(Boolean).join(', ')}</p>
          {inv.customer_phone && <p style={{ margin: '2px 0', fontWeight: 600, color: '#000' }}>Ph: {inv.customer_phone}</p>}
        </div>
        <div style={{ padding: '14px 20px', fontSize: '12.5px', lineHeight: 1.5, color: '#000' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: '#000' }}>Shipping address:</h3>
          <p style={{ margin: '2px 0', fontWeight: 600, color: '#000' }}>{[inv.customer_address, inv.customer_city].filter(Boolean).join(', ')}</p>
          <p style={{ margin: '2px 0', fontWeight: 600, color: '#000' }}>{[inv.customer_state, inv.customer_pincode].filter(Boolean).join(', ')}</p>
        </div>
      </div>

      {/* ITEMS TABLE */}
      <div style={{ borderBottom: B }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#000' }}>
          <thead>
            <tr style={{ borderBottom: B }}>
              <th style={{ textAlign: 'left', padding: '10px', fontSize: '12.5px', fontWeight: 800, borderBottom: B, whiteSpace: 'nowrap', color: '#000' }}>#</th>
              <th style={{ textAlign: 'left', padding: '10px', fontSize: '12.5px', fontWeight: 800, borderBottom: B, color: '#000' }}>Item</th>
              <th style={{ textAlign: 'left', padding: '10px', fontSize: '12.5px', fontWeight: 800, borderBottom: B, color: '#000' }}>HSN/SAC</th>
              <th style={{ textAlign: 'right', padding: '10px', fontSize: '12.5px', fontWeight: 800, borderBottom: B, whiteSpace: 'nowrap', color: '#000' }}>Tax</th>
              <th style={{ textAlign: 'right', padding: '10px', fontSize: '12.5px', fontWeight: 800, borderBottom: B, whiteSpace: 'nowrap', color: '#000' }}>Qty</th>
              <th style={{ textAlign: 'center', padding: '10px', fontSize: '12.5px', fontWeight: 800, borderBottom: B, whiteSpace: 'nowrap', color: '#000' }}>Rate/Item</th>
              <th style={{ textAlign: 'center', padding: '10px', fontSize: '12.5px', fontWeight: 800, borderBottom: B, color: '#000' }}>Per</th>
              <th style={{ textAlign: 'right', padding: '10px', fontSize: '12.5px', fontWeight: 800, borderBottom: B, color: '#000' }}>Amount</th>
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
              const itemFW = boldOn ? 800 : 600
              return (
                <tr key={i} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '8px 10px', fontWeight: itemFW, color: '#000' }}>{i + 1}</td>
                  <td style={{ padding: '8px 10px', lineHeight: 1.4, fontWeight: itemFW, color: '#000' }}>{item.description || ''}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: '#000' }}>{item.hsn_code || '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{taxRate > 0 ? `${taxRate}%` : '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{qty} {item.unit || 'NOS'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#000' }}>{fmt(rate)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#000' }}>{item.unit || 'NOS'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>{fmt(taxable)}</td>
                </tr>
              )
            })}
            {/* Summary rows */}
            <tr style={{ fontStyle: 'italic' }}>
              <td style={{ borderTop: '1px solid #ddd', padding: '8px 10px', fontWeight: 700, color: '#000' }}></td>
              <td colSpan={6} style={{ borderTop: '1px solid #ddd', padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>Taxable Amount</td>
              <td style={{ borderTop: '1px solid #ddd', padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>₹{fmt(inv.subtotal)}</td>
            </tr>
            {isPrintIntraState && (
              <>
                <tr style={{ fontStyle: 'italic' }}>
                  <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px', color: '#000' }}></td>
                  <td colSpan={6} style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>CGST {(parseFloat(items[0]?.cgst_rate) || 9).toFixed(1)}%</td>
                  <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>₹{fmt(totalCgst)}</td>
                </tr>
                <tr style={{ fontStyle: 'italic' }}>
                  <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px', color: '#000' }}></td>
                  <td colSpan={6} style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>SGST {(parseFloat(items[0]?.sgst_rate) || 9).toFixed(1)}%</td>
                  <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>₹{fmt(totalSgst)}</td>
                </tr>
              </>
            )}
            {!isPrintIntraState && (
              <tr style={{ fontStyle: 'italic' }}>
                <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px', color: '#000' }}></td>
                <td colSpan={6} style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>IGST {(parseFloat(items[0]?.igst_rate) || 18).toFixed(1)}%</td>
                <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>₹{fmt(totalIgst)}</td>
              </tr>
            )}
            {parseFloat(inv.discount) > 0 && (
              <tr style={{ fontStyle: 'italic' }}>
                <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px', color: '#000' }}></td>
                <td colSpan={6} style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>Discount</td>
                <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>-₹{fmt(inv.discount)}</td>
              </tr>
            )}
            {parseFloat(inv.round_off) !== 0 && (
              <tr style={{ fontStyle: 'italic' }}>
                <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px', color: '#000' }}></td>
                <td colSpan={6} style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>Round Off</td>
                <td style={{ borderTop: '1px solid #ddd', padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>{parseFloat(inv.round_off) > 0 ? '+' : ''}₹{fmt(Math.abs(inv.round_off))}</td>
              </tr>
            )}
            {/* TOTAL ROW */}
            <tr style={{ borderTop: B }}>
              <td style={{ padding: '10px', color: '#000' }}></td>
              <td colSpan={3} style={{ fontWeight: 900, fontSize: 15, padding: '10px', color: '#000' }}>Total</td>
              <td style={{ fontWeight: 900, fontSize: 15, padding: '10px', textAlign: 'right', color: '#000' }}>{totalQty.toFixed(3)}</td>
              <td style={{ padding: '10px' }}></td>
              <td style={{ padding: '10px' }}></td>
              <td style={{ fontWeight: 900, fontSize: 15, padding: '10px', textAlign: 'right', color: '#000' }}>₹{fmt(inv.total_amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* AMOUNT IN WORDS */}
      <div style={{ padding: '10px 20px', fontSize: 13, borderBottom: B, lineHeight: 1.5, color: '#000', fontWeight: 700 }}>
        Amount Chargeable (in words): <strong>INR {numberToWords(inv.total_amount).toUpperCase()}</strong> &nbsp;<em style={{ fontSize: 12, color: '#333', fontWeight: 600 }}>E & O.E</em>
      </div>

      {/* TAX SUMMARY TABLE */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', borderBottom: B, color: '#000' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'left', background: '#f0f0f0', fontWeight: 800, color: '#000' }} rowSpan={2}>HSN/SAC</th>
            <th style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', background: '#f0f0f0', fontWeight: 800, color: '#000' }} rowSpan={2}>Taxable Value</th>
            {isPrintIntraState ? (
              <>
                <th style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', background: '#f0f0f0', fontWeight: 800, color: '#000' }} colSpan={2}>Central Tax</th>
                <th style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', background: '#f0f0f0', fontWeight: 800, color: '#000' }} colSpan={2}>State Tax</th>
              </>
            ) : (
              <th style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', background: '#f0f0f0', fontWeight: 800, color: '#000' }} colSpan={2}>Integrated Tax</th>
            )}
            <th style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', background: '#f0f0f0', fontWeight: 800, color: '#000' }} rowSpan={2}>Total Tax Amount</th>
          </tr>
          <tr>
            <th style={{ border: '1px solid #999', padding: '4px 10px', textAlign: 'right', background: '#f0f0f0', fontWeight: 700, color: '#000' }}>Rate</th>
            <th style={{ border: '1px solid #999', padding: '4px 10px', textAlign: 'right', background: '#f0f0f0', fontWeight: 700, color: '#000' }}>Amount</th>
            {isPrintIntraState && (
              <>
                <th style={{ border: '1px solid #999', padding: '4px 10px', textAlign: 'right', background: '#f0f0f0', fontWeight: 700, color: '#000' }}>Rate</th>
                <th style={{ border: '1px solid #999', padding: '4px 10px', textAlign: 'right', background: '#f0f0f0', fontWeight: 700, color: '#000' }}>Amount</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {Object.entries(hsnMap).map(([hsn, d]) => (
            <tr key={hsn}>
              <td style={{ border: '1px solid #999', padding: '6px 10px', fontWeight: 700, color: '#000' }}>{hsn}</td>
              <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{fmt(d.taxable)}</td>
              {isPrintIntraState ? (
                <>
                  <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{d.cgstRate}%</td>
                  <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{fmt(d.cgstAmt)}</td>
                  <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{d.sgstRate}%</td>
                  <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{fmt(d.sgstAmt)}</td>
                </>
              ) : (
                <>
                  <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{d.igstRate}%</td>
                  <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#000' }}>{fmt(d.igstAmt)}</td>
                </>
              )}
              <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', fontWeight: 800, color: '#000' }}>{fmt(d.cgstAmt + d.sgstAmt + d.igstAmt)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 800, background: '#f0f0f0' }}>
            <td style={{ border: '1px solid #999', padding: '6px 10px', color: '#000' }}>TOTAL</td>
            <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', color: '#000' }}>{fmt(inv.subtotal)}</td>
            {isPrintIntraState ? (
              <>
                <td style={{ border: '1px solid #999', padding: '6px 10px' }}></td>
                <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', color: '#000' }}>{fmt(totalCgst)}</td>
                <td style={{ border: '1px solid #999', padding: '6px 10px' }}></td>
                <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', color: '#000' }}>{fmt(totalSgst)}</td>
              </>
            ) : (
              <>
                <td style={{ border: '1px solid #999', padding: '6px 10px' }}></td>
                <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', color: '#000' }}>{fmt(totalIgst)}</td>
              </>
            )}
            <td style={{ border: '1px solid #999', padding: '6px 10px', textAlign: 'right', color: '#000' }}>{fmt(totalTax)}</td>
          </tr>
        </tbody>
      </table>

      {/* PAID BLOCK */}
      {isPaid && (
        <div style={{ textAlign: 'right', padding: '10px 20px', borderBottom: B, fontSize: 13, color: '#000', fontWeight: 800 }}>
          <span style={{ color: '#1a7d3a', fontWeight: 900 }}>✔ Amount Paid</span><br />
          ₹{fmt(inv.total_amount)} Paid
        </div>
      )}

      {/* BOTTOM GRID — Bank | QR | Signature */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', borderBottom: B }}>
        <div style={{ padding: '16px 20px', borderRight: B, fontSize: 13, color: '#000' }}>
          <h4 style={{ margin: '0 0 8px', fontWeight: 800, color: '#000' }}>Bank Details:</h4>
          {org.bank_name && <p style={{ margin: '3px 0', fontWeight: 600, color: '#000' }}><strong>Bank:</strong> {org.bank_name}</p>}
          {org.account_no && <p style={{ margin: '3px 0', fontWeight: 600, color: '#000' }}><strong>Account #:</strong> {org.account_no}</p>}
          {org.ifsc && <p style={{ margin: '3px 0', fontWeight: 600, color: '#000' }}><strong>IFSC:</strong> {org.ifsc}</p>}
          {org.branch && <p style={{ margin: '3px 0', fontWeight: 600, color: '#000' }}><strong>Branch:</strong> {org.branch}</p>}
          {org.upi_id && <p style={{ margin: '3px 0', fontWeight: 600, color: '#000' }}><strong>UPI ID:</strong> {org.upi_id}</p>}
        </div>
        <div style={{ padding: '16px 20px', borderRight: B, fontSize: 13, color: '#000' }}>
          <h4 style={{ margin: '0 0 8px', fontWeight: 800, color: '#000' }}>Pay using UPI:</h4>
          {qrUrl
            ? <img src={qrUrl} style={{ width: 130, height: 130, marginTop: 6 }} alt="QR" />
            : <div style={{ width: 130, height: 130, border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#000', fontWeight: 700, marginTop: 6 }}>QR CODE</div>
          }
        </div>
        <div style={{ padding: '16px 20px', fontSize: 13, textAlign: 'right', color: '#000' }}>
          <h4 style={{ margin: '0 0 8px', fontWeight: 800, color: '#000' }}>For {(org.name || '').toUpperCase()}</h4>
          <div style={{ width: 140, height: 80, display: 'inline-block', position: 'relative', marginTop: 10 }}>
            {org.stamp_url && <img src={org.stamp_url} style={{ position: 'absolute', width: 140, height: 80, objectFit: 'contain', opacity: 0.85 }} alt="Stamp" />}
            {org.signature_url && <img src={org.signature_url} style={{ position: 'relative', zIndex: 1, maxHeight: 55, maxWidth: 110, objectFit: 'contain' }} alt="Sign" />}
          </div>
          <div style={{ borderTop: '1px solid #000', display: 'inline-block', paddingTop: 4, fontWeight: 800, fontSize: 12, marginTop: 8, color: '#000' }}>Authorized Signatory</div>
        </div>
      </div>

      {/* FOOTER — Notes | Terms */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ padding: '14px 20px', borderRight: B, fontSize: '12.5px', lineHeight: 1.6, color: '#000', fontWeight: 600 }}>
          <h4 style={{ margin: '0 0 6px', fontWeight: 800, color: '#000' }}>Notes:</h4>
          <p style={{ margin: 0, color: '#000' }}>{inv.notes || 'Thank you for the Business'}</p>
        </div>
        <div style={{ padding: '14px 20px', fontSize: '12.5px', lineHeight: 1.6, color: '#000', fontWeight: 600 }}>
          <h4 style={{ margin: '0 0 6px', fontWeight: 800, color: '#000' }}>Terms and Conditions:</h4>
          <ol style={{ margin: 0, paddingLeft: 18, color: '#000' }}>
            <li>Goods once sold cannot be taken back or exchanged.</li>
            <li>Interest @18% p.a. will be charged for uncleared bills beyond 15 days.</li>
            <li>Subject to Maharashtra jurisdiction only.</li>
          </ol>
        </div>
      </div>

      {/* PAGE NOTE */}
      <div style={{ textAlign: 'left', padding: '8px 20px', fontSize: '11.5px', color: '#000', borderTop: B, fontWeight: 600 }}>
        Page 1 / 1 &nbsp; This is a computer generated invoice.
      </div>
    </div>
  )
}
