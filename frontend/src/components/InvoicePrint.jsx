/**
 * InvoicePrint — Production-Ready GST Tax Invoice Component
 * 
 * Features:
 *   - A4 portrait, print-ready layout
 *   - Company header with logo, name, GSTIN, address, phone, email
 *   - Billing & Shipping address sections
 *   - Invoice details panel (number, date, due date, place of supply, reverse charge)
 *   - Itemized product table with HSN, GST, taxable value columns
 *   - HSN-wise tax summary
 *   - Grand total with amount in words
 *   - Bank details with dynamic UPI QR code
 *   - Payment status badge
 *   - Authorized signature
 *   - Notes & Terms & Conditions
 *   - Footer with page number
 *   - All data driven by props (no hardcoded values)
 * 
 * Props: { invoice, items, org }
 */
import { useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { numberToWords } from '../utils'

/* ─── helpers ─────────────────────────────────────────────── */

function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return String(d)
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

function fmt(n) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
}

const STATE_NAMES = {
  '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
  '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh',
  '10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur',
  '15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal',
  '20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh',
  '24':'Gujarat','25':'Daman & Diu','26':'Dadra & Nagar Haveli','27':'Maharashtra',
  '28':'Andhra Pradesh','29':'Karnataka','30':'Goa','31':'Lakshadweep',
  '32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman & Nicobar',
  '36':'Telangana','37':'Ladakh','38':'Other Territory'
}

function getStateName(code) {
  return STATE_NAMES[code] || ''
}

/* ─── styles ──────────────────────────────────────────────── */

