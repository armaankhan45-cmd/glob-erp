import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Printer, Edit, Trash2, Repeat, Share2, MessageCircle, Mail, Download, LayoutTemplate } from 'lucide-react'
import { numberToWordsCaps } from '../utils'

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
   CLASSIC LAYOUT — Compact A4-fit, all BLACK text, no subtotal
   ═══════════════════════════════════════════════════════════════ */
function ClassicLayout({ quotation, items, org, boldOn, customerSize, qNum, gstRate, totalGST, totalAmount, amountWords, letterheadMm, footerMm, selectedFont, selectedFontSize }) {
  const B = '1px solid #000'

  return (
    <div className="bg-white shadow-lg mx-auto print-area" style={{
      fontFamily: selectedFont,
      fontSize: selectedFontSize,
      width: '210mm', maxHeight: '297mm',
      display: 'flex', flexDirection: 'column',
      background: 'white', color: '#000',
      WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'
    }}>
      {/* Letterhead top spacer */}
      {letterheadMm > 0 && <div style={{ height: letterheadMm + 'mm', flexShrink: 0 }}></div>}

      {/* QUOTATION TITLE */}
      <div style={{ textAlign: 'center', padding: '4px 0 3px', fontSize: '12pt', fontWeight: 'bold', letterSpacing: '1px', color: '#000' }}>
        QUOTATION <u>No</u> :- {qNum}
      </div>

      {/* Main bordered box */}
      <div style={{ display: 'flex', flexDirection: 'column', border: '2px solid #000', margin: '0 8mm', overflow: 'hidden' }}>
        {/* Customer name row */}
        <div style={{ padding: '4px 8px 3px', textAlign: 'left', borderBottom: B, background: '#f0f0f0' }}>
          <div style={{ fontSize: `${customerSize}pt`, fontWeight: 'bold', textTransform: 'uppercase', lineHeight: 1.15, color: '#000' }}>
            {(quotation.customer_name || '').toUpperCase()}
          </div>
          {quotation.additional_info && <div style={{ fontSize: '9pt', marginTop: '2px', color: '#000', fontWeight: 800 }}>{quotation.additional_info}</div>}
          {quotation.customer_gstin && <div style={{ fontSize: '8pt', marginTop: '1px', color: '#000', fontWeight: 700 }}>GSTIN: {quotation.customer_gstin}</div>}
        </div>

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: selectedFontSize, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '6%' }} />
            <col style={{ width: '44%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '20%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ border: B, padding: '3px 4px', background: '#e0e0e0', textAlign: 'center', fontWeight: 'bold', color: '#000' }}>SR</th>
              <th style={{ border: B, padding: '3px 4px', background: '#e0e0e0', textAlign: 'left', fontWeight: 'bold', color: '#000' }}>Particulars</th>
              <th style={{ border: B, padding: '3px 4px', background: '#e0e0e0', textAlign: 'center', fontWeight: 'bold', color: '#000' }}>Qty</th>
              <th style={{ border: B, padding: '3px 4px', background: '#e0e0e0', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>Rate</th>
              <th style={{ border: B, padding: '3px 4px', background: '#e0e0e0', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td style={{ border: B, padding: '3px 4px', textAlign: 'center', fontWeight: 700, color: '#000' }}>{i + 1}</td>
                <td style={{ border: B, padding: '3px 4px', lineHeight: '1.25', fontWeight: boldOn ? 'bold' : 'normal', whiteSpace: 'pre-line', color: '#000' }}>{item.description || ''}</td>
                <td style={{ border: B, padding: '3px 4px', textAlign: 'center', fontWeight: 700, color: '#000' }}>{item.quantity}{item.unit && item.unit !== 'Unit' ? ` ${item.unit}` : ''}</td>
                <td style={{ border: B, padding: '3px 4px', textAlign: 'right', fontWeight: 700, color: '#000' }}>₹{fmt(item.rate)}</td>
                <td style={{ border: B, padding: '3px 4px', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>₹{fmt(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals — NO Subtotal */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: selectedFontSize }}>
          <tbody>
            {gstRate > 0 && (
              <tr>
                <td style={{ border: B, padding: '3px 8px', textAlign: 'left', fontWeight: 700, color: '#000' }}>GST: {gstRate}%</td>
                <td style={{ border: B, padding: '3px 8px', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>₹{fmt(totalGST)}</td>
              </tr>
            )}
            <tr style={{ background: '#f5f5f5' }}>
              <td colSpan={2} style={{ border: B, padding: '4px 8px', fontSize: '9.5pt', fontWeight: 'bold', color: '#000' }}>Total : {amountWords} ONLY</td>
            </tr>
            <tr style={{ background: '#e0e0e0' }}>
              <td style={{ border: B, padding: '4px 8px', textAlign: 'left', fontSize: '11pt', fontWeight: 'bold', color: '#000' }}>Total Amount</td>
              <td style={{ border: B, padding: '4px 8px', textAlign: 'right', fontSize: '11pt', fontWeight: 'bold', color: '#000' }}>₹{fmt(totalAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer bottom spacer */}
      {footerMm > 0 && <div style={{ height: footerMm + 'mm', flexShrink: 0 }}></div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   PRO LAYOUT — Compact A4-fit, all BLACK text, no subtotal
   ═══════════════════════════════════════════════════════════════ */
function ProLayout({ quotation, items, org, boldOn, customerSize, qNum, gstRate, totalGST, totalAmount, amountWords, selectedFont, selectedFontSize, letterheadMm, footerMm }) {
  const NAVY = '#1a2744'
  const bdr = '1px solid #bbb'
  const B = `1.5px solid ${NAVY}`
  const companyName = (org?.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()
  const hasLetterhead = !!org?.logo_url

  return (
    <div className="bg-white shadow-lg mx-auto print-area" style={{
      fontFamily: selectedFont,
      fontSize: selectedFontSize,
      width: '210mm', maxHeight: '297mm',
      background: 'white', color: '#000',
      WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Top stripe */}
      <div style={{ height: 2, background: NAVY }}></div>

      {/* Letterhead spacer */}
      {letterheadMm > 0 && <div style={{ height: letterheadMm + 'mm', flexShrink: 0 }}></div>}

      {/* ══ HEADER — compact ══ */}
      {hasLetterhead ? (
        <div style={{ padding: '5px 10px 4px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1.5px solid ${NAVY}` }}>
          <div style={{ width: 50, height: 50, flexShrink: 0, borderRadius: 3, overflow: 'hidden', border: `1.5px solid ${NAVY}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={org.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Logo" />
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '14pt', fontWeight: 900, color: '#000', letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 1.1 }}>{companyName}</div>
            <div style={{ fontSize: '8pt', color: '#000', marginTop: 1, fontWeight: 600 }}>
              {[org?.address, org?.city, org?.state, org?.pincode].filter(Boolean).join(', ')}
            </div>
            <div style={{ fontSize: '8pt', color: '#000', fontWeight: 600 }}>
              {org?.phone ? `Ph: ${org.phone}` : ''}{org?.email ? `  |  ${org.email}` : ''}
            </div>
            {org?.gstin && (
              <span style={{ display: 'inline-block', background: NAVY, color: '#fff', padding: '1px 8px', borderRadius: 2, fontSize: '7.5pt', fontWeight: 700, marginTop: 1 }}>GSTIN: {org.gstin}</span>
            )}
          </div>
          <div style={{ width: 50, flexShrink: 0 }}></div>
        </div>
      ) : (
        <div style={{ padding: '6px 10px 4px', textAlign: 'center', borderBottom: `1.5px solid ${NAVY}` }}>
          <div style={{ fontSize: '14pt', fontWeight: 900, color: '#000', letterSpacing: 2, textTransform: 'uppercase' }}>{companyName}</div>
          <div style={{ fontSize: '8pt', color: '#000', marginTop: 1, fontWeight: 600 }}>{[org?.address, org?.city, org?.state, org?.pincode].filter(Boolean).join(', ')}</div>
          <div style={{ fontSize: '8pt', color: '#000', fontWeight: 600 }}>{org?.phone ? `Ph: ${org.phone}` : ''}{org?.email ? `  |  ${org.email}` : ''}</div>
          {org?.gstin && <span style={{ display: 'inline-block', background: NAVY, color: '#fff', padding: '1px 8px', borderRadius: 2, fontSize: '7.5pt', fontWeight: 700, marginTop: 1 }}>GSTIN: {org.gstin}</span>}
        </div>
      )}

      {/* Thin accent */}
      <div style={{ height: 1, background: `linear-gradient(90deg, ${NAVY}, #06b6d4, ${NAVY})` }}></div>

      {/* ══ TITLE + DATE — compact ══ */}
      <div style={{ display: 'flex', background: '#f5f7fa', borderBottom: B, padding: '4px 10px', alignItems: 'center' }}>
        <span style={{ fontSize: '12pt', fontWeight: 900, color: '#000', letterSpacing: 2 }}>QUOTATION</span>
        <div style={{ flex: 1 }}></div>
        <div style={{ textAlign: 'right', fontSize: '8pt', fontWeight: 700, color: '#000' }}>
          No: <b>{qNum}</b>{quotation.quotation_date && `  |  Date: ${fmtDate(quotation.quotation_date)}`}
        </div>
      </div>

      {/* ══ CUSTOMER INFO — compact ══ */}
      <div style={{ display: 'flex', border: B, borderTop: 'none' }}>
        <div style={{ flex: 1, padding: '4px 10px', borderRight: '1px solid #ccc' }}>
          <div style={{ fontSize: `${customerSize}pt`, fontWeight: 800, color: '#000', textTransform: 'uppercase', lineHeight: 1.15 }}>{(quotation.customer_name || '').toUpperCase()}</div>
          {quotation.additional_info && <div style={{ fontSize: '9pt', color: '#000', fontWeight: 800, marginTop: 1 }}>{quotation.additional_info}</div>}
        </div>
        <div style={{ width: '180px', padding: '4px 10px', fontSize: '8pt', color: '#000', fontWeight: 600 }}>
          {quotation.customer_gstin && <div><b>GSTIN:</b> {quotation.customer_gstin}</div>}
          {quotation.customer_state && <div><b>State:</b> {quotation.customer_state}</div>}
        </div>
      </div>

      {/* ══ ITEMS TABLE — compact ══ */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: selectedFontSize, border: B, borderTop: 'none' }}>
        <colgroup>
          <col style={{ width: '5%' }} />
          <col style={{ width: '42%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '19%' }} />
        </colgroup>
        <thead>
          <tr style={{ background: '#d5dae0' }}>
            <th style={{ padding: '3px 4px', border: bdr, fontWeight: 800, color: '#000', textAlign: 'center' }}>#</th>
            <th style={{ padding: '3px 4px', border: bdr, fontWeight: 800, color: '#000', textAlign: 'left' }}>DESCRIPTION</th>
            <th style={{ padding: '3px 4px', border: bdr, fontWeight: 800, color: '#000', textAlign: 'center' }}>QTY</th>
            <th style={{ padding: '3px 4px', border: bdr, fontWeight: 800, color: '#000', textAlign: 'center' }}>UNIT</th>
            <th style={{ padding: '3px 4px', border: bdr, fontWeight: 800, color: '#000', textAlign: 'right' }}>RATE</th>
            <th style={{ padding: '3px 4px', border: bdr, fontWeight: 800, color: '#000', textAlign: 'right' }}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const rowBg = i % 2 === 1 ? '#fafbfc' : '#fff'
            return (
              <tr key={i} style={{ background: rowBg }}>
                <td style={{ padding: '3px 4px', border: bdr, textAlign: 'center', fontWeight: 700, color: '#000' }}>{i + 1}</td>
                <td style={{ padding: '3px 4px', border: bdr, fontWeight: boldOn ? 700 : 500, color: '#000', lineHeight: 1.25, whiteSpace: 'pre-line' }}>{item.description || ''}</td>
                <td style={{ padding: '3px 4px', border: bdr, textAlign: 'center', fontWeight: 700, color: '#000' }}>{item.quantity}</td>
                <td style={{ padding: '3px 4px', border: bdr, textAlign: 'center', fontWeight: 600, color: '#000' }}>{item.unit || 'NOS'}</td>
                <td style={{ padding: '3px 4px', border: bdr, textAlign: 'right', fontWeight: 700, color: '#000' }}>₹{fmt(item.rate)}</td>
                <td style={{ padding: '3px 4px', border: bdr, textAlign: 'right', fontWeight: 700, color: '#000' }}>₹{fmt(item.amount)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ══ TOTALS — NO Subtotal, compact ══ */}
      <div style={{ border: B, borderTop: 'none' }}>
        {gstRate > 0 && (
          <div style={{ display: 'flex', borderBottom: bdr }}>
            <div style={{ flex: 1, padding: '3px 10px', fontWeight: 700, color: '#000' }}>GST: {gstRate}%</div>
            <div style={{ width: '160px', padding: '3px 10px', textAlign: 'right', fontWeight: 700, color: '#000' }}>₹{fmt(totalGST)}</div>
          </div>
        )}
        <div style={{ background: '#f5f7fa', padding: '3px 10px', borderBottom: bdr }}>
          <div style={{ fontWeight: 700, color: '#000' }}>Amount in Words: <b>{amountWords} ONLY</b></div>
        </div>
        <div style={{ display: 'flex', background: '#d5dae0' }}>
          <div style={{ flex: 1, padding: '4px 10px', fontSize: '11pt', fontWeight: 900, color: '#000' }}>Total Amount</div>
          <div style={{ width: '160px', padding: '4px 10px', textAlign: 'right', fontSize: '11pt', fontWeight: 900, color: '#000' }}>₹{fmt(totalAmount)}</div>
        </div>
      </div>

      {/* ══ TERMS + BANK + SIGNATURE — compact ══ */}
      <div style={{ display: 'flex', border: B, borderTop: 'none' }}>
        {/* Terms */}
        <div style={{ flex: 1, padding: '4px 10px', borderRight: '1px solid #ccc', fontSize: '8pt', lineHeight: 1.4, color: '#000', fontWeight: 600 }}>
          <div style={{ fontWeight: 800, color: '#000', marginBottom: 2, textTransform: 'uppercase', fontSize: '8pt' }}>Terms & Conditions</div>
          <ol style={{ paddingLeft: 12, margin: 0 }}>
            <li>Goods once sold cannot be taken back or exchanged.</li>
            <li>Interest @18% p.a. on uncleared bills beyond 15 days.</li>
            <li>Subject to Maharashtra jurisdiction only.</li>
          </ol>
        </div>
        {/* Bank */}
        {(org?.bank_name || org?.account_no) && (
          <div style={{ width: '170px', padding: '4px 10px', borderRight: '1px solid #ccc', fontSize: '7.5pt', lineHeight: 1.4, color: '#000', fontWeight: 600 }}>
            <div style={{ fontWeight: 800, color: '#000', marginBottom: 2, textTransform: 'uppercase', fontSize: '8pt' }}>Bank Details</div>
            {org?.bank_name && <div>Bank: <b>{org.bank_name}</b></div>}
            {org?.account_no && <div>A/C: <b>{org.account_no}</b></div>}
            {org?.ifsc && <div>IFSC: <b>{org.ifsc}</b></div>}
          </div>
        )}
        {/* Signature */}
        <div style={{ flex: 1, padding: '4px 10px', textAlign: 'right', fontSize: '8pt', color: '#000' }}>
          <div style={{ fontWeight: 800, color: '#000', marginBottom: 2, textTransform: 'uppercase', fontSize: '8pt' }}>For {companyName}</div>
          <div style={{ width: 110, height: 50, display: 'inline-block', position: 'relative', marginTop: 2 }}>
            {org?.stamp_url && <img src={org.stamp_url} style={{ position: 'absolute', width: 110, height: 50, objectFit: 'contain', opacity: 0.85 }} alt="Stamp" />}
            {org?.signature_url && <img src={org.signature_url} style={{ position: 'relative', zIndex: 1, maxHeight: 35, maxWidth: 80, objectFit: 'contain' }} alt="Sign" />}
          </div>
          <div style={{ borderTop: '1px solid #000', display: 'inline-block', paddingTop: 2, fontWeight: 800, fontSize: '7.5pt', marginTop: 2, color: '#000' }}>Authorised Signatory</div>
        </div>
      </div>

      {/* Footer spacer */}
      {footerMm > 0 && <div style={{ height: footerMm + 'mm', flexShrink: 0 }}></div>}
      {/* Bottom stripe */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${NAVY}, #06b6d4, ${NAVY})` }}></div>
      <div style={{ textAlign: 'center', padding: '2px 0', fontSize: '7pt', color: '#000', fontWeight: 600 }}>
        Computer generated quotation • E & O.E
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function QuotationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [quotation, setQuotation] = useState(null)
  const [items, setItems] = useState([])
  const [org, setOrg] = useState(null)
  const [boldOn, setBoldOn] = useState(() => localStorage.getItem('quotBold') === 'true')
  const [customerSize, setCustomerSize] = useState(() => localStorage.getItem('quotCustSize') || '14')
  const [layout, setLayout] = useState(() => localStorage.getItem('quotLayout') || 'classic')
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

  const toggleBold = () => { const val = !boldOn; setBoldOn(val); localStorage.setItem('quotBold', val) }
  const changeCustomerSize = (size) => { setCustomerSize(size); localStorage.setItem('quotCustSize', size) }
  const switchLayout = (val) => { setLayout(val); localStorage.setItem('quotLayout', val) }

  const getGoogleFontUrl = (fontName) => {
    const SYSTEM_FONTS = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Calibri', 'Segoe UI', 'Tahoma', 'Trebuchet MS', 'Cambria', 'Consolas', 'Lucida Console', 'Impact', 'Comic Sans MS']
    if (SYSTEM_FONTS.includes(fontName)) return null
    const family = fontName.replace(/ /g, '+')
    return `https://fonts.googleapis.com/css2?family=${family}:wght@300;400;500;600;700;800;900&display=swap`
  }

  const handlePrint = () => {
    const printEl = document.querySelector('.print-area')
    if (!printEl) { window.print(); return }
    const html = printEl.innerHTML
    const title = quotation?.quotation_number || 'Quotation'
    const fontUrl = getGoogleFontUrl(selectedFont)
    const fontLinkTag = fontUrl ? `<link href="${fontUrl}" rel="stylesheet">` : ''
    const w = window.open('', '_blank', 'width=900,height=600')
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
${fontLinkTag}
<style>
@page { margin: 0; size: A4; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin:0; padding:0; background:white; color:#000; font-family:'${selectedFont}', 'Segoe UI', Arial, sans-serif; }
img { max-width:100%; }
table { border-collapse:collapse; width:100%; }
th,td { padding:3px 5px; }
</style></head><body>${html}</body></html>`)
    w.document.close()
    setTimeout(() => { w.print(); w.close() }, 500)
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
      const pdfUrl = `${api.defaults.baseURL}/quotations/${id}/pdf?token=${token}`
      const qNum = quotation.quotation_number || ''
      const custName = quotation.customer_name || ''
      const total = fmt(quotation.total_amount)
      try {
        const response = await fetch(pdfUrl); const htmlBlob = await response.blob()
        const file = new File([htmlBlob], `Quotation_${qNum.replace(/\//g, '-')}.html`, { type: 'text/html' })
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ text: `*QUOTATION ${qNum}*\nCustomer: ${custName}\nTotal: ₹${total}`, files: [file] })
          setShareOpen(false); setSharing(false); return
        }
      } catch (e) {}
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
      } catch (e) {
        const subject = `Quotation ${qNum} - ${org?.name || 'Our Company'}`
        const body = `Dear ${custName},\n\nPlease find our quotation below:\n\nQuotation No: ${qNum}\nTotal Amount: ₹${total}\n\n📄 View: ${window.location.origin}/app/quotations/${id}\n📥 PDF: ${pdfUrl}\n\nBest regards,\n${org?.name || 'Our Company'}`
        window.open(`mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
      }
    } catch (err) { alert('Email share failed: ' + err.message) }
    setShareOpen(false); setSharing(false)
  }

  if (!quotation) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>

  const rawNum = quotation.quotation_number?.split('/')[0] || ''
  const qNum = rawNum.replace(/^[A-Za-z\-]+/, '').replace(/^0+/, '') || rawNum

  const hasCGST = parseFloat(quotation.cgst_amount) > 0
  const hasIGST = parseFloat(quotation.igst_amount) > 0
  const gstRate = hasIGST
    ? parseFloat(items[0]?.igst_rate || 18)
    : (hasCGST ? parseFloat(items[0]?.cgst_rate || 9) * 2 : 18)
  const totalGST = parseFloat(quotation.igst_amount) + parseFloat(quotation.cgst_amount) + parseFloat(quotation.sgst_amount)
  const totalAmount = parseFloat(quotation.total_amount) || 0
  const amountWords = numberToWordsCaps(totalAmount)

  const selectedFont = org?.quotation_font_family || localStorage.getItem('quotation_font_family') || localStorage.getItem('selected_font') || 'Arial, sans-serif'
  const selectedFontSize = (org?.quotation_font_size || localStorage.getItem('quotation_font_size') || '10') + 'pt'
  const letterheadMm = parseInt(org?.print_letterhead_mm || localStorage.getItem('print_letterhead_mm') || '65')
  const footerMm = parseInt(org?.print_footer_mm || localStorage.getItem('print_footer_mm') || '50')

  const sharedProps = { quotation, items, org, boldOn, customerSize, qNum, gstRate, totalGST, totalAmount, amountWords, letterheadMm, footerMm, selectedFont, selectedFontSize }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button onClick={() => navigate('/app/quotations')} className="p-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all btn-shine"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold text-white flex-1">Quotation {quotation.quotation_number}</h1>
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
        <button onClick={toggleBold} className={`px-3 py-2 rounded-xl font-medium text-sm transition-all ${boldOn ? 'btn-primary' : 'btn-secondary'}`}>Bold {boldOn ? 'ON' : 'OFF'}</button>
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 btn-shine"><Printer size={16} /> Print</button>
        <button onClick={() => { const token = localStorage.getItem('token'); window.open(`${api.defaults.baseURL}/quotations/${id}/pdf?token=${token}`, '_blank') }} className="btn-secondary flex items-center gap-2 btn-shine"><Download size={16} /> PDF</button>
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
      </div>

      {layout === 'pro'
        ? <ProLayout {...sharedProps} />
        : <ClassicLayout {...sharedProps} />
      }
    </div>
  )
}
