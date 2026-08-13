import { useState, useEffect } from 'react'
import api from '../api/client'
import { formatCurrency, formatDate } from '../utils'

export default function Reports() {
  const [tab, setTab] = useState('item-wise')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => { loadData() }, [tab])

  const loadData = async () => {
    setLoading(true)
    setData([])
    try {
      let url = ''
      if (tab === 'item-wise') url = '/reports/item-wise-sales'
      else if (tab === 'customer-wise') url = '/reports/customer-wise-sales'
      else if (tab === 'ageing') url = '/reports/ageing'
      
      if (url) {
        const params = {}
        if (from) params.from = from
        if (to) params.to = to
        const res = await api.get(url, { params })
        setData(res.data.data || res.data.buckets || res.data)
      }
    } catch (err) {
      console.error('Reports error:', err)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'item-wise', label: 'Item-wise Sales' },
    { id: 'customer-wise', label: 'Customer-wise Sales' },
    { id: 'ageing', label: 'Outstanding Ageing' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reports</h1>

      <div className="flex gap-2 border-b">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3 mb-2">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-field w-auto" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-field w-auto" />
        <button onClick={loadData} className="btn-primary text-sm">Apply Filter</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>
      ) : (
        <div className="card">
          {tab === 'ageing' ? (
            <div className="space-y-6">
              {data && typeof data === 'object' && !Array.isArray(data) ? (
                Object.entries(data).map(([bucket, invoices]) => (
                  <div key={bucket}>
                    <h3 className="font-bold text-lg mb-2">{bucket} days <span className="text-gray-400 text-sm font-normal">({invoices?.length || 0} invoices)</span></h3>
                    {invoices && invoices.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead><tr className="border-b text-gray-500 text-left">
                          <th className="pb-2">Invoice</th><th className="pb-2">Customer</th><th className="pb-2">Days</th><th className="pb-2 text-right">Amount</th>
                        </tr></thead>
                        <tbody>
                          {invoices.map(inv => (
                            <tr key={inv.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                              <td className="py-2">{inv.invoice_number}</td>
                              <td className="py-2">{inv.customer_name}</td>
                              <td className="py-2">{inv.days}</td>
                              <td className="py-2 text-right font-medium">{formatCurrency(inv.total_amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <p className="text-gray-400 text-sm">No invoices in this bucket</p>}
                  </div>
                ))
              ) : <p className="text-gray-400">No ageing data</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-gray-500 text-left">
                  {tab === 'item-wise' ? (
                    <><th className="pb-2">Description</th><th className="pb-2">HSN</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Amount</th></>
                  ) : (
                    <><th className="pb-2">Customer</th><th className="pb-2">GSTIN</th><th className="pb-2 text-right">Invoices</th><th className="pb-2 text-right">Amount</th></>
                  )}
                </tr></thead>
                <tbody>
                  {Array.isArray(data) && data.map((row, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
                      {tab === 'item-wise' ? (
                        <><td className="py-2">{row.description}</td><td className="py-2">{row.hsn_code}</td><td className="py-2 text-right">{row.total_qty}</td><td className="py-2 text-right font-medium">{formatCurrency(row.total_amount)}</td></>
                      ) : (
                        <><td className="py-2">{row.customer_name}</td><td className="py-2 font-mono text-xs">{row.gstin || '-'}</td><td className="py-2 text-right">{row.invoice_count}</td><td className="py-2 text-right font-medium">{formatCurrency(row.total_amount)}</td></>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {Array.isArray(data) && data.length === 0 && <p className="text-center text-gray-400 py-8">No data available</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