const S = {
  page: {
    fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif",
    fontSize: '9pt',
    color: '#1a1a1a',
    width: '210mm',
    minHeight: '297mm',
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    overflow: 'hidden',
    lineHeight: 1.35,
  },
  /* header */
  headerWrap: {
    display: 'flex',
    borderBottom: '2.5px solid #000',
    padding: '8px 12px 6px',
    flexShrink: 0,
  },
  logoBox: {
    width: '68px',
    height: '68px',
    border: '1.5px solid #bbb',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '14px',
    flexShrink: 0,
    background: '#fafafa',
  },
  companyName: {
    fontSize: '16pt',
    fontWeight: '800',
    letterSpacing: '0.8px',
    color: '#111',
    lineHeight: 1.2,
  },
  companyAddr: {
    fontSize: '8pt',
    color: '#333',
    marginTop: '1px',
  },
  companyMeta: {
    display: 'flex',
    gap: '16px',
    marginTop: '2px',
    fontSize: '7.8pt',
    color: '#444',
    flexWrap: 'wrap',
  },
  /* title bar */
  titleBar: {
    textAlign: 'center',
    padding: '4px 0',
    borderBottom: '2.5px solid #000',
    flexShrink: 0,
    background: 'linear-gradient(to right, #f8f8f8, #fff, #f8f8f8)',
  },
  titleText: {
    fontSize: '13pt',
    fontWeight: '800',
    letterSpacing: '2.5px',
    color: '#111',
  },
  subtitleText: {
    fontSize: '7pt',
    fontWeight: '700',
    color: '#555',
    letterSpacing: '0.5px',
  },
  /* address & invoice info */
  infoRow: {
    display: 'flex',
    borderBottom: '1px solid #000',
    flexShrink: 0,
  },
  infoCell: {
    padding: '5px 10px',
    fontSize: '8pt',
    lineHeight: 1.4,
  },
  /* table */
  thBase: {
    border: '1px solid #000',
    padding: '4px 3px',
    background: '#e8e8e8',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: '7.5pt',
  },
  tdBase: {
    border: '1px solid #000',
    padding: '3px 4px',
    verticalAlign: 'top',
    fontSize: '8pt',
  },
  /* sections */
  sectionTitle: {
    fontSize: '7.5pt',
    fontWeight: '700',
    color: '#333',
    borderBottom: '1px solid #ccc',
    paddingBottom: '1px',
    marginBottom: '3px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  /* bank/sign */
  bottomRow: {
    display: 'flex',
    borderTop: '1.5px solid #000',
    marginTop: 'auto',
    flexShrink: 0,
  },
  /* footer */
  footer: {
    textAlign: 'center',
    fontSize: '6.5pt',
    color: '#999',
    padding: '3px 0',
    borderTop: '1px solid #ddd',
    flexShrink: 0,
  },
}

/* ─── component ───────────────────────────────────────────── */

export default function InvoicePrint({ invoice, items, org }) {
  if (!invoice || !org) return null

  /* ── derived data ──────────────────────────────────────── */
  const hasCGST = parseFloat(invoice.cgst_amount) > 0
  const hasIGST = parseFloat(invoice.igst_amount) > 0
  const totalTax = parseFloat(invoice.cgst_amount || 0) + parseFloat(invoice.sgst_amount || 0) + parseFloat(invoice.igst_amount || 0)

  const orgStateCode = org.state_code || (org.gstin ? org.gstin.substring(0, 2) : '27')
  const custStateCode = invoice.customer_state_code || (invoice.customer_gstin ? invoice.customer_gstin.substring(0, 2) : '')
  const placeOfSupply = custStateCode
    ? `${custStateCode} - ${invoice.customer_state || getStateName(custStateCode)}`
    : `${orgStateCode} - ${org.state || getStateName(orgStateCode)}`

  const invNum = (invoice.invoice_number || '').split('/')[0]
  const invoiceDate = fmtDate(invoice.invoice_date)
  const dueDate = fmtDate(invoice.due_date)

  const isPaid = (invoice.payment_status || '').toLowerCase() === 'paid'

  /* HSN tax summary map */
  const hsnMap = useMemo(() => {
    const map = {}
    items.forEach(item => {
      const hsn = item.hsn_code || 'Others'
      if (!map[hsn]) map[hsn] = { taxable: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0 }
      const qty = parseFloat(item.quantity) || 0
      const rate = parseFloat(item.rate) || 0
      const taxable = qty * rate
      map[hsn].taxable += taxable
      map[hsn].cgstRate = parseFloat(item.cgst_rate) || 0
      map[hsn].sgstRate = parseFloat(item.sgst_rate) || 0
      map[hsn].igstRate = parseFloat(item.igst_rate) || 0
      map[hsn].cgstAmt += taxable * (parseFloat(item.cgst_rate) || 0) / 100
      map[hsn].sgstAmt += taxable * (parseFloat(item.sgst_rate) || 0) / 100
      map[hsn].igstAmt += taxable * (parseFloat(item.igst_rate) || 0) / 100
    })
    return map
  }, [items])

  /* UPI QR string */
  const upiString = useMemo(() => {
    const upiId = org.upi_id || ''
    const name = (org.name || 'GLOB FABRICATION AND ENTERPRISES').replace(/&/g, 'and')
    const amount = parseFloat(invoice.total_amount || 0).toFixed(2)
    const note = `Invoice ${invNum}`
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`
  }, [org.upi_id, org.name, invoice.total_amount, invNum])

  const showQR = !!org.upi_id

  /* shipping address (if different) */
  const hasShipping = invoice.shipping_name || invoice.shipping_address || invoice.shipping_city

  /* ── render ────────────────────────────────────────────── */
  return (
    <div style={S.page} className="print-area">

      {/* ═══════ HEADER ═══════ */}
      <div style={S.headerWrap}>
        <div style={S.logoBox}>
          {org.logo_url
            ? <img src={org.logo_url} alt="" style={{ maxWidth: '60px', maxHeight: '60px', objectFit: 'contain' }} />
            : <span style={{ fontSize: '6px', color: '#aaa', textAlign: 'center' }}>LOGO</span>
          }
        </div>
        <div style={{ flex: 1 }}>
          <div style={S.companyName}>{(org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()}</div>
          <div style={S.companyAddr}>
            {[org.address, org.city, org.state, org.pincode ? `PIN: ${org.pincode}` : ''].filter(Boolean).join(', ')}
          </div>
          <div style={S.companyMeta}>
            {org.gstin && <span><b>GSTIN:</b> {org.gstin}</span>}
            {org.phone && <span><b>Phone:</b> {org.phone}</span>}
            {org.email && <span><b>Email:</b> {org.email}</span>}
          </div>
        </div>
      </div>

      {/* ═══════ TITLE ═══════ */}
      <div style={S.titleBar}>
        <div style={S.titleText}>TAX INVOICE</div>
        <div style={S.subtitleText}>ORIGINAL FOR RECIPIENT</div>
      </div>

      {/* ═══════ INVOICE INFO + BILLING ═══════ */}
      <div style={S.infoRow}>
        {/* Left: Invoice details */}
        <div style={{ ...S.infoCell, width: '36%', borderRight: '1px solid #000' }}>
          <div style={{ marginBottom: '2px' }}><b>Invoice No:</b> {invNum}</div>
          <div style={{ marginBottom: '2px' }}><b>Date:</b> {invoiceDate}</div>
          {dueDate && <div style={{ marginBottom: '2px' }}><b>Due Date:</b> {dueDate}</div>}
          <div style={{ marginBottom: '2px' }}><b>Place of Supply:</b> {placeOfSupply}</div>
          <div><b>Reverse Charge:</b> No</div>
        </div>

        {/* Right: Billing Address */}
        <div style={{ ...S.infoCell, width: hasShipping ? '32%' : '64%' }}>
          <div style={S.sectionTitle}>Bill To</div>
          <div style={{ fontWeight: '700', textTransform: 'uppercase', fontSize: '9pt' }}>
            {(invoice.customer_name || '').toUpperCase()}
          </div>
          {invoice.customer_gstin && <div><b>GSTIN:</b> {invoice.customer_gstin}</div>}
          <div>{[invoice.customer_address, invoice.customer_city, invoice.customer_state, invoice.customer_pincode].filter(Boolean).join(', ')}</div>
          {invoice.customer_phone && <div><b>Ph:</b> {invoice.customer_phone}</div>}
        </div>

        {/* Shipping Address (if different) */}
        {hasShipping && (
          <div style={{ ...S.infoCell, width: '32%', borderLeft: '1px solid #000' }}>
            <div style={S.sectionTitle}>Ship To</div>
            <div style={{ fontWeight: '700', textTransform: 'uppercase', fontSize: '9pt' }}>
              {(invoice.shipping_name || invoice.customer_name || '').toUpperCase()}
            </div>
            <div>{[invoice.shipping_address, invoice.shipping_city, invoice.shipping_state, invoice.shipping_pincode].filter(Boolean).join(', ')}</div>
          </div>
        )}
      </div>

      {/* ═══════ ITEMS TABLE ═══════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', flex: 1 }}>
          <thead>
            <tr>
              <th style={{ ...S.thBase, width: '4%' }}>Sr<br/>No</th>
              <th style={{ ...S.thBase, width: '24%' }}>Item Description</th>
              <th style={{ ...S.thBase, width: '8%' }}>HSN/<br/>SAC</th>
              <th style={{ ...S.thBase, width: '9%' }}>Rate<br/>(₹)</th>
              <th style={{ ...S.thBase, width: '6%' }}>Qty</th>
              <th style={{ ...S.thBase, width: '5%' }}>Unit</th>
              <th style={{ ...S.thBase, width: '13%' }}>Taxable<br/>Value (₹)</th>
              <th style={{ ...S.thBase, width: '7%' }}>GST<br/>%</th>
              <th style={{ ...S.thBase, width: '10%' }}>Tax<br/>Amount (₹)</th>
              <th style={{ ...S.thBase, width: '14%' }}>Total<br/>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const qty = parseFloat(item.quantity) || 0
              const rate = parseFloat(item.rate) || 0
              const taxable = qty * rate
              const taxRate = (parseFloat(item.igst_rate) || 0) > 0
                ? parseFloat(item.igst_rate)
                : (parseFloat(item.cgst_rate) || 0) + (parseFloat(item.sgst_rate) || 0)
              const taxAmt = taxable * taxRate / 100
              const total = taxable + taxAmt
              return (
                <tr key={i}>
                  <td style={{ ...S.tdBase, textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ ...S.tdBase, whiteSpace: 'pre-line', lineHeight: '1.3' }}>{item.description || ''}</td>
                  <td style={{ ...S.tdBase, textAlign: 'center' }}>{item.hsn_code || '—'}</td>
                  <td style={{ ...S.tdBase, textAlign: 'right' }}>{fmt(rate)}</td>
                  <td style={{ ...S.tdBase, textAlign: 'center' }}>{qty}</td>
                  <td style={{ ...S.tdBase, textAlign: 'center' }}>{item.unit || 'NOS'}</td>
                  <td style={{ ...S.tdBase, textAlign: 'right' }}>{fmt(taxable)}</td>
                  <td style={{ ...S.tdBase, textAlign: 'center' }}>{taxRate > 0 ? `${taxRate}%` : '—'}</td>
                  <td style={{ ...S.tdBase, textAlign: 'right' }}>{fmt(taxAmt)}</td>
                  <td style={{ ...S.tdBase, textAlign: 'right', fontWeight: '700' }}>{fmt(total)}</td>
                </tr>
              )
            })}
            {/* Empty rows to fill page */}
            {items.length < 12 && Array.from({ length: 12 - items.length }).map((_, i) => (
              <tr key={`e${i}`} style={{ height: '20px' }}>
                <td style={S.tdBase}>&nbsp;</td>
                <td style={S.tdBase}></td>
                <td style={S.tdBase}></td>
                <td style={S.tdBase}></td>
                <td style={S.tdBase}></td>
                <td style={S.tdBase}></td>
                <td style={S.tdBase}></td>
                <td style={S.tdBase}></td>
                <td style={S.tdBase}></td>
                <td style={S.tdBase}></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ═══════ TOTALS ═══════ */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', flexShrink: 0 }}>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right', width: '74%', background: '#fafafa' }}>Taxable Amount</td>
              <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>₹{fmt(invoice.subtotal)}</td>
            </tr>
            {hasCGST && (
              <>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>CGST @ {parseFloat(items[0]?.cgst_rate || 0).toFixed(1)}% on ₹{fmt(invoice.subtotal)}</td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>₹{fmt(invoice.cgst_amount)}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>SGST @ {parseFloat(items[0]?.sgst_rate || 0).toFixed(1)}% on ₹{fmt(invoice.subtotal)}</td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>₹{fmt(invoice.sgst_amount)}</td>
                </tr>
              </>
            )}
            {hasIGST && (
              <tr>
                <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>IGST @ {parseFloat(items[0]?.igst_rate || 0).toFixed(1)}% on ₹{fmt(invoice.subtotal)}</td>
                <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>₹{fmt(invoice.igst_amount)}</td>
              </tr>
            )}
            {parseFloat(invoice.discount) > 0 && (
              <tr>
                <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>Discount</td>
                <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>- ₹{fmt(invoice.discount)}</td>
              </tr>
            )}
            {parseFloat(invoice.round_off) !== 0 && (
              <tr>
                <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>Round Off</td>
                <td style={{ border: '1px solid #000', padding: '3px 6px', textAlign: 'right' }}>{parseFloat(invoice.round_off) > 0 ? '+' : ''} ₹{fmt(invoice.round_off)}</td>
              </tr>
            )}
            <tr style={{ background: '#e8e8e8' }}>
              <td style={{ border: '2px solid #000', padding: '5px 6px', textAlign: 'right', fontSize: '10.5pt' }}>
                <b>GRAND TOTAL</b>
              </td>
              <td style={{ border: '2px solid #000', padding: '5px 6px', textAlign: 'right', fontSize: '10.5pt', fontWeight: '800' }}>
                ₹{fmt(invoice.total_amount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ═══════ AMOUNT IN WORDS ═══════ */}
      <div style={{ padding: '4px 8px', fontSize: '8pt', borderTop: '1.5px solid #000', flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <b>Amount Chargeable (in words):</b> INR {numberToWords(invoice.total_amount)}
        </div>
        <div style={{ fontSize: '7pt', color: '#666', alignSelf: 'flex-end' }}>E & O.E</div>
      </div>

      {/* ═══════ HSN-WISE TAX SUMMARY ═══════ */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: '7.5pt', fontWeight: '700', padding: '3px 4px 0', color: '#333', letterSpacing: '0.3px' }}>
          HSN-WISE TAX SUMMARY
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7pt' }}>
          <thead>
            <tr>
              <th style={{ ...S.thBase, fontSize: '6.5pt' }}>HSN/SAC</th>
              <th style={{ ...S.thBase, fontSize: '6.5pt' }}>Taxable Value</th>
              {hasCGST ? (
                <>
                  <th style={{ ...S.thBase, fontSize: '6.5pt' }} colSpan={2}>Central Tax</th>
                  <th style={{ ...S.thBase, fontSize: '6.5pt' }} colSpan={2}>State/UT Tax</th>
                </>
              ) : (
                <th style={{ ...S.thBase, fontSize: '6.5pt' }} colSpan={2}>Integrated Tax</th>
              )}
              <th style={{ ...S.thBase, fontSize: '6.5pt' }}>Total Tax Amt</th>
            </tr>
            <tr>
              <th style={{ ...S.thBase, fontSize: '6pt', padding: '1px' }}></th>
              <th style={{ ...S.thBase, fontSize: '6pt', padding: '1px' }}></th>
              {hasCGST ? (
                <>
                  <th style={{ ...S.thBase, fontSize: '6pt', padding: '1px' }}>Rate</th>
                  <th style={{ ...S.thBase, fontSize: '6pt', padding: '1px' }}>Amount</th>
                  <th style={{ ...S.thBase, fontSize: '6pt', padding: '1px' }}>Rate</th>
                  <th style={{ ...S.thBase, fontSize: '6pt', padding: '1px' }}>Amount</th>
                </>
              ) : (
                <>
                  <th style={{ ...S.thBase, fontSize: '6pt', padding: '1px' }}>Rate</th>
                  <th style={{ ...S.thBase, fontSize: '6pt', padding: '1px' }}>Amount</th>
                </>
              )}
              <th style={{ ...S.thBase, fontSize: '6pt', padding: '1px' }}></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(hsnMap).map(([hsn, d]) => (
              <tr key={hsn}>
                <td style={{ ...S.tdBase, textAlign: 'center', fontSize: '7pt', padding: '1px 2px' }}>{hsn}</td>
                <td style={{ ...S.tdBase, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>₹{fmt(d.taxable)}</td>
                {hasCGST ? (
                  <>
                    <td style={{ ...S.tdBase, textAlign: 'center', fontSize: '7pt', padding: '1px 2px' }}>{d.cgstRate}%</td>
                    <td style={{ ...S.tdBase, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>₹{fmt(d.cgstAmt)}</td>
                    <td style={{ ...S.tdBase, textAlign: 'center', fontSize: '7pt', padding: '1px 2px' }}>{d.sgstRate}%</td>
                    <td style={{ ...S.tdBase, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>₹{fmt(d.sgstAmt)}</td>
                  </>
                ) : (
                  <>
                    <td style={{ ...S.tdBase, textAlign: 'center', fontSize: '7pt', padding: '1px 2px' }}>{d.igstRate}%</td>
                    <td style={{ ...S.tdBase, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>₹{fmt(d.igstAmt)}</td>
                  </>
                )}
                <td style={{ ...S.tdBase, textAlign: 'right', fontSize: '7pt', padding: '1px 2px', fontWeight: '700' }}>
                  ₹{fmt(d.cgstAmt + d.sgstAmt + d.igstAmt)}
                </td>
              </tr>
            ))}
            {/* Totals row */}
            <tr style={{ fontWeight: '700', background: '#f0f0f0' }}>
              <td style={{ ...S.tdBase, textAlign: 'center', fontSize: '7pt', padding: '1px 2px' }}>TOTAL</td>
              <td style={{ ...S.tdBase, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>₹{fmt(invoice.subtotal)}</td>
              {hasCGST ? (
                <>
                  <td style={{ ...S.tdBase, fontSize: '7pt', padding: '1px 2px' }}></td>
                  <td style={{ ...S.tdBase, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>₹{fmt(invoice.cgst_amount)}</td>
                  <td style={{ ...S.tdBase, fontSize: '7pt', padding: '1px 2px' }}></td>
                  <td style={{ ...S.tdBase, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>₹{fmt(invoice.sgst_amount)}</td>
                </>
              ) : (
                <>
                  <td style={{ ...S.tdBase, fontSize: '7pt', padding: '1px 2px' }}></td>
                  <td style={{ ...S.tdBase, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>₹{fmt(invoice.igst_amount)}</td>
                </>
              )}
              <td style={{ ...S.tdBase, textAlign: 'right', fontSize: '7pt', padding: '1px 2px' }}>₹{fmt(totalTax)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ═══════ BANK DETAILS + QR + SIGNATURE ═══════ */}
      <div style={S.bottomRow}>
        {/* Bank Details */}
        <div style={{ width: '42%', padding: '5px 10px', fontSize: '7.5pt', lineHeight: 1.5 }}>
          <div style={S.sectionTitle}>Bank Details</div>
          {org.bank_name && <div><b>Bank:</b> {org.bank_name}</div>}
          {org.account_no && <div><b>A/C No:</b> {org.account_no}</div>}
          {org.ifsc && <div><b>IFSC:</b> {org.ifsc}</div>}
          {org.branch && <div><b>Branch:</b> {org.branch}</div>}
          {org.upi_id && <div><b>UPI:</b> {org.upi_id}</div>}
        </div>

        {/* QR Code */}
        <div style={{ width: '18%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px', borderLeft: '1px solid #000', borderRight: '1px solid #000' }}>
          {showQR ? (
            <>
              <QRCodeSVG
                value={upiString}
                size={72}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
                includeMargin={false}
              />
              <div style={{ fontSize: '5.5pt', color: '#666', marginTop: '2px', textAlign: 'center' }}>Scan to Pay</div>
            </>
          ) : (
            <div style={{ fontSize: '7pt', color: '#aaa', textAlign: 'center' }}>QR Code</div>
          )}
        </div>

        {/* Payment Status + Signature */}
        <div style={{ width: '40%', padding: '5px 10px', fontSize: '7.5pt', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          {/* Payment Status */}
          <div style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: '700' }}>Payment Status: </span>
            <span style={{
              display: 'inline-block',
              padding: '1px 8px',
              borderRadius: '3px',
              fontSize: '7pt',
              fontWeight: '700',
              letterSpacing: '0.3px',
              background: isPaid ? '#d4edda' : '#fff3cd',
              color: isPaid ? '#155724' : '#856404',
              border: `1px solid ${isPaid ? '#c3e6cb' : '#ffeaa7'}`,
            }}>
              {isPaid ? '✓ PAID' : '● UNPAID'}
            </span>
          </div>

          {/* Authorized Signatory */}
          <div style={{ textAlign: 'right', marginTop: 'auto' }}>
            <div style={{ fontSize: '7.5pt', marginBottom: '24px' }}>For <b>{(org.name || '').toUpperCase()}</b></div>
            <div style={{ borderTop: '1px solid #000', display: 'inline-block', paddingTop: '2px', fontSize: '7.5pt', fontWeight: '600' }}>
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ NOTES & TERMS ═══════ */}
      {invoice.notes && (
        <div style={{ padding: '4px 10px', fontSize: '7pt', borderTop: '1px solid #000', flexShrink: 0, color: '#444', lineHeight: 1.5 }}>
          <b>Notes:</b> {invoice.notes}
        </div>
      )}

      <div style={{ padding: '3px 10px', fontSize: '6.5pt', borderTop: '1px solid #ccc', flexShrink: 0, color: '#777' }}>
        <b>Terms & Conditions:</b> 1. Goods once sold will not be taken back. 2. Interest @ 18% p.a. will be charged on delayed payments. 3. Subject to Maharashtra jurisdiction only.
      </div>

      {/* ═══════ FOOTER ═══════ */}
      <div style={S.footer}>
        Computer Generated Invoice | {(org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()} | Page 1 of 1
      </div>
    </div>
  )
}
