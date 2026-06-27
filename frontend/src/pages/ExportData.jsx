import { useState } from 'react'
import api from '../api/client'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'

const exports = [
  { key: 'invoices', label: 'Export Invoices', filename: 'invoices.xlsx' },
  { key: 'customers', label: 'Export Customers', filename: 'customers.xlsx' },
  { key: 'purchases', label: 'Export Purchases', filename: 'purchases.xlsx' },
  { key: 'payments', label: 'Export Payments', filename: 'payments.xlsx' },
]

export default function ExportData() {
  const [loading, setLoading] = useState(null)

  const handleExport = async (exp) => {
    setLoading(exp.key)
    try {
      const res = await api.get(`/export/${exp.key}.xlsx`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = exp.filename
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Export failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Export Excel</h1>
      <p className="text-gray-500">Download your data as Excel (.xlsx) files</p>

      <div className="grid gap-4">
        {exports.map(exp => (
          <div key={exp.key} className="card flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={24} className="text-green-600" />
              <div>
                <p className="font-medium">{exp.label}</p>
                <p className="text-sm text-gray-500">{exp.filename}</p>
              </div>
            </div>
            <button onClick={() => handleExport(exp)} disabled={loading === exp.key} className="btn-primary flex items-center gap-2">
              {loading === exp.key ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {loading === exp.key ? 'Exporting...' : 'Export'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
