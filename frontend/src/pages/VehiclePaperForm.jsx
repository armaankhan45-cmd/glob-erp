import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Printer, Download, Save, Trash2, Upload, X, Check, Eye, Edit } from 'lucide-react'
import { numberToWordsCaps, printElement } from '../utils'
import { PAPER_TYPES } from './VehiclePapers'
import defaultLetterhead from '../assets/vehicle-papers/glob-letterhead.jpg?inline'
import defaultAddressBar from '../assets/vehicle-papers/glob-address-bar.jpg?inline'
import defaultStamp from '../assets/vehicle-papers/glob-stamp.png?inline'
import defaultForm17 from '../assets/vehicle-papers/form17-reference.jpg?inline'
import defaultVahan from '../assets/vehicle-papers/vahan-reference.jpg?inline'

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
    heading: type === 'money_receipt' ? 'MARGIN MONEY RECEIPT' : type === 'form_22a' ? 'FORM22 (A)' : (PAPER_TYPES[type]?.label || 'VEHICLE PAPER').toUpperCase(),
    printHeader: type === 'money_receipt' || type === 'form_22a',
    useLetterhead: true,        // print the uploaded letterhead artwork (Settings → Letterhead)
    showFooterStrip: true,      // address + e-mail bar at the bottom
    footerAddress: '',          // blank = letterhead wording / Settings address
    letterheadMm: 0,
    footerMm: 0,
    handwriting: true,
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
    imageBorder: false,
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
//   • Letterhead artwork (Settings → Letterhead) prints edge-to-edge
//     at the top when uploaded — otherwise blank space / text header.
//   • Yellow address + e-mail strip prints at the bottom of the page.
// ───────────────────────────────────────────────────────────────
const DEFAULT_FOOTER_ADDRESS = 'Gala No. 4, Shilphata-Panvel Highway, Dhanar Village, Toll Plaza, 1 Km.,Dist-Raigad (Maharashtra)'

function isImg(v) { return typeof v === 'string' && v.startsWith('data:') }

