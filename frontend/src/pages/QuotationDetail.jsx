import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Printer, Edit, Trash2, Repeat } from 'lucide-react'
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
  const qNum = quotation.quotation_number?.split('/')[0]

  const hasCGST = parseFloat(quotation.cgst_amount) > 0
  const hasIGST = parseFloat(quotation.igst_amount) > 0
  const gstRate = hasIGST
    ? parseFloat(items[0]?.igst_rate || 18)
    : (hasCGST ? parseFloat(items[0]?.cgst_rate || 9) * 2 : 0)
  const totalGST = parseFloat(quotation.igst_amount) + parseFloat(quotation.cgst_amount) + parseFloat(quotation.sgst_amount)

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

      {/* A4 Print Layout - Letterhead space only at top, NO sign/stamp space at bottom */}
      <div className="bg-white shadow-lg mx-auto print-area" style={{ fontFamily: 'Georgia, serif', fontSize: '10pt' }}>
        {/* Pre-printed Letterhead Space */}
        <div style={{ height: `${letterheadMm}mm`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
          📎 Pre-printed Letterhead Space ({letterheadMm}mm)
        </div>

        {/* Content - fills the rest of the page */}
        <div style={{ padding: '0 12mm 6mm' }}>

          {/* Heading */}
          <h2 style={{ textAlign: 'center', fontSize: '22pt', fontFamily: 'Georgia, serif', marginBottom: '2px' }}>
            Quotation <u>No</u> :- {qNum}
          </h2>

          {/* Customer Name - Bold Uppercase */}
          <p style={{ textAlign: 'center', fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>
            {(quotation.customer_name || '').toUpperCase()}
          </p>

          {/* Additional Info (PAN, Vehicle No.) */}
          {quotation.additional_info && (
            <p style={{ textAlign: 'center', fontSize: '10pt', marginBottom: '2px' }}>{quotation.additional_info}</p>
          )}

          {/* Date Row */}
          <p style={{ textAlign: 'center', fontSize: '9pt', marginBottom: '8px', color: '#555' }}>
            Date: {quotation.quotation_date}{quotation.validity_date ? ` | Valid till: ${quotation.validity_date}` : ''}
          </p>

          {/* Items Table - Full box styling */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
            <thead>
              <tr style={{ background: '#e8e8e8' }}>
                <th style={{ border: '1.5px solid #000', padding: '5px 4px', width: '7%', textAlign: 'center' }}>SR No.</th>
                <th style={{ border: '1.5px solid #000', padding: '5px 4px', width: '47%', textAlign: 'center' }}>Particulars</th>
                <th style={{ border: '1.5px solid #000', padding: '5px 4px', width: '12%', textAlign: 'center' }}>Quantity</th>
                <th style={{ border: '1.5px solid #000', padding: '5px 4px', width: '17%', textAlign: 'center' }}>Rate (INR)</th>
                <th style={{ border: '1.5px solid #000', padding: '5px 4px', width: '17%', textAlign: 'center' }}>Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={{ border: '1.5px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>{i + 1}</td>
                  <td style={{
                    border: '1.5px solid #000',
                    padding: '3px 4px',
                    fontSize: '9pt',
                    lineHeight: '1.35',
                    fontWeight: boldOn ? 'bold' : 'normal',
                    whiteSpace: 'pre-line'
                  }}>
                    {item.description || ''}
                  </td>
                  <td style={{ border: '1.5px solid #000', padding: '3px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                    {item.quantity}{item.unit && item.unit !== 'Unit' ? ` ${item.unit}` : ''}
                  </td>
                  <td style={{ border: '1.5px solid #000', padding: '3px 4px', textAlign: 'right', verticalAlign: 'top' }}>{formatIndian(item.rate)}</td>
                  <td style={{ border: '1.5px solid #000', padding: '3px 4px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'top' }}>{formatIndian(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* GST + Total Box */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', marginTop: '0' }}>
            <tbody>
              {gstRate > 0 && (
                <tr>
                  <td style={{ borderLeft: '1.5px solid #000', borderBottom: '1.5px solid #000', padding: '4px 6px', textAlign: 'right', width: '78%' }}>
                    GST: {gstRate}%
                  </td>
                  <td style={{ border: '1.5px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>
                    {formatIndian(totalGST)}
                  </td>
                </tr>
              )}
              <tr style={{ background: '#f0f0f0' }}>
                <td style={{ borderLeft: '1.5px solid #000', borderBottom: '1.5px solid #000', padding: '5px 6px', textAlign: 'right', fontSize: '11pt' }}>
                  <strong>Total :</strong>
                </td>
                <td style={{ border: '1.5px solid #000', padding: '5px 6px', textAlign: 'right', fontSize: '11pt', fontWeight: 'bold' }}>
                  ₹{formatIndian(quotation.total_amount)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Amount in Words - ALL CAPS */}
          <p style={{ marginTop: '8px', fontSize: '10pt', fontWeight: 'bold' }}>
            {numberToWordsCaps(quotation.total_amount)}
          </p>

          {/* Company Info */}
          <div style={{ marginTop: '8px', fontSize: '8.5pt', color: '#444', borderTop: '1px solid #ddd', paddingTop: '4px' }}>
            <strong>GSTIN:</strong> {org?.gstin || ''} | <strong>State:</strong> {org?.state} ({org?.state_code})
          </div>

          {/* Bank Details */}
          {org?.bank_name && (
            <div style={{ marginTop: '3px', fontSize: '8.5pt', color: '#444' }}>
              <strong>Bank:</strong> {org.bank_name} | <strong>A/C:</strong> {org.account_no} | <strong>IFSC:</strong> {org.ifsc}
            </div>
          )}

          {/* Actual Notes */}
          {quotation.actual_notes && (
            <div style={{ marginTop: '6px', fontSize: '8.5pt', color: '#555', borderTop: '1px dotted #ccc', paddingTop: '4px' }}>
              {quotation.actual_notes}
            </div>
          )}
        </div>
        {/* NO footer/stamp space - content fills to bottom */}
      </div>
    </div>
  )
}
