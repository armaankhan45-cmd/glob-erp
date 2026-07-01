import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Printer, Edit, Trash2, Repeat, Share2, MessageCircle, Mail, Download } from 'lucide-react'
import { numberToWordsCaps } from '../utils'

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

  if (!quotation) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}></div></div>

  const letterheadMm = org?.print_letterhead_mm || 59
  const footerMm = org?.print_footer_mm || 30
  const rawNum = quotation.quotation_number?.split('/')[0] || ''
  const qNum = rawNum.replace(/^[A-Za-z\-]+/, '').replace(/^0+/, '') || rawNum

  const hasCGST = parseFloat(quotation.cgst_amount) > 0
  const hasIGST = parseFloat(quotation.igst_amount) > 0
  const gstRate = hasIGST
    ? parseFloat(items[0]?.igst_rate || 18)
    : (hasCGST ? parseFloat(items[0]?.cgst_rate || 9) * 2 : 18)
  const totalGST = parseFloat(quotation.igst_amount) + parseFloat(quotation.cgst_amount) + parseFloat(quotation.sgst_amount)

  const fmt = (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

  const s = {
    cell: { border: '1.5px solid #000', padding: '4px 5px', verticalAlign: 'top' },
    hc: { border: '1.5px solid #000', padding: '5px', background: '#e8e8e8', textAlign: 'center', fontWeight: 'bold' }
  }

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button onClick={() => navigate('/app/quotations')} className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold flex-1 text-white">Quotation {quotation.quotation_number}</h1>
        
        <div className="flex items-center gap-1 text-sm">
          <span className="text-white/55 text-xs font-medium">Name:</span>
          {[10,12,14,16,18,20].map(sz => (
            <button key={sz} onClick={() => changeCustomerSize(String(sz))}
              className={`w-7 h-7 rounded text-xs font-bold ${customerSize === String(sz) ? 'accent-text' : 'text-white/50 hover:text-white/70'}`}
              style={{ background: customerSize === String(sz) ? 'rgba(var(--accent-rgb),0.15)' : 'rgba(255,255,255,0.04)' }}>
              {sz}
            </button>
          ))}
        </div>

        <button onClick={toggleBold} className={`px-3 py-2 rounded-lg font-medium text-sm ${boldOn ? 'bg-white/10 text-white border border-white/15' : 'btn-secondary'}`}>Bold {boldOn ? 'ON' : 'OFF'}</button>
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2"><Printer size={16} /> Print</button>
        <button onClick={() => { const token = localStorage.getItem('token'); window.open(`${api.defaults.baseURL}/quotations/${id}/pdf?token=${token}`, '_blank') }} className="btn-secondary flex items-center gap-2"><Download size={16} /> PDF</button>
        
        <div className="relative">
          <button onClick={() => setShareOpen(!shareOpen)} className="btn-secondary flex items-center gap-2"><Share2 size={16} /> Share</button>
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

        <button onClick={() => navigate(`/app/quotations/${id}/edit`)} className="btn-primary flex items-center gap-2"><Edit size={16} /> Edit</button>
        <button onClick={handleConvert} className="px-4 py-2 rounded-xl font-semibold text-white flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}><Repeat size={16} /> Convert to Invoice</button>
        <button onClick={handleDelete} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>
      </div>

      {/* Quotation Print Layout */}
      <div className="bg-white shadow-lg mx-auto print-area" style={{ fontFamily: 'Georgia, serif', fontSize: '10pt', width: '210mm', height: '297mm', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white' }}>
        
        {/* Letterhead space — BLANK */}
        <div style={{ height: `${letterheadMm}mm`, flexShrink: 0 }}></div>

        {/* Quotation number — OUTSIDE the box, CENTERED */}
        <div style={{ margin: '0 10mm', textAlign: 'center', padding: '6px 0 4px', fontSize: '16pt', fontWeight: 'bold' }}>
          Quotation <u>No</u> :- {qNum}
        </div>

        {/* Bordered box */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '2px solid #000', margin: '0 10mm', overflow: 'hidden' }}>
          
          {/* Customer name — INSIDE the box, LEFT-aligned, bigger */}
          <div style={{ padding: '6px 8px 4px', textAlign: 'left', borderBottom: '1px solid #000' }}>
            <div style={{ fontSize: `${customerSize}pt`, fontWeight: 'bold', textTransform: 'uppercase', lineHeight: 1.2 }}>
              {(quotation.customer_name || '').toUpperCase()}
            </div>
            {quotation.additional_info && (
              <div style={{ fontSize: '9pt', marginTop: '2px', color: '#444' }}>{quotation.additional_info}</div>
            )}
          </div>

          {/* Items table */}
          <div style={{ flex: 1, padding: '4px 5px 0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', height: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...s.hc, width: '6%' }}>SR No.</th>
                  <th style={{ ...s.hc, width: '50%' }}>Particulars</th>
                  <th style={{ ...s.hc, width: '10%' }}>Quantity</th>
                  <th style={{ ...s.hc, width: '17%' }}>Rate (INR)</th>
                  <th style={{ ...s.hc, width: '17%' }}>Amount (INR)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ ...s.cell, textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ ...s.cell, fontSize: '8.5pt', lineHeight: '1.3', fontWeight: boldOn ? 'bold' : 'normal', whiteSpace: 'pre-line' }}>{item.description || ''}</td>
                    <td style={{ ...s.cell, textAlign: 'center' }}>{item.quantity}{item.unit && item.unit !== 'Unit' ? ` ${item.unit}` : ''}</td>
                    <td style={{ ...s.cell, textAlign: 'right' }}>₹{fmt(item.rate)}</td>
                    <td style={{ ...s.cell, textAlign: 'right', fontWeight: 'bold' }}>₹{fmt(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total box */}
          <div style={{ padding: '0 5px 6px', flexShrink: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
              <tbody>
                {gstRate > 0 && (
                  <tr>
                    <td style={{ border: '1.5px solid #000', padding: '4px 6px', textAlign: 'right', width: '55%', background: '#f8f8f8' }}>
                      GST: {gstRate}%
                    </td>
                    <td style={{ border: '1.5px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold', width: '45%', background: '#f8f8f8' }}>
                      ₹{fmt(totalGST)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2} style={{ border: '1.5px solid #000', padding: '8px 10px', background: '#e8e8e8' }}>
                    <div style={{ fontSize: '10pt', fontWeight: 'bold', textAlign: 'center', letterSpacing: '0.5px' }}>
                      Total : {numberToWordsCaps(quotation.total_amount)}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style={{ border: '1.5px solid #000', padding: '8px 10px', textAlign: 'right', background: '#d4d4d4', width: '55%' }}>
                    <span style={{ fontSize: '14pt', fontWeight: 'bold' }}>₹{fmt(quotation.total_amount)}</span>
                  </td>
                  <td style={{ border: '1.5px solid #000', padding: '8px 10px', textAlign: 'center', background: '#d4d4d4', width: '45%' }}>
                    <span style={{ fontSize: '10pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Amount</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Sign/stamp space — controlled by Settings footer mm */}
        <div style={{ height: `${footerMm}mm`, flexShrink: 0 }}></div>
      </div>
    </div>
  )
}