/** Yellow address bar + red/blue stripes + black e-mail box — matches the letterhead strip */
function AddressStrip({ org, opts }) {
  const address = (opts.footerAddress || '').trim() || (org?.address ? [org.address, org.city, org.pincode].filter(Boolean).join(', ') : DEFAULT_FOOTER_ADDRESS)
  const email = org?.email || 'globfabrication@gmail.com'
  return (
    <div style={{
      width: '210mm', height: '9.6mm', display: 'flex', alignItems: 'stretch',
      border: '1.2px solid #111', boxSizing: 'border-box', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{ flex: 1, background: '#F2C903', display: 'flex', alignItems: 'center', padding: '0 3mm', overflow: 'hidden' }}>
        <span style={{ fontSize: '10pt', fontWeight: 800, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{address}</span>
      </div>
      <div style={{ width: '1.3mm', background: '#D21100', flexShrink: 0 }} />
      <div style={{ width: '1.3mm', background: '#1199E6', flexShrink: 0 }} />
      <div style={{ width: '1.3mm', background: '#F2C903', flexShrink: 0 }} />
      <div style={{ width: '23.4%', background: '#111', display: 'flex', alignItems: 'center', padding: '0 2.5mm', overflow: 'hidden', flexShrink: 0 }}>
        <span style={{ fontSize: '9.5pt', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>E-mail : {email}</span>
      </div>
    </div>
  )
}

function Sheet({ org, opts, children }) {
  const font = opts.fontFamily || 'Arial'
  const isScan = opts.paperType === 'form_17' || opts.paperType === 'vahan'
  // The supplied artwork is the DEFAULT, independent of old settings/logo uploads.
  const header = !isScan && opts.useLetterhead !== false
    ? (opts.useCustomLetterhead && isImg(org?.letterhead_url) ? org.letterhead_url : defaultLetterhead)
    : null
  // Address bar only on Margin Money Receipt and Form 22-A — NEVER on scans.
  const footer = !isScan && opts.showFooterStrip !== false
    ? (opts.useCustomLetterhead && isImg(org?.letterhead_footer_url) ? org.letterhead_footer_url : defaultAddressBar)
    : null
  return (
    <div className="print-area" style={{
      width: '210mm', height: '297mm', minHeight: '297mm', maxHeight: '297mm',
      overflow: 'hidden', background: '#fff', color: '#000',
      fontFamily: `'${font}', Arial, Helvetica, sans-serif`, display: 'flex', flexDirection: 'column',
      boxSizing: 'border-box', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
    }}>
      {header ? <img src={header} alt="Glob letterhead" style={{ width: '210mm', height: '69mm', display: 'block', flexShrink: 0 }} />
        : (!isScan && !opts.printHeader && Number(opts.letterheadMm) > 0
          ? <div style={{ height: Math.min(80, Number(opts.letterheadMm)) + 'mm', flexShrink: 0 }} /> : null)}
      {!header && !isScan && opts.printHeader && <CompanyHeader org={org} />}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        padding: isScan ? '3mm 10mm 2mm' : '4mm 12mm 2mm', boxSizing: 'border-box' }}>
        {children}
      </div>
      {footer && <img src={footer} alt="Glob address and email" style={{ width: '210mm', height: '10mm', display: 'block', flexShrink: 0 }} />}
    </div>
  )
}

function CompanyHeader({ org }) {
  const name = (org?.name || 'GLOB FABRICATION AND ENTERPRISES').toUpperCase()
  const addr = [org?.address, org?.city, org?.state, org?.pincode].filter(Boolean).join(', ')
  return (
    <div style={{ textAlign: 'center', padding: '3mm 12mm', borderBottom: '2.5px solid #000', fontFamily: 'inherit', flexShrink: 0 }}>
      {org?.logo_url && <img src={org.logo_url} alt="" style={{ height: '15mm', objectFit: 'contain', marginBottom: '1mm' }} />}
      <div style={{ fontSize: '18pt', fontWeight: 900, letterSpacing: '0.5px' }}>{name}</div>
      {addr && <div style={{ fontSize: '9.5pt' }}>{addr}</div>}
      <div style={{ fontSize: '9.5pt' }}>
        {org?.phone ? `Ph: ${org.phone}` : ''}{org?.email ? `  |  ${org.email}` : ''}{org?.gstin ? `  |  GSTIN: ${org.gstin}` : ''}
      </div>
    </div>
  )
}

/** Company signature/stamp stays OUTSIDE the scanned official document. */
function SignBlock({ org, show = true, compact = false }) {
  if (!show) return null
  const combined = org?.stamp_url || defaultStamp
  return (
    <div style={{ alignSelf: 'flex-end', width: compact ? '45mm' : '57mm', height: compact ? '18mm' : '29mm', flexShrink: 0,
      position: 'relative', textAlign: 'center', marginTop: '1mm' }}>
      <img src={combined} alt="Company stamp and signature"
        style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)',
          width: compact ? '30mm' : '47mm', height: compact ? '14mm' : '24mm', objectFit: 'contain' }} />
      {org?.signature_url && <img src={org.signature_url} alt="Additional signature"
        style={{ position: 'absolute', left: '50%', top: '4mm', transform: 'translateX(-50%)',
          width: compact ? '17mm' : '27mm', height: compact ? '8mm' : '13mm', objectFit: 'contain' }} />}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
        borderTop: '1px solid #222', fontSize: compact ? '6pt' : '7.5pt', fontWeight: 700, paddingTop: '1mm' }}>
        GLOB FABRICATION &amp; ENTERPRISES · Authorised Signatory
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
  const hasLH = opts.useLetterhead !== false
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
      <div style={{ paddingTop: hasLH ? '0mm' : (opts.contentTopMm ?? 22) + 'mm' }}>
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
          ? <SignBlock org={org} show />
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
  const hasLH = opts.useLetterhead !== false
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
      <div style={{ paddingTop: hasLH ? '0mm' : (opts.contentTopMm ?? 22) + 'mm' }}>
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
      {opts.showSignature && <SignBlock org={org} show />}
    </Sheet>
  )
}

