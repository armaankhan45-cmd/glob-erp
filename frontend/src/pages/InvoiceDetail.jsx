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

  // PDF download — uses backend HTML endpoint, opens in new tab for browser print-to-PDF
  const handleExportPDF = async () => {
    try {
      // Try backend PDF first
      const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' })
      const contentType = res.headers?.['content-type'] || ''
      if (contentType.includes('pdf')) {
        const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
        const link = document.createElement('a')
        link.href = url
        link.download = `${invoice.invoice_number || 'invoice'}.pdf`
        link.click()
        window.URL.revokeObjectURL(url)
      } else {
        // Backend returned HTML — open in new tab for manual PDF save
        const htmlBlob = new Blob([res.data], { type: 'text/html' })
        const url = window.URL.createObjectURL(htmlBlob)
        window.open(url, '_blank')
      }
    } catch {
      // Fallback: open the HTML version in new tab
      window.open(`${api.defaults.baseURL}/invoices/${id}/pdf`, '_blank')
    }
  }

  // WhatsApp share
  const handleWhatsApp = () => {
    const invNum = invoice.invoice_number || ''
    const custName = invoice.customer_name || ''
    const total = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(invoice.total_amount)
    const viewUrl = `${window.location.origin}/app/invoices/${id}`
    const msg = `*TAX INVOICE ${invNum}*\nCustomer: ${custName}\nTotal: ₹${total}\n\nView & Print: ${viewUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
    setShareOpen(false)
  }

  // Email share
  const handleEmail = () => {
    const invNum = invoice.invoice_number || ''
    const custName = invoice.customer_name || ''
    const total = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(invoice.total_amount)
    const viewUrl = `${window.location.origin}/app/invoices/${id}`
    const subject = `Tax Invoice ${invNum} - ${org?.name || 'Our Company'}`
    const body = `Dear ${custName},\n\nPlease find below your invoice:\n\nInvoice No: ${invNum}\nTotal Amount: ₹${total}\n\nYou can view and print the invoice here:\n${viewUrl}\n\nThank you for your business.\n\nBest regards,\n${org?.name || 'Our Company'}`
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank')
    setShareOpen(false)
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
              <button onClick={handleWhatsApp} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-green-50 text-green-700 text-sm font-medium">
                <MessageCircle size={18} /> WhatsApp
              </button>
              <button onClick={handleEmail} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-blue-50 text-blue-700 text-sm font-medium border-t">
                <Mail size={18} /> Email
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
