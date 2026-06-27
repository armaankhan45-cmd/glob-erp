import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Printer, Edit, Trash2 } from 'lucide-react'
import { numberToWords, numberToWordsCaps, formatIndian } from '../utils'

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

  const hasCGST = parseFloat(invoice.cgst_amount) > 0
  const hasIGST = parseFloat(invoice.igst_amount) > 0

  // Extract invoice number without FY
  const invNum = invoice.invoice_number?.split('/')[0]

<<<<<<< Updated upstream
  // Place of supply
  const custStateCode = invoice.customer_state_code || (invoice.customer_gstin ? invoice.customer_gstin.substring(0,2) : '')
  const orgStateCode = org?.state_code || '27'
  const isInterState = custStateCode && custStateCode !== orgStateCode
  const placeOfSupply = custStateCode ? `${custStateCode}-${invoice.customer_state || ''}` : `${orgStateCode}-${org?.state || ''}`

  // HSN summary for tax breakdown
  const hsnMap = {}
  items.forEach(item => {
    const hsn = item.hsn_code || 'Others'
    if (!hsnMap[hsn]) hsnMap[hsn] = { taxable: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0 }
    const amt = parseFloat(item.amount) || 0
    hsnMap[hsn].taxable += amt
    hsnMap[hsn].cgstRate = parseFloat(item.cgst_rate) || 0
    hsnMap[hsn].sgstRate = parseFloat(item.sgst_rate) || 0
    hsnMap[hsn].igstRate = parseFloat(item.igst_rate) || 0
    hsnMap[hsn].cgstAmt += amt * (parseFloat(item.cgst_rate) || 0) / 100
    hsnMap[hsn].sgstAmt += amt * (parseFloat(item.sgst_rate) || 0) / 100
    hsnMap[hsn].igstAmt += amt * (parseFloat(item.igst_rate) || 0) / 100
  })

