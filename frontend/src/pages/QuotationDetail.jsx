import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Printer, Edit, Trash2, Repeat } from 'lucide-react'
import { numberToWordsCaps, formatIndian } from '../utils'

export default function QuotationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [quotation, setQuotation] = useState(null)
  const [items, setItems] = useState([])
  const [org, setOrg] = useState(null)
  const [boldOn, setBoldOn] = useState(() => localStorage.getItem('quotBold') === 'true')

  useEffect(() => { loadQuotation() }, [id])

  const loadQuotation = async () => {
    try {
      const res = await api.get(`/quotations/${id}`)
      setQuotation(res.data.quotation)
      setItems(res.data.items || [])
      setOrg(res.data.organization)
    } catch (err) {
      alert('Quotation not found')
      navigate('/app/quotations')
    }
  }

  const toggleBold = () => {
    const val = !boldOn
    setBoldOn(val)
    localStorage.setItem('quotBold', val)
  }

  const handlePrint = () => window.print()
  const handleDelete = async () => {
    if (!confirm('Delete this quotation?')) return
    await api.delete(`/quotations/${id}`)
    navigate('/app/quotations')
  }

  const handleConvert = async () => {
    if (!confirm('Convert this quotation to an invoice?')) return
    try {
      const res = await api.post(`/quotations/${id}/convert`)
      alert(`Invoice created: ${res.data.invoice_number}`)
      navigate(`/app/invoices/${res.data.invoiceId}`)
    } catch (err) {
      alert(err.response?.data?.msg || 'Conversion failed')
    }
  }

  if (!quotation) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>

  const letterheadMm = org?.print_letterhead_mm || 65
  const qNum = quotation.quotation_number?.split('/')[0]

  const hasCGST = parseFloat(quotation.cgst_amount) > 0
  const hasIGST = parseFloat(quotation.igst_amount) > 0
  const gstRate = hasIGST
    ? parseFloat(items[0]?.igst_rate || 18)
    : (hasCGST ? parseFloat(items[0]?.cgst_rate || 9) * 2 : 18)
  const totalGST = parseFloat(quotation.igst_amount) + parseFloat(quotation.cgst_amount) + parseFloat(quotation.sgst_amount)

  const fmt = (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

  const s = {
    cell: { border: '1.5px solid #000', padding: '4px 5px', verticalAlign: 'top' },
    hc: { border: '1.5px solid #000', padding: '5px', background: '#e8e8e8', textAlign: 'center', fontWeight: 'bold' }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button onClick={() => navigate('/app/quotations')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold flex-1">Quotation {quotation.quotation_number}</h1>
        <button onClick={toggleBold} className={`px-3 py-2 rounded-lg font-medium text-sm ${boldOn ? 'bg-gray-800 text-white' : 'btn-secondary'}`}>Bold {boldOn ? 'ON' : 'OFF'}</button>
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2"><Printer size={16} /> Print</button>
        <button onClick={() => navigate(`/app/quotations/${id}/edit`)} className="btn-primary flex items-center gap-2"><Edit size={16} /> Edit</button>
        <button onClick={handleConvert} className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 flex items-center gap-2"><Repeat size={16} /> Convert to Invoice</button>
        <button onClick={handleDelete} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>
      </div>

      <div className="bg-white shadow-lg mx-auto print-area" style={{ fontFamily: 'Georgia, serif', fontSize: '10pt', width: '210mm', height: '297mm', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white' }}>
        <div style={{ height: `${letterheadMm}mm`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
          Pre-printed Letterhead Space ({letterheadMm}mm)
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '2px solid #000', margin: '0 10mm', overflow: 'hidden' }}>
          <div style={{ textAlign: 'center', padding: '8px 0 2px', fontSize: '20pt', fontWeight: 'bold' }}>
            Quotation <u>No</u> :- {qNum}
          </div>

          <div style={{ textAlign: 'center', fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', padding: '2px 8px' }}>
            {(quotation.customer_name || '').toUpperCase()}
          </div>

          {quotation.additional_info && (
            <div style={{ textAlign: 'center', fontSize: '9pt', padding: '0 8px 2px' }}>{quotation.additional_info}</div>
          )}

          <div style={{ flex: 1, padding: '4px 5px 0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', height: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...s.hc, width: '6%' }}>SR No.</th>
                  <th style={{ ...s.hc, width: '50%' }}>Particulars</th>
                  <th style={{ ...s.hc, width: '10%' }}>Quantity</th>
                  <th style={{ ...s.hc, width: '17%' }}>Rate (INR)</th>
                  <th style={{ ...s.hc, width: '17%' }}>Amount (INR)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ ...s.cell, textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ ...s.cell, fontSize: '8.5pt', lineHeight: '1.3', fontWeight: boldOn ? 'bold' : 'normal', whiteSpace: 'pre-line' }}>{item.description || ''}</td>
                    <td style={{ ...s.cell, textAlign: 'center' }}>{item.quantity}{item.unit && item.unit !== 'Unit' ? ` ${item.unit}` : ''}</td>
                    <td style={{ ...s.cell, textAlign: 'right' }}>₹{fmt(item.rate)}</td>
                    <td style={{ ...s.cell, textAlign: 'right', fontWeight: 'bold' }}>₹{fmt(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals + Amount in words — ALL inside the bordered box */}
          <div style={{ padding: '0 5px 6px', flexShrink: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
              <tbody>
                {gstRate > 0 && (
                  <tr>
                    <td style={{ border: '1.5px solid #000', padding: '4px 6px', textAlign: 'right', width: '76%' }}>
                      GST: {gstRate}%
                    </td>
                    <td style={{ border: '1.5px solid #000', padding: '4px 6px', textAlign: 'right', fontWeight: 'bold' }}>
                      ₹{fmt(totalGST)}
                    </td>
                  </tr>
                )}
                <tr style={{ background: '#f0f0f0' }}>
                  <td style={{ border: '1.5px solid #000', padding: '5px 6px', textAlign: 'right', fontSize: '11pt' }}>
                    <strong>Total :</strong>
                  </td>
                  <td style={{ border: '1.5px solid #000', padding: '5px 6px', textAlign: 'right', fontSize: '11pt', fontWeight: 'bold' }}>
                    ₹{fmt(quotation.total_amount)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Amount in words INSIDE the box */}
            <div style={{ border: '1.5px solid #000', borderTop: 'none', padding: '6px 8px', fontSize: '10pt', fontWeight: 'bold', textAlign: 'center', background: '#fafafa' }}>
              {numberToWordsCaps(quotation.total_amount)}
            </div>
          </div>
        </div>

        <div style={{ height: '30mm', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>
          Sign & Stamp Space (30mm)
        </div>
      </div>
    </div>
  )
}
