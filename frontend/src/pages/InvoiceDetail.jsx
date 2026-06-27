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

  return (
    <div className="space-y-4">
      {/* Action buttons (hidden in print) */}
      <div className="flex items-center gap-3 no-print">
        <button onClick={() => navigate('/app/invoices')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold flex-1">Invoice {invoice.invoice_number}</h1>
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2"><Printer size={16} /> Print</button>
        <button onClick={() => navigate(`/app/invoices/${id}/edit`)} className="btn-primary flex items-center gap-2"><Edit size={16} /> Edit</button>
        <button onClick={handleDelete} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>
      </div>

      {/* A4 Print Preview */}
      <div className="bg-white shadow-lg mx-auto print-area" style={{ fontFamily: 'Georgia, serif', fontSize: '10pt' }}>
        <div style={{ height: `${letterheadMm}mm` }}></div>
        <div style={{ maxHeight: `${297 - letterheadMm - footerMm}mm`, overflow: 'hidden', padding: '0 14mm' }}>
          <h2 style={{ textAlign: 'center', fontSize: '18pt', marginBottom: '8px', fontWeight: 'bold' }}>TAX INVOICE</h2>
          <table style={{ width: '100%', marginBottom: '8px', fontSize: '10pt' }}><tbody><tr>
            <td style={{ width: '50%', padding: '4px', verticalAlign: 'top' }}>
              <strong>Invoice No:</strong> {invoice.invoice_number}<br />
              <strong>Date:</strong> {invoice.invoice_date}<br />
              {invoice.due_date && <><strong>Due Date:</strong> {invoice.due_date}<br /></>}
            </td>
            <td style={{ width: '50%', padding: '4px', verticalAlign: 'top' }}>
              <strong>Buyer:</strong> {invoice.customer_name || ''}<br />
              {invoice.customer_address && <>{invoice.customer_address}<br /></>}
              {invoice.customer_city && <>{invoice.customer_city}, {invoice.customer_state} - {invoice.customer_pincode}<br /></>}
              {invoice.customer_gstin && <><strong>GSTIN:</strong> {invoice.customer_gstin}<br /></>}
            </td>
          </tr></tbody></table>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
            <thead><tr style={{ background: '#f0f0f0' }}>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '5%' }}>#</th>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left' }}>Description</th>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '8%' }}>HSN</th>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '8%' }}>Qty</th>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', width: '8%' }}>Unit</th>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', width: '12%' }}>Rate</th>
              <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', width: '12%' }}>Amount</th>
            </tr></thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '4px' }}>{item.description}</td>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{item.hsn_code}</td>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{item.unit}</td>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{parseFloat(item.rate).toFixed(2)}</td>
                  <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{parseFloat(item.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <table style={{ width: '100%', marginTop: '4px', fontSize: '10pt' }}>
            <tbody>
              <tr><td style={{ textAlign: 'right', padding: '4px', width: '75%' }}><strong>Subtotal</strong></td><td style={{ textAlign: 'right', padding: '4px' }}>{formatCurrency(invoice.subtotal)}</td></tr>
              {hasCGST && <><tr><td style={{ textAlign: 'right', padding: '4px' }}>CGST @ {parseFloat(items[0]?.cgst_rate || 0).toFixed(1)}%</td><td style={{ textAlign: 'right', padding: '4px' }}>{formatCurrency(invoice.cgst_amount)}</td></tr>
              <tr><td style={{ textAlign: 'right', padding: '4px' }}>SGST @ {parseFloat(items[0]?.sgst_rate || 0).toFixed(1)}%</td><td style={{ textAlign: 'right', padding: '4px' }}>{formatCurrency(invoice.sgst_amount)}</td></tr></>}
              {hasIGST && <tr><td style={{ textAlign: 'right', padding: '4px' }}>IGST @ {parseFloat(items[0]?.igst_rate || 0).toFixed(1)}%</td><td style={{ textAlign: 'right', padding: '4px' }}>{formatCurrency(invoice.igst_amount)}</td></tr>}
              {parseFloat(invoice.discount) > 0 && <tr><td style={{ textAlign: 'right', padding: '4px' }}>Discount</td><td style={{ textAlign: 'right', padding: '4px' }}>-{formatCurrency(invoice.discount)}</td></tr>}
              {parseFloat(invoice.round_off) !== 0 && <tr><td style={{ textAlign: 'right', padding: '4px' }}>Round Off</td><td style={{ textAlign: 'right', padding: '4px' }}>{formatCurrency(invoice.round_off)}</td></tr>}
              <tr style={{ fontSize: '11pt' }}><td style={{ textAlign: 'right', padding: '6px' }}><strong>TOTAL</strong></td><td style={{ textAlign: 'right', padding: '6px', fontWeight: 'bold' }}>{formatCurrency(invoice.total_amount)}</td></tr>
            </tbody>
          </table>

          <p style={{ marginTop: '6px', fontSize: '9pt' }}><strong>Amount in Words:</strong> {numberToWords(invoice.total_amount)}</p>
          {invoice.notes && <p style={{ marginTop: '4px', fontSize: '8pt', color: '#555' }}>{invoice.notes}</p>}
          <p style={{ marginTop: '4px', fontSize: '8pt' }}><strong>Company GSTIN:</strong> {org?.gstin}</p>
        </div>
        <div style={{ height: `${footerMm}mm` }}></div>
      </div>
    </div>
  )
}
