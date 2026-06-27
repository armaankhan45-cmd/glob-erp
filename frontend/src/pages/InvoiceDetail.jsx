import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Printer, Edit, Trash2 } from 'lucide-react'
import { numberToWords, formatIndian } from '../utils'

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
  const invNum = invoice.invoice_number?.split('/')[0]
  const custStateCode = invoice.customer_state_code || (invoice.customer_gstin ? invoice.customer_gstin.substring(0,2) : '')
  const orgStateCode = org?.state_code || '27'
  const placeOfSupply = custStateCode ? `${custStateCode}-${invoice.customer_state || ''}` : `${orgStateCode}-${org?.state || ''}`
  const totalTax = parseFloat(invoice.cgst_amount) + parseFloat(invoice.sgst_amount) + parseFloat(invoice.igst_amount)

  // HSN summary — use qty*rate as taxable, NOT item.amount
  const hsnMap = {}
  items.forEach(item => {
    const hsn = item.hsn_code || 'Others'
    if (!hsnMap[hsn]) hsnMap[hsn] = { taxable: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0 }
    const qty = parseFloat(item.quantity) || 0
    const rate = parseFloat(item.rate) || 0
    const taxable = qty * rate
    hsnMap[hsn].taxable += taxable
    hsnMap[hsn].cgstRate = parseFloat(item.cgst_rate) || 0
    hsnMap[hsn].sgstRate = parseFloat(item.sgst_rate) || 0
    hsnMap[hsn].igstRate = parseFloat(item.igst_rate) || 0
    hsnMap[hsn].cgstAmt += taxable * (parseFloat(item.cgst_rate) || 0) / 100
    hsnMap[hsn].sgstAmt += taxable * (parseFloat(item.sgst_rate) || 0) / 100
    hsnMap[hsn].igstAmt += taxable * (parseFloat(item.igst_rate) || 0) / 100
  })

  const c = { border: '1px solid #000', padding: '3px 4px', verticalAlign: 'top' }
  const h = { border: '1px solid #000', padding: '3px 4px', background: '#f0f0f0', textAlign: 'center', fontWeight: 'bold' }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button onClick={() => navigate('/app/invoices')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold flex-1">Invoice {invoice.invoice_number}</h1>
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2"><Printer size={16} /> Print</button>
        <button onClick={() => navigate(`/app/invoices/${id}/edit`)} className="btn-primary flex items-center gap-2"><Edit size={16} /> Edit</button>
        <button onClick={handleDelete} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>
      </div>

      <div className="bg-white shadow-lg mx-auto print-area" style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '9pt', color: '#000', width: '210mm', height: '297mm', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white' }}>

        {/* ===== HEADER ===== */}
        <div style={{ display: 'flex', borderBottom: '2px solid #000', padding: '6px 10px', flexShrink: 0 }}>
          <div style={{ width: '56px', height: '56px', border: '1px solid #999', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 }}>
            {org?.logo_url ? <img src={org.logo_url} alt="" style={{ maxWidth: '50px', maxHeight: '50px' }} /> : <span style={{ fontSize: '7px', color: '#aaa' }}>LOGO</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14pt', fontWeight: 'bold', letterSpacing: '0.5px' }}>{(org?.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()}</div>
            <div style={{ fontSize: '8pt', marginTop: '1px' }}>{[org?.address, org?.city, org?.state, org?.pincode].filter(Boolean).join(', ')}</div>
            <div style={{ fontSize: '7.5pt', marginTop: '1px', color: '#333' }}>
              {org?.gstin && <span style={{ marginRight: '14px' }}>GSTIN: {org.gstin}</span>}
              {org?.phone && <span style={{ marginRight: '14px' }}>Mobile: {org.phone}</span>}
              {org?.email && <span>Email: {org.email}</span>}
            </div>
          </div>
        </div>

        {/* ===== TAX INVOICE TITLE ===== */}
        <div style={{ textAlign: 'center', padding: '3px 0', borderBottom: '2px solid #000', flexShrink: 0 }}>
          <div style={{ fontSize: '12pt', fontWeight: 'bold', letterSpacing: '2px' }}>TAX INVOICE</div>
          <div style={{ fontSize: '7pt', fontWeight: 'bold', color: '#555' }}>ORIGINAL FOR RECIPIENT</div>
        </div>

        {/* ===== INVOICE + CUSTOMER INFO ===== */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000', flexShrink: 0 }}>
          <div style={{ width: '35%', borderRight: '1px solid #000', padding: '4px 8px', fontSize: '8pt' }}>
            <div><strong>Invoice #:</strong> {invNum}</div>
            <div><strong>Date:</strong> {invoice.invoice_date}</div>
            {invoice.due_date && <div><strong>Due Date:</strong> {invoice.due_date}</div>}
            <div><strong>Place of Supply:</strong> {placeOfSupply}</div>
          </div>
          <div style={{ width: '65%', padding: '4px 8px', fontSize: '8pt' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '1px' }}>Customer Details:</div>
            <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{(invoice.customer_name || '').toUpperCase()}</div>
            {invoice.customer_gstin && <div>GSTIN: {invoice.customer_gstin}</div>}
            <div>Billing Address: {[invoice.customer_address, invoice.customer_city, invoice.customer_state, invoice.customer_pincode].filter(Boolean).join(', ')}</div>
            {invoice.customer_phone && <div>Ph: {invoice.customer_phone}</div>}
          </div>
        </div>

        {/* ===== ITEMS TABLE ===== */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt', flex: 1 }}>
            <thead>
              <tr>
                <th style={{ ...h, width: '4%' }}>#</th>
                <th style={{ ...h, width: '30%' }}>Item</th>
                <th style={{ ...h, width: '8%' }}>HSN/SAC</th>
                <th style={{ ...h, width: '5%' }}>Tax</th>
                <th style={{ ...h, width: '7%' }}>Qty</th>
                <th style={{ ...h, width: '12%' }}>Rate/Item</th>
                <th style={{ ...h, width: '13%' }}>Taxable Value</th>
                <th style={{ ...h, width: '10%' }}>Tax Amt</th>
                <th style={{ ...h, width: '11%' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const qty = parseFloat(item.quantity) || 0
                const rate = parseFloat(item.rate) || 0
                const taxable = qty * rate
                const taxRate = (parseFloat(item.igst_rate) || 0) > 0 ? parseFloat(item.igst_rate) : (parseFloat(item.cgst_rate) + parseFloat(item.sgst_rate))
                const taxAmt = taxable * taxRate / 100
                return (
                  <tr key={i}>
                    <td style={{ ...c, textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ ...c, lineHeight: '1.25', whiteSpace: 'pre-line' }}>{item.description || ''}</td>
                    <td style={{ ...c, textAlign: 'center' }}>{item.hsn_code || '-'}</td>
                    <td style={{ ...c, textAlign: 'center' }}>{taxRate > 0 ? `${taxRate}%` : ''}</td>
                    <td style={{ ...c, textAlign: 'center' }}>{qty} {item.unit || 'NOS'}</td>
                    <td style={{ ...c, textAlign: 'right' }}>{new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rate)}</td>
                    <td style={{ ...c, textAlign: 'right' }}>{new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(taxable)}</td>
                    <td style={{ ...c, textAlign: 'right' }}>{new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(taxAmt)}</td>
                    <td style={{ ...c, textAlign: 'right', fontWeight: 'bold' }}>{new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(taxable + taxAmt)}</td>
                  </tr>
                )
              })}
              {items.length < 10 && Array.from({ length: 10 - items.length }).map((_, i) => (
                <tr key={`e${i}`}><td style={c}>&nbsp;</td><td style={c}></td><td style={c}></td><td style={c}></td><td style={c}></td><td style={c}></td><td style={c}></td><td style={c}></td><td style={c}></td></tr>
              ))}
            </tbody>
          </table>

          {/* ===== TOTALS ===== */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', flexShrink: 0 }}>
            <tbody>
              <tr><td style={{ ...c, textAlign: 'right', width: '72%' }}>Taxable Amount</td><td style={{ ...c, textAlign: 'right' }}>₹{new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(invoice.subtotal)}</td></tr>
              {hasCGST && <>
                <tr><td style={{ ...c, textAlign: 'right' }}>CGST @ {parseFloat(items[0]?.cgst_rate || 9).toFixed(1)}% on ₹{new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(invoice.subtotal)}</td><td style={{ ...c, textAlign: 'right' }}>₹{new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(invoice.cgst_amount)}</td></tr>
                <tr><td style={{ ...c, textAlign: 'right' }}>SGST @ {parseFloat(items[0]?.sgst_rate || 9).toFixed(1)}% on ₹{new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(invoice.subtotal)}</td><td style={{ ...c, textAlign: 'right' }}>₹{new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(invoice.sgst_amount)}</td></tr>
              </>}
              {hasIGST && <tr><td style={{ ...c, textAlign: 'right' }}>IGST @ {parseFloat(items[0]?.igst_rate || 18).toFixed(1)}% on ₹{new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(invoice.subtotal)}</td><td style={{ ...c, textAlign: 'right' }}>₹{new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(invoice.igst_amount)}</td></tr>}
              {parseFloat(invoice.discount) > 0 && <tr><td style={{ ...c, textAlign: 'right' }}>Discount</td><td style={{ ...c, textAlign: 'right' }}>-₹{new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(invoice.discount)}</td></tr>}
              {parseFloat(invoice.round_off) !== 0 && <tr><td style={{ ...c, textAlign: 'right' }}>Round Off</td><td style={{ ...c, textAlign: 'right' }}>₹{new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(invoice.round_off)}</td></tr>}
              <tr style={{ background: '#f0f0f0' }}>
                <td style={{ border: '2px solid #000', padding: '4px', textAlign: 'right', fontSize: '10pt', fontWeight: 'bold' }}>Total</td>
                <td style={{ border: '2px solid #000', padding: '4px', textAlign: 'right', fontSize: '10pt', fontWeight: 'bold' }}>₹{new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(invoice.total_amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ===== AMOUNT IN WORDS ===== */}
        <div style={{ fontSize: '8pt', padding: '3px 0', borderTop: '1px solid #000', flexShrink: 0 }}>
          <strong>Amount Chargeable (in words):</strong> INR {numberToWords(invoice.total_amount)}
          <span style={{ float: 'right', fontSize: '7pt', color: '#666' }}>E & O.E</span>
        </div>

        {/* ===== HSN SUMMARY ===== */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt', flexShrink: 0 }}>
          <thead>
            <tr>
              <th style={{ ...h, fontSize: '7pt' }}>HSN/SAC</th>
              <th style={{ ...h, fontSize: '7pt' }}>Taxable Value</th>
              {hasCGST ? <><th style={{ ...h, fontSize: '7pt' }} colSpan="2">Central Tax</th><th style={{ ...h, fontSize: '7pt' }} colSpan="2">State/UT Tax</th></> : <th style={{ ...h, fontSize: '7pt' }} colSpan="2">Integrated Tax</th>}
              <th style={{ ...h, fontSize: '7pt' }}>Total Tax</th>
            </tr>
            <tr>
              <th style={{ ...h, fontSize: '6.5pt' }}></th><th style={{ ...h, fontSize: '6.5pt' }}></th>
              {hasCGST ? <><th style={{ ...h, fontSize: '6.5pt' }}>Rate</th><th style={{ ...h, fontSize: '6.5pt' }}>Amt</th><th style={{ ...h, fontSize: '6.5pt' }}>Rate</th><th style={{ ...h, fontSize: '6.5pt' }}>Amt</th></> : <><th style={{ ...h, fontSize: '6.5pt' }}>Rate</th><th style={{ ...h, fontSize: '6.5pt' }}>Amt</th></>}
              <th style={{ ...h, fontSize: '6.5pt' }}></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(hsnMap).map(([hsn, d]) => (
              <tr key={hsn}>
                <td style={{ ...c, textAlign: 'center', fontSize: '7pt', padding: '1px 2px' }}>{hsn}</td>
                <td style={{ ...c, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(d.taxable)}</td>
                {hasCGST ? <><td style={{ ...c, textAlign: 'center', fontSize: '7pt', padding: '1px 2px' }}>{d.cgstRate}%</td><td style={{ ...c, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(d.cgstAmt)}</td><td style={{ ...c, textAlign: 'center', fontSize: '7pt', padding: '1px 2px' }}>{d.sgstRate}%</td><td style={{ ...c, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(d.sgstAmt)}</td></> : <><td style={{ ...c, textAlign: 'center', fontSize: '7pt', padding: '1px 2px' }}>{d.igstRate}%</td><td style={{ ...c, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(d.igstAmt)}</td></>}
                <td style={{ ...c, textAlign: 'right', fontSize: '7pt', padding: '1px 2px', fontWeight: 'bold' }}>{formatIndian(d.cgstAmt + d.sgstAmt + d.igstAmt)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 'bold', background: '#f5f5f5' }}>
              <td style={{ ...c, textAlign: 'center', fontSize: '7pt', padding: '1px 2px' }}>TOTAL</td>
              <td style={{ ...c, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(invoice.subtotal)}</td>
              {hasCGST ? <><td style={{ ...c, fontSize: '7pt', padding: '1px 2px' }}></td><td style={{ ...c, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(invoice.cgst_amount)}</td><td style={{ ...c, fontSize: '7pt', padding: '1px 2px' }}></td><td style={{ ...c, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(invoice.sgst_amount)}</td></> : <><td style={{ ...c, fontSize: '7pt', padding: '1px 2px' }}></td><td style={{ ...c, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(invoice.igst_amount)}</td></>}
              <td style={{ ...c, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(totalTax)}</td>
            </tr>
          </tbody>
        </table>

        {/* ===== BANK + SIGNATURE ===== */}
        <div style={{ display: 'flex', borderTop: '1px solid #000', marginTop: '2px', paddingTop: '3px', flexShrink: 0 }}>
          <div style={{ width: '55%', fontSize: '7.5pt' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Bank Details:</div>
            {org?.bank_name && <div>Bank: {org.bank_name}</div>}
            {org?.account_no && <div>Account #: {org.account_no}</div>}
            {org?.ifsc && <div>IFSC: {org.ifsc}</div>}
            {org?.city && <div>Branch: {org.city}</div>}
            {org?.upi_id && <div style={{ marginTop: '2px' }}>UPI ID: {org.upi_id}</div>}
          </div>
          <div style={{ width: '45%', textAlign: 'right', fontSize: '7.5pt' }}>
            <div>For <strong>{(org?.name || '').toUpperCase()}</strong></div>
            <div style={{ height: '28px' }}></div>
            <div style={{ borderTop: '1px solid #000', display: 'inline-block', paddingTop: '1px' }}>Authorized Signatory</div>
          </div>
        </div>
      </div>
    </div>
  )
}
