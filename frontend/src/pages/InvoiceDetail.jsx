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

  // HSN summary
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

  const styles = {
    page: { fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '9pt', color: '#000', width: '210mm', height: '297mm', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white' },
    cell: { border: '1px solid #000', padding: '3px 4px', verticalAlign: 'top' },
    hc: { border: '1px solid #000', padding: '3px 4px', background: '#f0f0f0', textAlign: 'center', fontWeight: 'bold' },
    tbl: { width: '100%', borderCollapse: 'collapse' }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button onClick={() => navigate('/app/invoices')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold flex-1">Invoice {invoice.invoice_number}</h1>
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2"><Printer size={16} /> Print</button>
        <button onClick={() => navigate(`/app/invoices/${id}/edit`)} className="btn-primary flex items-center gap-2"><Edit size={16} /> Edit</button>
        <button onClick={handleDelete} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>
      </div>

      <div className="bg-white shadow-lg mx-auto print-area" style={styles.page}>
        {/* ===== HEADER: Logo + Company Info ===== */}
        <div style={{ display: 'flex', borderBottom: '2px solid #000', padding: '6px 10px', flexShrink: 0 }}>
          <div style={{ width: '56px', height: '56px', border: '1px solid #999', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 }}>
            {org?.logo_url ? <img src={org.logo_url} alt="" style={{ maxWidth: '50px', maxHeight: '50px' }} /> : <span style={{ fontSize: '7px', color: '#aaa' }}>LOGO</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14pt', fontWeight: 'bold', letterSpacing: '0.5px' }}>{(org?.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()}</div>
            <div style={{ fontSize: '8pt', marginTop: '1px' }}>{org?.address || ''}{org?.city ? `, ${org.city}` : ''}{org?.state ? `, ${org.state}` : ''}{org?.pincode ? ` - ${org.pincode}` : ''}</div>
            <div style={{ fontSize: '7.5pt', marginTop: '1px', color: '#333' }}>
              {org?.gstin && <span style={{ marginRight: '14px' }}>GSTIN: {org.gstin}</span>}
              {org?.phone && <span style={{ marginRight: '14px' }}>Mobile: {org.phone}</span>}
              {org?.email && <span>Email: {org.email}</span>}
            </div>
          </div>
        </div>

        {/* ===== TAX INVOICE TITLE ===== */}
        <div style={{ textAlign: 'center', padding: '4px 0', borderBottom: '2px solid #000', flexShrink: 0, fontSize: '13pt', fontWeight: 'bold', letterSpacing: '2px' }}>
          TAX INVOICE
        </div>

        {/* ===== INVOICE + CUSTOMER INFO ===== */}
        <div style={{ display: 'flex', borderBottom: '1px solid #000', flexShrink: 0 }}>
          <div style={{ width: '35%', borderRight: '1px solid #000', padding: '4px 8px', fontSize: '8pt' }}>
            <div><strong>Invoice #:</strong> {invNum}</div>
            <div><strong>Date:</strong> {invoice.invoice_date}</div>
            <div><strong>Due Date:</strong> {invoice.due_date || '-'}</div>
            <div><strong>Place of Supply:</strong> {placeOfSupply}</div>
          </div>
          <div style={{ width: '65%', padding: '4px 8px', fontSize: '8pt' }}>
            <div style={{ fontWeight: 'bold' }}>Customer Details:</div>
            <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{(invoice.customer_name || '').toUpperCase()}</div>
            {invoice.customer_gstin && <div>GSTIN: {invoice.customer_gstin}</div>}
            <div>{invoice.customer_address || ''}{invoice.customer_city ? `, ${invoice.customer_city}` : ''}{invoice.customer_state ? `, ${invoice.customer_state}` : ''}{invoice.customer_pincode ? ` - ${invoice.customer_pincode}` : ''}</div>
            {invoice.customer_phone && <div>Ph: {invoice.customer_phone}</div>}
          </div>
        </div>

        {/* ===== ITEMS TABLE (flex:1 to fill) ===== */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <table style={{ ...styles.tbl, fontSize: '8pt', flex: 1 }}>
            <thead>
              <tr>
                <th style={{ ...styles.hc, width: '4%' }}>#</th>
                <th style={{ ...styles.hc, width: '28%' }}>Item</th>
                <th style={{ ...styles.hc, width: '8%' }}>HSN/SAC</th>
                <th style={{ ...styles.hc, width: '6%' }}>Tax</th>
                <th style={{ ...styles.hc, width: '8%' }}>Qty</th>
                <th style={{ ...styles.hc, width: '12%' }}>Rate/Item</th>
                <th style={{ ...styles.hc, width: '13%' }}>Taxable Value</th>
                <th style={{ ...styles.hc, width: '10%' }}>Tax Amt</th>
                <th style={{ ...styles.hc, width: '11%' }}>Amount</th>
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
                    <td style={{ ...styles.cell, textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ ...styles.cell, lineHeight: '1.25', whiteSpace: 'pre-line' }}>{item.description || ''}</td>
                    <td style={{ ...styles.cell, textAlign: 'center' }}>{item.hsn_code || '-'}</td>
                    <td style={{ ...styles.cell, textAlign: 'center' }}>{taxRate > 0 ? `${taxRate}%` : ''}</td>
                    <td style={{ ...styles.cell, textAlign: 'center' }}>{qty} {item.unit || 'NOS'}</td>
                    <td style={{ ...styles.cell, textAlign: 'right' }}>{formatIndian(rate)}</td>
                    <td style={{ ...styles.cell, textAlign: 'right' }}>{formatIndian(taxable)}</td>
                    <td style={{ ...styles.cell, textAlign: 'right' }}>{formatIndian(taxAmt)}</td>
                    <td style={{ ...styles.cell, textAlign: 'right', fontWeight: 'bold' }}>{formatIndian(taxable + taxAmt)}</td>
                  </tr>
                )
              })}
              {items.length < 10 && Array.from({ length: 10 - items.length }).map((_, i) => (
                <tr key={`e${i}`}><td style={styles.cell}>&nbsp;</td><td style={styles.cell}></td><td style={styles.cell}></td><td style={styles.cell}></td><td style={styles.cell}></td><td style={styles.cell}></td><td style={styles.cell}></td><td style={styles.cell}></td><td style={styles.cell}></td></tr>
              ))}
            </tbody>
          </table>

          {/* ===== TOTALS ===== */}
          <table style={{ ...styles.tbl, fontSize: '8.5pt', flexShrink: 0 }}>
            <tbody>
              <tr><td style={{ ...styles.cell, textAlign: 'right', width: '72%' }}>Taxable Amount</td><td style={{ ...styles.cell, textAlign: 'right' }}>{formatIndian(invoice.subtotal)}</td></tr>
              {hasCGST && <><tr><td style={{ ...styles.cell, textAlign: 'right' }}>CGST @ {parseFloat(items[0]?.cgst_rate || 9).toFixed(1)}% on {formatIndian(invoice.subtotal)}</td><td style={{ ...styles.cell, textAlign: 'right' }}>{formatIndian(invoice.cgst_amount)}</td></tr>
              <tr><td style={{ ...styles.cell, textAlign: 'right' }}>SGST @ {parseFloat(items[0]?.sgst_rate || 9).toFixed(1)}% on {formatIndian(invoice.subtotal)}</td><td style={{ ...styles.cell, textAlign: 'right' }}>{formatIndian(invoice.sgst_amount)}</td></tr></>}
              {hasIGST && <tr><td style={{ ...styles.cell, textAlign: 'right' }}>IGST @ {parseFloat(items[0]?.igst_rate || 18).toFixed(1)}% on {formatIndian(invoice.subtotal)}</td><td style={{ ...styles.cell, textAlign: 'right' }}>{formatIndian(invoice.igst_amount)}</td></tr>}
              {parseFloat(invoice.round_off) !== 0 && <tr><td style={{ ...styles.cell, textAlign: 'right' }}>Round Off</td><td style={{ ...styles.cell, textAlign: 'right' }}>{formatIndian(invoice.round_off)}</td></tr>}
              <tr style={{ background: '#f0f0f0' }}><td style={{ border: '2px solid #000', padding: '4px', textAlign: 'right', fontSize: '10pt', fontWeight: 'bold' }}>Total</td><td style={{ border: '2px solid #000', padding: '4px', textAlign: 'right', fontSize: '10pt', fontWeight: 'bold' }}>₹{formatIndian(invoice.total_amount)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* ===== AMOUNT IN WORDS ===== */}
        <div style={{ fontSize: '8pt', padding: '3px 0', borderTop: '1px solid #000', flexShrink: 0 }}>
          <strong>Amount Chargeable (in words):</strong> INR {numberToWords(invoice.total_amount)}
          <span style={{ float: 'right', fontSize: '7pt', color: '#666' }}>E & O.E</span>
        </div>

        {/* ===== HSN SUMMARY ===== */}
        <table style={{ ...styles.tbl, fontSize: '7.5pt', flexShrink: 0 }}>
          <thead>
            <tr>
              <th style={{ ...styles.hc, fontSize: '7pt' }}>HSN/SAC</th>
              <th style={{ ...styles.hc, fontSize: '7pt' }}>Taxable Value</th>
              {hasCGST ? <><th style={{ ...styles.hc, fontSize: '7pt' }} colSpan="2">Central Tax</th><th style={{ ...styles.hc, fontSize: '7pt' }} colSpan="2">State/UT Tax</th></> : <th style={{ ...styles.hc, fontSize: '7pt' }} colSpan="2">Integrated Tax</th>}
              <th style={{ ...styles.hc, fontSize: '7pt' }}>Total Tax</th>
            </tr>
            <tr>
              <th style={{ ...styles.hc, fontSize: '6.5pt' }}></th><th style={{ ...styles.hc, fontSize: '6.5pt' }}></th>
              {hasCGST ? <><th style={{ ...styles.hc, fontSize: '6.5pt' }}>Rate</th><th style={{ ...styles.hc, fontSize: '6.5pt' }}>Amt</th><th style={{ ...styles.hc, fontSize: '6.5pt' }}>Rate</th><th style={{ ...styles.hc, fontSize: '6.5pt' }}>Amt</th></> : <><th style={{ ...styles.hc, fontSize: '6.5pt' }}>Rate</th><th style={{ ...styles.hc, fontSize: '6.5pt' }}>Amt</th></>}
              <th style={{ ...styles.hc, fontSize: '6.5pt' }}></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(hsnMap).map(([hsn, d]) => (
              <tr key={hsn}>
                <td style={{ ...styles.cell, textAlign: 'center', fontSize: '7pt', padding: '1px 2px' }}>{hsn}</td>
                <td style={{ ...styles.cell, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(d.taxable)}</td>
                {hasCGST ? <><td style={{ ...styles.cell, textAlign: 'center', fontSize: '7pt', padding: '1px 2px' }}>{d.cgstRate}%</td><td style={{ ...styles.cell, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(d.cgstAmt)}</td><td style={{ ...styles.cell, textAlign: 'center', fontSize: '7pt', padding: '1px 2px' }}>{d.sgstRate}%</td><td style={{ ...styles.cell, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(d.sgstAmt)}</td></> : <><td style={{ ...styles.cell, textAlign: 'center', fontSize: '7pt', padding: '1px 2px' }}>{d.igstRate}%</td><td style={{ ...styles.cell, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(d.igstAmt)}</td></>}
                <td style={{ ...styles.cell, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(d.cgstAmt + d.sgstAmt + d.igstAmt)}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 'bold', background: '#f5f5f5' }}>
              <td style={{ ...styles.cell, textAlign: 'center', fontSize: '7pt', padding: '1px 2px' }}>TOTAL</td>
              <td style={{ ...styles.cell, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(invoice.subtotal)}</td>
              {hasCGST ? <><td style={{ ...styles.cell, fontSize: '7pt', padding: '1px 2px' }}></td><td style={{ ...styles.cell, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(invoice.cgst_amount)}</td><td style={{ ...styles.cell, fontSize: '7pt', padding: '1px 2px' }}></td><td style={{ ...styles.cell, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(invoice.sgst_amount)}</td></> : <><td style={{ ...styles.cell, fontSize: '7pt', padding: '1px 2px' }}></td><td style={{ ...styles.cell, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(invoice.igst_amount)}</td></>}
              <td style={{ ...styles.cell, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>{formatIndian(totalTax)}</td>
            </tr>
          </tbody>
        </table>

        {/* ===== BANK + SIGNATURE ===== */}
        <div style={{ display: 'flex', borderTop: '1px solid #000', marginTop: '2px', paddingTop: '3px', flexShrink: 0 }}>
          <div style={{ width: '55%', fontSize: '7.5pt' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Bank Details:</div>
            {org?.bank_name && <div>Bank: {org.bank_name}</div>}
            {org?.account_no && <div>A/C: {org.account_no}</div>}
            {org?.ifsc && <div>IFSC: {org.ifsc}</div>}
            {org?.upi_id && <div>UPI: {org.upi_id}</div>}
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
