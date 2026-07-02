/**
 * InvoicePrint — GST Tax Invoice
 * Shows CGST + SGST + IGST columns separately
 * GST type determined by customer GSTIN state code
 */
import { useMemo } from 'react'
import { numberToWords } from '../utils'

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

export default function InvoicePrint({ invoice, items, org }) {
  if (!invoice || !org) return null

  const fontFamily = org.invoice_font_family || 'Arial, sans-serif'
  const fontSize = org.invoice_font_size || '11px'
  const descSize = org.invoice_desc_size || '10px'
  const itemBold = org.invoice_item_bold === 'true' || org.invoice_item_bold === '1'

  // ═══ GST STATE DETERMINATION ═══
  const orgStateCode = org.state_code || (org.gstin ? org.gstin.substring(0, 2) : '27')
  const custGstin = invoice.customer_gstin || ''
  const custStateCode = invoice.customer_state_code || (custGstin ? custGstin.substring(0, 2) : '')
  const isIntraState = custStateCode ? (custStateCode === orgStateCode) : (parseFloat(invoice.cgst_amount || 0) > 0)

  // Calculate per-item tax amounts based on determination
  const processedItems = useMemo(() => {
    return items.map(item => {
      const qty = parseFloat(item.quantity) || 0
      const rate = parseFloat(item.rate) || 0
      const taxable = qty * rate
      let cgstAmt = 0, sgstAmt = 0, igstAmt = 0
      let cgstRate = 0, sgstRate = 0, igstRate = 0

      if (isIntraState) {
        cgstRate = parseFloat(item.cgst_rate) || 0
        sgstRate = parseFloat(item.sgst_rate) || 0
        // If stored as IGST but should be CGST+SGST, split it
        if (cgstRate === 0 && parseFloat(item.igst_rate) > 0) {
          cgstRate = (parseFloat(item.igst_rate) || 0) / 2
          sgstRate = cgstRate
        }
        cgstAmt = taxable * cgstRate / 100
        sgstAmt = taxable * sgstRate / 100
      } else {
        igstRate = parseFloat(item.igst_rate) || 0
        // If stored as CGST+SGST but should be IGST, combine it
        if (igstRate === 0 && parseFloat(item.cgst_rate) > 0) {
          igstRate = (parseFloat(item.cgst_rate) || 0) + (parseFloat(item.sgst_rate) || 0)
        }
        igstAmt = taxable * igstRate / 100
      }

      return { ...item, qty, rate, taxable, cgstRate, sgstRate, igstRate, cgstAmt, sgstAmt, igstAmt, totalTax: cgstAmt + sgstAmt + igstAmt }
    })
  }, [items, isIntraState])

  // Totals
  const totalCgst = processedItems.reduce((s, i) => s + i.cgstAmt, 0)
  const totalSgst = processedItems.reduce((s, i) => s + i.sgstAmt, 0)
  const totalIgst = processedItems.reduce((s, i) => s + i.igstAmt, 0)
  const totalTax = totalCgst + totalSgst + totalIgst
  const hasCGST = totalCgst > 0
  const hasIGST = totalIgst > 0

  // Representative rates for display
  const cgstRate = processedItems.length > 0 ? processedItems[0].cgstRate : 0
  const sgstRate = processedItems.length > 0 ? processedItems[0].sgstRate : 0
  const igstRate = processedItems.length > 0 ? processedItems[0].igstRate : 0

  const placeOfSupply = custStateCode
    ? `${custStateCode} - ${invoice.customer_state || STATE_NAMES[custStateCode] || ''}`
    : `${orgStateCode} - ${org.state || STATE_NAMES[orgStateCode] || ''}`

  const invNum = (invoice.invoice_number || '').split('/')[0]
  const invoiceDate = fmtDate(invoice.invoice_date)
  const isPaid = (invoice.payment_status || '').toLowerCase() === 'paid'
  const totalQty = processedItems.reduce((s, i) => s + i.qty, 0)

  // HSN summary
  const hsnMap = useMemo(() => {
    const map = {}
    processedItems.forEach(item => {
      const hsn = item.hsn_code || 'Others'
      if (!map[hsn]) map[hsn] = { taxable: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0 }
      map[hsn].taxable += item.taxable
      map[hsn].cgstRate = item.cgstRate
      map[hsn].sgstRate = item.sgstRate
      map[hsn].igstRate = item.igstRate
      map[hsn].cgstAmt += item.cgstAmt
      map[hsn].sgstAmt += item.sgstAmt
      map[hsn].igstAmt += item.igstAmt
    })
    return map
  }, [processedItems])

  // UPI QR
  const qrImgUrl = useMemo(() => {
    const upiId = org.upi_id || ''
    if (!upiId) return ''
    const name = (org.name || 'GLOB FABRICATION AND ENTERPRISES').replace(/&/g, 'and')
    const amount = parseFloat(invoice.total_amount || 0).toFixed(2)
    const upiStr = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Invoice ' + invNum)}`
    return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiStr)}`
  }, [org.upi_id, org.name, invoice.total_amount, invNum])

  const logoSrc = org.logo_url
  const companyName = (org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()
  const companyInitials = companyName.split(' ').map(w => w[0]).join('').substring(0, 4)

  // ═══ STYLE CONSTANTS ═══
  const bdr = '1.5px solid #333'
  const hdrBg = '#1a2a3a'
  const hdrText = '#fff'
  const titleColor = '#0a2e4f'
  const mutedColor = '#333'
  const lightBg = '#f0f4f8'
  const totalBg = '#0a2e4f'

  const customerFullAddress = [
    invoice.customer_address,
    invoice.customer_city,
    invoice.customer_state ? `${invoice.customer_state}${invoice.customer_pincode ? ' - ' + invoice.customer_pincode : ''}` : '',
  ].filter(Boolean).join(', ')

  // Always show all 3 tax columns (CGST, SGST, IGST)
  return (
    <div className="print-area" style={{
      fontFamily, fontSize, color: '#000', background: '#fff',
      width: '794px', maxWidth: '100%', margin: '0 auto', padding: '12px 14px',
      border: '2px solid #333', boxSizing: 'border-box',
      WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
    }}>

      {/* ── TITLE BAR ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', border: bdr }}>
        <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRight: bdr, background: titleColor }}>
          <div style={{ fontSize: '17px', fontWeight: '900', letterSpacing: '5px', color: '#fff' }}>TAX INVOICE</div>
        </div>
        <div style={{ padding: '10px 14px', fontSize: '10px', fontWeight: '800', textAlign: 'right', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', color: '#000' }}>
          ORIGINAL FOR RECIPIENT
        </div>
      </div>

      {/* ── COMPANY + INVOICE INFO ── */}
      <div style={{ display: 'flex', borderLeft: bdr, borderRight: bdr, borderBottom: bdr }}>
        <div style={{ flex: 1.3, padding: '10px 10px', borderRight: bdr, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: titleColor, overflow: 'hidden' }}>
            {logoSrc
              ? <img src={logoSrc} alt="" style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '50%' }} />
              : <span style={{ color: '#fff', fontSize: '11px', fontWeight: '900', textAlign: 'center', lineHeight: 1.2 }}>{companyInitials}</span>
            }
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', lineHeight: 1.3, color: '#000' }}>{companyName}</div>
            {org.gstin && <div style={{ fontSize: '10px', marginTop: '2px', fontWeight: '800', color: '#000' }}>GSTIN: <b>{org.gstin}</b></div>}
            <div style={{ fontSize: '10px', color: '#000', marginTop: '2px', lineHeight: 1.5, fontWeight: '600' }}>
              {[org.address, org.city, org.state, org.pincode].filter(Boolean).join(', ')}
            </div>
            <div style={{ fontSize: '10px', color: '#000', marginTop: '1px', fontWeight: '600' }}>
              {org.phone && <span><b>Ph:</b> {org.phone} &nbsp;</span>}
              {org.email && <span><b>Email:</b> {org.email}</span>}
            </div>
          </div>
        </div>

        {/* Invoice Details — fixed width */}
        <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: bdr }}>
            <div style={{ flex: 1, padding: '5px 7px', borderRight: bdr }}>
              <div style={{ fontSize: '8.5px', color: mutedColor, fontWeight: '700' }}>Invoice #:</div>
              <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#000' }}>{invNum}</div>
            </div>
            <div style={{ flex: 1, padding: '5px 7px' }}>
              <div style={{ fontSize: '8.5px', color: mutedColor, fontWeight: '700' }}>Date:</div>
              <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#000' }}>{invoiceDate}</div>
            </div>
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ flex: 1, padding: '5px 7px', borderRight: bdr }}>
              <div style={{ fontSize: '8.5px', color: mutedColor, fontWeight: '700' }}>Place of Supply:</div>
              <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#000' }}>{placeOfSupply}</div>
            </div>
            <div style={{ flex: 1, padding: '5px 7px' }}>
              <div style={{ fontSize: '8.5px', color: mutedColor, fontWeight: '700' }}>Rev. Charge:</div>
              <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#000' }}>No</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CUSTOMER "Bill To" ── */}
      <div style={{ display: 'flex', borderLeft: bdr, borderRight: bdr, borderBottom: bdr, minHeight: '80px' }}>
        <div style={{ flex: 1, padding: '8px 10px' }}>
          <div style={{ fontSize: '10px', fontWeight: '900', color: titleColor, textTransform: 'uppercase', letterSpacing: '1px', borderBottom: `2px solid ${titleColor}`, paddingBottom: '3px', marginBottom: '5px' }}>Bill To</div>
          <div style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '2px', lineHeight: 1.3, color: '#000' }}>{(invoice.customer_name || '').toUpperCase()}</div>
          {custGstin && (
            <div style={{ fontSize: '10px', marginBottom: '2px', fontWeight: '700', color: '#000' }}>
              GSTIN: <b>{custGstin}</b>
              <span style={{ marginLeft: '6px', fontSize: '8.5px', color: isIntraState ? '#fff' : '#000', background: isIntraState ? '#155724' : '#fff3cd', padding: '1px 5px', borderRadius: '3px', fontWeight: '800' }}>
                {isIntraState ? 'INTRA-STATE' : 'INTER-STATE'}
              </span>
            </div>
          )}
          {customerFullAddress && <div style={{ fontSize: '10px', color: '#000', lineHeight: 1.5, fontWeight: '600' }}>{customerFullAddress}</div>}
          {invoice.customer_phone && <div style={{ fontSize: '10px', color: '#000', fontWeight: '600' }}>Ph: {invoice.customer_phone}</div>}
        </div>
        {invoice.shipping_name && (
          <div style={{ flex: 1, padding: '8px 10px', borderLeft: bdr }}>
            <div style={{ fontSize: '10px', fontWeight: '900', color: titleColor, textTransform: 'uppercase', letterSpacing: '1px', borderBottom: `2px solid ${titleColor}`, paddingBottom: '3px', marginBottom: '5px' }}>Ship To</div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#000' }}>{invoice.shipping_name}</div>
            <div style={{ fontSize: '10px', color: '#000', lineHeight: 1.5, fontWeight: '600' }}>{[invoice.shipping_address, invoice.shipping_city, invoice.shipping_state].filter(Boolean).join(', ')}</div>
          </div>
        )}
      </div>

      {/* ── ITEMS TABLE — with CGST / SGST / IGST columns ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: bdr, borderTop: 'none', fontSize: '9px', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '24px' }} />
          <col style={{ width: '*' }} />
          <col style={{ width: '50px' }} />
          <col style={{ width: '54px' }} />
          <col style={{ width: '38px' }} />
          <col style={{ width: '62px' }} />
          <col style={{ width: '46px' }} />
          <col style={{ width: '46px' }} />
          <col style={{ width: '46px' }} />
          <col style={{ width: '66px' }} />
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} style={{ background: hdrBg, color: hdrText, padding: '4px 2px', border: bdr, textAlign: 'center', fontWeight: '800' }}>#</th>
            <th rowSpan={2} style={{ background: hdrBg, color: hdrText, padding: '4px 2px', border: bdr, textAlign: 'left', fontWeight: '800' }}>Description</th>
            <th rowSpan={2} style={{ background: hdrBg, color: hdrText, padding: '4px 2px', border: bdr, textAlign: 'center', fontWeight: '800' }}>HSN</th>
            <th rowSpan={2} style={{ background: hdrBg, color: hdrText, padding: '4px 2px', border: bdr, textAlign: 'right', fontWeight: '800' }}>Rate</th>
            <th rowSpan={2} style={{ background: hdrBg, color: hdrText, padding: '4px 2px', border: bdr, textAlign: 'center', fontWeight: '800' }}>Qty</th>
            <th rowSpan={2} style={{ background: hdrBg, color: hdrText, padding: '4px 2px', border: bdr, textAlign: 'right', fontWeight: '800' }}>Taxable</th>
            <th colSpan={3} style={{ background: hdrBg, color: hdrText, padding: '4px 2px', border: bdr, textAlign: 'center', fontWeight: '800' }}>Tax</th>
            <th rowSpan={2} style={{ background: hdrBg, color: hdrText, padding: '4px 2px', border: bdr, textAlign: 'right', fontWeight: '800' }}>Amount</th>
          </tr>
          <tr>
            <th style={{ background: hdrBg, color: '#4fc3f7', padding: '2px 2px', border: bdr, textAlign: 'center', fontWeight: '800', fontSize: '8px' }}>CGST</th>
            <th style={{ background: hdrBg, color: '#ce93d8', padding: '2px 2px', border: bdr, textAlign: 'center', fontWeight: '800', fontSize: '8px' }}>SGST</th>
            <th style={{ background: hdrBg, color: '#ff8a80', padding: '2px 2px', border: bdr, textAlign: 'center', fontWeight: '800', fontSize: '8px' }}>IGST</th>
          </tr>
        </thead>
        <tbody>
          {processedItems.map((item, i) => (
            <tr key={i}>
              <td style={{ padding: '4px 2px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{i + 1}</td>
              <td style={{ padding: '4px 2px', border: bdr, lineHeight: 1.25, whiteSpace: 'pre-line', fontWeight: itemBold ? '800' : '600', fontSize: descSize, color: '#000', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description || ''}</td>
              <td style={{ padding: '4px 2px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{item.hsn_code || '—'}</td>
              <td style={{ padding: '4px 2px', border: bdr, textAlign: 'right', fontWeight: '700', color: '#000' }}>{fmt(item.rate)}</td>
              <td style={{ padding: '4px 2px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{item.qty} {item.unit || ''}</td>
              <td style={{ padding: '4px 2px', border: bdr, textAlign: 'right', fontWeight: '700', color: '#000' }}>{fmt(item.taxable)}</td>
              <td style={{ padding: '4px 2px', border: bdr, textAlign: 'right', fontWeight: '700', color: item.cgstAmt > 0 ? '#000' : '#bbb' }}>
                {item.cgstAmt > 0 ? <>{item.cgstRate}%<br/>₹{fmt(item.cgstAmt)}</> : '—'}
              </td>
              <td style={{ padding: '4px 2px', border: bdr, textAlign: 'right', fontWeight: '700', color: item.sgstAmt > 0 ? '#000' : '#bbb' }}>
                {item.sgstAmt > 0 ? <>{item.sgstRate}%<br/>₹{fmt(item.sgstAmt)}</> : '—'}
              </td>
              <td style={{ padding: '4px 2px', border: bdr, textAlign: 'right', fontWeight: '700', color: item.igstAmt > 0 ? '#000' : '#bbb' }}>
                {item.igstAmt > 0 ? <>{item.igstRate}%<br/>₹{fmt(item.igstAmt)}</> : '—'}
              </td>
              <td style={{ padding: '4px 2px', border: bdr, textAlign: 'right', fontWeight: '900', color: '#000' }}>{fmt(item.taxable + item.totalTax)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── TOTALS ── */}
      <div style={{ display: 'flex', borderLeft: bdr, borderRight: bdr, borderBottom: bdr }}>
        <div style={{ flex: 1.5, padding: '5px 8px', fontSize: '9.5px', borderRight: bdr, fontWeight: '800', color: '#000' }}>
          Total Items / Qty : {items.length} / {totalQty.toFixed(3)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 8px', borderBottom: '1px solid #ccc', fontSize: '9.5px', fontWeight: '800', color: '#000' }}>
            <span>Taxable Amount</span><span>₹{fmt(invoice.subtotal)}</span>
          </div>
          {totalCgst > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 8px', borderBottom: '1px solid #ccc', fontSize: '9.5px', background: '#eef2ff', fontWeight: '700', color: '#000' }}>
              <span>CGST @ {cgstRate}%</span><span>₹{fmt(totalCgst)}</span>
            </div>
          )}
          {totalSgst > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 8px', borderBottom: '1px solid #ccc', fontSize: '9.5px', background: '#eef2ff', fontWeight: '700', color: '#000' }}>
              <span>SGST @ {sgstRate}%</span><span>₹{fmt(totalSgst)}</span>
            </div>
          )}
          {totalIgst > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 8px', borderBottom: '1px solid #ccc', fontSize: '9.5px', background: '#fff8f0', fontWeight: '700', color: '#000' }}>
              <span>IGST @ {igstRate}%</span><span>₹{fmt(totalIgst)}</span>
            </div>
          )}
          {parseFloat(invoice.discount) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 8px', borderBottom: '1px solid #ccc', fontSize: '9.5px', fontWeight: '700', color: '#000' }}>
              <span>Discount</span><span>-₹{fmt(invoice.discount)}</span>
            </div>
          )}
          {parseFloat(invoice.round_off) !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 8px', borderBottom: '1px solid #ccc', fontSize: '9.5px', fontWeight: '700', color: '#000' }}>
              <span>Round Off</span><span>₹{fmt(invoice.round_off)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 8px', fontSize: '12px', fontWeight: '900', background: totalBg, color: '#fff' }}>
            <span>GRAND TOTAL</span><span>₹{fmt(invoice.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* ── AMOUNT IN WORDS ── */}
      <div style={{ border: bdr, borderTop: 'none', padding: '5px 8px', fontSize: '9.5px', fontWeight: '800', background: lightBg, color: '#000' }}>
        <b>Amount Chargeable (in words):</b> INR {numberToWords(invoice.total_amount)}
      </div>

      {/* ── HSN TABLE with CGST/SGST/IGST ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: bdr, borderTop: 'none', fontSize: '9.5px', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ background: hdrBg, color: hdrText, padding: '4px 5px', border: bdr, textAlign: 'left', fontWeight: '800' }}>HSN</th>
            <th style={{ background: hdrBg, color: hdrText, padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '800' }}>Taxable</th>
            <th style={{ background: '#1565c0', color: '#fff', padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '800' }} colSpan={2}>CGST</th>
            <th style={{ background: '#7b1fa2', color: '#fff', padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '800' }} colSpan={2}>SGST</th>
            <th style={{ background: '#c62828', color: '#fff', padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '800' }} colSpan={2}>IGST</th>
            <th style={{ background: hdrBg, color: hdrText, padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '800' }}>Total</th>
          </tr>
          <tr>
            <th style={{ background: hdrBg, padding: '2px 5px', border: bdr }}></th>
            <th style={{ background: hdrBg, padding: '2px 5px', border: bdr }}></th>
            <th style={{ background: '#1565c0', color: '#fff', padding: '2px 5px', border: bdr, textAlign: 'center', fontWeight: '700', fontSize: '8px' }}>Rate</th>
            <th style={{ background: '#1565c0', color: '#fff', padding: '2px 5px', border: bdr, textAlign: 'center', fontWeight: '700', fontSize: '8px' }}>Amt</th>
            <th style={{ background: '#7b1fa2', color: '#fff', padding: '2px 5px', border: bdr, textAlign: 'center', fontWeight: '700', fontSize: '8px' }}>Rate</th>
            <th style={{ background: '#7b1fa2', color: '#fff', padding: '2px 5px', border: bdr, textAlign: 'center', fontWeight: '700', fontSize: '8px' }}>Amt</th>
            <th style={{ background: '#c62828', color: '#fff', padding: '2px 5px', border: bdr, textAlign: 'center', fontWeight: '700', fontSize: '8px' }}>Rate</th>
            <th style={{ background: '#c62828', color: '#fff', padding: '2px 5px', border: bdr, textAlign: 'center', fontWeight: '700', fontSize: '8px' }}>Amt</th>
            <th style={{ background: hdrBg, padding: '2px 5px', border: bdr }}></th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(hsnMap).map(([hsn, d]) => (
            <tr key={hsn}>
              <td style={{ padding: '4px 5px', border: bdr, fontWeight: '700', color: '#000' }}>{hsn}</td>
              <td style={{ padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{fmt(d.taxable)}</td>
              <td style={{ padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '700', color: d.cgstAmt > 0 ? '#000' : '#bbb' }}>{d.cgstRate > 0 ? `${d.cgstRate}%` : '—'}</td>
              <td style={{ padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '700', color: d.cgstAmt > 0 ? '#000' : '#bbb' }}>{d.cgstAmt > 0 ? fmt(d.cgstAmt) : '—'}</td>
              <td style={{ padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '700', color: d.sgstAmt > 0 ? '#000' : '#bbb' }}>{d.sgstRate > 0 ? `${d.sgstRate}%` : '—'}</td>
              <td style={{ padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '700', color: d.sgstAmt > 0 ? '#000' : '#bbb' }}>{d.sgstAmt > 0 ? fmt(d.sgstAmt) : '—'}</td>
              <td style={{ padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '700', color: d.igstAmt > 0 ? '#000' : '#bbb' }}>{d.igstRate > 0 ? `${d.igstRate}%` : '—'}</td>
              <td style={{ padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '700', color: d.igstAmt > 0 ? '#000' : '#bbb' }}>{d.igstAmt > 0 ? fmt(d.igstAmt) : '—'}</td>
              <td style={{ padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '800', color: '#000' }}>{fmt(d.cgstAmt + d.sgstAmt + d.igstAmt)}</td>
            </tr>
          ))}
          <tr style={{ background: lightBg }}>
            <td style={{ padding: '4px 5px', border: bdr, fontWeight: '900', color: '#000' }}>TOTAL</td>
            <td style={{ padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '900', color: '#000' }}>{fmt(invoice.subtotal)}</td>
            <td style={{ padding: '4px 5px', border: bdr }}></td>
            <td style={{ padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '900', color: totalCgst > 0 ? '#000' : '#bbb' }}>{totalCgst > 0 ? fmt(totalCgst) : '—'}</td>
            <td style={{ padding: '4px 5px', border: bdr }}></td>
            <td style={{ padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '900', color: totalSgst > 0 ? '#000' : '#bbb' }}>{totalSgst > 0 ? fmt(totalSgst) : '—'}</td>
            <td style={{ padding: '4px 5px', border: bdr }}></td>
            <td style={{ padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '900', color: totalIgst > 0 ? '#000' : '#bbb' }}>{totalIgst > 0 ? fmt(totalIgst) : '—'}</td>
            <td style={{ padding: '4px 5px', border: bdr, textAlign: 'center', fontWeight: '900', color: '#000' }}>{fmt(totalTax)}</td>
          </tr>
        </tbody>
      </table>

      {/* ── PAYMENT STATUS ── */}
      <div style={{ textAlign: 'right', padding: '4px 8px', border: bdr, borderTop: 'none', fontSize: '9.5px' }}>
        {isPaid ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#c8e6c9', border: '2px solid #2e7d32', borderRadius: '12px', padding: '2px 10px', color: '#1b5e20', fontWeight: '900', fontSize: '9.5px' }}>✔ PAID</span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fff9c4', border: '2px solid #f9a825', borderRadius: '12px', padding: '2px 10px', color: '#e65100', fontWeight: '900', fontSize: '9.5px' }}>● UNPAID</span>
        )}
      </div>

      {/* ── BANK + UPI + SIGNATURE ── */}
      <div style={{ display: 'flex', border: bdr, borderTop: 'none' }}>
        <div style={{ flex: 1.2, padding: '6px 8px', borderRight: bdr, fontSize: '9.5px', lineHeight: 1.8 }}>
          <b style={{ display: 'block', marginBottom: '3px', color: '#000', fontSize: '10px' }}>Bank Details:</b>
          <table style={{ fontSize: '9.5px' }}>
            <tbody>
              {org.bank_name && <tr><td style={{ padding: '1px 5px 1px 0', color: '#000', fontWeight: '700' }}>Bank:</td><td style={{ fontWeight: '800', color: '#000' }}>{org.bank_name}</td></tr>}
              {org.account_no && <tr><td style={{ padding: '1px 5px 1px 0', color: '#000', fontWeight: '700' }}>A/C:</td><td style={{ fontWeight: '800', color: '#000' }}>{org.account_no}</td></tr>}
              {org.ifsc && <tr><td style={{ padding: '1px 5px 1px 0', color: '#000', fontWeight: '700' }}>IFSC:</td><td style={{ fontWeight: '800', color: '#000' }}>{org.ifsc}</td></tr>}
              {org.branch && <tr><td style={{ padding: '1px 5px 1px 0', color: '#000', fontWeight: '700' }}>Branch:</td><td style={{ fontWeight: '800', color: '#000' }}>{org.branch}</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ width: '110px', flexShrink: 0, padding: '6px 8px', borderRight: bdr, textAlign: 'center' }}>
          <b style={{ display: 'block', marginBottom: '3px', fontSize: '9.5px', color: '#000' }}>UPI:</b>
          {qrImgUrl ? (
            <img src={qrImgUrl} alt="QR" style={{ width: '72px', height: '72px', margin: '0 auto', imageRendering: 'pixelated' }} crossOrigin="anonymous" />
          ) : (
            <div style={{ width: '72px', height: '72px', border: '2px solid #333', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '700' }}>QR</div>
          )}
        </div>
        <div style={{ flex: 1, padding: '6px 8px', textAlign: 'center', fontSize: '9.5px' }}>
          <div style={{ textAlign: 'right', marginBottom: '3px', fontSize: '9.5px', fontWeight: '700', color: '#000' }}>For <b>{companyName}</b></div>
          <div style={{ width: '90px', height: '60px', margin: '0 auto 3px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {org.stamp_url && <img src={org.stamp_url} alt="" style={{ position: 'absolute', width: '90px', height: '60px', objectFit: 'contain', opacity: 0.85 }} />}
            {org.signature_url && <img src={org.signature_url} alt="" style={{ position: 'relative', zIndex: 1, maxHeight: '40px', maxWidth: '75px', objectFit: 'contain' }} />}
          </div>
          <div style={{ fontSize: '9px', color: '#000', marginTop: '3px', fontWeight: '700' }}>Authorized Signatory</div>
        </div>
      </div>

      {/* ── NOTES + T&C ── */}
      <div style={{ display: 'flex', border: bdr, borderTop: 'none' }}>
        <div style={{ flex: 1, padding: '5px 8px', borderRight: bdr, fontSize: '9.5px', fontWeight: '700', color: '#000' }}>
          <b style={{ display: 'block', marginBottom: '2px' }}>Notes:</b>
          {invoice.notes || 'Thank you for the Business'}
        </div>
        <div style={{ flex: 2, padding: '5px 8px', fontSize: '9.5px', fontWeight: '700', color: '#000' }}>
          <b style={{ display: 'block', marginBottom: '2px' }}>Terms & Conditions:</b>
          <ol style={{ paddingLeft: '14px', lineHeight: 1.6 }}>
            <li>Goods once sold cannot be taken back or exchanged.</li>
            <li>Interest @18% p.a. will be charged for uncleared bills beyond 30 days.</li>
            <li>Subject to Maharashtra jurisdiction only.</li>
          </ol>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ marginTop: '6px', fontSize: '9px', color: '#000', display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
        <span style={{ fontStyle: 'italic' }}>Page 1 / 1</span>
        <span style={{ fontStyle: 'italic' }}>Computer generated document</span>
      </div>
    </div>
  )
}
