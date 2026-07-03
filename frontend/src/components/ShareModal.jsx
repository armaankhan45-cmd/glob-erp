import { useState } from 'react'
import { X, Send, MessageCircle, Mail, Copy, Check } from 'lucide-react'
import { generateInvoicePDF, generateQuotationPDF } from '../utils/invoicePDF'
import api from '../api/client'

export default function ShareModal({ open, onClose, invoice, items, type = 'invoice' }) {
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const num = invoice?.invoice_number || invoice?.quotation_number || ''
  const custName = invoice?.customer_name || ''
  const total = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(invoice?.total_amount || 0)

  const token = localStorage.getItem('token')
  const docId = invoice?.id
  const endpoint = type === 'quotation' ? 'quotations' : 'invoices'
  const pdfUrl = `${api.defaults.baseURL}/${endpoint}/${docId}/pdf?token=${token}`
  const viewUrl = `${window.location.origin}/app/${endpoint}/${docId}`

  const handleWhatsApp = async () => {
    setSharing(true)
    try {
      // Try Web Share API with file
      try {
        const response = await fetch(pdfUrl)
        const blob = await response.blob()
        const ext = type === 'quotation' ? 'Quotation' : 'Invoice'
        const file = new File([blob], `${ext}_${num.replace(/\//g, '-')}.pdf`, { type: blob.type })

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            text: `*${type === 'quotation' ? 'QUOTATION' : 'TAX INVOICE'} ${num}*\nCustomer: ${custName}\nTotal: ₹${total}`,
            files: [file]
          })
          setSharing(false)
          return
        }
      } catch (shareErr) {
        // Fallback
      }

      // Fallback: WhatsApp with message + PDF link
      const docLabel = type === 'quotation' ? 'QUOTATION' : 'TAX INVOICE'
      const msg = `*${docLabel} ${num}*\nCustomer: ${custName}\nTotal: ₹${total}\n\n📄 View: ${viewUrl}\n📥 PDF: ${pdfUrl}`
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
    } catch (err) {
      alert('Share failed: ' + err.message)
    }
    setSharing(false)
  }

  const handleEmail = async () => {
    setSharing(true)
    try {
      const emailTo = prompt('Enter email address:')
      if (!emailTo) { setSharing(false); return }

      try {
        await api.post(`/${endpoint}/${docId}/share-email`, { to: emailTo })
        alert(`${type === 'quotation' ? 'Quotation' : 'Invoice'} sent to ${emailTo}!`)
      } catch (backendErr) {
        // Fallback: mailto link
        const docLabel = type === 'quotation' ? 'Quotation' : 'Tax Invoice'
        const subject = `${docLabel} ${num} - ${invoice?.organization_name || 'Our Company'}`
        const body = `Dear ${custName},\n\nPlease find your ${docLabel.toLowerCase()} below:\n\n${docLabel} No: ${num}\nTotal Amount: ₹${total}\n\n📄 View: ${viewUrl}\n📥 PDF: ${pdfUrl}\n\nBest regards`
        window.open(`mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
      }
    } catch (err) {
      alert('Email share failed: ' + err.message)
    }
    setSharing(false)
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(viewUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const textArea = document.createElement('textarea')
      textArea.value = viewUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      textArea.remove()
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="rounded-2xl p-6 w-full max-w-md"
        style={{ background: 'rgba(14,18,36,0.97)', border: '1px solid rgba(255,255,255,0.10)', animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg text-white">Share {type === 'quotation' ? 'Quotation' : 'Invoice'}</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/50"><X size={20} /></button>
        </div>

        <div className="glass rounded-xl p-4 mb-5">
          <div className="text-sm text-white font-bold">{num}</div>
          <div className="text-xs text-slate-400">{custName}</div>
          <div className="text-lg font-bold text-emerald-400 mt-1">₹{total}</div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleWhatsApp}
            disabled={sharing}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <MessageCircle size={18} />
            {sharing ? 'Sharing...' : 'Share on WhatsApp'}
          </button>

          <button
            onClick={handleEmail}
            disabled={sharing}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50"
          >
            <Mail size={18} />
            {sharing ? 'Sending...' : 'Send via Email'}
          </button>

          <button
            onClick={handleCopyLink}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? 'Link Copied!' : 'Copy Link'}
          </button>
        </div>

        {onConfigureEmail && (
          <button
            onClick={onConfigureEmail}
            className="w-full mt-3 text-xs text-center text-slate-500 hover:text-slate-400 underline"
          >
            Configure Email Settings
          </button>
        )}
      </div>
    </div>
  )
}
