/**
 * InvoicePrint — Production-Ready GST Tax Invoice
 * STRICT GST segregation: CGST+SGST for intra-state, IGST for inter-state
 * Based on customer state code vs organization state code.
 * Professional "Bill To" customer details layout.
 *
 * Props: { invoice, items, org }
 */
import { useMemo } from 'react'
import { numberToWords } from '../utils'

/* ─── helpers ─── */

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

/* ─── component ─── */

export default function InvoicePrint({ invoice, items, org }) {
  if (!invoice || !org) return null

  // ── Font Settings from Org ──
  const fontFamily = org.invoice_font_family || 'Arial, sans-serif'
  const fontSize = org.invoice_font_size || '11px'
  const descSize = org.invoice_desc_size || '10px'
  const itemBold = org.invoice_item_bold === 'true' || org.invoice_item_bold === '1'

  // ════════════════════════════════════════════════════════
  // GST STATE DETERMINATION — THE CRITICAL LOGIC
  // ════════════════════════════════════════════════════════
  const orgStateCode = org.state_code || (org.gstin ? org.gstin.substring(0, 2) : '27')
  const custGstin = invoice.customer_gstin || ''
  // Get customer state code from: 1) explicit field, 2) GSTIN first 2 digits
  const custStateCode = invoice.customer_state_code || (custGstin ? custGstin.substring(0, 2) : '')

  // STRICT RULE: Same state = CGST+SGST, Different state = IGST
  // If no state code at all, fall back to what's stored in the invoice data
  const isIntraState = custStateCode ? (custStateCode === orgStateCode) : (parseFloat(invoice.cgst_amount || 0) > 0)

  // Calculate tax amounts based on the determination
  // If intra-state: use cgst_amount + sgst_amount (from DB, which should be correct)
  // If inter-state: use igst_amount
  const cgstAmount = isIntraState ? parseFloat(invoice.cgst_amount || 0) : 0
  const sgstAmount = isIntraState ? parseFloat(invoice.sgst_amount || 0) : 0
  const igstAmount = !isIntraState ? parseFloat(invoice.igst_amount || 0) : 0

  // If the stored data doesn't match the expected type, recalculate from items
  // This handles cases where invoice was saved with wrong GST type
  let displayCgst = cgstAmount
  let displaySgst = sgstAmount
  let displayIgst = igstAmount

  if (isIntraState && cgstAmount === 0 && igstAmount > 0) {
    // Data has IGST but should be CGST+SGST — split it
    displayCgst = igstAmount / 2
    displaySgst = igstAmount / 2
    displayIgst = 0
  } else if (!isIntraState && igstAmount === 0 && cgstAmount > 0) {
    // Data has CGST+SGST but should be IGST — combine it
    displayIgst = cgstAmount + sgstAmount
    displayCgst = 0
    displaySgst = 0
  }

  const totalTax = displayCgst + displaySgst + displayIgst
  const hasCGST = displayCgst > 0
  const hasIGST = displayIgst > 0

  // Tax rates for display
  const cgstRate = hasCGST ? (items.length > 0 ? parseFloat(items[0].cgst_rate || 0) : 0) : 0
  const sgstRate = hasCGST ? (items.length > 0 ? parseFloat(items[0].sgst_rate || 0) : 0) : 0
  const igstRate = hasIGST ? (items.length > 0 ? parseFloat(items[0].igst_rate || 0) : 0) : 0

  // Place of supply
  const placeOfSupply = custStateCode
    ? `${custStateCode} - ${invoice.customer_state || STATE_NAMES[custStateCode] || ''}`
    : `${orgStateCode} - ${org.state || STATE_NAMES[orgStateCode] || ''}`

  const invNum = (invoice.invoice_number || '').split('/')[0]
  const invoiceDate = fmtDate(invoice.invoice_date)
  const isPaid = (invoice.payment_status || '').toLowerCase() === 'paid'
  const totalQty = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0)

  /* HSN summary — recalculate based on correct GST type */
  const hsnMap = useMemo(() => {
    const map = {}
    items.forEach(item => {
      const hsn = item.hsn_code || 'Others'
      if (!map[hsn]) map[hsn] = { taxable: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0 }
      const qty = parseFloat(item.quantity) || 0
      const rate = parseFloat(item.rate) || 0
      const taxable = qty * rate
      map[hsn].taxable += taxable
      if (isIntraState) {
        map[hsn].cgstRate = parseFloat(item.cgst_rate) || 0
        map[hsn].sgstRate = parseFloat(item.sgst_rate) || 0
        map[hsn].igstRate = 0
        map[hsn].cgstAmt += taxable * (parseFloat(item.cgst_rate) || 0) / 100
        map[hsn].sgstAmt += taxable * (parseFloat(item.sgst_rate) || 0) / 100
      } else {
        map[hsn].cgstRate = 0
        map[hsn].sgstRate = 0
        map[hsn].igstRate = parseFloat(item.igst_rate) || 0
        map[hsn].igstAmt += taxable * (parseFloat(item.igst_rate) || 0) / 100
      }
    })
    return map
  }, [items, isIntraState])

  /* UPI QR */
  const qrImgUrl = useMemo(() => {
    const upiId = org.upi_id || ''
    if (!upiId) return ''
    const name = (org.name || 'GLOB FABRICATION AND ENTERPRISES').replace(/&/g, 'and')
    const amount = parseFloat(invoice.total_amount || 0).toFixed(2)
    const note = `Invoice ${invNum}`
    const upiStr = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`
    return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiStr)}`
  }, [org.upi_id, org.name, invoice.total_amount, invNum])

  const logoSrc = org.logo_url
  const companyName = (org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()
  const companyInitials = companyName.split(' ').map(w => w[0]).join('').substring(0, 4)

  const bdr = '1px solid #bbb'
  const hdrBg = '#f2f2f2'

  // Customer full address
  const customerFullAddress = [
    invoice.customer_address,
    invoice.customer_city,
    invoice.customer_state ? `${invoice.customer_state}${invoice.customer_pincode ? ' - ' + invoice.customer_pincode : ''}` : '',
  ].filter(Boolean).join(', ')

  return (
    <div className="print-area" style={{ fontFamily, fontSize, color: '#111', background: '#fff', width: '794px', margin: '0 auto', padding: '18px 22px', border: '1px solid #bbb' }}>

      {/* ── TITLE BAR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', border: bdr }}>
        <div style={{ flex: 1, textAlign: 'center', padding: '12px 0', borderRight: bdr }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', letterSpacing: '4px', color: '#0a3d6b' }}>TAX INVOICE</div>
        </div>
        <div style={{ padding: '12px 16px', fontSize: '10px', fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
          ORIGINAL FOR RECIPIENT
        </div>
      </div>

      {/* ── COMPANY + INVOICE INFO ── */}
      <div style={{ display: 'flex', borderLeft: bdr, borderRight: bdr, borderBottom: bdr }}>
        {/* Company Block */}
        <div style={{ flex: 1.2, padding: '14px 14px', borderRight: bdr, display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#0a3d6b', overflow: 'hidden'
          }}>
            {logoSrc
              ? <img src={logoSrc} alt="" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '50%' }} />
              : <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', lineHeight: 1.2 }}>{companyInitials}</span>
            }
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', lineHeight: 1.3 }}>{companyName}</div>
            {org.gstin && <div style={{ fontSize: '10.5px', marginTop: '3px' }}>GSTIN: <b>{org.gstin}</b></div>}
            <div style={{ fontSize: '10.5px', color: '#333', marginTop: '3px', lineHeight: 1.6 }}>
              {[org.address, org.city, org.state, org.pincode].filter(Boolean).join(', ')}
            </div>
            <div style={{ fontSize: '10.5px', color: '#333', marginTop: '2px' }}>
              {org.phone && <span><b>Mobile:</b> {org.phone} &nbsp;</span>}
              {org.email && <span><b>Email:</b> {org.email}</span>}
            </div>
          </div>
        </div>

        {/* Invoice Details */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: bdr }}>
            <div style={{ flex: 1, padding: '7px 10px', borderRight: bdr }}>
              <div style={{ fontSize: '9px', color: '#555' }}>Invoice #:</div>
              <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{invNum}</div>
            </div>
            <div style={{ flex: 1, padding: '7px 10px' }}>
              <div style={{ fontSize: '9px', color: '#555' }}>Invoice Date:</div>
              <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{invoiceDate}</div>
            </div>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ flex: 1, padding: '7px 10px', borderRight: bdr }}>
              <div style={{ fontSize: '9px', color: '#555' }}>Place of Supply:</div>
              <div style={{ fontSize: '11px', fontWeight: 'bold' }}>{placeOfSupply}</div>
            </div>
            <div style={{ flex: 1, padding: '7px 10px' }}>
              <div style={{ fontSize: '9px', color: '#555' }}>Reverse Charge:</div>
              <div style={{ fontSize: '11px', fontWeight: 'bold' }}>No</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CUSTOMER DETAILS — Professional "Bill To" Layout ── */}
      <div style={{ display: 'flex', borderLeft: bdr, borderRight: bdr, borderBottom: bdr, minHeight: '90px' }}>
        {/* Bill To */}
        <div style={{ flex: 1, padding: '10px 14px' }}>
          <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#0a3d6b', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid #ddd', paddingBottom: '3px', marginBottom: '6px' }}>Bill To</div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '3px', lineHeight: 1.3 }}>{(invoice.customer_name || '').toUpperCase()}</div>
          {custGstin && (
            <div style={{ fontSize: '10.5px', marginBottom: '2px' }}>
              <span style={{ color: '#555' }}>GSTIN: </span><b>{custGstin}</b>
              <span style={{ marginLeft: '8px', fontSize: '9px', color: isIntraState ? '#155724' : '#856404', background: isIntraState ? '#d4edda' : '#fff3cd', padding: '1px 6px', borderRadius: '3px', fontWeight: 'bold' }}>
                {isIntraState ? 'INTRA-STATE' : 'INTER-STATE'}
              </span>
            </div>
          )}
          {customerFullAddress && (
            <div style={{ fontSize: '10.5px', color: '#333', lineHeight: 1.5 }}>{customerFullAddress}</div>
          )}
          {invoice.customer_phone && (
            <div style={{ fontSize: '10.5px', color: '#333' }}><span style={{ color: '#555', fontSize: '9px' }}>Ph: </span>{invoice.customer_phone}</div>
          )}
        </div>

        {/* Ship To (if applicable) */}
        {invoice.shipping_name && (
          <div style={{ flex: 1, padding: '10px 14px', borderLeft: bdr }}>
            <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#0a3d6b', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid #ddd', paddingBottom: '3px', marginBottom: '6px' }}>Ship To</div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '2px' }}>{invoice.shipping_name}</div>
            <div style={{ fontSize: '10.5px', color: '#333', lineHeight: 1.5 }}>
              {[invoice.shipping_address, invoice.shipping_city, invoice.shipping_state].filter(Boolean).join(', ')}
            </div>
          </div>
        )}
      </div>

      {/* ── ITEMS TABLE ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: bdr, borderTop: 'none', fontSize: '10px' }}>
        <thead>
          <tr>
            <th style={{ background: hdrBg, padding: '6px', border: bdr, textAlign: 'center', width: '30px' }}>#</th>
            <th style={{ background: hdrBg, padding: '6px', border: bdr, textAlign: 'left' }}>Item Description</th>
            <th style={{ background: hdrBg, padding: '6px', border: bdr, textAlign: 'center' }}>HSN/SAC</th>
            <th style={{ background: hdrBg, padding: '6px', border: bdr, textAlign: 'right' }}>Rate/Item</th>
            <th style={{ background: hdrBg, padding: '6px', border: bdr, textAlign: 'center' }}>Qty</th>
            <th style={{ background: hdrBg, padding: '6px', border: bdr, textAlign: 'right' }}>Taxable Value</th>
            <th style={{ background: hdrBg, padding: '6px', border: bdr, textAlign: 'right' }}>Tax Amount</th>
            <th style={{ background: hdrBg, padding: '6px', border: bdr, textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const qty = parseFloat(item.quantity) || 0
            const rate = parseFloat(item.rate) || 0
            const taxable = qty * rate
            const taxAmt = taxable * (isIntraState
              ? ((parseFloat(item.cgst_rate) || 0) + (parseFloat(item.sgst_rate) || 0))
              : (parseFloat(item.igst_rate) || 0)) / 100
            return (
              <tr key={i}>
                <td style={{ padding: '6px', border: bdr, textAlign: 'center' }}>{i + 1}</td>
                <td style={{ padding: '6px', border: bdr, lineHeight: 1.3, whiteSpace: 'pre-line', fontWeight: itemBold ? 'bold' : 'normal', fontSize: descSize }}>{item.description || ''}</td>
                <td style={{ padding: '6px', border: bdr, textAlign: 'center' }}>{item.hsn_code || '—'}</td>
                <td style={{ padding: '6px', border: bdr, textAlign: 'right' }}>{fmt(rate)}</td>
                <td style={{ padding: '6px', border: bdr, textAlign: 'center' }}>{qty} {item.unit || ''}</td>
                <td style={{ padding: '6px', border: bdr, textAlign: 'right' }}>{fmt(taxable)}</td>
                <td style={{ padding: '6px', border: bdr, textAlign: 'right' }}>{fmt(taxAmt)}</td>
                <td style={{ padding: '6px', border: bdr, textAlign: 'right', fontWeight: 'bold' }}>{fmt(taxable + taxAmt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ── TOTALS ── */}
      <div style={{ display: 'flex', borderLeft: bdr, borderRight: bdr, borderBottom: bdr }}>
        <div style={{ flex: 1.5, padding: '6px 10px', fontSize: '10px', borderRight: bdr }}>
          <b>Total Items / Qty : {items.length} / {totalQty.toFixed(3)}</b>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', borderBottom: '1px solid #eee', fontSize: '10px' }}>
            <span><b>Taxable Amount</b></span><span>₹{fmt(invoice.subtotal)}</span>
          </div>
          {hasCGST && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', borderBottom: '1px solid #eee', fontSize: '10px', background: '#f8f4ff' }}>
                <span>CGST @ {cgstRate.toFixed(1)}%</span><span>₹{fmt(displayCgst)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', borderBottom: '1px solid #eee', fontSize: '10px', background: '#f8f4ff' }}>
                <span>SGST @ {sgstRate.toFixed(1)}%</span><span>₹{fmt(displaySgst)}</span>
              </div>
            </>
          )}
          {hasIGST && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', borderBottom: '1px solid #eee', fontSize: '10px', background: '#fff8f0' }}>
              <span>IGST @ {igstRate.toFixed(1)}%</span><span>₹{fmt(displayIgst)}</span>
            </div>
          )}
          {parseFloat(invoice.discount) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', borderBottom: '1px solid #eee', fontSize: '10px' }}>
              <span>Discount</span><span>-₹{fmt(invoice.discount)}</span>
            </div>
          )}
          {parseFloat(invoice.round_off) !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', borderBottom: '1px solid #eee', fontSize: '10px' }}>
              <span>Round Off</span><span>₹{fmt(invoice.round_off)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: '12px', fontWeight: 'bold', background: '#f0f0f0' }}>
            <span>Grand Total</span><span style={{ fontSize: '13px' }}>₹{fmt(invoice.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* ── AMOUNT IN WORDS ── */}
      <div style={{ border: bdr, borderTop: 'none', padding: '5px 10px', fontSize: '9.5px', fontStyle: 'italic', background: '#fafafa' }}>
        <b>Amount Chargeable (in words):</b> INR {numberToWords(invoice.total_amount)}
      </div>

      {/* ── HSN TABLE ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: bdr, borderTop: 'none', fontSize: '10px' }}>
        <thead>
          <tr>
            <th style={{ background: hdrBg, padding: '5px 8px', border: bdr, textAlign: 'left' }}>HSN/SAC</th>
            <th style={{ background: hdrBg, padding: '5px 8px', border: bdr, textAlign: 'center' }}>Taxable Value</th>
            {hasCGST ? (
              <>
                <th style={{ background: hdrBg, padding: '5px 8px', border: bdr, textAlign: 'center' }} colSpan={2}>Central Tax</th>
                <th style={{ background: hdrBg, padding: '5px 8px', border: bdr, textAlign: 'center' }} colSpan={2}>State/UT Tax</th>
              </>
            ) : (
              <th style={{ background: hdrBg, padding: '5px 8px', border: bdr, textAlign: 'center' }} colSpan={2}>Integrated Tax</th>
            )}
            <th style={{ background: hdrBg, padding: '5px 8px', border: bdr, textAlign: 'center' }}>Total Tax Amt</th>
          </tr>
          <tr>
            <th style={{ background: hdrBg, padding: '3px 8px', border: bdr }}></th>
            <th style={{ background: hdrBg, padding: '3px 8px', border: bdr }}></th>
            {hasCGST ? (
              <>
                <th style={{ background: hdrBg, padding: '3px 8px', border: bdr, textAlign: 'center' }}>Rate</th>
                <th style={{ background: hdrBg, padding: '3px 8px', border: bdr, textAlign: 'center' }}>Amount</th>
                <th style={{ background: hdrBg, padding: '3px 8px', border: bdr, textAlign: 'center' }}>Rate</th>
                <th style={{ background: hdrBg, padding: '3px 8px', border: bdr, textAlign: 'center' }}>Amount</th>
              </>
            ) : (
              <>
                <th style={{ background: hdrBg, padding: '3px 8px', border: bdr, textAlign: 'center' }}>Rate</th>
                <th style={{ background: hdrBg, padding: '3px 8px', border: bdr, textAlign: 'center' }}>Amount</th>
              </>
            )}
            <th style={{ background: hdrBg, padding: '3px 8px', border: bdr }}></th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(hsnMap).map(([hsn, d]) => (
            <tr key={hsn}>
              <td style={{ padding: '5px 8px', border: bdr, textAlign: 'left' }}>{hsn}</td>
              <td style={{ padding: '5px 8px', border: bdr, textAlign: 'center' }}>{fmt(d.taxable)}</td>
              {hasCGST ? (
                <>
                  <td style={{ padding: '5px 8px', border: bdr, textAlign: 'center' }}>{d.cgstRate}%</td>
                  <td style={{ padding: '5px 8px', border: bdr, textAlign: 'center' }}>{fmt(d.cgstAmt)}</td>
                  <td style={{ padding: '5px 8px', border: bdr, textAlign: 'center' }}>{d.sgstRate}%</td>
                  <td style={{ padding: '5px 8px', border: bdr, textAlign: 'center' }}>{fmt(d.sgstAmt)}</td>
                </>
              ) : (
                <>
                  <td style={{ padding: '5px 8px', border: bdr, textAlign: 'center' }}>{d.igstRate}%</td>
                  <td style={{ padding: '5px 8px', border: bdr, textAlign: 'center' }}>{fmt(d.igstAmt)}</td>
                </>
              )}
              <td style={{ padding: '5px 8px', border: bdr, textAlign: 'center' }}>{fmt(d.cgstAmt + d.sgstAmt + d.igstAmt)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 'bold', background: '#f0f0f0' }}>
            <td style={{ padding: '5px 8px', border: bdr, textAlign: 'left' }}><b>TOTAL</b></td>
            <td style={{ padding: '5px 8px', border: bdr, textAlign: 'center' }}><b>{fmt(invoice.subtotal)}</b></td>
            {hasCGST ? (
              <>
                <td style={{ padding: '5px 8px', border: bdr }}></td>
                <td style={{ padding: '5px 8px', border: bdr, textAlign: 'center' }}><b>{fmt(displayCgst)}</b></td>
                <td style={{ padding: '5px 8px', border: bdr }}></td>
                <td style={{ padding: '5px 8px', border: bdr, textAlign: 'center' }}><b>{fmt(displaySgst)}</b></td>
              </>
            ) : (
              <>
                <td style={{ padding: '5px 8px', border: bdr }}></td>
                <td style={{ padding: '5px 8px', border: bdr, textAlign: 'center' }}><b>{fmt(displayIgst)}</b></td>
              </>
            )}
            <td style={{ padding: '5px 8px', border: bdr, textAlign: 'center' }}><b>{fmt(totalTax)}</b></td>
          </tr>
        </tbody>
      </table>

      {/* ── PAYMENT STATUS ── */}
      <div style={{ textAlign: 'right', padding: '5px 10px', border: bdr, borderTop: 'none', fontSize: '10px' }}>
        {isPaid ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '12px', padding: '2px 10px', color: '#2e7d32', fontWeight: 'bold', fontSize: '10px' }}>✔ Amount Paid</span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '12px', padding: '2px 10px', color: '#856404', fontWeight: 'bold', fontSize: '10px' }}>● Unpaid</span>
        )}
      </div>

      {/* ── BANK + UPI + SIGNATURE ── */}
      <div style={{ display: 'flex', border: bdr, borderTop: 'none' }}>
        <div style={{ flex: 1.1, padding: '10px 12px', borderRight: bdr, fontSize: '10px', lineHeight: 1.8 }}>
          <b style={{ display: 'block', marginBottom: '4px' }}>Bank Details:</b>
          <table style={{ fontSize: '10px' }}>
            <tbody>
              {org.bank_name && <tr><td style={{ padding: '1px 6px 1px 0', color: '#555' }}>Bank:</td><td style={{ fontWeight: 'bold' }}>{org.bank_name}</td></tr>}
              {org.account_no && <tr><td style={{ padding: '1px 6px 1px 0', color: '#555' }}>Account #:</td><td style={{ fontWeight: 'bold' }}>{org.account_no}</td></tr>}
              {org.ifsc && <tr><td style={{ padding: '1px 6px 1px 0', color: '#555' }}>IFSC:</td><td style={{ fontWeight: 'bold' }}>{org.ifsc}</td></tr>}
              {org.branch && <tr><td style={{ padding: '1px 6px 1px 0', color: '#555' }}>Branch:</td><td style={{ fontWeight: 'bold' }}>{org.branch}</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1, padding: '10px 12px', borderRight: bdr, textAlign: 'center' }}>
          <b style={{ display: 'block', marginBottom: '6px', fontSize: '10px' }}>Pay using UPI:</b>
          {qrImgUrl ? (
            <img src={qrImgUrl} alt="UPI QR" style={{ width: '90px', height: '90px', margin: '0 auto', imageRendering: 'pixelated' }} crossOrigin="anonymous" />
          ) : (
            <div style={{ width: '90px', height: '90px', border: '2px solid #333', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#888' }}>QR CODE</div>
          )}
        </div>
        <div style={{ flex: 1, padding: '10px 12px', textAlign: 'center', fontSize: '10px' }}>
          <div style={{ textAlign: 'right', marginBottom: '6px', fontSize: '10px' }}>For <b>{companyName}</b></div>
          <div style={{
            width: '100px', height: '80px',
            margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative'
          }}>
            {org.stamp_url && <img src={org.stamp_url} alt="" style={{ position: 'absolute', width: '100px', height: '80px', objectFit: 'contain', opacity: 0.85 }} />}
            {org.signature_url && <img src={org.signature_url} alt="" style={{ position: 'relative', zIndex: 1, maxHeight: '50px', maxWidth: '90px', objectFit: 'contain' }} />}
          </div>
          <div style={{ fontSize: '9.5px', color: '#555', marginTop: '6px' }}>Authorized Signatory</div>
        </div>
      </div>

      {/* ── NOTES + T&C ── */}
      <div style={{ display: 'flex', border: bdr, borderTop: 'none' }}>
        <div style={{ flex: 1, padding: '8px 12px', borderRight: bdr, fontSize: '10px' }}>
          <b style={{ display: 'block', marginBottom: '3px' }}>Notes:</b>
          {invoice.notes || 'Thank you for the Business'}
        </div>
        <div style={{ flex: 2, padding: '8px 12px', fontSize: '10px' }}>
          <b style={{ display: 'block', marginBottom: '3px' }}>Terms and Conditions:</b>
          <ol style={{ paddingLeft: '14px', lineHeight: 1.7 }}>
            <li>Goods once sold cannot be taken back or exchanged.</li>
            <li>Interest @18% p.a. will be charged for uncleared bills beyond 30 days.</li>
            <li>Subject to Maharashtra jurisdiction only.</li>
          </ol>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ marginTop: '10px', fontSize: '10px', color: '#555', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontStyle: 'italic' }}>Page 1 / 1</span>
        <span style={{ fontStyle: 'italic' }}>This is a computer generated document.</span>
      </div>
    </div>
  )
}
