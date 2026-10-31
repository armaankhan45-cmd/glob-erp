import { useState, useRef, useEffect } from 'react'
import { Download, FileText, Image as ImageIcon, Printer, Share2, ChevronDown, Loader2 } from 'lucide-react'
import { downloadPdf, downloadImage, printElement, sharePdf, canShareFiles } from '../utils'

/**
 * One tidy "Download" menu for any printable document.
 *   getEl     () => the .print-area element (may be async, e.g. switch to preview first)
 *   baseName  file name without extension, e.g. "Invoice_INV-101_Tata-Motors"
 *   title     print window / pdf title
 */
export default function DownloadMenu({ getEl, baseName, title, shareText = '' }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close) }
  }, [])
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t) }, [msg])

  const run = async (kind) => {
    setOpen(false); setBusy(kind); setMsg(null)
    try {
      const el = await getEl()
      if (!el) throw new Error('Nothing to export yet')
      if (kind === 'pdf') await downloadPdf(el, baseName)
      else if (kind === 'image') await downloadImage(el, baseName)
      else if (kind === 'print') await printElement(el, title || baseName)
      else if (kind === 'share') await sharePdf(el, baseName, shareText)
      if (kind !== 'print' && kind !== 'share') setMsg({ ok: true, text: kind === 'pdf' ? 'PDF ready' : 'Image ready' })
    } catch (e) {
      setMsg({ ok: false, text: e.message || 'Export failed' })
    } finally { setBusy('') }
  }

  const Item = ({ kind, icon: Icon, label, hint }) => (
    <button onClick={() => run(kind)} className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-sm hover:bg-white/5"
      style={{ color: 'var(--text-primary)' }}>
      <Icon size={16} style={{ color: 'var(--text-secondary)' }} />
      <span className="flex-1"><span className="block font-medium">{label}</span><span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>{hint}</span></span>
    </button>
  )

  return (
    <div className="relative no-print" ref={ref}>
      <div className="flex">
        <button onClick={() => run('pdf')} disabled={!!busy} className="btn-primary flex items-center gap-2 disabled:opacity-60" style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {busy === 'pdf' ? 'Preparing…' : busy ? 'Working…' : 'Download PDF'}
        </button>
        <button onClick={() => setOpen(o => !o)} disabled={!!busy} className="btn-primary px-2 disabled:opacity-60" aria-label="More download options"
          style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: '1px solid rgba(255,255,255,.3)' }}>
          <ChevronDown size={16} />
        </button>
      </div>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl overflow-hidden z-50"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', boxShadow: '0 12px 32px rgba(0,0,0,.28)' }}>
          <Item kind="pdf" icon={FileText} label="Download PDF" hint="A4, sharp text, ready to send" />
          <Item kind="image" icon={ImageIcon} label="Download image (PNG)" hint="For WhatsApp or quick preview" />
          <Item kind="print" icon={Printer} label="Print" hint="Same pages as the PDF" />
          {canShareFiles() && <Item kind="share" icon={Share2} label="Share file…" hint="WhatsApp, Mail, Drive, Files" />}
        </div>
      )}
      {msg && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: msg.ok ? '#15803d' : '#b91c1c', color: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,.3)' }}>{msg.text}</div>
      )}
    </div>
  )
}
