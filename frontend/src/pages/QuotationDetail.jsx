import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Printer, Edit, Trash2, Repeat, Share2, MessageCircle, Mail } from 'lucide-react'
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

  // WhatsApp share
  const handleWhatsApp = () => {
    const qNum = quotation.quotation_number || ''
    const custName = quotation.customer_name || ''
    const total = fmt(quotation.total_amount)
    const viewUrl = `${window.location.origin}/app/quotations/${id}`
    const msg = `*QUOTATION ${qNum}*\nCustomer: ${custName}\nTotal: ₹${total}\n\nView & Print: ${viewUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
    setShareOpen(false)
  }

  // Email share
  const handleEmail = () => {
    const qNum = quotation.quotation_number || ''
    const custName = quotation.customer_name || ''
    const total = fmt(quotation.total_amount)
    const viewUrl = `${window.location.origin}/app/quotations/${id}`
    const subject = `Quotation ${qNum} - ${org?.name || 'Our Company'}`
    const body = `Dear ${custName},\n\nPlease find below our quotation:\n\nQuotation No: ${qNum}\nTotal Amount: ₹${total}\n\nYou can view and print the quotation here:\n${viewUrl}\n\nThank you for your interest.\n\nBest regards,\n${org?.name || 'Our Company'}`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
    setShareOpen(false)
  }

  if (!quotation) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>

  const letterheadMm = org?.print_letterhead_mm || 65

  // Extract just the number part — remove prefix like "Q-" and zero-padding
  // e.g. "Q-0001/26-27" → "1", "821/26-27" → "821"
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
        <button onClick={() => navigate('/app/quotations')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold flex-1">Quotation {quotation.quotation_number}</h1>
        
        {/* Customer size control */}
        <div className="flex items-center gap-1 text-sm">
          <span className="text-gray-500 text-xs">Name:</span>
          {[10,12,14,16,18,20].map(s => (
            <button key={s} onClick={() => changeCustomerSize(String(s))}
              className={`w-7 h-7 rounded text-xs font-medium ${customerSize === String(s) ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s}
            </button>
          ))}
        </div>

        <button onClick={toggleBold} className={`px-3 py-2 rounded-lg font-medium text-sm ${boldOn ? 'bg-gray-800 text-white' : 'btn-secondary'}`}>Bold {boldOn ? 'ON' : 'OFF'}</button>
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2"><Printer size={16} /> Print</button>
        
        {/* Share button */}
        <div className="relative">
          <button onClick={() => setShareOpen(!shareOpen)} className="btn-secondary flex items-center gap-2"><Share2 size={16} /> Share</button>
          {shareOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border z-50 min-w-[180px]">
              <button onClick={handleWhatsApp} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-green-50 text-green-700 text-sm font-medium">
                <MessageCircle size={18} /> WhatsApp
              </button>
              <button onClick={handleEmail} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-blue-50 text-blue-700 text-sm font-medium border-t">
                <Mail size={18} /> Email
              </button>
            </div>
          )}
        </div>

        <button onClick={() => navigate(`/app/quotations/${id}/edit`)} className="btn-primary flex items-center gap-2"><Edit size={16} /> Edit</button>
        <button onClick={handleConvert} className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 flex items-center gap-2"><Repeat size={16} /> Convert to Invoice</button>
        <button onClick={handleDelete} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>
      </div>

      {/* Quotation Print Layout */}
      <div className="bg-white shadow-lg mx-auto print-area" style={{ fontFamily: 'Georgia, serif', fontSize: '10pt', width: '210mm', height: '297mm', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white' }}>
        
        {/* Letterhead space */}
        <div style={{ height: `${letterheadMm}mm`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
          Pre-printed Letterhead Space ({letterheadMm}mm)
        </div>

        {/* Customer name — OUTSIDE the box, left-aligned, bigger */}
        <div style={{ margin: '0 10mm', padding: '4px 0 6px', textAlign: 'left' }}>
          <div style={{ fontSize: `${customerSize}pt`, fontWeight: 'bold', textTransform: 'uppercase', lineHeight: 1.2 }}>
            {(quotation.customer_name || '').toUpperCase()}
          </div>
          {quotation.additional_info && (
            <div style={{ fontSize: '9pt', marginTop: '2px', color: '#444' }}>{quotation.additional_info}</div>
          )}
        </div>

        {/* Bordered box starts here */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '2px solid #000', margin: '0 10mm', overflow: 'hidden' }}>
          
          {/* Quotation number — inside box, centered */}
          <div style={{ textAlign: 'center', padding: '6px 0 4px', fontSize: '16pt', fontWeight: 'bold' }}>
            Quotation <u>No</u> :- {qNum}
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

          {/* Total + Amount in words — INSIDE the box */}
          <div style={{ padding: '0 5px 6px', flexShrink: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
              <tbody>
                {gstRate > 0 && (
                  <tr>
                    <td style={{ border: '1.5px solid #000', padding: '4px 6px', textAlign: 'right', width: '76%' }}>
                      GST: {gstRate}%
                    </td>
                    <td style={{ border: '1.5px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>
                      ₹{fmt(totalGST)}
                    </td>
                  </tr>
                )}
                <tr style={{ background: '#f0f0f0' }}>
                  <td style={{ border: '1.5px solid #000', padding: '5px 6px', textAlign: 'right', fontSize: '11pt' }}>
                    <strong>Total ₹{fmt(quotation.total_amount)}</strong>
                  </td>
                  <td style={{ border: '1.5px solid #000', padding: '5px 6px', fontSize: '9pt', fontWeight: 'bold', textAlign: 'center', background: '#fafafa' }}>
                    {numberToWordsCaps(quotation.total_amount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Sign space */}
        <div style={{ height: '30mm', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
          Sign & Stamp Space (30mm)
        </div>
      </div>
    </div>
  )
}