// ═══════════════════════════════════════════════════════════════
// PAPERS 3 & 4 — FORM 17 / VAHAN PAPER
// Scanned paper image on top  +  CHASSIS NO. / ENGINE NO. below it
// ═══════════════════════════════════════════════════════════════
export function ImageSheetPaper({ rec, org, opts }) {
  const image = rec.image_data || (rec.type === 'vahan' ? defaultVahan : defaultForm17)
  const ink = { fontFamily: "'Caveat', 'Segoe Print', cursive", fontWeight: 700,
    fontSize: '13pt', color: '#29203d', letterSpacing: '0.4px' }
  return (
    <Sheet org={org} opts={{ ...opts, paperType: rec.type }}>
      {/* Reproduce the supplied official scan. Never redraw or edit the government document. */}
      <div style={{ height: '228mm', width: '100%', flexShrink: 0,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflow: 'hidden' }}>
        <img src={image} alt={rec.type === 'vahan' ? 'Vahan receipt reference' : 'Form 17 reference'}
          style={{ display: 'block', maxWidth: '100%', maxHeight: '228mm', objectFit: 'contain' }} />
      </div>
      {/* Handwritten-looking text is deliberately separate BELOW the scan. */}
      <div style={{ flexShrink: 0, padding: '1mm 5mm 0', fontSize: '9pt', lineHeight: 1.1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', minHeight: '7mm', gap: '3mm' }}>
          <b style={{ minWidth: '27mm' }}>Chassis No. :</b>
          <span style={opts.handwriting !== false ? ink : { fontWeight: 700, fontSize: '10pt' }}>
            {rec.chassis_no || '____________________________'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', minHeight: '7mm', gap: '3mm' }}>
          <b style={{ minWidth: '27mm' }}>Engine No. :</b>
          <span style={opts.handwriting !== false ? ink : { fontWeight: 700, fontSize: '10pt' }}>
            {rec.engine_no || '____________________________'}</span>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }} />
      <SignBlock org={org} show={opts.showSignature !== false} compact />
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
  const [viewMode, setViewMode] = useState('edit')

  const meta = PAPER_TYPES[rec.type] || PAPER_TYPES.money_receipt
  const set = (k, v) => setRec(prev => ({ ...prev, [k]: v }))
  const setD = (k, v) => setRec(prev => ({ ...prev, data: { ...(prev.data || {}), [k]: v } }))
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const isImageSheet = rec.type === 'form_17' || rec.type === 'vahan'

  // ── Load org settings + customers ──
  useEffect(() => {
    api.get('/settings').then(res => {
      const o = res.data.organization || {}
      setOrg(o)

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
    await document.fonts.ready
    await printElement(el, rec.paper_no || meta.label)
  }

  const handlePdf = async () => {
    const el = document.querySelector('.print-area')
    const name = (rec.paper_no || meta.short).replace(/[\\/]/g, '-')
    try {
      await document.fonts.ready
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#fff' })
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297)
      pdf.save(`${meta.short.replace(/\s/g, '')}_${name}.pdf`)
    }
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
        <button onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}
          className="btn-secondary flex items-center gap-2">
          {viewMode === 'edit' ? <Eye size={16} /> : <Edit size={16} />}
          {viewMode === 'edit' ? 'Preview A4' : 'Edit fields'}
        </button>
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
        {!isImageSheet && <Toggle label="Glob artwork letterhead" checked={opts.useLetterhead !== false} onChange={v => setD('useLetterhead', v)} />}
        {!isImageSheet && <Toggle label="Address strip at bottom" checked={opts.showFooterStrip !== false} onChange={v => setD('showFooterStrip', v)} />}
        {!isImageSheet && <Toggle label="Company header text (no artwork)" checked={!!opts.printHeader} onChange={v => setD('printHeader', v)} />}
        <Toggle label="Stamp / signature" checked={opts.showSignature !== false} onChange={v => setD('showSignature', v)} />
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Font</label>
          <select value={opts.fontFamily || 'Arial'} onChange={e => setD('fontFamily', e.target.value)}
            className="px-2 py-1.5 rounded-lg text-sm" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-input)', color: 'var(--text-primary)', outline: 'none' }}>
            {['Arial', 'Times New Roman', 'Calibri', 'Verdana', 'Tahoma', 'Georgia'].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Fixed 210 × 297 mm A4 · bundled Glob header/footer · no invoice spacing</span>
      </div>

      {/* ═══ EDITOR + PREVIEW ═══ */}
      <div className={viewMode === 'preview' ? 'flex justify-center' : 'grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-4 items-start'}>

        {/* ─── LEFT: editor fields ─── */}
        <div className={viewMode === 'preview' ? 'hidden' : 'rounded-2xl p-4 space-y-4 no-print'} style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)' }}>

          {!isImageSheet && <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Paper No." value={rec.paper_no} onChange={v => set('paper_no', v)} />
              <Field label="Date" type="date" value={rec.paper_date} onChange={v => set('paper_date', v)} />
            </div>
            <Field label="Customer name" value={rec.customer_name} onChange={pickCustomer} placeholder="SHIV TRANSPORT" />
            {customers.length > 0 && <div className="flex flex-wrap gap-1 -mt-1">
              {customers.slice(0, 6).map(c => <button key={c.id} type="button" onClick={() => pickCustomer(c.name || '')}
                className="text-[11px] px-2 py-1 rounded-lg" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>{c.name}</button>)}
            </div>}
            <Field label="Vehicle / Model" value={rec.model} onChange={v => set('model', v)} placeholder="TATA SIGNA 4832 BSVI 10X2" />
          </>}
          {isImageSheet && <div className="text-sm rounded-xl p-3" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
            Your {rec.type === 'form_17' ? 'Form 17 certificate' : 'Vahan receipt'} is already selected as the default.
            Enter just the two numbers below. The handwriting-style text and company stamp print <b>below</b> the original scan.
          </div>}
          <Field label="Chassis No." value={rec.chassis_no} onChange={v => set('chassis_no', v)} placeholder="Write chassis number" />
          <Field label="Engine No." value={rec.engine_no} onChange={v => set('engine_no', v)} placeholder="Write engine number" />

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

          {isImageSheet && <div className="space-y-2">
            <Toggle label="Handwritten-style chassis / engine" checked={opts.handwriting !== false} onChange={v => setD('handwriting', v)} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Using your supplied original scan. If this certificate/receipt is renewed, replace the sample below.
            </p>
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-xs flex items-center gap-2"><Upload size={14} /> {rec.image_data ? 'Replace custom scan' : 'Use a different scan'}</button>
            {rec.image_data && <button type="button" onClick={() => set('image_data', '')} className="btn-secondary text-xs ml-2">Restore default</button>}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { handleImage(e.target.files?.[0]); e.target.value = '' }} />
          </div>}


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
