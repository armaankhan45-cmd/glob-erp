import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Printer, Edit, Trash2, Copy, Repeat } from 'lucide-react'
import { numberToWordsCaps, formatIndian } from '../utils'

export default function QuotationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [quotation, setQuotation] = useState(null)
  const [items, setItems] = useState([])
  const [org, setOrg] = useState(null)
  const [boldOn, setBoldOn] = useState(() => localStorage.getItem('quotBold') === 'true')

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

  if (!quotation) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>

  const letterheadMm = org?.print_letterhead_mm || 65
  const footerMm = org?.print_footer_mm || 50
  const qNum = quotation.quotation_number?.split('/')[0]

  // Determine GST type
  const hasCGST = parseFloat(quotation.cgst_amount) > 0
  const hasIGST = parseFloat(quotation.igst_amount) > 0
  const gstRate = hasIGST
    ? parseFloat(items[0]?.igst_rate || 18)
    : (hasCGST ? parseFloat(items[0]?.cgst_rate || 9) * 2 : 0)

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button onClick={() => navigate('/app/quotations')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold flex-1">Quotation {quotation.quotation_number}</h1>
        <button onClick={toggleBold} className={`px-3 py-2 rounded-lg font-medium text-sm ${boldOn ? 'bg-gray-800 text-white' : 'btn-secondary'}`}>Bold {boldOn ? 'ON' : 'OFF'}</button>
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2"><Printer size={16} /> Print</button>
        <button onClick={() => navigate(`/app/quotations/${id}/edit`)} className="btn-primary flex items-center gap-2"><Edit size={16} /> Edit</button>
        <button onClick={handleConvert} className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 flex items-center gap-2"><Repeat size={16} /> Convert to Invoice</button>
        <button onClick={handleDelete} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>
      </div>

      {/* A4 Print Layout - EXACT user business format */}
      <div className="bg-white shadow-lg mx-auto print-area" style={{ fontFamily: 'Georgia, serif', fontSize: '10pt' }}>
        {/* Letterhead Space */}
        <div style={{ height: `${letterheadMm}mm`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
          📎 Pre-printed Letterhead Space ({letterheadMm}mm)
        </div>

        {/* Content */}
        <div style={{ maxHeight: `${297 - letterheadMm - footerMm}mm`, overflow: 'hidden', padding: '0 14mm' }}>
          {/* Heading - Matching "Quotation No:- 873" style */}
          <h2 style={{ textAlign: 'center', fontSize: '24pt', fontFamily: 'Georgia, serif', marginBottom: '4px' }}>
            Quotation <u>No</u> :- {qNum}
          </h2>

          {/* Customer Name - Bold Uppercase */}
          <p style={{ textAlign: 'center', fontSize: '13pt', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>
            {(quotation.customer_name || '').toUpperCase()}
          </p>

          {/* Additional Info (PAN, Vehicle No.) */}
          {quotation.additional_info && (
            <p style={{ textAlign: 'center', fontSize: '10pt', marginBottom: '4px' }}>{quotation.additional_info}</p>
          )}

          {/* Date Row */}
          <p style={{ textAlign: 'center', fontSize: '10pt', marginBottom: '8px', color: '#555' }}>
            Date: {quotation.quotation_date}{quotation.validity_date ? ` | Valid till: ${quotation.validity_date}` : ''}
          </p>

          {/* Items Table - SR No. | Particulars | Quantity | Rate (INR) | Amount (INR) */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
            <thead><tr style={{ background: '#f0f0f0' }}>
              <th style={{ border: '1px solid #000', padding: '5px', width: '7%', textAlign: 'center' }}>SR No.</th>
              <th style={{ border: '1px solid #000', padding: '5px', width: '47%', textAlign: 'center' }}>Particulars</th>
              <th style={{ border: '1px solid #000', padding: '5px', width: '12%', textAlign: 'center' }}>Quantity</th>
              <th style={{ border: '1px solid #000', padding: '5px', width: '17%', textAlign: 'center' }}>Rate (INR)</th>
              <th style={{ border: '1px solid #000', padding: '5px', width: '17%', textAlign: 'center' }}>Amount (INR)</th>
            </tr></thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', verticalAlign: 'top' }}>{i + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', fontSize: '9pt', lineHeight: '1.4', fontWeight: boldOn ? 'bold' : 'normal', whiteSpace: 'pre-line' }}>{item.description || ''}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', verticalAlign: 'top' }}>
                    {item.quantity}{item.unit && item.unit !== 'Unit' ? ` ${item.unit}` : ''}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', verticalAlign: 'top' }}>{formatIndian(item.rate)}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'top' }}>{formatIndian(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* GST + Totals - Matching "GST: 18%" then "Total:" style */}
          <table style={{ width: '100%', marginTop: '4px', fontSize: '10pt' }}>
            <tbody>
              {hasIGST && parseFloat(quotation.igst_amount) > 0 && (
                <tr>
                  <td style={{ textAlign: 'right', padding: '4px', width: '78%' }}>GST: {gstRate}%</td>
                  <td style={{ textAlign: 'right', padding: '4px' }}>{formatIndian(quotation.igst_amount)}</td>
                </tr>
              )}
              {hasCGST && parseFloat(quotation.cgst_amount) > 0 && (
                <>
                  <tr>
                    <td style={{ textAlign: 'right', padding: '4px', width: '78%' }}>CGST @ {parseFloat(items[0]?.cgst_rate || 9).toFixed(1)}%</td>
                    <td style={{ textAlign: 'right', padding: '4px' }}>{formatIndian(quotation.cgst_amount)}</td>
                  </tr>
                  <tr>
                    <td style={{ textAlign: 'right', padding: '4px', width: '78%' }}>SGST @ {parseFloat(items[0]?.sgst_rate || 9).toFixed(1)}%</td>
                    <td style={{ textAlign: 'right', padding: '4px' }}>{formatIndian(quotation.sgst_amount)}</td>
                  </tr>
                </>
              )}
              {!hasIGST && !hasCGST && gstRate > 0 && (
                <tr>
                  <td style={{ textAlign: 'right', padding: '4px', width: '78%' }}>GST: {gstRate}%</td>
                  <td style={{ textAlign: 'right', padding: '4px' }}>{formatIndian(parseFloat(quotation.igst_amount) + parseFloat(quotation.cgst_amount) + parseFloat(quotation.sgst_amount))}</td>
                </tr>
              )}
              <tr style={{ fontSize: '12pt', borderTop: '2px solid #000' }}>
                <td style={{ textAlign: 'right', padding: '6px', width: '78%' }}><strong>Total :</strong></td>
                <td style={{ textAlign: 'right', padding: '6px', fontWeight: 'bold' }}>₹{formatIndian(quotation.total_amount)}</td>
              </tr>
            </tbody>
          </table>

          {/* Amount in Words - ALL CAPS like "TWENTY ONE LAKH TWENTY FOUR THOUSAND ONLY" */}
          <p style={{ marginTop: '8px', fontSize: '10pt', fontWeight: 'bold' }}>
            {numberToWordsCaps(quotation.total_amount)}
          </p>

          {/* Company Info */}
          <p style={{ marginTop: '6px', fontSize: '8.5pt', color: '#444' }}>
            <strong>GSTIN:</strong> {org?.gstin || ''} | <strong>State:</strong> {org?.state} ({org?.state_code})
          </p>

          {/* Bank Details */}
          {org?.bank_name && (
            <p style={{ marginTop: '4px', fontSize: '8.5pt', color: '#444' }}>
              <strong>Bank:</strong> {org.bank_name} | <strong>A/C:</strong> {org.account_no} | <strong>IFSC:</strong> {org.ifsc}
            </p>
          )}

          {/* Actual Notes */}
          {quotation.actual_notes && (
            <p style={{ marginTop: '4px', fontSize: '8.5pt', color: '#666' }}>{quotation.actual_notes}</p>
          )}
        </div>

        {/* Footer Space */}
        <div style={{ height: `${footerMm}mm`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
          📎 Stamp + Signature + Address Space ({footerMm}mm)
        </div>
      </div>
    </div>
  )
}
