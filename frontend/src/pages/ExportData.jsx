import { useState } from 'react'
import api from '../api/client'
import { Download, FileSpreadsheet, Loader2, Eye, TrendingUp, Hash, IndianRupee } from 'lucide-react'

const EXPORTS = [
  { key: 'invoices', label: 'Invoices' },
  { key: 'customers', label: 'Customers' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'payments', label: 'Payments' },
]

const money = (n) => n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function ExportData() {
  const [openKey, setOpenKey] = useState(null)
  const [preview, setPreview] = useState({})     // key -> { columns, rows, insights }
  const [loadingPreview, setLoadingPreview] = useState(null)
  const [loadingDownload, setLoadingDownload] = useState(null)

  const togglePreview = async (key) => {
    if (openKey === key) { setOpenKey(null); return }
    setOpenKey(key)
    if (preview[key]) return // cached, no need to refetch
    setLoadingPreview(key)
    try {
      const res = await api.get(`/export/${key}/preview`)
      setPreview(prev => ({ ...prev, [key]: res.data }))
    } catch (err) {
      setPreview(prev => ({ ...prev, [key]: { error: true } }))
    } finally {
      setLoadingPreview(null)
    }
  }

  const handleDownload = async (exp) => {
    setLoadingDownload(exp.key)
    try {
      const res = await api.get(`/export/${exp.key}.xlsx`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `${exp.key}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Export failed')
    } finally {
      setLoadingDownload(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Export Excel</h1>
        <p className="text-gray-500">Preview your data right here, or download a fully formatted .xlsx</p>
      </div>

      <div className="space-y-4">
        {EXPORTS.map(exp => {
          const data = preview[exp.key]
          const isOpen = openKey === exp.key
          return (
            <div key={exp.key} className="card overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={24} className="text-green-600" />
                  <div>
                    <p className="font-medium">{exp.label}</p>
                    <p className="text-sm text-gray-500">{exp.key}.xlsx</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => togglePreview(exp.key)} className="btn-secondary flex items-center gap-2">
                    {loadingPreview === exp.key ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                    {isOpen ? 'Hide' : 'Preview'}
                  </button>
                  <button onClick={() => handleDownload(exp)} disabled={loadingDownload === exp.key} className="btn-primary flex items-center gap-2">
                    {loadingDownload === exp.key ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    {loadingDownload === exp.key ? 'Exporting...' : 'Download'}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                  {loadingPreview === exp.key && <p className="text-sm text-gray-500">Loading preview…</p>}

                  {data?.error && <p className="text-sm text-red-500">Couldn't load preview.</p>}

                  {data && !data.error && (
                    <>
                      {/* Insights row */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="rounded-lg bg-gray-50 p-3 flex items-center gap-2">
                          <Hash size={16} className="text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Records</p>
                            <p className="font-semibold">{data.insights.count}</p>
                          </div>
                        </div>
                        {data.insights.total != null && (
                          <div className="rounded-lg bg-gray-50 p-3 flex items-center gap-2">
                            <IndianRupee size={16} className="text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">Total Value</p>
                              <p className="font-semibold">{money(data.insights.total)}</p>
                            </div>
                          </div>
                        )}
                        {data.insights.average != null && (
                          <div className="rounded-lg bg-gray-50 p-3 flex items-center gap-2">
                            <TrendingUp size={16} className="text-gray-400" />
                            <div>
                              <p className="text-xs text-gray-500">Average</p>
                              <p className="font-semibold">{money(data.insights.average)}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Table preview (first 50 rows, styled to resemble the exported sheet) */}
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-[#1E3A5F] text-white">
                              {data.columns.map(col => (
                                <th key={col.key} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{col.header}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {data.rows.slice(0, 50).map((row, i) => (
                              <tr key={i} className={i % 2 === 0 ? 'bg-[#F4F7FB]' : 'bg-white'}>
                                {data.columns.map(col => (
                                  <td key={col.key} className="px-3 py-1.5 whitespace-nowrap border-t border-gray-100">
                                    {col.key.match(/amount|subtotal|_gst_|cgst|sgst|igst/) && typeof row[col.key] === 'number'
                                      ? money(row[col.key])
                                      : (row[col.key] ?? '—')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {data.rows.length > 50 && (
                        <p className="text-xs text-gray-400 mt-2">Showing first 50 of {data.rows.length} rows — download the file for the full set.</p>
                      )}
                      {data.rows.length === 0 && (
                        <p className="text-sm text-gray-400 py-6 text-center">No {exp.label.toLowerCase()} yet.</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
