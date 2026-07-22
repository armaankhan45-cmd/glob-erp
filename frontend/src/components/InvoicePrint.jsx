/**
 * InvoicePrint — GST Tax Invoice (A4-optimized, PRO layout)
 * - Company details CLEARLY VISIBLE with white text on dark navy
 * - Fits A4 paper (210mm × 297mm) properly
 * - CGST + SGST + IGST columns
 * - HSN summary, bank details, UPI QR, stamp/signature
 */
import { useMemo } from 'react'
import { numberToWordsCaps } from '../utils'

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
  const fontSize = org.invoice_font_size || '10px'
  const descSize = org.invoice_desc_size || '9px'
  const itemBold = org.invoice_item_bold === 'true' || org.invoice_item_bold === '1'

  const orgStateCode = org.state_code || (org.gstin ? org.gstin.substring(0, 2) : '27')
  const custGstin = invoice.customer_gstin || ''
  const custStateCode = invoice.customer_state_code || (custGstin ? custGstin.substring(0, 2) : '')
  const isIntraState = custStateCode ? (custStateCode === orgStateCode) : (parseFloat(invoice.cgst_amount || 0) > 0)

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
        if (cgstRate === 0 && parseFloat(item.igst_rate) > 0) {
          cgstRate = (parseFloat(item.igst_rate) || 0) / 2
          sgstRate = cgstRate
        }
        cgstAmt = taxable * cgstRate / 100
        sgstAmt = taxable * sgstRate / 100
      } else {
        igstRate = parseFloat(item.igst_rate) || 0
        if (igstRate === 0 && parseFloat(item.cgst_rate) > 0) {
          igstRate = (parseFloat(item.cgst_rate) || 0) + (parseFloat(item.sgst_rate) || 0)
        }
        igstAmt = taxable * igstRate / 100
      }
      return { ...item, qty, rate, taxable, cgstRate, sgstRate, igstRate, cgstAmt, sgstAmt, igstAmt, totalTax: cgstAmt + sgstAmt + igstAmt }
    })
  }, [items, isIntraState])

  const totalCgst = processedItems.reduce((s, i) => s + i.cgstAmt, 0)
  const totalSgst = processedItems.reduce((s, i) => s + i.sgstAmt, 0)
  const totalIgst = processedItems.reduce((s, i) => s + i.igstAmt, 0)
  const totalTax = totalCgst + totalSgst + totalIgst
  const hasCGST = totalCgst > 0
  const hasIGST = totalIgst > 0
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

  const hsnMap = useMemo(() => {
    const map = {}
    processedItems.forEach(item => {
      const hsn = item.hsn_code || 'Others'
      if (!map[hsn]) map[hsn] = { taxable: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, cgstAmt: 0, sgstAmt: 0, igstAmt: 0 }
      map[hsn].taxable += item.taxable
      map[hsn].cgstRate = item.cgstRate; map[hsn].sgstRate = item.sgstRate; map[hsn].igstRate = item.igstRate
      map[hsn].cgstAmt += item.cgstAmt; map[hsn].sgstAmt += item.sgstAmt; map[hsn].igstAmt += item.igstAmt
    })
    return map
  }, [processedItems])

  const qrImgUrl = useMemo(() => {
    const upiId = org.upi_id || ''
    if (!upiId) return ''
    const name = (org.name || 'GLOB FABRICATION AND ENTERPRISES').replace(/&/g, 'and')
    const amount = parseFloat(invoice.total_amount || 0).toFixed(2)
    const upiStr = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Invoice ' + invNum)}`
    return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(upiStr)}`
  }, [org.upi_id, org.name, invoice.total_amount, invNum])

  const logoSrc = org.logo_url
  const companyName = (org.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()

  // ═══ STYLE — A4 FITTING ═══
  const bdr = '1px solid #444'
  const navyBg = '#0d1f3c'
  const navyLight = '#162d54'

  const customerFullAddress = [
    invoice.customer_address,
    invoice.customer_city,
    invoice.customer_state ? `${invoice.customer_state}${invoice.customer_pincode ? ' - ' + invoice.customer_pincode : ''}` : '',
  ].filter(Boolean).join(', ')

  const amountWords = numberToWordsCaps(invoice.total_amount || 0)

  return (
    <div className="print-area" style={{
      fontFamily, fontSize, color: '#000', background: '#fff',
      width: '210mm', minHeight: '297mm', margin: '0 auto', padding: '8mm 12mm',
      boxSizing: 'border-box',
      WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
      lineHeight: 1.4,
    }}>

      {/* ══ PRO HEADER: B&W print-safe — dark text, light bg, navy accents ══ */}
      <div style={{ borderRadius: '4px 4px 0 0', borderTop: `4px solid ${navyBg}`, borderBottom: `2px solid ${navyBg}`, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {logoSrc ? (
            <img src={logoSrc} alt="" style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', border: `2px solid ${navyBg}`, flexShrink: 0 }} />
          ) : (
            <div style={{ width: '48px', height: '48px', borderRadius: '6px', background: navyBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '900', fontSize: '14px', flexShrink: 0 }}>
              {companyName.split(' ').map(w => w[0]).join('').substring(0, 3)}
            </div>
          )}
          <div>
            <div style={{ fontSize: '17px', fontWeight: '900', color: '#1a1a2e', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{companyName}</div>
            {org.gstin && <div style={{ fontSize: '10.5px', color: '#1a1a2e', fontWeight: '700', marginTop: '2px' }}>GSTIN: {org.gstin}</div>}
            <div style={{ fontSize: '10px', color: '#333', marginTop: '1px', fontWeight: '600' }}>
              {[org.address, org.city, org.state, org.pincode].filter(Boolean).join(', ')}
            </div>
            <div style={{ fontSize: '10px', color: '#333', fontWeight: '600' }}>
              {org.phone && <span>Ph: {org.phone} &nbsp;</span>}
              {org.email && <span>{org.email}</span>}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: '900', color: navyBg, letterSpacing: '4px' }}>TAX INVOICE</div>
          <div style={{ fontSize: '8px', color: '#555', marginTop: '2px', fontWeight: '600' }}>ORIGINAL FOR RECIPIENT</div>
        </div>
      </div>

      {/* ══ INVOICE INFO BAR ══ */}
      <div style={{ display: 'flex', border: bdr, borderTop: 'none', background: '#f5f7fa' }}>
        <div style={{ flex: 1, padding: '6px 10px', borderRight: bdr }}>
          <span style={{ fontSize: '9px', color: '#666', fontWeight: '700' }}>Invoice #:</span>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#000', marginLeft: '4px' }}>{invNum}</span>
        </div>
        <div style={{ flex: 1, padding: '6px 10px', borderRight: bdr }}>
          <span style={{ fontSize: '9px', color: '#666', fontWeight: '700' }}>Date:</span>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#000', marginLeft: '4px' }}>{invoiceDate}</span>
        </div>
        <div style={{ flex: 1, padding: '6px 10px', borderRight: bdr }}>
          <span style={{ fontSize: '9px', color: '#666', fontWeight: '700' }}>Place of Supply:</span>
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#000', marginLeft: '4px' }}>{placeOfSupply}</span>
        </div>
        <div style={{ flex: 1, padding: '6px 10px', textAlign: 'right' }}>
          {isPaid ? (
            <span style={{ background: '#c8e6c9', border: '1.5px solid #2e7d32', borderRadius: '10px', padding: '1px 8px', color: '#1b5e20', fontWeight: '900', fontSize: '9.5px' }}>✔ PAID</span>
          ) : (
            <span style={{ background: '#fff9c4', border: '1.5px solid #f9a825', borderRadius: '10px', padding: '1px 8px', color: '#e65100', fontWeight: '900', fontSize: '9.5px' }}>● UNPAID</span>
          )}
        </div>
      </div>

      {/* ══ BUYER INFO ══ */}
      <div style={{ border: bdr, borderTop: 'none', padding: '6px 10px', display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '9px', color: '#666', fontWeight: '700', marginBottom: '2px' }}>Buyer (Bill To):</div>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#000', textTransform: 'uppercase' }}>{invoice.customer_name || 'N/A'}</div>
          {custGstin && <div style={{ fontSize: '10px', fontWeight: '700', color: '#000', marginTop: '1px' }}>GSTIN: {custGstin}</div>}
          {customerFullAddress && <div style={{ fontSize: '10px', color: '#333', marginTop: '1px', fontWeight: '600' }}>{customerFullAddress}</div>}
        </div>
      </div>

      {/* ══ ITEMS TABLE ══ */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: bdr, borderTop: 'none', fontSize: '10.5px', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '5%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '30%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '8%' }} />
        </colgroup>
        <thead>
          <tr style={{ background: '#e0e4e8', color: '#1a1a2e' }}>
            <th style={{ padding: '5px 4px', border: bdr, fontWeight: '800', textAlign: 'center', fontSize: '10px', color: '#1a1a2e' }}>Sr</th>
            <th style={{ padding: '5px 4px', border: bdr, fontWeight: '800', fontSize: '10px', color: '#1a1a2e' }}>HSN</th>
            <th style={{ padding: '5px 4px', border: bdr, fontWeight: '800', fontSize: '10px', color: '#1a1a2e' }}>Description</th>
            <th style={{ padding: '5px 4px', border: bdr, fontWeight: '800', textAlign: 'center', fontSize: '10px', color: '#1a1a2e' }}>Qty</th>
            <th style={{ padding: '5px 4px', border: bdr, fontWeight: '800', textAlign: 'center', fontSize: '10px', color: '#1a1a2e' }}>Unit</th>
            <th style={{ padding: '5px 4px', border: bdr, fontWeight: '800', textAlign: 'right', fontSize: '10px', color: '#1a1a2e' }}>Rate</th>
            <th style={{ padding: '5px 4px', border: bdr, fontWeight: '800', textAlign: 'right', fontSize: '10px', color: '#1a1a2e' }}>Amount</th>
            <th style={{ padding: '5px 4px', border: bdr, fontWeight: '800', textAlign: 'center', fontSize: '10px', color: '#1a1a2e' }}>GST%</th>
            <th style={{ padding: '5px 4px', border: bdr, fontWeight: '800', textAlign: 'right', fontSize: '10px', color: '#1a1a2e' }}>GST Amt</th>
          </tr>
        </thead>
        <tbody>
          {processedItems.map((item, i) => {
            const gstPct = isIntraState ? item.cgstRate + item.sgstRate : item.igstRate
            return (
              <tr key={i}>
                <td style={{ padding: '4px 4px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{i + 1}</td>
                <td style={{ padding: '4px 4px', border: bdr, fontWeight: '700', color: '#000', fontSize: '9.5px' }}>{item.hsn_code || '—'}</td>
                <td style={{ padding: '4px 4px', border: bdr, fontWeight: itemBold ? '700' : '500', color: '#000', fontSize: descSize, lineHeight: 1.3 }}>{item.description || ''}</td>
                <td style={{ padding: '4px 4px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{item.qty}</td>
                <td style={{ padding: '4px 4px', border: bdr, textAlign: 'center', fontWeight: '600', color: '#000' }}>{item.unit || 'NOS'}</td>
                <td style={{ padding: '4px 4px', border: bdr, textAlign: 'right', fontWeight: '700', color: '#000' }}>₹{fmt(item.rate)}</td>
                <td style={{ padding: '4px 4px', border: bdr, textAlign: 'right', fontWeight: '700', color: '#000' }}>₹{fmt(item.taxable)}</td>
                <td style={{ padding: '4px 4px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{gstPct}%</td>
                <td style={{ padding: '4px 4px', border: bdr, textAlign: 'right', fontWeight: '700', color: '#000' }}>₹{fmt(item.totalTax)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* ══ TOTALS — Full width, no gap, bigger fonts ══ */}
      {/* Amount in Words row */}
      <div style={{ border: bdr, borderTop: 'none', padding: '5px 10px', background: '#f9fafb' }}>
        <div style={{ fontSize: '11px', fontWeight: '800', color: '#000' }}>Amount in Words:</div>
        <div style={{ fontSize: '12px', fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{amountWords} ONLY</div>
      </div>
      {/* Summary rows — full width */}
      <div style={{ border: bdr, borderTop: 'none' }}>
        <div style={{ display: 'flex', borderBottom: bdr }}>
          <div style={{ flex: 1, padding: '4px 10px', fontSize: '10.5px', fontWeight: '700', color: '#000' }}>Subtotal</div>
          <div style={{ width: '180px', padding: '4px 10px', textAlign: 'right', fontSize: '10.5px', fontWeight: '800', color: '#000' }}>₹{fmt(invoice.subtotal)}</div>
        </div>
        {hasCGST && (
          <div style={{ display: 'flex', borderBottom: bdr }}>
            <div style={{ flex: 1, padding: '4px 10px', fontSize: '10.5px', fontWeight: '700', color: '#1565c0' }}>CGST {cgstRate}%</div>
            <div style={{ width: '180px', padding: '4px 10px', textAlign: 'right', fontSize: '10.5px', fontWeight: '800', color: '#1565c0' }}>₹{fmt(totalCgst)}</div>
          </div>
        )}
        {hasCGST && (
          <div style={{ display: 'flex', borderBottom: bdr }}>
            <div style={{ flex: 1, padding: '4px 10px', fontSize: '10.5px', fontWeight: '700', color: '#7b1fa2' }}>SGST {sgstRate}%</div>
            <div style={{ width: '180px', padding: '4px 10px', textAlign: 'right', fontSize: '10.5px', fontWeight: '800', color: '#7b1fa2' }}>₹{fmt(totalSgst)}</div>
          </div>
        )}
        {hasIGST && (
          <div style={{ display: 'flex', borderBottom: bdr }}>
            <div style={{ flex: 1, padding: '4px 10px', fontSize: '10.5px', fontWeight: '700', color: '#c62828' }}>IGST {igstRate}%</div>
            <div style={{ width: '180px', padding: '4px 10px', textAlign: 'right', fontSize: '10.5px', fontWeight: '800', color: '#c62828' }}>₹{fmt(totalIgst)}</div>
          </div>
        )}
        {parseFloat(invoice.discount) > 0 && (
          <div style={{ display: 'flex', borderBottom: bdr }}>
            <div style={{ flex: 1, padding: '4px 10px', fontSize: '10.5px', fontWeight: '700', color: '#000' }}>Discount</div>
            <div style={{ width: '180px', padding: '4px 10px', textAlign: 'right', fontSize: '10.5px', fontWeight: '800', color: '#000' }}>-₹{fmt(invoice.discount)}</div>
          </div>
        )}
        {parseFloat(invoice.round_off) !== 0 && (
          <div style={{ display: 'flex', borderBottom: bdr }}>
            <div style={{ flex: 1, padding: '4px 10px', fontSize: '10.5px', fontWeight: '700', color: '#000' }}>Round Off</div>
            <div style={{ width: '180px', padding: '4px 10px', textAlign: 'right', fontSize: '10.5px', fontWeight: '800', color: '#000' }}>{parseFloat(invoice.round_off) > 0 ? '+' : ''}₹{fmt(Math.abs(invoice.round_off))}</div>
          </div>
        )}
        <div style={{ display: 'flex', background: '#d5dae0' }}>
          <div style={{ flex: 1, padding: '6px 10px', fontSize: '13px', fontWeight: '900', color: '#1a1a2e' }}>Total</div>
          <div style={{ width: '180px', padding: '6px 10px', textAlign: 'right', fontSize: '13px', fontWeight: '900', color: '#1a1a2e' }}>₹{fmt(invoice.total_amount)}</div>
        </div>
      </div>

      {/* ══ HSN SUMMARY ══ */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: bdr, borderTop: 'none', fontSize: '9.5px', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{ background: '#e8ecf0', padding: '4px 5px', border: bdr, fontWeight: '800', textAlign: 'left', fontSize: '9.5px', color: '#1a1a2e' }}>HSN</th>
            <th style={{ background: '#e8ecf0', padding: '4px 5px', border: bdr, fontWeight: '800', textAlign: 'center', fontSize: '9.5px', color: '#1a1a2e' }}>Taxable</th>
            <th style={{ background: '#e8ecf0', padding: '4px 5px', border: bdr, fontWeight: '800', textAlign: 'center', fontSize: '9.5px', color: '#1565c0' }} colSpan={2}>CGST</th>
            <th style={{ background: '#e8ecf0', padding: '4px 5px', border: bdr, fontWeight: '800', textAlign: 'center', fontSize: '9.5px', color: '#7b1fa2' }} colSpan={2}>SGST</th>
            <th style={{ background: '#e8ecf0', padding: '4px 5px', border: bdr, fontWeight: '800', textAlign: 'center', fontSize: '9.5px', color: '#c62828' }} colSpan={2}>IGST</th>
            <th style={{ background: '#e8ecf0', padding: '4px 5px', border: bdr, fontWeight: '800', textAlign: 'center', fontSize: '9.5px', color: '#1a1a2e' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(hsnMap).map(([hsn, d]) => (
            <tr key={hsn}>
              <td style={{ padding: '3px 5px', border: bdr, fontWeight: '700', color: '#000' }}>{hsn}</td>
              <td style={{ padding: '3px 5px', border: bdr, textAlign: 'center', fontWeight: '700', color: '#000' }}>{fmt(d.taxable)}</td>
              <td style={{ padding: '3px 5px', border: bdr, textAlign: 'center', color: d.cgstAmt > 0 ? '#000' : '#bbb', fontWeight: '700' }}>{d.cgstRate > 0 ? `${d.cgstRate}%` : '—'}</td>
              <td style={{ padding: '3px 5px', border: bdr, textAlign: 'center', color: d.cgstAmt > 0 ? '#000' : '#bbb', fontWeight: '700' }}>{d.cgstAmt > 0 ? fmt(d.cgstAmt) : '—'}</td>
              <td style={{ padding: '3px 5px', border: bdr, textAlign: 'center', color: d.sgstAmt > 0 ? '#000' : '#bbb', fontWeight: '700' }}>{d.sgstRate > 0 ? `${d.sgstRate}%` : '—'}</td>
              <td style={{ padding: '3px 5px', border: bdr, textAlign: 'center', color: d.sgstAmt > 0 ? '#000' : '#bbb', fontWeight: '700' }}>{d.sgstAmt > 0 ? fmt(d.sgstAmt) : '—'}</td>
              <td style={{ padding: '3px 5px', border: bdr, textAlign: 'center', color: d.igstAmt > 0 ? '#000' : '#bbb', fontWeight: '700' }}>{d.igstRate > 0 ? `${d.igstRate}%` : '—'}</td>
              <td style={{ padding: '3px 5px', border: bdr, textAlign: 'center', color: d.igstAmt > 0 ? '#000' : '#bbb', fontWeight: '700' }}>{d.igstAmt > 0 ? fmt(d.igstAmt) : '—'}</td>
              <td style={{ padding: '3px 5px', border: bdr, textAlign: 'center', fontWeight: '800', color: '#000' }}>{fmt(d.cgstAmt + d.sgstAmt + d.igstAmt)}</td>
            </tr>
          ))}
          <tr style={{ background: '#f0f4f8' }}>
            <td style={{ padding: '3px 5px', border: bdr, fontWeight: '900', color: '#000' }}>TOTAL</td>
            <td style={{ padding: '3px 5px', border: bdr, textAlign: 'center', fontWeight: '900', color: '#000' }}>{fmt(invoice.subtotal)}</td>
            <td style={{ padding: '3px 5px', border: bdr }}></td>
            <td style={{ padding: '3px 5px', border: bdr, textAlign: 'center', fontWeight: '900', color: totalCgst > 0 ? '#000' : '#bbb' }}>{totalCgst > 0 ? fmt(totalCgst) : '—'}</td>
            <td style={{ padding: '3px 5px', border: bdr }}></td>
            <td style={{ padding: '3px 5px', border: bdr, textAlign: 'center', fontWeight: '900', color: totalSgst > 0 ? '#000' : '#bbb' }}>{totalSgst > 0 ? fmt(totalSgst) : '—'}</td>
            <td style={{ padding: '3px 5px', border: bdr }}></td>
            <td style={{ padding: '3px 5px', border: bdr, textAlign: 'center', fontWeight: '900', color: totalIgst > 0 ? '#000' : '#bbb' }}>{totalIgst > 0 ? fmt(totalIgst) : '—'}</td>
            <td style={{ padding: '3px 5px', border: bdr, textAlign: 'center', fontWeight: '900', color: '#000' }}>{fmt(totalTax)}</td>
          </tr>
        </tbody>
      </table>

      {/* ══ BANK + UPI + SIGNATURE ══ */}
      <div style={{ display: 'flex', border: bdr, borderTop: 'none' }}>
        <div style={{ flex: 1.2, padding: '6px 10px', borderRight: bdr, fontSize: '10px', lineHeight: 1.7 }}>
          <b style={{ display: 'block', marginBottom: '2px', color: '#000', fontSize: '10.5px' }}>Bank Details:</b>
          {org.bank_name && <div style={{ fontWeight: '700', color: '#000' }}>Bank: <b>{org.bank_name}</b></div>}
          {org.account_no && <div style={{ fontWeight: '700', color: '#000' }}>A/C: <b>{org.account_no}</b></div>}
          {org.ifsc && <div style={{ fontWeight: '700', color: '#000' }}>IFSC: <b>{org.ifsc}</b></div>}
          {org.branch && <div style={{ fontWeight: '700', color: '#000' }}>Branch: <b>{org.branch}</b></div>}
        </div>
        <div style={{ width: '100px', flexShrink: 0, padding: '5px 8px', borderRight: bdr, textAlign: 'center' }}>
          <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#000', marginBottom: '2px' }}>UPI:</div>
          {qrImgUrl ? (
            <img src={qrImgUrl} alt="QR" style={{ width: '65px', height: '65px', margin: '0 auto', imageRendering: 'pixelated' }} crossOrigin="anonymous" />
          ) : (
            <div style={{ width: '65px', height: '65px', border: '1.5px solid #333', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '700' }}>QR</div>
          )}
        </div>
        <div style={{ flex: 1, padding: '5px 10px', textAlign: 'center', fontSize: '10px', overflow: 'hidden' }}>
          <div style={{ textAlign: 'right', marginBottom: '2px', fontWeight: '700', color: '#000' }}>For <b>{companyName}</b></div>
          <div style={{ width: '90px', height: '55px', margin: '0 auto 2px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            {org.stamp_url && <img src={org.stamp_url} alt="" style={{ position: 'absolute', maxWidth: '90px', maxHeight: '55px', objectFit: 'contain', opacity: 0.85 }} />}
            {org.signature_url && <img src={org.signature_url} alt="" style={{ position: 'relative', zIndex: 1, maxHeight: '35px', maxWidth: '60px', objectFit: 'contain' }} />}
          </div>
          <div style={{ fontSize: '9.5px', color: '#000', fontWeight: '700' }}>Authorized Signatory</div>
        </div>
      </div>

      {/* ══ NOTES + T&C ══ */}
      <div style={{ display: 'flex', border: bdr, borderTop: 'none' }}>
        <div style={{ flex: 1, padding: '5px 10px', borderRight: bdr, fontSize: '10px', fontWeight: '700', color: '#000' }}>
          <b>Notes:</b> {invoice.notes || 'Thank you for the Business'}
        </div>
        <div style={{ flex: 2, padding: '5px 10px', fontSize: '10px', fontWeight: '700', color: '#000' }}>
          <b>Terms & Conditions:</b>
          <ol style={{ paddingLeft: '14px', lineHeight: 1.5, margin: 0 }}>
            <li>Goods once sold cannot be taken back or exchanged.</li>
            <li>Interest @18% p.a. will be charged for uncleared bills beyond 30 days.</li>
            <li>Subject to Maharashtra jurisdiction only.</li>
          </ol>
        </div>
      </div>

      {/* ══ FOOTER ══ */}
      <div style={{ marginTop: '4px', fontSize: '9px', color: '#666', display: 'flex', justifyContent: 'space-between', fontWeight: '600' }}>
        <span>Page 1 / 1</span>
        <span>Computer generated document</span>
      </div>
    </div>
  )
}
