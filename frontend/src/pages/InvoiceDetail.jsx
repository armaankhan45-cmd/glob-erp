import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Printer, Edit, Trash2 } from 'lucide-react'
import { numberToWords, formatCurrency } from '../utils'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [items, setItems] = useState([])
  const [org, setOrg] = useState(null)

  useEffect(() => { loadInvoice() }, [id])

  const loadInvoice = async () => {
    try {
      const res = await api.get(`/invoices/${id}`)
      setInvoice(res.data.invoice)
      setItems(res.data.items || [])
      setOrg(res.data.organization)
    } catch (err) {
      alert('Invoice not found')
      navigate('/app/invoices')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this invoice?')) return
    await api.delete(`/invoices/${id}`)
    navigate('/app/invoices')
  }

  const handlePrint = () => window.print()

  if (!invoice) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>

  const letterheadMm = org?.print_letterhead_mm || 65
  const footerMm = org?.print_footer_mm || 50
  const hasCGST = parseFloat(invoice.cgst_amount) > 0
  const hasIGST = parseFloat(invoice.igst_amount) > 0

  // Extract invoice number without FY
  const invNum = invoice.invoice_number?.split('/')[0]

  return (
    <div className="space-y-4">
      {/* Action buttons (hidden in print) */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button onClick={() => navigate('/app/invoices')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold flex-1">Invoice {invoice.invoice_number}</h1>
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2"><Printer size={16} /> Print</button>
        <button onClick={() => navigate(`/app/invoices/${id}/edit`)} className="btn-primary flex items-center gap-2"><Edit size={16} /> Edit</button>
        <button onClick={handleDelete} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>
      </div>

      {/* A4 Print Layout - Same style as Quotation */}
      <div className="bg-white shadow-lg mx-auto print-area" style={{ fontFamily: 'Georgia, serif', fontSize: '10pt' }}>
        {/* Letterhead Space */}
        <div style={{ height: `${letterheadMm}mm`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
          📎 Pre-printed Letterhead Space ({letterheadMm}mm)
        </div>

        {/* Content */}
        <div style={{ maxHeight: `${297 - letterheadMm - footerMm}mm`, overflow: 'hidden', padding: '0 14mm' }}>
          {/* Centered Heading */}
          <h2 style={{ textAlign: 'center', fontSize: '26pt', fontFamily: 'Georgia, serif', marginBottom: '4px' }}>
            Tax Invoice <u>No</u> :- {invNum}
          </h2>

          {/* Date Row */}
          <p style={{ textAlign: 'center', fontSize: '10pt', marginBottom: '2px', color: '#555' }}>
            Date: {invoice.invoice_date}{invoice.due_date ? ` | Due: ${invoice.due_date}` : ''}
          </p>

          {/* Customer Name - Bold Uppercase */}
          <p style={{ textAlign: 'center', fontSize: '13pt', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>
            {(invoice.customer_name || '').toUpperCase()}
          </p>

          {/* Customer GSTIN */}
          {invoice.customer_gstin && (
            <p style={{ textAlign: 'center', fontSize: '10pt', marginBottom: '6px' }}>
              GSTIN: {invoice.customer_gstin}
            </p>
          )}

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
            <thead><tr style={{ background: '#f0f0f0' }}>
              <th style={{ border: '1px solid #000', padding: '5px', width: '7%', textAlign: 'center' }}>SR.No</th>
              <th style={{ border: '1px solid #000', padding: '5px', width: '35%', textAlign: 'center' }}>Particulars</th>
              <th style={{ border: '1px solid #000', padding: '5px', width: '10%', textAlign: 'center' }}>HSN</th>
              <th style={{ border: '1px solid #000', padding: '5px', width: '10%', textAlign: 'center' }}>Quantity</th>
              <th style={{ border: '1px solid #000', padding: '5px', width: '18%', textAlign: 'center' }}>Rate INR</th>
              <th style={{ border: '1px solid #000', padding: '5px', width: '20%', textAlign: 'center' }}>Amount INR</th>
            </tr></thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', fontSize: '9.5pt', lineHeight: '1.35' }}>{item.description || ''}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{item.hsn_code || ''}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>{item.quantity} {item.unit || 'NOS'}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>{parseFloat(item.rate).toFixed(2)}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', fontWeight: 'bold' }}>{parseFloat(item.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <table style={{ width: '100%', marginTop: '2px', fontSize: '10pt' }}>
            <tbody>
              <tr><td style={{ textAlign: 'right', padding: '4px', width: '80%' }}>Subtotal</td><td style={{ textAlign: 'right', padding: '4px' }}>{formatCurrency(invoice.subtotal)}</td></tr>
              {hasCGST && <>
                <tr><td style={{ textAlign: 'right', padding: '4px' }}>CGST @ {parseFloat(items[0]?.cgst_rate || 9).toFixed(1)}%</td><td style={{ textAlign: 'right', padding: '4px' }}>{formatCurrency(invoice.cgst_amount)}</td></tr>
                <tr><td style={{ textAlign: 'right', padding: '4px' }}>SGST @ {parseFloat(items[0]?.sgst_rate || 9).toFixed(1)}%</td><td style={{ textAlign: 'right', padding: '4px' }}>{formatCurrency(invoice.sgst_amount)}</td></tr>
              </>}
              {hasIGST && <tr><td style={{ textAlign: 'right', padding: '4px' }}>IGST @ {parseFloat(items[0]?.igst_rate || 18).toFixed(1)}%</td><td style={{ textAlign: 'right', padding: '4px' }}>{formatCurrency(invoice.igst_amount)}</td></tr>}
              {parseFloat(invoice.discount) > 0 && <tr><td style={{ textAlign: 'right', padding: '4px' }}>Discount</td><td style={{ textAlign: 'right', padding: '4px' }}>-{formatCurrency(invoice.discount)}</td></tr>}
              {parseFloat(invoice.round_off) !== 0 && <tr><td style={{ textAlign: 'right', padding: '4px' }}>Round Off</td><td style={{ textAlign: 'right', padding: '4px' }}>{formatCurrency(invoice.round_off)}</td></tr>}
              <tr style={{ fontSize: '11pt' }}>
                <td style={{ textAlign: 'right', padding: '5px' }}><strong>Total :</strong></td>
                <td style={{ textAlign: 'right', padding: '5px', fontWeight: 'bold' }}>{formatCurrency(invoice.total_amount)}</td>
              </tr>
            </tbody>
          </table>

          {/* Amount in Words */}
          <p style={{ marginTop: '6px', fontSize: '9pt' }}>
            <strong>Amount in Words:</strong> {numberToWords(invoice.total_amount)}
          </p>

          {/* Company GSTIN */}
          <p style={{ marginTop: '4px', fontSize: '8pt', color: '#555' }}>
            <strong>Company GSTIN:</strong> {org?.gstin || ''} | <strong>State:</strong> {org?.state} ({org?.state_code})
          </p>

          {invoice.notes && <p style={{ marginTop: '4px', fontSize: '8pt', color: '#666' }}>{invoice.notes}</p>}
        </div>

        {/* Footer Space */}
        <div style={{ height: `${footerMm}mm`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
          📎 Stamp + Signature + Address Space ({footerMm}mm)
        </div>
      </div>
    </div>
  )
}
