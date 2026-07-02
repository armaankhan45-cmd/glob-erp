/**
 * InvoicePrint — Production-Ready GST Tax Invoice
 * BOLD + DARK text, fits A4 print width perfectly
 * STRICT GST segregation: CGST+SGST for intra-state, IGST for inter-state
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
  // GST STATE DETERMINATION
  // ════════════════════════════════════════════════════════
  const orgStateCode = org.state_code || (org.gstin ? org.gstin.substring(0, 2) : '27')
  const custGstin = invoice.customer_gstin || ''
  const custStateCode = invoice.customer_state_code || (custGstin ? custGstin.substring(0, 2) : '')
  const isIntraState = custStateCode ? (custStateCode === orgStateCode) : (parseFloat(invoice.cgst_amount || 0) > 0)

  const cgstAmount = isIntraState ? parseFloat(invoice.cgst_amount || 0) : 0
  const sgstAmount = isIntraState ? parseFloat(invoice.sgst_amount || 0) : 0
  const igstAmount = !isIntraState ? parseFloat(invoice.igst_amount || 0) : 0

  let displayCgst = cgstAmount
  let displaySgst = sgstAmount
  let displayIgst = igstAmount

  if (isIntraState && cgstAmount === 0 && igstAmount > 0) {
    displayCgst = igstAmount / 2; displaySgst = igstAmount / 2; displayIgst = 0
  } else if (!isIntraState && igstAmount === 0 && cgstAmount > 0) {
    displayIgst = cgstAmount + sgstAmount; displayCgst = 0; displaySgst = 0
  }

  const totalTax = displayCgst + displaySgst + displayIgst
  const hasCGST = displayCgst > 0
  const hasIGST = displayIgst > 0

  const cgstRate = hasCGST ? (items.length > 0 ? parseFloat(items[0].cgst_rate || 0) : 0) : 0
  const sgstRate = hasCGST ? (items.length > 0 ? parseFloat(items[0].sgst_rate || 0) : 0) : 0
  const igstRate = hasIGST ? (items.length > 0 ? parseFloat(items[0].igst_rate || 0) : 0) : 0

  const placeOfSupply = custStateCode
    ? `${custStateCode} - ${invoice.customer_state || STATE_NAMES[custStateCode] || ''}`
    : `${orgStateCode} - ${org.state || STATE_NAMES[orgStateCode] || ''}`

  const invNum = (invoice.invoice_number || '').split('/')[0]
  const invoiceDate = fmtDate(invoice.invoice_date)
  const isPaid = (invoice.payment_status || '').toLowerCase() === 'paid'
  const totalQty = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0)

  /* HSN summary */
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
        map[hsn].cgstRate = 0; map[hsn].sgstRate = 0
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

  // ═══════════════════════════════════════════════
  // STYLE CONSTANTS — BOLD + DARK + A4 FIT
  // ═══════════════════════════════════════════════
  const bdr = '1.5px solid #333'         // Darker thicker borders
  const hdrBg = '#1a2a3a'               // Dark header
  const hdrText = '#fff'                 // White header text
  const titleColor = '#0a2e4f'          // Dark navy title
  const labelColor = '#222'             // Very dark labels
  const valueColor = '#000'             // BLACK text for values
  const mutedColor = '#333'             // Dark muted text
  const lightBg = '#f0f4f8'            // Light blue-gray bg
  const totalBg = '#0a2e4f'            // Dark total bg
  const totalText = '#fff'             // White total text

  // A4 print: 794px width, but we use 100% with max-width to fit properly
  const printWidth = '794px'

  const customerFullAddress = [
    invoice.customer_address,
    invoice.customer_city,
    invoice.customer_state ? `${invoice.customer_state}${invoice.customer_pincode ? ' - ' + invoice.customer_pincode : ''}` : '',
  ].filter(Boolean).join(', ')

  return (
    <div className="print-area" style={{
      fontFamily,
      fontSize,
      color: '#000',
      background: '#fff',
      width: printWidth,
      maxWidth: '100%',
      margin: '0 auto',
      padding: '12px 18px',
      border: `2px solid #333`,
      boxSizing: 'border-box',
      WebkitPrintColorAdjust: 'exact',
      printColorAdjust: 'exact',
    }}>

      {/* ── TITLE BAR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', border: bdr }}>
        <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRight: bdr, background: titleColor }}>
          <div style={{ fontSize: '17px', fontWeight: '900', letterSpacing: '5px', color: '#fff' }}>TAX INVOICE</div>
        </div>
        <div style={{ padding: '10px 16px', fontSize: '10px', fontWeight: '800', textAlign: 'right', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', color: '#000' }}>
          ORIGINAL FOR RECIPIENT
        </div>
      </div>

      {/* ── COMPANY + INVOICE INFO ── */}
      <div style={{ display: 'flex', borderLeft: bdr, borderRight: bdr, borderBottom: bdr }}>
        {/* Company Block */}
        <div style={{ flex: 1.3, padding: '12px 12px', borderRight: bdr, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: titleColor, overflow: 'hidden'
          }}>
            {logoSrc
              ? <img src={logoSrc} alt="" style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '50%' }} />
              : <span style={{ color: '#fff', fontSize: '11px', fontWeight: '900', textAlign: 'center', lineHeight: 1.2 }}>{companyInitials}</span>
            }
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', lineHeight: 1.3, color: '#000' }}>{companyName}</div>
            {org.gstin && <div style={{ fontSize: '10.5px', marginTop: '3px', fontWeight: '700', color: '#000' }}>GSTIN: <b>{org.gstin}</b></div>}
            <div style={{ fontSize: '10.5px', color: '#000', marginTop: '3px', lineHeight: 1.6, fontWeight: '600' }}>
              {[org.address, org.city, org.state, org.pincode].filter(Boolean).join(', ')}
            </div>
            <div style={{ fontSize: '10.5px', color: '#000', marginTop: '2px', fontWeight: '600' }}>
              {org.phone && <span><b>Mobile:</b> {org.phone} &nbsp;</span>}
              {org.email && <span><b>Email:</b> {org.email}</span>}
            </div>
          </div>
        </div>

        {/* Invoice Details — Fixed width so it doesn't overflow */}
        <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: bdr }}>
            <div style={{ flex: 1, padding: '6px 8px', borderRight: bdr }}>
              <div style={{ fontSize: '9px', color: mutedColor, fontWeight: '700' }}>Invoice #:</div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#000' }}>{invNum}</div>
            </div>
            <div style={{ flex: 1, padding: '6px 8px' }}>
              <div style={{ fontSize: '9px', color: mutedColor, fontWeight: '700' }}>Invoice Date:</div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#000' }}>{invoiceDate}</div>
            </div>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ flex: 1, padding: '6px 8px', borderRight: bdr }}>
              <div style={{ fontSize: '9px', color: mutedColor, fontWeight: '700' }}>Place of Supply:</div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#000' }}>{placeOfSupply}</div>
            </div>
            <div style={{ flex: 1, padding: '6px 8px' }}>
              <div style={{ fontSize: '9px', color: mutedColor, fontWeight: '700' }}>Reverse Charge:</div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#000' }}>No</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CUSTOMER DETAILS — "Bill To" Layout ── */}
      <div style={{ display: 'flex', borderLeft: bdr, borderRight: bdr, borderBottom: bdr, minHeight: '85px' }}>
        <div style={{ flex: 1, padding: '8px 12px' }}>
          <div style={{ fontSize: '10px', fontWeight: '900', color: titleColor, textTransform: 'uppercase', letterSpacing: '1px', borderBottom: `2px solid ${titleColor}`, paddingBottom: '3px', marginBottom: '6px' }}>Bill To</div>
          <div style={{ fontSize: '13px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '3px', lineHeight: 1.3, color: '#000' }}>{(invoice.customer_name || '').toUpperCase()}</div>
          {custGstin && (
            <div style={{ fontSize: '10.5px', marginBottom: '2px', fontWeight: '700', color: '#000' }}>
              GSTIN: <b>{custGstin}</b>
              <span style={{ marginLeft: '8px', fontSize: '9px', color: isIntraState ? '#fff' : '#000', background: isIntraState ? '#155724' : '#fff3cd', padding: '1px 6px', borderRadius: '3px', fontWeight: '800' }}>
                {isIntraState ? 'INTRA-STATE' : 'INTER-STATE'}
              </span>
            </div>
          )}
          {customerFullAddress && (
            <div style={{ fontSize: '10.5px', color: '#000', lineHeight: 1.5, fontWeight: '600' }}>{customerFullAddress}</div>
          )}
          {invoice.customer_phone && (
            <div style={{ fontSize: '10.5px', color: '#000', fontWeight: '600' }}>Ph: {invoice.customer_phone}</div>
          )}
        </div>

        {invoice.shipping_name && (
          <div style={{ flex: 1, padding: '8px 12px', borderLeft: bdr }}>
            <div style={{ fontSize: '10px', fontWeight: '900', color: titleColor, textTransform: 'uppercase', letterSpacing: '1px', borderBottom: `2px solid ${titleColor}`, paddingBottom: '3px', marginBottom: '6px' }}>Ship To</div>
            <div style={{ fontSize: '11px', fontWeight: '800', marginBottom: '2px', color: '#000' }}>{invoice.shipping_name}</div>
            <div style={{ fontSize: '10.5px', color: '#000', lineHeight: 1.5, fontWeight: '600' }}>
              {[invoice.shipping_address, invoice.shipping_city, invoice.shipping_state].filter(Boolean).join(', ')}
            </div>
          </div>
        )}
      </div>

      {/* ── ITEMS TABLE — BOLD + DARK ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: bdr, borderTop: 'none', fontSize: '10px', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '28px' }} />
          <col style={{ width: '*' }} />
          <col style={{ width: '62px' }} />
          <col style={{ width: '68px' }} />
          <col style={{ width: '48px' }} />
          <col style={{ width: '78px' }} />
          <col style={{ width: '68px' }} />
          <col style={{ width: '78px' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ background: hdrBg, color: hdrText, padding: '6px 4px', border: bdr, textAlign: 'center', fontWeight: '800' }}>#</th>
            <th style={{ background: hdrBg, color: hdrText, padding: '6px 4px', border: bdr, textAlign: 'left', fontWeight: '800' }}>Item Description</th>
            <th style={{ background: hdrBg, color: hdrText, padding: '6px 4px', border: bdr, textAlign: 'center', fontWeight: '800' }}>HSN</th>
            <th style={{ background: hdrBg, color: hdrText, padding: '6px 4px', border: bdr, textAlign: 'right', fontWeight: '800' }}>Rate</th>
            <th style={{ background: hdrBg, color: hdrText, padding: '6px 4px', border: bdr, textAlign: 'center', fontWeight: '800' }}>Qty</th>
            <th style={{ background: hdrBg, color: hdrText, padding: '6px 4px', border: bdr, textAlign: 'right', fontWeight: '800' }}>Taxable</th>
            <th style={{ background: hdrBg, color: hdrText, padding: '6px 4px', border: bdr, textAlign: 'right', fontWeight: '800' }}>Tax</th>
            <th style={{ background: hdrBg, color: hdrText, padding: '6px 4px', border: bdr, textAlign: 'right', fontWeight: '800' }}>Amount</th>
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
                <td style={{ padding: '5px 4px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{i + 1}</td>
                <td style={{ padding: '5px 4px', border: bdr, lineHeight: 1.3, whiteSpace: 'pre-line', fontWeight: itemBold ? '800' : '600', fontSize: descSize, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description || ''}</td>
                <td style={{ padding: '5px 4px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{item.hsn_code || '—'}</td>
                <td style={{ padding: '5px 4px', border: bdr, textAlign: 'right', fontWeight: '700', color: '#000' }}>{fmt(rate)}</td>
                <td style={{ padding: '5px 4px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{qty} {item.unit || ''}</td>
                <td style={{ padding: '5px 4px', border: bdr, textAlign: 'right', fontWeight: '700', color: '#000' }}>{fmt(taxable)}</td>
                <td style={{ padding: '5px 4px', border: bdr, textAlign: 'right', fontWeight: '700', color: '#000' }}>{fmt(taxAmt)}</td>
                <td style={{ padding: '5px 4px', border: bdr, textAlign: 'right', fontWeight: '900', color: '#000' }}>{fmt(taxable + taxAmt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ── TOTALS — BOLD + DARK ── */}
      <div style={{ display: 'flex', borderLeft: bdr, borderRight: bdr, borderBottom: bdr }}>
        <div style={{ flex: 1.5, padding: '6px 10px', fontSize: '10px', borderRight: bdr, fontWeight: '800', color: '#000' }}>
          Total Items / Qty : {items.length} / {totalQty.toFixed(3)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', borderBottom: '1px solid #ccc', fontSize: '10px', fontWeight: '800', color: '#000' }}>
            <span>Taxable Amount</span><span>₹{fmt(invoice.subtotal)}</span>
          </div>
          {hasCGST && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', borderBottom: '1px solid #ccc', fontSize: '10px', background: '#eef2ff', fontWeight: '700', color: '#000' }}>
                <span>CGST @ {cgstRate.toFixed(1)}%</span><span>₹{fmt(displayCgst)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', borderBottom: '1px solid #ccc', fontSize: '10px', background: '#eef2ff', fontWeight: '700', color: '#000' }}>
                <span>SGST @ {sgstRate.toFixed(1)}%</span><span>₹{fmt(displaySgst)}</span>
              </div>
            </>
          )}
          {hasIGST && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', borderBottom: '1px solid #ccc', fontSize: '10px', background: '#fff8f0', fontWeight: '700', color: '#000' }}>
              <span>IGST @ {igstRate.toFixed(1)}%</span><span>₹{fmt(displayIgst)}</span>
            </div>
          )}
          {parseFloat(invoice.discount) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', borderBottom: '1px solid #ccc', fontSize: '10px', fontWeight: '700', color: '#000' }}>
              <span>Discount</span><span>-₹{fmt(invoice.discount)}</span>
            </div>
          )}
          {parseFloat(invoice.round_off) !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', borderBottom: '1px solid #ccc', fontSize: '10px', fontWeight: '700', color: '#000' }}>
              <span>Round Off</span><span>₹{fmt(invoice.round_off)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', fontSize: '13px', fontWeight: '900', background: totalBg, color: totalText }}>
            <span>GRAND TOTAL</span><span>₹{fmt(invoice.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* ── AMOUNT IN WORDS ── */}
      <div style={{ border: bdr, borderTop: 'none', padding: '6px 10px', fontSize: '10px', fontWeight: '800', background: lightBg, color: '#000' }}>
        <b>Amount Chargeable (in words):</b> INR {numberToWords(invoice.total_amount)}
      </div>

      {/* ── HSN TABLE — BOLD + DARK ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: bdr, borderTop: 'none', fontSize: '10px', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ background: hdrBg, color: hdrText, padding: '5px 6px', border: bdr, textAlign: 'left', fontWeight: '800' }}>HSN</th>
            <th style={{ background: hdrBg, color: hdrText, padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '800' }}>Taxable</th>
            {hasCGST ? (
              <>
                <th style={{ background: hdrBg, color: hdrText, padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '800' }} colSpan={2}>Central Tax</th>
                <th style={{ background: hdrBg, color: hdrText, padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '800' }} colSpan={2}>State/UT Tax</th>
              </>
            ) : (
              <th style={{ background: hdrBg, color: hdrText, padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '800' }} colSpan={2}>Integrated Tax</th>
            )}
            <th style={{ background: hdrBg, color: hdrText, padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '800' }}>Total Tax</th>
          </tr>
          <tr>
            <th style={{ background: hdrBg, color: hdrText, padding: '3px 6px', border: bdr }}></th>
            <th style={{ background: hdrBg, color: hdrText, padding: '3px 6px', border: bdr }}></th>
            {hasCGST ? (
              <>
                <th style={{ background: hdrBg, color: hdrText, padding: '3px 6px', border: bdr, textAlign: 'center', fontWeight: '700' }}>Rate</th>
                <th style={{ background: hdrBg, color: hdrText, padding: '3px 6px', border: bdr, textAlign: 'center', fontWeight: '700' }}>Amt</th>
                <th style={{ background: hdrBg, color: hdrText, padding: '3px 6px', border: bdr, textAlign: 'center', fontWeight: '700' }}>Rate</th>
                <th style={{ background: hdrBg, color: hdrText, padding: '3px 6px', border: bdr, textAlign: 'center', fontWeight: '700' }}>Amt</th>
              </>
            ) : (
              <>
                <th style={{ background: hdrBg, color: hdrText, padding: '3px 6px', border: bdr, textAlign: 'center', fontWeight: '700' }}>Rate</th>
                <th style={{ background: hdrBg, color: hdrText, padding: '3px 6px', border: bdr, textAlign: 'center', fontWeight: '700' }}>Amt</th>
              </>
            )}
            <th style={{ background: hdrBg, color: hdrText, padding: '3px 6px', border: bdr }}></th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(hsnMap).map(([hsn, d]) => (
            <tr key={hsn}>
              <td style={{ padding: '5px 6px', border: bdr, textAlign: 'left', fontWeight: '700', color: '#000' }}>{hsn}</td>
              <td style={{ padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{fmt(d.taxable)}</td>
              {hasCGST ? (
                <>
                  <td style={{ padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{d.cgstRate}%</td>
                  <td style={{ padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{fmt(d.cgstAmt)}</td>
                  <td style={{ padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{d.sgstRate}%</td>
                  <td style={{ padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{fmt(d.sgstAmt)}</td>
                </>
              ) : (
                <>
                  <td style={{ padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{d.igstRate}%</td>
                  <td style={{ padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{fmt(d.igstAmt)}</td>
                </>
              )}
              <td style={{ padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '800', color: '#000' }}>{fmt(d.cgstAmt + d.sgstAmt + d.igstAmt)}</td>
            </tr>
          ))}
          <tr style={{ background: lightBg }}>
            <td style={{ padding: '5px 6px', border: bdr, textAlign: 'left', fontWeight: '900', color: '#000' }}>TOTAL</td>
            <td style={{ padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '900', color: '#000' }}>{fmt(invoice.subtotal)}</td>
            {hasCGST ? (
              <>
                <td style={{ padding: '5px 6px', border: bdr }}></td>
                <td style={{ padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '900', color: '#000' }}>{fmt(displayCgst)}</td>
                <td style={{ padding: '5px 6px', border: bdr }}></td>
                <td style={{ padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '900', color: '#000' }}>{fmt(displaySgst)}</td>
              </>
            ) : (
              <>
                <td style={{ padding: '5px 6px', border: bdr }}></td>
                <td style={{ padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '900', color: '#000' }}>{fmt(displayIgst)}</td>
              </>
            )}
            <td style={{ padding: '5px 6px', border: bdr, textAlign: 'center', fontWeight: '900', color: '#000' }}>{fmt(totalTax)}</td>
          </tr>
        </tbody>
      </table>

      {/* ── PAYMENT STATUS ── */}
      <div style={{ textAlign: 'right', padding: '5px 10px', border: bdr, borderTop: 'none', fontSize: '10px' }}>
        {isPaid ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#c8e6c9', border: '2px solid #2e7d32', borderRadius: '12px', padding: '3px 12px', color: '#1b5e20', fontWeight: '900', fontSize: '10px' }}>✔ AMOUNT PAID</span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fff9c4', border: '2px solid #f9a825', borderRadius: '12px', padding: '3px 12px', color: '#e65100', fontWeight: '900', fontSize: '10px' }}>● UNPAID</span>
        )}
      </div>

      {/* ── BANK + UPI + SIGNATURE ── */}
      <div style={{ display: 'flex', border: bdr, borderTop: 'none' }}>
        <div style={{ flex: 1.2, padding: '8px 10px', borderRight: bdr, fontSize: '10px', lineHeight: 1.9 }}>
          <b style={{ display: 'block', marginBottom: '4px', color: '#000', fontSize: '11px' }}>Bank Details:</b>
          <table style={{ fontSize: '10px' }}>
            <tbody>
              {org.bank_name && <tr><td style={{ padding: '1px 6px 1px 0', color: '#000', fontWeight: '700' }}>Bank:</td><td style={{ fontWeight: '800', color: '#000' }}>{org.bank_name}</td></tr>}
              {org.account_no && <tr><td style={{ padding: '1px 6px 1px 0', color: '#000', fontWeight: '700' }}>A/C #:</td><td style={{ fontWeight: '800', color: '#000' }}>{org.account_no}</td></tr>}
              {org.ifsc && <tr><td style={{ padding: '1px 6px 1px 0', color: '#000', fontWeight: '700' }}>IFSC:</td><td style={{ fontWeight: '800', color: '#000' }}>{org.ifsc}</td></tr>}
              {org.branch && <tr><td style={{ padding: '1px 6px 1px 0', color: '#000', fontWeight: '700' }}>Branch:</td><td style={{ fontWeight: '800', color: '#000' }}>{org.branch}</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ width: '120px', flexShrink: 0, padding: '8px 10px', borderRight: bdr, textAlign: 'center' }}>
          <b style={{ display: 'block', marginBottom: '4px', fontSize: '10px', color: '#000' }}>Pay via UPI:</b>
          {qrImgUrl ? (
            <img src={qrImgUrl} alt="UPI QR" style={{ width: '80px', height: '80px', margin: '0 auto', imageRendering: 'pixelated' }} crossOrigin="anonymous" />
          ) : (
            <div style={{ width: '80px', height: '80px', border: '2px solid #333', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#000', fontWeight: '700' }}>QR CODE</div>
          )}
        </div>
        <div style={{ flex: 1, padding: '8px 10px', textAlign: 'center', fontSize: '10px' }}>
          <div style={{ textAlign: 'right', marginBottom: '4px', fontSize: '10px', fontWeight: '700', color: '#000' }}>For <b>{companyName}</b></div>
          <div style={{
            width: '100px', height: '70px',
            margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative'
          }}>
            {org.stamp_url && <img src={org.stamp_url} alt="" style={{ position: 'absolute', width: '100px', height: '70px', objectFit: 'contain', opacity: 0.85 }} />}
            {org.signature_url && <img src={org.signature_url} alt="" style={{ position: 'relative', zIndex: 1, maxHeight: '45px', maxWidth: '80px', objectFit: 'contain' }} />}
          </div>
          <div style={{ fontSize: '9.5px', color: '#000', marginTop: '4px', fontWeight: '700' }}>Authorized Signatory</div>
        </div>
      </div>

      {/* ── NOTES + T&C ── */}
      <div style={{ display: 'flex', border: bdr, borderTop: 'none' }}>
        <div style={{ flex: 1, padding: '6px 10px', borderRight: bdr, fontSize: '10px', fontWeight: '700', color: '#000' }}>
          <b style={{ display: 'block', marginBottom: '3px' }}>Notes:</b>
          {invoice.notes || 'Thank you for the Business'}
        </div>
        <div style={{ flex: 2, padding: '6px 10px', fontSize: '10px', fontWeight: '700', color: '#000' }}>
          <b style={{ display: 'block', marginBottom: '3px' }}>Terms and Conditions:</b>
          <ol style={{ paddingLeft: '14px', lineHeight: 1.7 }}>
            <li>Goods once sold cannot be taken back or exchanged.</li>
            <li>Interest @18% p.a. will be charged for uncleared bills beyond 30 days.</li>
            <li>Subject to Maharashtra jurisdiction only.</li>
          </ol>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ marginTop: '8px', fontSize: '10px', color: '#000', display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
        <span style={{ fontStyle: 'italic' }}>Page 1 / 1</span>
        <span style={{ fontStyle: 'italic' }}>This is a computer generated document.</span>
      </div>
    </div>
  )
}
