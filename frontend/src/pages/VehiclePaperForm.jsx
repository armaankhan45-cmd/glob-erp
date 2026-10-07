import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Printer, Download, Save, Trash2, Upload, X, Check } from 'lucide-react'
import { numberToWordsCaps, downloadPdf, printElement } from '../utils'
import { PAPER_TYPES } from './VehiclePapers'

// ═══════════════════════════════════════════════════════════════
// VEHICLE PAPER EDITOR
// Layouts match the company's own paper formats EXACTLY:
//   1. Margin Money Receipt  — centred bold paragraph on letterhead
//   2. Form 22-A             — green heading + certificate lines (tanker)
//   3. Form 17               — scanned image + CHASSIS / ENGINE below
//   4. Vahan Paper           — receipt image + CHASSIS / ENGINE below
// ═══════════════════════════════════════════════════════════════

const PAYMENT_MODES = ['Cash', 'Cheque', 'NEFT', 'RTGS', 'NEFT / RTGS', 'UPI', 'Bank Transfer', 'Other']

function todayISO() { return new Date().toISOString().slice(0, 10) }

function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return String(d)
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
}

function amountText(n) {
  const v = parseFloat(n)
  if (isNaN(v) || v === 0) return ''
  return Number.isInteger(v) ? String(v) : v.toFixed(2)
}

export function defaultData(type) {
  const sigBlock = type === 'form_17' || type === 'vahan'
  return {
    // common print options
    heading: type === 'money_receipt' ? 'MARGIN MONEY RECEIPT' : (PAPER_TYPES[type]?.label || 'VEHICLE PAPER').toUpperCase(),
    printHeader: type === 'money_receipt' || type === 'form_22a',
    letterheadMm: 0,
    footerMm: 0,
    showSignature: type === 'form_22a' ? false : true,
    sigStyle: sigBlock || type === 'form_22a' ? 'block' : 'plain',
    fontFamily: 'Arial',

    // ── Margin Money Receipt ──
    modeText: 'NEFT',              // word printed in the sentence ("… 500000/- NEFT RECEIVED")
    wordsOverride: '',             // blank = auto "(FIVE LAKH ONLY )" from the amount
    hypothecation: '',             // e.g. STATE BANK OF INDIA
    customParagraph: '',           // optional full override of the sentence
    showDetailsBox: false,         // extra box with UTR / bank / vehicle / chassis etc.

    // ── Form 22-A ──
    ruleLine: "SEE RULE 47 (G) 124'126-A AND 127",
    partLine: 'PART – II',
    issuedBy: 'TO BE ISSUED BY THE TANKER',
    bodyType: 'TANKER',
    closingText: "HAS BEEN FABRICATED TANKER BY US AND THE SAME COMPLIES WITH\nTHE PROVISION OF THE MOTOR\nVEHICLES ACT' 1988 AND THE RULES MADE THERE UNDER.",
    greenHeading: true,
    contentTopMm: 22,

    // ── Form 17 / Vahan ──
    showTitle: false,
    showDetails: false,
    imageBorder: true,
  }
}

// ───────────────────────────────────────────────────────────────
// Small UI pieces
// ───────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text', options, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {options ? (
        <select value={value || ''} onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-sm"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', outline: 'none' }}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full px-3 py-2 rounded-xl text-sm"
          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', outline: 'none' }} />
      )}
    </div>
  )
}

