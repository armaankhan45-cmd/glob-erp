import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft } from 'lucide-react'
import { formatCurrency, formatDate } from '../utils'

export default function PurchaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [purchase, setPurchase] = useState(null)
  const [items, setItems] = useState([])

  useEffect(() => {
    api.get(`/purchases/${id}`).then(res => {
      setPurchase(res.data.purchase)
      setItems(res.data.items || [])
    }).catch(() => navigate('/app/purchases'))
  }, [id])

  if (!purchase) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/purchases')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-bold">Purchase Bill {purchase.bill_number}</h1>
      </div>

      <div className="card">
        <h3 className="font-bold mb-3">Supplier Details</h3>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Supplier:</span> {purchase.supplier_name}</div>
          <div><span className="text-gray-500">GSTIN:</span> {purchase.supplier_gstin || 'N/A'}</div>
          <div><span className="text-gray-500">Date:</span> {formatDate(purchase.bill_date)}</div>
          <div><span className="text-gray-500">Phone:</span> {purchase.supplier_phone || 'N/A'}</div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold mb-3">Items</h3>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-gray-500 text-left">
            <th className="pb-2">#</th><th className="pb-2">Description</th><th className="pb-2">HSN</th><th className="pb-2">Qty</th><th className="pb-2 text-right">Rate</th><th className="pb-2 text-right">Amount</th>
          </tr></thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="py-2">{i+1}</td>
                <td className="py-2">{item.description}</td>
                <td className="py-2">{item.hsn_code}</td>
                <td className="py-2">{item.quantity} {item.unit}</td>
                <td className="py-2 text-right">{formatCurrency(item.rate)}</td>
                <td className="py-2 text-right font-medium">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="max-w-xs ml-auto mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(purchase.subtotal)}</span></div>
          {parseFloat(purchase.cgst_amount) > 0 && <div className="flex justify-between"><span>CGST</span><span>{formatCurrency(purchase.cgst_amount)}</span></div>}
          {parseFloat(purchase.sgst_amount) > 0 && <div className="flex justify-between"><span>SGST</span><span>{formatCurrency(purchase.sgst_amount)}</span></div>}
          {parseFloat(purchase.igst_amount) > 0 && <div className="flex justify-between"><span>IGST</span><span>{formatCurrency(purchase.igst_amount)}</span></div>}
          <hr />
          <div className="flex justify-between font-bold"><span>Total</span><span>{formatCurrency(purchase.total_amount)}</span></div>
        </div>
      </div>
    </div>
  )
}
