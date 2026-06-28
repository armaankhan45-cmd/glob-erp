import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Printer, Edit, Trash2, Download, Share2, MessageCircle, Mail } from 'lucide-react'
import InvoicePrint from '../components/InvoicePrint'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [items, setItems] = useState([])
  const [org, setOrg] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [sharing, setSharing] = useState(false)

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

  // PDF: Opens the backend HTML/PDF in a new browser tab.
  const handleExportPDF = () => {
    const token = localStorage.getItem('token')
    const url = `${api.defaults.baseURL}/invoices/${id}/pdf?token=${token}`
    window.open(url, '_blank')
  }

  // WhatsApp share with PDF file
  const handleWhatsApp = async () => {
    setSharing(true)
    try {
      const token = localStorage.getItem('token')
      const pdfUrl = `${api.defaults.baseURL}/invoices/${id}/pdf?token=${token}`
      const invNum = invoice.invoice_number || ''
      const custName = invoice.customer_name || ''
      const total = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(invoice.total_amount)

      // Try Web Share API with file
      try {
        const response = await fetch(pdfUrl)
        const htmlBlob = await response.blob()
        const file = new File([htmlBlob], `Invoice_${invNum.replace(/\//g, '-')}.html`, { type: 'text/html' })

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            text: `*TAX INVOICE ${invNum}*\nCustomer: ${custName}\nTotal: ₹${total}`,
            files: [file]
          })
          setShareOpen(false)
          setSharing(false)
          return
        }
      } catch (shareErr) {
        // Fallback
      }

      // Fallback: Open WhatsApp with message containing the PDF link
      const viewUrl = `${window.location.origin}/app/invoices/${id}`
      const msg = `*TAX INVOICE ${invNum}*\nCustomer: ${custName}\nTotal: ₹${total}\n\n📄 View & Print: ${viewUrl}\n📥 Direct PDF: ${pdfUrl}`
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
    } catch (err) {
      alert('Share failed: ' + err.message)
    }
    setShareOpen(false)
    setSharing(false)
  }

  // Email share with PDF attachment
  const handleEmail = async () => {
    setSharing(true)
    try {
      const invNum = invoice.invoice_number || ''
      const custName = invoice.customer_name || ''
      const total = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(invoice.total_amount)
      const token = localStorage.getItem('token')
      const pdfUrl = `${api.defaults.baseURL}/invoices/${id}/pdf?token=${token}`

      // Try to send via backend email endpoint (sends actual PDF attachment)
      const emailTo = prompt('Enter email address to send invoice:')
      if (!emailTo) { setSharing(false); return }

      try {
        await api.post(`/invoices/${id}/share-email`, { to: emailTo })
        alert('Invoice sent via email!')
      } catch (backendErr) {
        // Fallback: mailto link with PDF link
        const subject = `Tax Invoice ${invNum} - ${org?.name || 'Our Company'}`
        const body = `Dear ${custName},\n\nPlease find your tax invoice below:\n\nInvoice No: ${invNum}\nTotal Amount: ₹${total}\n\n📄 View & Print: ${window.location.origin}/app/invoices/${id}\n📥 Direct PDF: ${pdfUrl}\n\nBest regards,\n${org?.name || 'Our Company'}`
        window.open(`mailto:${emailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
      }
    } catch (err) {
      alert('Email share failed: ' + err.message)
    }
    setShareOpen(false)
    setSharing(false)
  }

  if (!invoice) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="space-y-4">
      {/* Action buttons — hidden on print */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button onClick={() => navigate('/app/invoices')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold flex-1">Invoice {invoice.invoice_number}</h1>
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2"><Printer size={16} /> Print</button>
        <button onClick={handleExportPDF} className="btn-secondary flex items-center gap-2"><Download size={16} /> PDF</button>
        
        {/* Share dropdown */}
        <div className="relative">
          <button onClick={() => setShareOpen(!shareOpen)} className="btn-secondary flex items-center gap-2"><Share2 size={16} /> Share</button>
          {shareOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border z-50 min-w-[180px]">
              <button onClick={handleWhatsApp} disabled={sharing} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-green-50 text-green-700 text-sm font-medium">
                <MessageCircle size={18} /> {sharing ? 'Sharing...' : 'WhatsApp'}
              </button>
              <button onClick={handleEmail} disabled={sharing} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-blue-50 text-blue-700 text-sm font-medium border-t">
                <Mail size={18} /> {sharing ? 'Sending...' : 'Email'}
              </button>
            </div>
          )}
        </div>

        <button onClick={() => navigate(`/app/invoices/${id}/edit`)} className="btn-primary flex items-center gap-2"><Edit size={16} /> Edit</button>
        <button onClick={handleDelete} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>
      </div>

      {/* Production Invoice Template */}
      <InvoicePrint invoice={invoice} items={items} org={org} />
    </div>
  )
}
