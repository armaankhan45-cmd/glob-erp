import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Printer, Edit, Trash2 } from 'lucide-react'
import PurchasePrint from '../components/PurchasePrint'

export default function PurchaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [purchase, setPurchase] = useState(null)
  const [items, setItems] = useState([])
  const [org, setOrg] = useState(null)

  useEffect(() => {
    api.get(`/purchases/${id}`).then(async (pRes) => {
      setPurchase(pRes.data.purchase)
      setItems(pRes.data.items || [])
      // Load org details for print template
      try {
        const oRes = await api.get('/settings')
        setOrg(oRes.data.organization)
      } catch {
        // Fallback: use user's org from localStorage
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        setOrg(user.organization || {})
      }
    }).catch(err => {
      console.error('Load error:', err)
      alert('Purchase bill not found')
      navigate('/app/purchases')
    })
  }, [id])

  const handleDelete = async () => {
    if (!confirm('Delete this purchase bill?')) return
    try {
      await api.delete(`/purchases/${id}`)
      navigate('/app/purchases')
    } catch {
      alert('Failed to delete')
    }
  }

  const handlePrint = () => window.print()

  if (!purchase || !org) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="space-y-4">
      {/* Action buttons — hidden on print */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <button onClick={() => navigate('/app/purchases')} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold flex-1">Purchase Bill {purchase.bill_number}</h1>
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2"><Printer size={16} /> Print</button>
        <button onClick={() => navigate(`/app/purchases/${id}/edit`)} className="btn-primary flex items-center gap-2"><Edit size={16} /> Edit</button>
        <button onClick={handleDelete} className="btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>
      </div>

      {/* Professional Purchase Print Template */}
      <PurchasePrint purchase={purchase} items={items} org={org} />
    </div>
  )
}
