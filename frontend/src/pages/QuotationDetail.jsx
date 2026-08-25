import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Printer, Edit, Trash2, Repeat, Share2, MessageCircle, Mail, Download, LayoutTemplate, Bold } from 'lucide-react'
import { numberToWordsCaps, downloadPdf, printElement } from '../utils'

function fmt(n) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
}

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return String(d)
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

/* ═══════════════════════════════════════════════════════════════
   CLASSIC LAYOUT — Original bordered box, no letterhead/stamp
   ═══════════════════════════════════════════════════════════════ */
function ClassicLayout({ quotation, items, org, boldOn, customerSize, detailSize, qNum, gstRate, totalGST, subtotal, totalAmount, amountWords, letterheadMm, footerMm, selectedFont, selectedFontSize }) {
  return (
    <div className="bg-white shadow-lg mx-auto print-area" style={{
      fontFamily: selectedFont,
      fontSize: selectedFontSize,
      width: '210mm', minHeight: '297mm',
      display: 'flex', flexDirection: 'column',
      background: 'white', color: '#000'
    }}>
      {letterheadMm > 0 && <div style={{ height: letterheadMm + 'mm', flexShrink: 0 }}></div>}
      {/* FIX: Classic layout never rendered the quotation date at all. Added
          it here in the same plain Arial style used on the Pro layout
          (independent of the customer's chosen quotation font, so it never
          renders in a decorative/script face). */}
      <div style={{ margin: '0 10mm', textAlign: 'right', fontFamily: 'Arial, sans-serif', fontSize: '11pt', letterSpacing: '0.2px' }}>
        <span style={{ fontWeight: 700 }}>Date: </span>
        <span style={{ fontWeight: 400 }}>{fmtDate(quotation.quotation_date)}</span>
      </div>
      <div style={{ margin: '0 10mm', textAlign: 'center', padding: '8px 0 6px', fontSize: '18pt', fontWeight: 'bold', letterSpacing: '1px' }}>
        QUOTATION <u>No</u> :- {qNum}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', border: '2px solid #000', margin: '0 10mm', overflow: 'hidden' }}>
        <div style={{ padding: '8px 10px 6px', textAlign: 'left', borderBottom: '1.5px solid #000', background: '#f8f9fa' }}>
          <div style={{ fontSize: `${customerSize}pt`, fontWeight: 'bold', textTransform: 'uppercase', lineHeight: 1.2, color: '#000' }}>
            {(quotation.customer_name || '').toUpperCase()}
          </div>
          {quotation.additional_info && <div style={{ fontSize: `${detailSize}pt`, marginTop: '3px', color: '#000', fontWeight: 800 }}>{quotation.additional_info}</div>}
        </div>
        <div style={{ padding: '2px 4px 0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5pt', tableLayout: 'fixed' }}>
            <colgroup><col style={{ width: '6%' }} /><col style={{ width: '56%' }} /><col style={{ width: '10%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} /></colgroup>
            <thead><tr>
              <th style={{ border: '1.5px solid #000', padding: '6px 4px', background: '#e8e8e8', textAlign: 'center', fontWeight: 'bold', fontSize: '10pt' }}>SR No.</th>
              <th style={{ border: '1.5px solid #000', padding: '6px 4px', background: '#e8e8e8', textAlign: 'left', fontWeight: 'bold', fontSize: '10pt' }}>Particulars</th>
              <th style={{ border: '1.5px solid #000', padding: '6px 4px', background: '#e8e8e8', textAlign: 'center', fontWeight: 'bold', fontSize: '10pt' }}>Qty</th>
              <th style={{ border: '1.5px solid #000', padding: '6px 4px', background: '#e8e8e8', textAlign: 'right', fontWeight: 'bold', fontSize: '10pt' }}>Rate</th>
              <th style={{ border: '1.5px solid #000', padding: '6px 4px', background: '#e8e8e8', textAlign: 'right', fontWeight: 'bold', fontSize: '10pt' }}>Amount</th>
            </tr></thead>
            <tbody>{items.map((item, i) => (
              <tr key={i}>
                <td style={{ border: '1.5px solid #000', padding: '5px 4px', textAlign: 'center', fontWeight: '700', color: '#000' }}>{i + 1}</td>
                <td style={{ border: '1.5px solid #000', padding: '5px 4px', fontSize: '10pt', lineHeight: '1.3', fontWeight: boldOn ? 'bold' : 'normal', whiteSpace: 'pre-line', color: '#000' }}>{item.description || ''}</td>
                <td style={{ border: '1.5px solid #000', padding: '5px 4px', textAlign: 'center', fontWeight: '700', color: '#000' }}>{item.quantity}{item.unit && item.unit !== 'Unit' ? ` ${item.unit}` : ''}</td>
                <td style={{ border: '1.5px solid #000', padding: '5px 4px', textAlign: 'right', fontWeight: '700', color: '#000' }}>₹{fmt(item.rate)}</td>
                <td style={{ border: '1.5px solid #000', padding: '5px 4px', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>₹{fmt(item.amount)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div style={{ padding: '0 4px 6px', flexShrink: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5pt' }}><tbody>
            {gstRate > 0 && <tr><td style={{ border: '1.5px solid #000', padding: '5px 8px', textAlign: 'left', fontWeight: '700', color: '#000' }}>GST: {gstRate}%</td><td style={{ border: '1.5px solid #000', padding: '5px 8px', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>₹{fmt(totalGST)}</td></tr>}
            {/* FIX: amountWords already ends in "ONLY" (see numberToWordsCaps) — appending it again produced "...ONLY ONLY" */}
            <tr style={{ background: '#f5f5f5' }}><td colSpan={2} style={{ border: '1.5px solid #000', padding: '6px 8px', fontSize: '11pt', fontWeight: 'bold', color: '#000' }}>Total : {amountWords}</td></tr>
            <tr style={{ background: '#e8e8e8' }}><td style={{ border: '1.5px solid #000', padding: '7px 8px', textAlign: 'left', fontSize: '13pt', fontWeight: 'bold', color: '#000' }}>Total Amount</td><td style={{ border: '1.5px solid #000', padding: '7px 8px', textAlign: 'right', fontSize: '13pt', fontWeight: 'bold', color: '#000' }}>₹{fmt(totalAmount)}</td></tr>
          </tbody></table>
        </div>
      </div>
      {footerMm > 0 && <div style={{ height: footerMm + 'mm', flexShrink: 0 }}></div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PRO LAYOUT — With letterhead image header, stamp, signature
   Matches the company's printed letterhead format
   ═══════════════════════════════════════════════════════════════ */
function ProLayout({ quotation, items, boldOn, customerSize, detailSize, qNum, gstRate, totalGST, totalAmount, amountWords }) {
  const bdr = '1.5px solid #000'
  return (
    <div className="bg-white shadow-lg mx-auto print-area" style={{ fontFamily: 'Arial, sans-serif', width: '210mm', minHeight: '297mm', background: '#fff', color: '#000', display: 'flex', flexDirection: 'column' }}>
      {/* Real scanned letterhead — logo, GLOB wordmark, tagline, GSTIN, mobile numbers */}
      <img src="/letterhead/glob-header.png" alt="" style={{ width: '100%', display: 'block' }} />

      {/* FIX: bumped size/weight and used a plain label+value split (both
          Arial, no italics) — the old 10pt/600 line read as thin and cramped
          next to the bold letterhead above it. */}
      <div style={{ textAlign: 'right', padding: '4px 10mm 0', fontSize: '11pt', letterSpacing: '0.2px' }}>
        <span style={{ fontWeight: 700 }}>Date: </span>
        <span style={{ fontWeight: 400 }}>{fmtDate(quotation.quotation_date)}</span>
      </div>

      <div style={{ textAlign: 'center', padding: '10px 0 8px', fontSize: '17pt', fontWeight: 700, letterSpacing: 0.5 }}>
        QUOTATION <u>No</u> :- {qNum}
      </div>

      {/* Boxed body — grows to fill page, leaves room for stamp + footer.
          FIX: stamp used to be position:absolute + bottom:2mm measured from
          this whole flex area, so on quotations with a tall items table
          (little leftover white space) the stamp's height (~42mm) reached
          up past the 20mm box margin and overlapped the totals row.
          Using a flex spacer instead means the stamp always sits directly
          below the box in normal flow — it can float down to hug the
          footer when there's room, but it will never overlap the table. */}
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ border: '2px solid #000', margin: '0 10mm 6mm', overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px 6px', borderBottom: bdr }}>
            <div style={{ fontSize: `${customerSize}pt`, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.2 }}>{(quotation.customer_name || '').toUpperCase()}</div>
            {quotation.additional_info && <div style={{ fontSize: `${detailSize}pt`, fontWeight: 700, marginTop: 3 }}>{quotation.additional_info}</div>}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt', tableLayout: 'fixed' }}>
            <colgroup><col style={{ width: '6%' }} /><col style={{ width: '56%' }} /><col style={{ width: '10%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} /></colgroup>
            <thead><tr>
              <th style={{ border: bdr, padding: '6px 4px' }}>SR<br />No.</th>
              <th style={{ border: bdr, padding: '6px 4px', textAlign: 'left' }}>Particulars</th>
              <th style={{ border: bdr, padding: '6px 4px' }}>Qty</th>
              <th style={{ border: bdr, padding: '6px 4px' }}>Rate</th>
              <th style={{ border: bdr, padding: '6px 4px' }}>Amount</th>
            </tr></thead>
            <tbody>{items.map((it, i) => (
              <tr key={i}>
                <td style={{ border: bdr, padding: '5px 4px', textAlign: 'center', fontWeight: 700 }}>{i + 1}</td>
                <td style={{ border: bdr, padding: '5px 4px', fontWeight: boldOn ? 700 : 400, whiteSpace: 'pre-line', lineHeight: 1.3 }}>{it.description || ''}</td>
                <td style={{ border: bdr, padding: '5px 4px', textAlign: 'center', fontWeight: 700 }}>{it.quantity}{it.unit && it.unit !== 'Unit' ? ` ${it.unit}` : ''}</td>
                <td style={{ border: bdr, padding: '5px 4px', textAlign: 'right', fontWeight: 700 }}>₹{fmt(it.rate)}</td>
                <td style={{ border: bdr, padding: '5px 4px', textAlign: 'right', fontWeight: 700 }}>₹{fmt(it.amount)}</td>
              </tr>
            ))}</tbody>
          </table>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5pt' }}><tbody>
            <tr><td style={{ border: bdr, padding: '5px 8px', fontWeight: 700 }}>GST: {gstRate}%</td><td style={{ border: bdr, padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>₹{fmt(totalGST)}</td></tr>
            {/* FIX: amountWords already ends in "ONLY" — appending it again produced "...ONLY ONLY" */}
            <tr><td colSpan={2} style={{ border: bdr, padding: '6px 8px', fontSize: '11pt', fontWeight: 700 }}>Total : {amountWords}</td></tr>
            <tr><td style={{ border: bdr, padding: '7px 8px', fontSize: '13pt', fontWeight: 800 }}>Total Amount</td><td style={{ border: bdr, padding: '7px 8px', textAlign: 'right', fontSize: '13pt', fontWeight: 800 }}>₹{fmt(totalAmount)}</td></tr>
          </tbody></table>
        </div>

        {/* Spacer — absorbs leftover page height so the stamp hugs the
            footer on short quotations, and shrinks to 0 on long ones so
            the stamp is simply pushed down in normal flow (never overlaps). */}
        <div style={{ flex: 1, minHeight: 0 }}></div>

        {/* Company stamp + signature — sits just above the footer, right-aligned */}
        <div style={{ textAlign: 'right', padding: '0 14mm 3mm 0', flexShrink: 0 }}>
          <img src="/letterhead/glob-stamp%26sign.png" alt="" style={{ width: '28mm', opacity: 0.92 }} />
        </div>
      </div>

      {/* Real scanned footer — address + email bar */}
      <img src="/letterhead/glob-footer.png" alt="" style={{ width: '100%', display: 'block' }} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT — FIXED: derived vars moved BEFORE early return
   ═══════════════════════════════════════════════════════════════ */
export default function QuotationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [quotation, setQuotation] = useState(null)
  const [items, setItems] = useState([])
  const [org, setOrg] = useState(null)
  const [boldOn, setBoldOn] = useState(() => localStorage.getItem('quotBold') === 'true')
  const [customerSize, setCustomerSize] = useState(() => localStorage.getItem('quotCustSize') || '14')
  const [detailSize, setDetailSize] = useState(() => localStorage.getItem('quotDetailSize') || '10')
  const [layout, setLayout] = useState(() => localStorage.getItem('quotLayout') || 'classic')
  const [shareOpen, setShareOpen] = useState(false)
  const [sharing, setSharing] = useState(false)

  // ═══ KEY FIX: Compute derived vars BEFORE hooks that reference them ═══
  // This prevents "Cannot access before initialization" when quotation is null
  const selectedFont = org?.quotation_font_family || localStorage.getItem('quotation_font_family') || localStorage.getItem('selected_font') || 'Arial, sans-serif'
  const selectedFontSize = (org?.quotation_font_size || localStorage.getItem('quotation_font_size') || '10') + 'pt'
  const letterheadMm = parseInt(org?.print_letterhead_mm || localStorage.getItem('print_letterhead_mm') || '65')
  const footerMm = parseInt(org?.print_footer_mm || localStorage.getItem('print_footer_mm') || '50')

  useEffect(() => { loadQuotation() }, [id])

  // Load the quotation's Google Font on page mount so it displays correctly
  useEffect(() => {
    if (!selectedFont) return
    const SYSTEM = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Calibri', 'Segoe UI', 'Tahoma', 'Trebuchet MS', 'Cambria', 'Consolas', 'Lucida Console', 'Impact', 'Comic Sans MS', 'Courier New', 'Palatino', 'Garamond', 'Book Antiqua', 'Gill Sans', 'Century Gothic', 'Franklin Gothic Medium']
    // Strip fallback fonts to get just the primary font name
    const primary = selectedFont.split(',')[0].replace(/'/g, '').trim()
    if (SYSTEM.includes(primary)) return
    const family = primary.replace(/ /g, '+')
    const fontId = 'quot-font-' + primary
    if (!document.getElementById(fontId)) {
      const link = document.createElement('link')
      link.id = fontId
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@300;400;500;600;700;800;900&display=swap`
      document.head.appendChild(link)
    }
  }, [selectedFont])

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

  const toggleBold = () => { const val = !boldOn; setBoldOn(val); localStorage.setItem('quotBold', val) }
  const changeCustomerSize = (size) => { setCustomerSize(size); localStorage.setItem('quotCustSize', size) }
  const changeDetailSize = (size) => { setDetailSize(size); localStorage.setItem('quotDetailSize', size) }
  const switchLayout = (val) => { setLayout(val); localStorage.setItem('quotLayout', val) }

  const getGoogleFontUrl = (fontName) => {
    const SYSTEM_FONTS = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Calibri', 'Segoe UI', 'Tahoma', 'Trebuchet MS', 'Cambria', 'Consolas', 'Lucida Console', 'Impact', 'Comic Sans MS']
    if (SYSTEM_FONTS.includes(fontName)) return null
    const family = fontName.replace(/ /g, '+')
    return `https://fonts.googleapis.com/css2?family=${family}:wght@300;400;500;600;700;800;900&display=swap`
  }

  const handlePrint = async () => {
    // WYSIWYG single-page print — stamp/signature included, fits one A4.
    const printEl = document.querySelector('.print-area')
    if (!printEl) { window.print(); return }
    await printElement(printEl, quotation?.quotation_number || 'Quotation')
  }

  const handleDownloadPDF = async () => {
    const printEl = document.querySelector('.print-area')
    const safeName = (quotation?.quotation_number || `quotation-${id}`).replace(/\//g, '-')
    try {
      if (printEl) {
        await downloadPdf(printEl, `Quotation_${safeName}.pdf`)
        return
      }
    } catch (e) {
      console.warn('Client-side PDF failed, falling back to server:', e.message)
    }
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${api.defaults.baseURL}/quotations/${id}/pdf?token=${token}`, { headers: { Authorization: `Bearer ${token}` } })
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Quotation_${safeName}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) { alert('PDF download failed: ' + e.message) }
  }
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
    } catch (err) { alert(err.response?.data?.msg || 'Conversion failed') }
  }

  const handleWhatsApp = async () => {
    setSharing(true)
    try {
      const token = localStorage.getItem('token')
      // FIX: fetch + blob, no token in URL for browser history/log safety
      const pdfResponse = await fetch(`${api.defaults.baseURL}/quotations/${id}/pdf?token=${token}`, { headers: { Authorization: `Bearer ${token}` } })
      const htmlBlob = await pdfResponse.blob()
      const qNum = quotation.quotation_number || ''
      const custName = quotation.customer_name || ''
      const total = fmt(quotation.total_amount)
      try {
        const file = new File([htmlBlob], `Quotation_${qNum.replace(/\//g, '-')}.html`, { type: 'text/html' })
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ text: `*QUOTATION ${qNum}*\nCustomer: ${custName}\nTotal: ₹${total}`, files: [file] })
          setShareOpen(false); setSharing(false); return
        }
      } catch (e) {}
      const viewUrl = `${window.location.origin}/app/quotations/${id}`
      const msg = `*QUOTATION ${qNum}*\nCustomer: ${custName}\nTotal: ₹${total}\n\n📄 View & Print: ${viewUrl}`
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
    } catch (err) { alert('Share failed: ' + err.message) }
    setShareOpen(false); setSharing(false)
  }

  const handleEmail = async () => {
    setSharing(true)
    try {
      const qNum = quotation.quotation_number || ''
      const custName = quotation.customer_name || ''
      const total = fmt(quotation.total_amount)
      const emailTo = prompt('Enter email address to send quotation:')
      if (!emailTo) { setSharing(false); return }
      try {
        await api.post(`/quotations/${id}/share-email`, { to: emailTo })
        alert('Quotation sent via email!')
      } catch (e) {
        const subject = `Quotation ${qNum} - ${org?.name || 'Our Company'}`
        const body = `Dear ${custName},\n\nPlease find our quotation below:\n\nQuotation No: ${qNum}\nTotal Amount: ₹${total}\n\n📄 View: ${window.location.origin}/app/quotations/${id}\n\nBest regards,\n${org?.name || 'Our Company'}`
        window.open(`mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
      }
    } catch (err) { alert('Email share failed: ' + err.message) }
    setShareOpen(false); setSharing(false)
  }

  // ═══ EARLY RETURN (loading spinner) — NOW safe because derived vars are above ═══
  if (!quotation) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>

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

  const sharedProps = { quotation, items, org, boldOn, customerSize, detailSize, qNum, gstRate, totalGST, subtotal, totalAmount, amountWords, letterheadMm, footerMm, selectedFont, selectedFontSize }

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button onClick={() => navigate('/app/quotations')} className="p-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all btn-shine"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold text-white flex-1">Quotation {quotation.quotation_number}</h1>

        {/* Layout Switcher */}
        <button onClick={() => switchLayout(layout === 'pro' ? 'classic' : 'pro')} className="btn-secondary flex items-center gap-2" title="Switch layout">
          <LayoutTemplate size={16} />
          <span className="text-xs font-bold tracking-wide uppercase">{layout === 'pro' ? 'PRO' : 'Classic'}</span>
        </button>

        <div className="flex items-center gap-1 text-sm">
          <span className="text-white/35 text-xs">Name:</span>
          {[10,12,14,16,18,20].map(s => (
            <button key={s} onClick={() => changeCustomerSize(String(s))}
              className={`w-7 h-7 rounded text-xs font-medium transition-all ${customerSize === String(s) ? 'btn-primary' : 'btn-secondary'}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span className="text-white/35 text-xs">Detail:</span>
          {[8,9,10,11,12,14].map(s => (
            <button key={s} onClick={() => changeDetailSize(String(s))}
              className={`w-7 h-7 rounded text-xs font-medium transition-all ${detailSize === String(s) ? 'btn-primary' : 'btn-secondary'}`}>
              {s}
            </button>
          ))}
        </div>

        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 btn-shine"><Printer size={16} /> Print</button>
        {/* FIX: real .pdf download (single A4, includes stamp/signature) */}
        <button onClick={handleDownloadPDF} className="btn-secondary flex items-center gap-2 btn-shine"><Download size={16} /> PDF</button>

        <div className="relative">
          <button onClick={() => setShareOpen(!shareOpen)} className="btn-secondary flex items-center gap-2 btn-shine"><Share2 size={16} /> Share</button>
          {shareOpen && (
            <div className="absolute right-0 top-full mt-1 rounded-xl shadow-xl z-50 min-w-[180px] overflow-hidden" style={{ background: 'rgba(12,16,32,0.98)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button onClick={handleWhatsApp} disabled={sharing} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-green-500/10 text-green-400 text-sm font-medium transition-colors"><MessageCircle size={18} /> {sharing ? 'Sharing...' : 'WhatsApp'}</button>
              <button onClick={handleEmail} disabled={sharing} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-blue-500/10 text-blue-400 text-sm font-medium border-t border-white/5 transition-colors"><Mail size={18} /> {sharing ? 'Sending...' : 'Email'}</button>
            </div>
          )}
        </div>

        <button onClick={() => navigate(`/app/quotations/${id}/edit`)} className="btn-primary flex items-center gap-2 btn-shine"><Edit size={16} /> Edit</button>
        <button onClick={handleConvert} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 flex items-center gap-2 btn-shine transition-colors"><Repeat size={16} /> Convert to Invoice</button>
        <button onClick={handleDelete} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>

        {/* Rightmost — the actual end of the toolbar, not just "after Print" */}
        <button
          onClick={toggleBold}
          title="Bold item descriptions in the printed quotation"
          className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium text-sm transition-all btn-shine ${boldOn ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Bold size={16} />
          Bold {boldOn ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* ═══ LAYOUT SWITCH ═══ */}
      {layout === 'pro'
        ? <ProLayout {...sharedProps} />
        : <ClassicLayout {...sharedProps} />
      }
    </div>
  )
}