=======
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
      {/* A4 FULL PAGE Tax Invoice Layout */}
      <div className="bg-white shadow-lg mx-auto print-area" style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '9pt',
        width: '210mm',
        minHeight: '297mm',
        padding: '8mm 10mm',
        color: '#000'
      }}>

        {/* ===== COMPANY HEADER BOX ===== */}
        <div style={{ border: '2px solid #000', padding: '8px 12px', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* Logo area */}
            <div style={{ width: '70px', height: '70px', border: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '14px', flexShrink: 0 }}>
              {org?.logo_url
                ? <img src={org.logo_url} alt="Logo" style={{ maxWidth: '64px', maxHeight: '64px' }} />
                : <span style={{ fontSize: '8px', color: '#999', textAlign: 'center' }}>LOGO</span>
              }
            </div>
            {/* Company details */}
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: '16pt', fontWeight: 'bold', margin: 0, color: '#1a1a1a', letterSpacing: '0.5px' }}>
                {(org?.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()}
              </h1>
              <p style={{ fontSize: '9pt', margin: '2px 0 0', color: '#333' }}>
                {org?.address || ''}{org?.city ? `, ${org.city}` : ''}{org?.state ? `, ${org.state}` : ''}{org?.pincode ? ` - ${org.pincode}` : ''}
              </p>
              <div style={{ display: 'flex', gap: '20px', marginTop: '3px', fontSize: '8.5pt', color: '#444' }}>
                {org?.gstin && <span><strong>GSTIN:</strong> {org.gstin}</span>}
                {org?.phone && <span><strong>Mobile:</strong> {org.phone}</span>}
                {org?.email && <span><strong>Email:</strong> {org.email}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* ===== TAX INVOICE HEADING ===== */}
        <div style={{ textAlign: 'center', margin: '6px 0' }}>
          <h2 style={{ fontSize: '14pt', fontWeight: 'bold', margin: 0, letterSpacing: '1px' }}>TAX INVOICE</h2>
          <p style={{ fontSize: '8pt', margin: '2px 0 0', fontWeight: 'bold', color: '#555' }}>ORIGINAL FOR RECIPIENT</p>
        </div>

        {/* ===== INVOICE INFO + CUSTOMER BOX ===== */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '6px', border: '1px solid #000' }}>
          {/* Left: Invoice details */}
          <div style={{ width: '40%', borderRight: '1px solid #000', padding: '6px 10px', fontSize: '8.5pt' }}>
            <div style={{ marginBottom: '3px' }}><strong>Invoice #:</strong> {invNum}</div>
            <div style={{ marginBottom: '3px' }}><strong>Invoice Date:</strong> {invoice.invoice_date}</div>
            <div style={{ marginBottom: '3px' }}><strong>Due Date:</strong> {invoice.due_date || '-'}</div>
            <div style={{ marginBottom: '3px' }}><strong>Place of Supply:</strong> {placeOfSupply}</div>
          </div>
          {/* Right: Customer details */}
          <div style={{ width: '60%', padding: '6px 10px', fontSize: '8.5pt' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>Customer Details:</div>
            <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '9pt' }}>{(invoice.customer_name || '').toUpperCase()}</div>
            {invoice.customer_gstin && <div><strong>GSTIN:</strong> {invoice.customer_gstin}</div>}
            <div>
              <strong>Billing Address:</strong>{' '}
              {invoice.customer_address || ''}{invoice.customer_city ? `, ${invoice.customer_city}` : ''}{invoice.customer_state ? `, ${invoice.customer_state}` : ''}{invoice.customer_pincode ? ` - ${invoice.customer_pincode}` : ''}
            </div>
            {invoice.customer_phone && <div><strong>Ph:</strong> {invoice.customer_phone}</div>}
          </div>
        </div>

        {/* ===== ITEMS TABLE ===== */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', marginBottom: '0' }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              <th style={{ border: '1px solid #000', padding: '4px 3px', width: '4%', textAlign: 'center' }}>#</th>
              <th style={{ border: '1px solid #000', padding: '4px 3px', width: '30%', textAlign: 'center' }}>Item</th>
              <th style={{ border: '1px solid #000', padding: '4px 3px', width: '9%', textAlign: 'center' }}>HSN/SAC</th>
              <th style={{ border: '1px solid #000', padding: '4px 3px', width: '8%', textAlign: 'center' }}>Tax</th>
              <th style={{ border: '1px solid #000', padding: '4px 3px', width: '7%', textAlign: 'center' }}>Qty</th>
              <th style={{ border: '1px solid #000', padding: '4px 3px', width: '12%', textAlign: 'center' }}>Rate/Item</th>
              <th style={{ border: '1px solid #000', padding: '4px 3px', width: '14%', textAlign: 'center' }}>Taxable Value</th>
              <th style={{ border: '1px solid #000', padding: '4px 3px', width: '8%', textAlign: 'center' }}>Tax Amt</th>
              <th style={{ border: '1px solid #000', padding: '4px 3px', width: '8%', textAlign: 'center' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const qty = parseFloat(item.quantity) || 0
              const rate = parseFloat(item.rate) || 0
              const taxableValue = qty * rate
              const cgstR = parseFloat(item.cgst_rate) || 0
              const sgstR = parseFloat(item.sgst_rate) || 0
              const igstR = parseFloat(item.igst_rate) || 0
              const taxRate = igstR > 0 ? igstR : (cgstR + sgstR)
              const taxAmt = taxableValue * taxRate / 100
              const totalAmt = taxableValue + taxAmt
              const taxLabel = taxRate > 0 ? `${taxRate}%` : ''

              return (
                <tr key={i}>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', verticalAlign: 'top' }}>{i + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', lineHeight: '1.3', whiteSpace: 'pre-line' }}>{item.description || ''}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', verticalAlign: 'top' }}>{item.hsn_code || '-'}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', verticalAlign: 'top' }}>{taxLabel}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', verticalAlign: 'top' }}>{qty} {item.unit || 'NOS'}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', verticalAlign: 'top' }}>{formatIndian(rate)}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', verticalAlign: 'top' }}>{formatIndian(taxableValue)}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', verticalAlign: 'top' }}>{formatIndian(taxAmt)}</td>
                  <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'top' }}>{formatIndian(totalAmt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* ===== TOTALS ROW ===== */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', width: '70%' }}><strong>Taxable Amount</strong></td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatIndian(invoice.subtotal)}</td>
            </tr>
            {hasCGST && <>
              <tr>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>CGST @ {parseFloat(items[0]?.cgst_rate || 9).toFixed(1)}% on {formatIndian(invoice.subtotal)}</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatIndian(invoice.cgst_amount)}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>SGST @ {parseFloat(items[0]?.sgst_rate || 9).toFixed(1)}% on {formatIndian(invoice.subtotal)}</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatIndian(invoice.sgst_amount)}</td>
              </tr>
            </>}
            {hasIGST && (
              <tr>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>IGST @ {parseFloat(items[0]?.igst_rate || 18).toFixed(1)}% on {formatIndian(invoice.subtotal)}</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatIndian(invoice.igst_amount)}</td>
              </tr>
            )}
            {parseFloat(invoice.discount) > 0 && (
              <tr>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>Discount</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>-{formatIndian(invoice.discount)}</td>
              </tr>
            )}
            {parseFloat(invoice.round_off) !== 0 && (
              <tr>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>Round Off</td>
                <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatIndian(invoice.round_off)}</td>
              </tr>
            )}
            <tr style={{ background: '#f0f0f0' }}>
              <td style={{ border: '2px solid #000', padding: '5px', textAlign: 'right', fontSize: '10pt' }}><strong>Total</strong></td>
              <td style={{ border: '2px solid #000', padding: '5px', textAlign: 'right', fontSize: '10pt', fontWeight: 'bold' }}>₹{formatIndian(invoice.total_amount)}</td>
            </tr>
          </tbody>
        </table>

        {/* Amount in words */}
        <p style={{ marginTop: '4px', fontSize: '8.5pt' }}>
          <strong>Amount Chargeable (in words):</strong> INR {numberToWords(invoice.total_amount)}
        </p>
        <p style={{ fontSize: '7pt', color: '#666', marginBottom: '6px' }}>E & O.E</p>

        {/* ===== HSN-WISE TAX SUMMARY TABLE ===== */}
        <div style={{ marginBottom: '6px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt' }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>HSN/SAC</th>
                <th style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>Taxable Value</th>
                {hasCGST ? (
                  <>
                    <th style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }} colSpan="2">Central Tax</th>
                    <th style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }} colSpan="2">State/UT Tax</th>
                  </>
                ) : (
                  <>
                    <th style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }} colSpan="2">Integrated Tax</th>
                  </>
                )}
                <th style={{ border: '1px solid #000', padding: '3px', textAlign: 'center' }}>Total Tax Amount</th>
              </tr>
              <tr style={{ background: '#f5f5f5', fontSize: '7pt' }}>
                <th style={{ border: '1px solid #000' }}></th>
                <th style={{ border: '1px solid #000' }}></th>
                {hasCGST ? (
                  <>
                    <th style={{ border: '1px solid #000', padding: '2px' }}>Rate</th>
                    <th style={{ border: '1px solid #000', padding: '2px' }}>Amount</th>
                    <th style={{ border: '1px solid #000', padding: '2px' }}>Rate</th>
                    <th style={{ border: '1px solid #000', padding: '2px' }}>Amount</th>
                  </>
                ) : (
                  <>
                    <th style={{ border: '1px solid #000', padding: '2px' }}>Rate</th>
                    <th style={{ border: '1px solid #000', padding: '2px' }}>Amount</th>
                  </>
                )}
                <th style={{ border: '1px solid #000' }}></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(hsnMap).map(([hsn, data]) => (
                <tr key={hsn}>
                  <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center' }}>{hsn}</td>
                  <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>{formatIndian(data.taxable)}</td>
                  {hasCGST ? (
                    <>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center' }}>{data.cgstRate}%</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>{formatIndian(data.cgstAmt)}</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center' }}>{data.sgstRate}%</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>{formatIndian(data.sgstAmt)}</td>
                    </>
                  ) : (
                    <>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center' }}>{data.igstRate}%</td>
                      <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>{formatIndian(data.igstAmt)}</td>
                    </>
                  )}
                  <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>{formatIndian(data.cgstAmt + data.sgstAmt + data.igstAmt)}</td>
