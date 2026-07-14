import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Printer, Edit, Trash2, Repeat, Share2, MessageCircle, Mail, Download } from 'lucide-react'
import { numberToWordsCaps } from '../utils'

function fmt(n) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
}

export default function QuotationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [quotation, setQuotation] = useState(null)
  const [items, setItems] = useState([])
  const [org, setOrg] = useState(null)
  const [boldOn, setBoldOn] = useState(() => localStorage.getItem('quotBold') === 'true')
  const [customerSize, setCustomerSize] = useState(() => localStorage.getItem('quotCustSize') || '14')
  const [shareOpen, setShareOpen] = useState(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => { loadQuotation() }, [id])

  const loadQuotation = async () => {
    try {
      const res = await api.get(`/quotations/${id}`)
      setQuotation(res.data.quotation)
      setItems(res.data.items || [])
      setOrg(res.data.organization)
    } catch (err) {
      alert('Quotation not found')
      navigate('/app/quotations')
    }
  }

  const toggleBold = () => {
    const val = !boldOn
    setBoldOn(val)
    localStorage.setItem('quotBold', val)
  }

  const changeCustomerSize = (size) => {
    setCustomerSize(size)
    localStorage.setItem('quotCustSize', size)
  }

  const handlePrint = () => window.print()
  const handleDelete = async () => {
    if (!confirm('Delete this quotation?')) return
    await api.delete(`/quotations/${id}`)
    navigate('/app/quotations')
  }

  const handleConvert = async () => {
    if (!confirm('Convert this quotation to an invoice?')) return
    try {
      const res = await api.post(`/quotations/${id}/convert`)
      alert(`Invoice created: ${res.data.invoice_number}`)
      navigate(`/app/invoices/${res.data.invoiceId}`)
    } catch (err) {
      alert(err.response?.data?.msg || 'Conversion failed')
    }
  }

  const handleWhatsApp = async () => {
    setSharing(true)
    try {
      const token = localStorage.getItem('token')
      const pdfUrl = `${api.defaults.baseURL}/quotations/${id}/pdf?token=${token}`
      const qNum = quotation.quotation_number || ''
      const custName = quotation.customer_name || ''
      const total = fmt(quotation.total_amount)
      try {
        const response = await fetch(pdfUrl)
        const htmlBlob = await response.blob()
        const file = new File([htmlBlob], `Quotation_${qNum.replace(/\//g, '-')}.html`, { type: 'text/html' })
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ text: `*QUOTATION ${qNum}*\nCustomer: ${custName}\nTotal: ₹${total}`, files: [file] })
          setShareOpen(false); setSharing(false); return
        }
      } catch (shareErr) {}
      const viewUrl = `${window.location.origin}/app/quotations/${id}`
      const msg = `*QUOTATION ${qNum}*\nCustomer: ${custName}\nTotal: ₹${total}\n\n📄 View & Print: ${viewUrl}\n📥 Direct PDF: ${pdfUrl}`
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
    } catch (err) { alert('Share failed: ' + err.message) }
    setShareOpen(false); setSharing(false)
  }

  const handleEmail = async () => {
    setSharing(true)
    try {
      const token = localStorage.getItem('token')
      const pdfUrl = `${api.defaults.baseURL}/quotations/${id}/pdf?token=${token}`
      const qNum = quotation.quotation_number || ''
      const custName = quotation.customer_name || ''
      const total = fmt(quotation.total_amount)
      const emailTo = prompt('Enter email address to send quotation:')
      if (!emailTo) { setSharing(false); return }
      try {
        await api.post(`/quotations/${id}/share-email`, { to: emailTo })
        alert('Quotation sent via email!')
      } catch (backendErr) {
        const subject = `Quotation ${qNum} - ${org?.name || 'Our Company'}`
        const body = `Dear ${custName},\n\nPlease find our quotation below:\n\nQuotation No: ${qNum}\nTotal Amount: ₹${total}\n\n📄 View: ${window.location.origin}/app/quotations/${id}\n📥 PDF: ${pdfUrl}\n\nBest regards,\n${org?.name || 'Our Company'}`
        window.open(`mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
      }
    } catch (err) { alert('Email share failed: ' + err.message) }
    setShareOpen(false); setSharing(false)
  }

  if (!quotation) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>

  const letterheadMm = org?.print_letterhead_mm || 65
  const rawNum = quotation.quotation_number?.split('/')[0] || ''
  const qNum = rawNum.replace(/^[A-Za-z\-]+/, '').replace(/^0+/, '') || rawNum

  const hasCGST = parseFloat(quotation.cgst_amount) > 0
  const hasIGST = parseFloat(quotation.igst_amount) > 0
  const gstRate = hasIGST
    ? parseFloat(items[0]?.igst_rate || 18)
    : (hasCGST ? parseFloat(items[0]?.cgst_rate || 9) * 2 : 18)
  const totalGST = parseFloat(quotation.igst_amount) + parseFloat(quotation.cgst_amount) + parseFloat(quotation.sgst_amount)
  const subtotal = parseFloat(quotation.subtotal) || 0
  const totalAmount = parseFloat(quotation.total_amount) || 0
  const amountWords = numberToWordsCaps(totalAmount)

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button onClick={() => navigate('/app/quotations')} className="p-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all btn-shine"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold text-white flex-1">Quotation {quotation.quotation_number}</h1>

        <div className="flex items-center gap-1 text-sm">
          <span className="text-white/35 text-xs">Name:</span>
          {[10,12,14,16,18,20].map(s => (
            <button key={s} onClick={() => changeCustomerSize(String(s))}
              className={`w-7 h-7 rounded text-xs font-medium transition-all ${customerSize === String(s) ? 'btn-primary' : 'btn-secondary'}`}>
              {s}
            </button>
          ))}
        </div>

        <button onClick={toggleBold} className={`px-3 py-2 rounded-xl font-medium text-sm transition-all ${boldOn ? 'btn-primary' : 'btn-secondary'}`}>Bold {boldOn ? 'ON' : 'OFF'}</button>
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 btn-shine"><Printer size={16} /> Print</button>
        <button onClick={() => { const token = localStorage.getItem('token'); window.open(`${api.defaults.baseURL}/quotations/${id}/pdf?token=${token}`, '_blank') }} className="btn-secondary flex items-center gap-2 btn-shine"><Download size={16} /> PDF</button>

        <div className="relative">
          <button onClick={() => setShareOpen(!shareOpen)} className="btn-secondary flex items-center gap-2 btn-shine"><Share2 size={16} /> Share</button>
          {shareOpen && (
            <div className="absolute right-0 top-full mt-1 rounded-xl shadow-xl z-50 min-w-[180px] overflow-hidden" style={{ background: 'rgba(12,16,32,0.98)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button onClick={handleWhatsApp} disabled={sharing} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-green-500/10 text-green-400 text-sm font-medium transition-colors">
                <MessageCircle size={18} /> {sharing ? 'Sharing...' : 'WhatsApp'}
              </button>
              <button onClick={handleEmail} disabled={sharing} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-blue-500/10 text-blue-400 text-sm font-medium border-t border-white/5 transition-colors">
                <Mail size={18} /> {sharing ? 'Sending...' : 'Email'}
              </button>
            </div>
          )}
        </div>

        <button onClick={() => navigate(`/app/quotations/${id}/edit`)} className="btn-primary flex items-center gap-2 btn-shine"><Edit size={16} /> Edit</button>
        <button onClick={handleConvert} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 flex items-center gap-2 btn-shine transition-colors"><Repeat size={16} /> Convert to Invoice</button>
        <button onClick={handleDelete} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>
      </div>

      {/* ═══════════════════════════════════════════
          PRO QUOTATION LAYOUT — A4 optimized
          ═══════════════════════════════════════════ */}
      <div className="bg-white shadow-lg mx-auto print-area" style={{
        fontFamily: (org?.quotation_font_family || 'Georgia, serif'),
        fontSize: (org?.quotation_font_size || '10') + 'pt',
        width: '210mm',
        minHeight: '297mm',
        display: 'flex',
        flexDirection: 'column',
        background: 'white',
        color: '#000'
      }}>

        {/* Letterhead space — BLANK */}
        <div style={{ height: `${letterheadMm}mm`, flexShrink: 0 }}></div>

        {/* Quotation number — OUTSIDE the box, CENTERED */}
        <div style={{ margin: '0 10mm', textAlign: 'center', padding: '8px 0 6px', fontSize: '18pt', fontWeight: 'bold', letterSpacing: '1px' }}>
          QUOTATION <u>No</u> :- {qNum}
        </div>

        {/* ══ Bordered box — main content ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', border: '2px solid #000', margin: '0 10mm', overflow: 'hidden' }}>

          {/* Customer name — INSIDE box, LEFT, BIGGER */}
          <div style={{ padding: '8px 10px 6px', textAlign: 'left', borderBottom: '1.5px solid #000', background: '#f8f9fa' }}>
            <div style={{ fontSize: `${customerSize}pt`, fontWeight: 'bold', textTransform: 'uppercase', lineHeight: 1.2, color: '#000' }}>
              {(quotation.customer_name || '').toUpperCase()}
            </div>
            {quotation.additional_info && (
              <div style={{ fontSize: '10pt', marginTop: '3px', color: '#333', fontWeight: '600' }}>{quotation.additional_info}</div>
            )}
          </div>

          {/* Items table — PROPERLY ALIGNED */}
          <div style={{ padding: '2px 4px 0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5pt', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '6%' }} />
                <col style={{ width: '44%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ border: '1.5px solid #000', padding: '6px 4px', background: '#e8e8e8', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top', fontSize: '10pt' }}>SR No.</th>
                  <th style={{ border: '1.5px solid #000', padding: '6px 4px', background: '#e8e8e8', textAlign: 'left', fontWeight: 'bold', verticalAlign: 'top', fontSize: '10pt' }}>Particulars</th>
                  <th style={{ border: '1.5px solid #000', padding: '6px 4px', background: '#e8e8e8', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'top', fontSize: '10pt' }}>Qty</th>
                  <th style={{ border: '1.5px solid #000', padding: '6px 4px', background: '#e8e8e8', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'top', fontSize: '10pt' }}>Rate (INR)</th>
                  <th style={{ border: '1.5px solid #000', padding: '6px 4px', background: '#e8e8e8', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'top', fontSize: '10pt' }}>Amount (INR)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ border: '1.5px solid #000', padding: '5px 4px', textAlign: 'center', verticalAlign: 'top', fontWeight: '700', color: '#000' }}>{i + 1}</td>
                    <td style={{ border: '1.5px solid #000', padding: '5px 4px', fontSize: '10pt', lineHeight: '1.3', fontWeight: boldOn ? 'bold' : 'normal', whiteSpace: 'pre-line', verticalAlign: 'top', color: '#000' }}>{item.description || ''}</td>
                    <td style={{ border: '1.5px solid #000', padding: '5px 4px', textAlign: 'center', verticalAlign: 'top', fontWeight: '700', color: '#000' }}>{item.quantity}{item.unit && item.unit !== 'Unit' ? ` ${item.unit}` : ''}</td>
                    <td style={{ border: '1.5px solid #000', padding: '5px 4px', textAlign: 'right', verticalAlign: 'top', fontWeight: '700', color: '#000' }}>₹{fmt(item.rate)}</td>
                    <td style={{ border: '1.5px solid #000', padding: '5px 4px', textAlign: 'right', verticalAlign: 'top', fontWeight: 'bold', color: '#000' }}>₹{fmt(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ══ Totals — INSIDE the box, NO GAP ══ */}
          <div style={{ padding: '0 4px 6px', flexShrink: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5pt' }}>
              <tbody>
                <tr>
                  <td style={{ border: '1.5px solid #000', padding: '5px 8px', textAlign: 'left', fontWeight: '700', color: '#000' }}>Subtotal</td>
                  <td style={{ border: '1.5px solid #000', padding: '5px 8px', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>₹{fmt(subtotal)}</td>
                </tr>
                {gstRate > 0 && (
                  <tr>
                    <td style={{ border: '1.5px solid #000', padding: '5px 8px', textAlign: 'left', fontWeight: '700', color: '#000' }}>
                      GST: {gstRate}%
                    </td>
                    <td style={{ border: '1.5px solid #000', padding: '5px 8px', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>
                      ₹{fmt(totalGST)}
                    </td>
                  </tr>
                )}
                {/* Amount in words — INSIDE the box, full width, BIGGER */}
                <tr style={{ background: '#f5f5f5' }}>
                  <td colSpan={2} style={{ border: '1.5px solid #000', padding: '6px 8px', fontSize: '11pt', fontWeight: 'bold', color: '#000' }}>
                    Total : {amountWords} ONLY
                  </td>
                </tr>
                {/* Total Amount row — LEFT label, RIGHT number, BIGGER */}
                <tr style={{ background: '#e8e8e8' }}>
                  <td style={{ border: '1.5px solid #000', padding: '7px 8px', textAlign: 'left', fontSize: '13pt', fontWeight: 'bold', color: '#000' }}>
                    Total Amount
                  </td>
                  <td style={{ border: '1.5px solid #000', padding: '7px 8px', textAlign: 'right', fontSize: '13pt', fontWeight: 'bold', color: '#000' }}>
                    ₹{fmt(totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Sign space — guaranteed at bottom */}
        <div style={{ height: '35mm', flexShrink: 0, margin: '0 10mm', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ borderTop: '1.5px solid #000', paddingTop: '4mm', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ textAlign: 'center', width: '60mm' }}>
              <div style={{ minHeight: '15mm' }}></div>
              <div style={{ borderTop: '1.5px solid #000', fontSize: '10pt', fontWeight: 'bold', color: '#000', paddingTop: '2mm' }}>Authorised Signatory</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