function Area({ label, value, onChange, rows = 3, placeholder, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <textarea rows={rows} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl text-sm resize-y"
        style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', outline: 'none' }} />
    </div>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={{
        background: checked ? 'rgba(var(--accent-rgb),0.15)' : 'var(--bg-input)',
        border: `1px solid ${checked ? 'rgba(var(--accent-rgb),0.45)' : 'var(--border-input)'}`,
        color: checked ? 'var(--accent)' : 'var(--text-muted)',
      }}>
      <span className="w-3.5 h-3.5 rounded flex items-center justify-center" style={{ border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--text-muted)'}` }}>
        {checked && <Check size={10} />}
      </span>
      {label}
    </button>
  )
}

// ───────────────────────────────────────────────────────────────
// A4 sheet + shared blocks
// ───────────────────────────────────────────────────────────────
function Sheet({ org, opts, children }) {
  const font = opts.fontFamily || 'Arial'
  return (
    <div className="print-area" style={{
      width: '210mm', minHeight: '297mm', background: '#fff', color: '#000',
      fontFamily: `'${font}', Arial, Helvetica, sans-serif`, display: 'flex', flexDirection: 'column',
      padding: '0 12mm', boxSizing: 'border-box',
      WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
    }}>
      {(parseInt(opts.letterheadMm) || 0) > 0 && <div style={{ height: (parseInt(opts.letterheadMm) || 0) + 'mm', flexShrink: 0 }} />}
      {opts.printHeader && <CompanyHeader org={org} />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      {(parseInt(opts.footerMm) || 0) > 0 && <div style={{ height: (parseInt(opts.footerMm) || 0) + 'mm', flexShrink: 0 }} />}
    </div>
  )
}

function CompanyHeader({ org }) {
  const name = (org?.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()
  const addr = [org?.address, org?.city, org?.state, org?.pincode].filter(Boolean).join(', ')
  return (
    <div style={{ textAlign: 'center', padding: '3mm 0', borderBottom: '2.5px solid #000', fontFamily: 'inherit' }}>
      {org?.logo_url && <img src={org.logo_url} alt="" style={{ height: '15mm', objectFit: 'contain', marginBottom: '1mm' }} />}
      <div style={{ fontSize: '18pt', fontWeight: 900, letterSpacing: '0.5px' }}>{name}</div>
      {addr && <div style={{ fontSize: '9.5pt' }}>{addr}</div>}
      <div style={{ fontSize: '9.5pt' }}>
        {org?.phone ? `Ph: ${org.phone}` : ''}{org?.email ? `  |  ${org.email}` : ''}{org?.gstin ? `  |  GSTIN: ${org.gstin}` : ''}
      </div>
    </div>
  )
}

/** Stamp + signature block — used for Form 17 / Vahan (and optionally 22-A) */
function SignBlock({ org, show = true, minHeight = '24mm' }) {
  if (!show) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8mm' }}>
      <div style={{ position: 'relative', width: '68mm', minHeight, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {org?.stamp_url && (
          <img src={org.stamp_url} alt="" style={{ position: 'absolute', left: '50%', bottom: '7mm', transform: 'translateX(-50%)', width: '40mm', opacity: 0.9 }} />
        )}
        {org?.signature_url && (
          <img src={org.signature_url} alt="" style={{ position: 'absolute', left: '55%', bottom: '10mm', transform: 'translateX(-50%)', width: '34mm' }} />
        )}
        <div style={{ borderTop: '1.2px solid #000', paddingTop: '1.5mm', fontWeight: 700, fontSize: '10pt' }}>
          For {(org?.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()}
        </div>
        <div style={{ fontSize: '9pt' }}>Authorised Signatory</div>
      </div>
    </div>
  )
}

/** Plain "SIGNATURE :" line — exactly as on the company's margin money receipt */
function PlainSignature() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '26mm' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: '13.5pt', letterSpacing: '1.5px' }}>SIGNATURE :</div>
        <div style={{ width: '38mm', height: '2px', background: '#4a90d9', margin: '1.5mm auto 0' }} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// PAPER 1 — MARGIN MONEY RECEIPT
//   WE ARE ACCOUNTING A SUM OF RS:- 500000/- NEFT RECEIVED
//   (FIVE LAKH ONLY ) ON DATE 20/09/2026 OF PAYMENT TO US FROM
//   SHIV TRANSPORT ON ACCOUNT OF TATA MOTORS SIGNA 4932.T
//   AND WITH HYPOTHECATION :- STATE BANK OF INDIA
//                                    SIGNATURE :
// ═══════════════════════════════════════════════════════════════
export function MoneyReceiptPaper({ rec, org, opts }) {
  const amount = amountText(rec.amount)
  const words = (opts.wordsOverride || '').trim() ||
    (parseFloat(rec.amount) > 0 ? numberToWordsCaps(parseFloat(rec.amount)).replace(' RUPEES', '').replace('RUPEES ', '') : '')
  const mode = (opts.modeText || '').trim() || 'NEFT'
  const customer = (rec.customer_name || '').toUpperCase()
  const vehicle = [rec.model, rec.vehicle_no].filter(Boolean).join(' ').toUpperCase()
  const bank = (opts.hypothecation || '').toUpperCase()

  const custom = (opts.customParagraph || '').trim()

  const L = { fontWeight: 800, fontSize: '13.5pt', textAlign: 'center', lineHeight: 1.5, marginBottom: '5.5mm', letterSpacing: '0.2px' }

  return (
    <Sheet org={org} opts={opts}>
      <div style={{ paddingTop: (opts.contentTopMm ?? 22) + 'mm' }}>
        {/* Heading */}
        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '14pt', letterSpacing: '1.2px', marginBottom: '16mm', textTransform: 'uppercase' }}>
          {opts.heading || 'MARGIN MONEY RECEIPT'}
        </div>

        {custom ? (
          <div style={{ ...L, whiteSpace: 'pre-line' }}>{custom}</div>
        ) : (
          <div>
            <div style={L}>
              WE ARE ACCOUNTING A SUM OF <span style={{ borderBottom: '1.5px solid #000' }}>RS:- {amount}/-</span> {mode} RECEIVED
            </div>
            <div style={L}>
              ({words}{words ? ' ' : ''}) ON DATE <span style={{ borderBottom: '1.5px solid #000' }}>{fmtDate(rec.paper_date)}</span> OF PAYMENT TO US FROM
            </div>
            <div style={L}>
              <span style={{ borderBottom: '1.5px solid #000' }}>{customer || '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}</span>
              {vehicle ? <> ON ACCOUNT OF <span style={{ borderBottom: '1.5px solid #000' }}>{vehicle}</span></> : null}
            </div>
            <div style={L}>
              AND WITH HYPOTHECATION :- <span style={{ borderBottom: '1.5px solid #000' }}>{bank || '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}</span>
            </div>
          </div>
        )}

        {/* Optional extra details */}
        {opts.showDetailsBox && (
          <div style={{ border: '1.2px solid #000', marginTop: '10mm', fontSize: '10pt', fontWeight: 600 }}>
            {[
              ['Payment Mode', rec.payment_mode || mode],
              ['Cheque / Ref / UTR No.', rec.reference],
              ['Bank', rec.bank_name],
              ['Vehicle No.', rec.vehicle_no],
              ['Chassis No.', rec.chassis_no],
              ['Engine No.', rec.engine_no],
              ['Balance Amount', rec.balance_amount ? 'Rs. ' + amountText(rec.balance_amount) + '/-' : ''],
              ['Remarks', rec.notes],
            ].filter(([, v]) => v).map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', borderBottom: '1px solid #999' }}>
                <div style={{ width: '55mm', padding: '1.5mm 3mm', borderRight: '1px solid #999' }}>{k}</div>
                <div style={{ flex: 1, padding: '1.5mm 3mm', whiteSpace: 'pre-line' }}>{String(v).toUpperCase()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Signature — plain (exact format) or stamp+signature block */}
      <div style={{ flex: 1 }} />
      {opts.showSignature !== false && (
        opts.sigStyle === 'block'
          ? <SignBlock org={org} show minHeight="22mm" />
          : <PlainSignature />
      )}
    </Sheet>
  )
}

// ═══════════════════════════════════════════════════════════════
// PAPER 2 — FORM 22 (A)   [exact company format]
//   FORM22 (A)
//   SEE RULE 47 (G) 124'126-A AND 127
//   PART – II
//   TO BE ISSUED BY THE TANKER
//   CERTIFIED THAT TANKER OF TATA SIGNA 4832 BSVI 10X2
//   CHASSIS BEARING CHASSIS NO.: MAT566136T1H24001
//   AND ENGINE.NO:- B6.7B62320D14162H64616434
//   HAS BEEN FABRICATED TANKER BY US AND THE SAME COMPLIES WITH …
// ═══════════════════════════════════════════════════════════════
export function Form22APaper({ rec, org, opts }) {
  const body = (opts.bodyType || 'TANKER').toUpperCase()
  const model = (rec.model || '').toUpperCase()
  const chassis = (rec.chassis_no || '').toUpperCase()
  const engine = (rec.engine_no || '').toUpperCase()

  const L = {
    fontWeight: 800, fontSize: '13.5pt', textAlign: 'center', lineHeight: 1.6,
    marginBottom: '6mm', color: '#000', letterSpacing: '0.2px',
  }
  const blank = (w = '70mm') => <span style={{ display: 'inline-block', minWidth: w, borderBottom: '1.5px solid #000', height: '1em' }}>&nbsp;</span>

  return (
    <Sheet org={org} opts={opts}>
      <div style={{ paddingTop: (opts.contentTopMm ?? 22) + 'mm' }}>
        {/* FORM22 (A) — green as in the company's format */}
        <div style={{
          textAlign: 'center', fontWeight: 900, fontSize: '22pt', letterSpacing: '1.5px',
          color: opts.greenHeading !== false ? '#008000' : '#000', marginBottom: '9mm',
        }}>
          {opts.heading || 'FORM22 (A)'}
        </div>

        <div style={{ ...L, fontSize: '12.5pt' }}>{opts.ruleLine || "SEE RULE 47 (G) 124'126-A AND 127"}</div>
        <div style={L}>{opts.partLine || 'PART – II'}</div>
        <div style={L}>{opts.issuedBy || 'TO BE ISSUED BY THE TANKER'}</div>

        <div style={{ height: '4mm' }} />

        <div style={L}>
          CERTIFIED THAT {body} OF {model || blank('90mm')}
        </div>

        <div style={L}>
          CHASSIS BEARING CHASSIS NO.: {chassis || blank('80mm')}
        </div>

        <div style={L}>
          AND ENGINE.NO:- {engine || blank('80mm')}
        </div>

        <div style={{ height: '4mm' }} />

        <div style={{ ...L, marginBottom: 0, whiteSpace: 'pre-line' }}>
          {(opts.closingText || "HAS BEEN FABRICATED TANKER BY US AND THE SAME COMPLIES WITH\nTHE PROVISION OF THE MOTOR\nVEHICLES ACT' 1988 AND THE RULES MADE THERE UNDER.")}
        </div>
      </div>

      <div style={{ flex: 1 }} />
      {opts.showSignature && <SignBlock org={org} show minHeight="22mm" />}
    </Sheet>
  )
}

// ═══════════════════════════════════════════════════════════════
// PAPERS 3 & 4 — FORM 17 / VAHAN PAPER
// Scanned paper image on top  +  CHASSIS NO. / ENGINE NO. below it
// ═══════════════════════════════════════════════════════════════
export function ImageSheetPaper({ rec, org, opts }) {
  const heading = (opts.heading || (rec.type === 'vahan' ? 'VAHAN PAPER' : 'FORM 17')).toUpperCase()
  const details = [
    rec.vehicle_no ? { l: 'Vehicle No.', v: rec.vehicle_no } : null,
    rec.model ? { l: 'Make / Model', v: rec.model } : null,
    rec.customer_name ? { l: 'Customer', v: rec.customer_name } : null,
    { l: 'Date', v: fmtDate(rec.paper_date) },
  ].filter(Boolean)

  return (
    <Sheet org={org} opts={opts}>
      {opts.showTitle && (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '3mm' }}>
          <div style={{ fontSize: '18pt', fontWeight: 900, letterSpacing: '1px', textDecoration: 'underline' }}>{heading}</div>
          <div style={{ textAlign: 'right', fontSize: '10.5pt', fontWeight: 700 }}>
            {rec.paper_no ? <div>No. : <b>{rec.paper_no}</b></div> : null}
            <div>Date : <b>{fmtDate(rec.paper_date)}</b></div>
          </div>
        </div>
      )}

      {opts.showDetails && details.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', border: '1.5px solid #000', marginTop: '3mm' }}>
          {details.map((row, i) => (
            <div key={i} style={{ flex: '1 1 30%', padding: '2mm 3mm', borderRight: i < details.length - 1 ? '1px solid #999' : 'none' }}>
              <div style={{ fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{row.l}</div>
              <div style={{ fontSize: '10.5pt', fontWeight: 700 }}>{String(row.v).toUpperCase()}</div>
            </div>
          ))}
        </div>
      )}

      {/* IMAGE — fills the page, Chassis/Engine print directly under it */}
      <div style={{
        border: opts.imageBorder !== false ? '1.5px solid #000' : 'none',
        marginTop: (opts.showTitle || opts.showDetails) ? '3mm' : '2mm',
        flex: 1, minHeight: '150mm',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#fff',
      }}>
        {rec.image_data ? (
          <img src={rec.image_data} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ textAlign: 'center', border: '2px dashed #999', borderRadius: '2mm', padding: '16mm 20mm', color: '#666' }}>
            <div style={{ fontSize: '12pt', fontWeight: 700 }}>IMAGE / PHOTO OF THE PAPER</div>
            <div style={{ fontSize: '9.5pt', marginTop: '1.5mm' }}>Upload the scan from the editor panel — it prints exactly here, with the<br />chassis &amp; engine numbers printed below.</div>
          </div>
        )}
      </div>

      {/* CHASSIS + ENGINE directly below the image */}
      <div style={{ border: '2px solid #000', borderTop: '2px solid #000', marginTop: '2mm' }}>
        <div style={{ display: 'flex' }}>
          <div style={{ width: '42mm', padding: '3mm', borderRight: '1.5px solid #000', background: '#f0f0f0', display: 'flex', alignItems: 'center' }}>
            <b style={{ fontSize: '11pt' }}>CHASSIS NO.</b>
          </div>
          <div style={{ flex: 1, padding: '3mm 4mm', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '15pt', fontWeight: 800, letterSpacing: '1.5px' }}>
              {rec.chassis_no ? rec.chassis_no.toUpperCase() : <span style={{ display: 'inline-block', width: '110mm', borderBottom: '1.5px dotted #333' }}>&nbsp;</span>}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', borderTop: '1.5px solid #000' }}>
          <div style={{ width: '42mm', padding: '3mm', borderRight: '1.5px solid #000', background: '#f0f0f0', display: 'flex', alignItems: 'center' }}>
            <b style={{ fontSize: '11pt' }}>ENGINE NO.</b>
          </div>
          <div style={{ flex: 1, padding: '3mm 4mm', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '15pt', fontWeight: 800, letterSpacing: '1.5px' }}>
              {rec.engine_no ? rec.engine_no.toUpperCase() : <span style={{ display: 'inline-block', width: '110mm', borderBottom: '1.5px dotted #333' }}>&nbsp;</span>}
            </span>
          </div>
        </div>
      </div>

      {rec.notes && (
        <div style={{ marginTop: '2.5mm', fontSize: '9.5pt', whiteSpace: 'pre-line' }}>
          <b>Remarks : </b>{rec.notes}
        </div>
      )}

      <SignBlock org={org} show={opts.showSignature !== false} minHeight="20mm" />
    </Sheet>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN EDITOR
// ═══════════════════════════════════════════════════════════════
export default function VehiclePaperForm() {
  const { type: typeParam, id } = useParams()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [rec, setRec] = useState(() => {
    const t = typeParam && PAPER_TYPES[typeParam] ? typeParam : 'money_receipt'
    return {
      type: t, paper_no: '', paper_date: todayISO(), title: '',
      customer_id: null, customer_name: '', customer_address: '', customer_gstin: '', customer_phone: '',
      vehicle_no: '', chassis_no: '', engine_no: '', model: '',
      amount: '', payment_mode: 'NEFT', reference: '', bank_name: '', reference_date: '',
      towards: 'Margin money for tanker / body fabrication work', balance_amount: '', notes: '',
      image_data: '', data: defaultData(t),
    }
  })
  const [org, setOrg] = useState(null)
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(!!id)
  const [recordId, setRecordId] = useState(id || null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const meta = PAPER_TYPES[rec.type] || PAPER_TYPES.money_receipt
  const set = (k, v) => setRec(prev => ({ ...prev, [k]: v }))
  const setD = (k, v) => setRec(prev => ({ ...prev, data: { ...(prev.data || {}), [k]: v } }))
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const isImageSheet = rec.type === 'form_17' || rec.type === 'vahan'
  const isLetterheadPaper = rec.type === 'money_receipt' || rec.type === 'form_22a'

  // ── Load org settings + customers ──
  useEffect(() => {
    api.get('/settings').then(res => {
      const o = res.data.organization || {}
      setOrg(o)
      setRec(prev => ({
        ...prev,
        data: {
          ...prev.data,
          letterheadMm: id ? (prev.data?.letterheadMm ?? 0)
            : (isLetterheadPaper ? (parseInt(o.print_letterhead_mm) || 0) : 0),
          footerMm: id ? (prev.data?.footerMm ?? 0) : (parseInt(o.print_footer_mm) || 0),
          printHeader: id ? !!prev.data?.printHeader : (isLetterheadPaper && !(parseInt(o.print_letterhead_mm) > 0)),
        },
      }))
    }).catch(() => {})
    api.get('/customers').then(res => setCustomers(res.data.customers || [])).catch(() => {})
  }, []) // eslint-disable-line

  // ── Load existing record OR next number ──
  useEffect(() => {
    let alive = true
    if (id) {
      setLoading(true)
      api.get(`/vehicle-papers/${id}`).then(res => {
        if (!alive) return
        const p = res.data.paper
        setRec({
          ...p,
          amount: p.amount ?? '',
          balance_amount: p.balance_amount ?? '',
          data: { ...defaultData(p.type), ...(p.data || {}) },
        })
        setRecordId(p.id)
      }).catch(() => { alert('Paper not found'); navigate('/app/vehicle-papers') })
        .finally(() => { if (alive) setLoading(false) })
    } else {
      const t = typeParam && PAPER_TYPES[typeParam] ? typeParam : 'money_receipt'
      api.get(`/vehicle-papers/next-number?type=${t}`).then(res => {
        if (alive) set('paper_no', res.data.nextNumber)
      }).catch(() => {})
    }
    return () => { alive = false }
  }, [id]) // eslint-disable-line

  // ── Customer autofill ──
  const pickCustomer = (name) => {
    const c = customers.find(x => (x.name || '').toLowerCase() === (name || '').toLowerCase())
    if (c) {
      setRec(prev => ({
        ...prev,
        customer_name: c.name || prev.customer_name,
        customer_id: c.id,
        customer_address: c.address || prev.customer_address,
        customer_gstin: c.gstin || prev.customer_gstin,
        customer_phone: c.phone || prev.customer_phone,
      }))
    } else {
      set('customer_name', name)
    }
  }

  // ── Image upload (downscaled so the database stays small) ──
  const handleImage = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('Please choose an image file (JPG / PNG)'); return }
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const img = new Image()
          img.onload = () => {
            const maxDim = 1600
            const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(img.width * scale)
            canvas.height = Math.round(img.height * scale)
            const ctx = canvas.getContext('2d')
            ctx.fillStyle = '#fff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            resolve(canvas.toDataURL('image/jpeg', 0.85))
          }
          img.onerror = () => reject(new Error('Could not read image'))
          img.src = reader.result
        }
        reader.onerror = () => reject(new Error('Could not read file'))
        reader.readAsDataURL(file)
      })
      set('image_data', dataUrl)
      showToast('Image added ✓')
    } catch (e) { alert('Image upload failed: ' + e.message) }
  }

  // ── Save / Delete ──
  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { ...rec, data: rec.data || {} }
      if (recordId) {
        await api.put(`/vehicle-papers/${recordId}`, payload)
        showToast('Saved ✓')
      } else {
        const res = await api.post('/vehicle-papers', payload)
        setRecordId(res.data.paper.id)
        showToast('Saved ✓')
      }
    } catch (e) {
      alert(e.response?.data?.msg || 'Save failed — is the backend awake?')
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!recordId) return
    if (!confirm('Delete this saved paper?')) return
    try { await api.delete(`/vehicle-papers/${recordId}`); navigate('/app/vehicle-papers') }
    catch (e) { alert('Delete failed') }
  }

  const handlePrint = async () => {
    const el = document.querySelector('.print-area')
    await printElement(el, rec.paper_no || meta.label)
  }

  const handlePdf = async () => {
    const el = document.querySelector('.print-area')
    const name = (rec.paper_no || meta.short).replace(/[\\/]/g, '-')
    try { await downloadPdf(el, `${meta.short.replace(/\s/g, '')}_${name}.pdf`) }
    catch (e) { alert('PDF failed: ' + e.message) }
  }

  const opts = rec.data || {}
  const words = (opts.wordsOverride || '').trim() ||
    (parseFloat(rec.amount) > 0 ? numberToWordsCaps(parseFloat(rec.amount)).replace(' RUPEES', '').replace('RUPEES ', '') : '')

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} /></div>

  return (
    <div className="space-y-4">
      {/* ═══ ACTION BAR ═══ */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button onClick={() => navigate('/app/vehicle-papers')} className="p-2 rounded-xl hover:bg-white/5" style={{ color: 'var(--text-muted)' }}><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold text-white flex-1">
          {meta.label}
          {rec.paper_no && <span className="text-sm font-normal ml-2" style={{ color: 'var(--text-muted)' }}>{rec.paper_no}</span>}
        </h1>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 btn-shine disabled:opacity-50">
          <Save size={16} /> {saving ? 'Saving…' : recordId ? 'Update' : 'Save'}
        </button>
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 btn-shine"><Printer size={16} /> Print</button>
        <button onClick={handlePdf} className="btn-secondary flex items-center gap-2 btn-shine"><Download size={16} /> PDF</button>
        {recordId && <button onClick={handleDelete} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>}
      </div>

      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-xl"
          style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>{toast}</div>
      )}

      {/* ═══ PRINT SETTINGS STRIP ═══ */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl no-print" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Print</span>
        <Toggle label="Company header" checked={!!opts.printHeader} onChange={v => setD('printHeader', v)} />
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Letterhead space (mm)</label>
          <input type="number" value={opts.letterheadMm ?? 0} onChange={e => setD('letterheadMm', parseInt(e.target.value) || 0)}
            className="w-20 px-2 py-1.5 rounded-lg text-sm" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', outline: 'none' }} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Top gap (mm)</label>
          <input type="number" value={opts.contentTopMm ?? 22} onChange={e => setD('contentTopMm', parseInt(e.target.value) || 0)}
            className="w-20 px-2 py-1.5 rounded-lg text-sm" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', outline: 'none' }} />
        </div>
        <Toggle label="Stamp / signature" checked={opts.showSignature !== false} onChange={v => setD('showSignature', v)} />
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Font</label>
          <select value={opts.fontFamily || 'Arial'} onChange={e => setD('fontFamily', e.target.value)}
            className="px-2 py-1.5 rounded-lg text-sm" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', outline: 'none' }}>
            {['Arial', 'Times New Roman', 'Calibri', 'Verdana', 'Tahoma', 'Georgia'].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Keep “Letterhead space 0 + Company header ON” to print on plain paper.</span>
      </div>

      {/* ═══ EDITOR + PREVIEW ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-4 items-start">

        {/* ─── LEFT: editor fields ─── */}
        <div className="rounded-2xl p-4 space-y-4 no-print" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Paper No." value={rec.paper_no} onChange={v => set('paper_no', v)} placeholder="MR-0001/26-27" />
            <Field label="Date" type="date" value={rec.paper_date} onChange={v => set('paper_date', v)} />
          </div>

          <Field label="Customer name" value={rec.customer_name} onChange={pickCustomer} placeholder="SHIV TRANSPORT" />
          {customers.length > 0 && (
            <div className="flex flex-wrap gap-1 -mt-1">
              {customers.slice(0, 6).map(c => (
                <button key={c.id} type="button" onClick={() => pickCustomer(c.name || '')}
                  className="text-[11px] px-2 py-1 rounded-lg" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-muted)' }}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vehicle / Model (ON ACCOUNT OF)" value={rec.model} onChange={v => set('model', v)} placeholder="TATA MOTORS SIGNA 4932.T" />
            <Field label="Vehicle No." value={rec.vehicle_no} onChange={v => set('vehicle_no', v)} placeholder="MH-46-TC-164" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Chassis No." value={rec.chassis_no} onChange={v => set('chassis_no', v)} placeholder="MAT566136T1H24001" />
            <Field label="Engine No." value={rec.engine_no} onChange={v => set('engine_no', v)} placeholder="B6.7B62320D14162H64616434" />
          </div>

          {/* ── Margin money receipt ── */}
          {rec.type === 'money_receipt' && (
            <>
              <div className="pt-1" style={{ borderTop: '1px solid var(--border)' }} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (Rs.)" type="number" value={rec.amount} onChange={v => set('amount', v)} placeholder="500000" />
                <Field label="Mode word in sentence" value={opts.modeText} onChange={v => setD('modeText', v)} placeholder="NEFT" />
              </div>
              <div className="text-xs px-3 py-2 rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                Amount in words (auto): <b style={{ color: 'var(--text-primary)' }}>({words}{words ? ' ' : ''})</b>
              </div>
              <Field label="Words override (leave blank for auto)" value={opts.wordsOverride} onChange={v => setD('wordsOverride', v)} placeholder="FIVE LAKH ONLY" />
              <Field label="Hypothecation bank (AND WITH HYPOTHECATION :-)" value={opts.hypothecation} onChange={v => setD('hypothecation', v)} placeholder="STATE BANK OF INDIA" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Payment mode detail" options={PAYMENT_MODES} value={rec.payment_mode} onChange={v => set('payment_mode', v)} />
                <Field label="Cheque / Ref / UTR No." value={rec.reference} onChange={v => set('reference', v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bank name" value={rec.bank_name} onChange={v => set('bank_name', v)} />
                <Field label="Balance amount (Rs.)" type="number" value={rec.balance_amount} onChange={v => set('balance_amount', v)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Toggle label="Extra details box at bottom" checked={!!opts.showDetailsBox} onChange={v => setD('showDetailsBox', v)} />
                <Toggle label="Stamp / signature block (instead of plain SIGNATURE :)" checked={opts.sigStyle === 'block'} onChange={v => setD('sigStyle', v ? 'block' : 'plain')} />
              </div>
              <Area label="Custom paragraph (optional — replaces the whole sentence)" value={opts.customParagraph} onChange={v => setD('customParagraph', v)} rows={4}
                placeholder="Leave blank to auto-fill from the fields above" />
            </>
          )}

          {/* ── Form 22-A ── */}
          {rec.type === 'form_22a' && (
            <>
              <div className="pt-1" style={{ borderTop: '1px solid var(--border)' }} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Heading" value={opts.heading} onChange={v => setD('heading', v)} placeholder="FORM22 (A)" />
                <Field label="Body word (TANKER / BODY etc.)" value={opts.bodyType} onChange={v => setD('bodyType', v)} placeholder="TANKER" />
              </div>
              <Toggle label="Green heading (as in your format)" checked={opts.greenHeading !== false} onChange={v => setD('greenHeading', v)} />
              <Field label="Rule line" value={opts.ruleLine} onChange={v => setD('ruleLine', v)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Part line" value={opts.partLine} onChange={v => setD('partLine', v)} placeholder="PART – II" />
                <Field label="Issued-by line" value={opts.issuedBy} onChange={v => setD('issuedBy', v)} placeholder="TO BE ISSUED BY THE TANKER" />
              </div>
              <Area label="Closing paragraph (each line as you want it printed)" value={opts.closingText} onChange={v => setD('closingText', v)} rows={4} />
            </>
          )}

          {/* ── Form 17 / Vahan ── */}
          {isImageSheet && (
            <>
              <div className="pt-1" style={{ borderTop: '1px solid var(--border)' }} />
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>Paper image (prints above Chassis / Engine No.)</label>
                {rec.image_data ? (
                  <div className="relative">
                    <img src={rec.image_data} alt="" className="w-full rounded-xl" style={{ maxHeight: 180, objectFit: 'contain', background: '#fff' }} />
                    <button type="button" onClick={() => set('image_data', '')}
                      className="absolute top-2 right-2 p-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}><X size={14} /></button>
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="mt-2 text-xs px-3 py-1.5 rounded-lg w-full" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-secondary)' }}>
                      Replace image
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="w-full py-6 rounded-xl flex flex-col items-center gap-2 text-sm"
                    style={{ background: 'var(--bg-input)', border: '1.5px dashed var(--border-input)', color: 'var(--text-muted)' }}>
                    <Upload size={20} />
                    Upload Form 17 / Vahan paper scan
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { handleImage(e.target.files?.[0]); e.target.value = '' }} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Toggle label="Print title line" checked={!!opts.showTitle} onChange={v => setD('showTitle', v)} />
                <Toggle label="Vehicle details strip" checked={!!opts.showDetails} onChange={v => setD('showDetails', v)} />
                <Toggle label="Image border" checked={opts.imageBorder !== false} onChange={v => setD('imageBorder', v)} />
              </div>
              <Field label="Remarks (printed below the numbers)" value={rec.notes} onChange={v => set('notes', v)} />
            </>
          )}

          <div className="text-[11px] leading-relaxed px-3 py-2 rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
            Click <b>Save</b> to store this paper. <b>Print</b> / <b>PDF</b> capture exactly what you see in the preview — one A4 page.
          </div>
        </div>

        {/* ─── RIGHT: live A4 preview ─── */}
        <div className="overflow-x-auto pb-4">
          <div className="mx-auto" style={{ width: '210mm', boxShadow: '0 10px 40px rgba(0,0,0,0.45)' }}>
            {rec.type === 'money_receipt' && <MoneyReceiptPaper rec={rec} org={org} opts={opts} />}
            {rec.type === 'form_22a' && <Form22APaper rec={rec} org={org} opts={opts} />}
            {isImageSheet && <ImageSheetPaper rec={rec} org={org} opts={opts} />}
          </div>
        </div>
      </div>
    </div>
  )
}