=======
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
>>>>>>> Stashed changes
                </tr>
              ))}
              <tr style={{ fontWeight: 'bold', background: '#f8f8f8' }}>
                <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'center' }}>TOTAL</td>
                <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>{formatIndian(invoice.subtotal)}</td>
                {hasCGST ? (
                  <>
                    <td style={{ border: '1px solid #000', padding: '2px 3px' }}></td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>{formatIndian(invoice.cgst_amount)}</td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px' }}></td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>{formatIndian(invoice.sgst_amount)}</td>
                  </>
                ) : (
                  <>
                    <td style={{ border: '1px solid #000', padding: '2px 3px' }}></td>
                    <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>{formatIndian(invoice.igst_amount)}</td>
                  </>
                )}
                <td style={{ border: '1px solid #000', padding: '2px 3px', textAlign: 'right' }}>{formatIndian(parseFloat(invoice.cgst_amount) + parseFloat(invoice.sgst_amount) + parseFloat(invoice.igst_amount))}</td>
              </tr>
            </tbody>
          </table>
<<<<<<< Updated upstream
        </div>

        {/* ===== BANK DETAILS + SIGNATURE ===== */}
        <div style={{ display: 'flex', borderTop: '1px solid #000', paddingTop: '6px', marginTop: '4px' }}>
          {/* Bank Details */}
          <div style={{ width: '55%', fontSize: '8pt', paddingRight: '10px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>Bank Details:</div>
            {org?.bank_name && <div><strong>Bank:</strong> {org.bank_name}</div>}
            {org?.account_no && <div><strong>Account #:</strong> {org.account_no}</div>}
            {org?.ifsc && <div><strong>IFSC Code:</strong> {org.ifsc}</div>}
            {org?.bank_name && <div><strong>Branch:</strong> {org.city || ''}</div>}
            {org?.upi_id && <div style={{ marginTop: '2px' }}><strong>Pay using UPI:</strong> {org.upi_id}</div>}
          </div>
          {/* Signature */}
          <div style={{ width: '45%', textAlign: 'right' }}>
            <div style={{ fontSize: '8pt', marginBottom: '2px' }}>For <strong>{(org?.name || '').toUpperCase()}</strong></div>
            <div style={{ height: '35px' }}></div>
            <div style={{ borderTop: '1px solid #000', display: 'inline-block', paddingTop: '2px', fontSize: '8pt' }}>
              Authorized Signatory
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div style={{ marginTop: '6px', fontSize: '7.5pt', color: '#444', borderTop: '1px dotted #ccc', paddingTop: '4px' }}>
            <strong>Notes:</strong> {invoice.notes}
          </div>
        )}

        {/* Company GSTIN footer */}
        <div style={{ marginTop: '4px', fontSize: '7pt', color: '#888', textAlign: 'center' }}>
          <strong>Company GSTIN:</strong> {org?.gstin || ''} | <strong>State:</strong> {org?.state} ({org?.state_code}) | Page 1/1
        </div>
=======

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
>>>>>>> Stashed changes
      </div>
    </div>
  )
}
