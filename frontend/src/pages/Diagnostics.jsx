import { useState } from 'react'
import api from '../api/client'
import { Activity, Database, AlertTriangle, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'

export default function Diagnostics() {
  const [report, setReport] = useState(null)
  const [errors, setErrors] = useState(null)
  const [tableInfo, setTableInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expandedTable, setExpandedTable] = useState(null)

  const runDiagnose = async () => {
    setLoading(true)
    try {
      const res = await api.get('/diagnose')
      setReport(res.data)
    } catch (err) {
      setReport({ success: false, msg: err.response?.data?.msg || err.message, status: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const loadErrors = async () => {
    try {
      const res = await api.get('/diagnose/errors')
      setErrors(res.data)
    } catch {}
  }

  const loadTableInfo = async (tableName) => {
    if (expandedTable === tableName) {
      setExpandedTable(null)
      return
    }
    setExpandedTable(tableName)
    try {
      const res = await api.get(`/diagnose/table/${tableName}`)
      setTableInfo(res.data)
    } catch {}
  }

  const getStatusColor = (status) => {
    if (status === 'healthy' || status === 'fixed') return 'text-green-600'
    if (status === 'issues_found') return 'text-yellow-600'
    return 'text-red-600'
  }

  const getStatusIcon = (status) => {
    if (status === 'healthy' || status === 'fixed') return <CheckCircle className="text-green-500" size={20} />
    if (status === 'issues_found') return <AlertTriangle className="text-yellow-500" size={20} />
    return <XCircle className="text-red-500" size={20} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity size={24} /> Self-Diagnostics
          </h1>
          <p className="text-gray-500 text-sm">Auto-detect and auto-fix errors in your ERP</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadErrors} className="btn-secondary text-sm">Show Errors</button>
          <button onClick={runDiagnose} disabled={loading} className="btn-primary flex items-center gap-2">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Running...' : 'Run Diagnose & Fix'}
          </button>
        </div>
      </div>

      {/* Quick action cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-blue-50 border-l-4 border-blue-500 cursor-pointer hover:shadow-md transition-shadow" onClick={runDiagnose}>
          <div className="flex items-center gap-3">
            <Database className="text-blue-500" size={24} />
            <div>
              <p className="font-bold text-blue-800">Full Diagnosis</p>
              <p className="text-xs text-blue-600">Check tables, columns, indexes, routes, data</p>
            </div>
          </div>
        </div>
        <div className="card bg-orange-50 border-l-4 border-orange-500 cursor-pointer hover:shadow-md transition-shadow" onClick={loadErrors}>
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-orange-500" size={24} />
            <div>
              <p className="font-bold text-orange-800">Recent Errors</p>
              <p className="text-xs text-orange-600">View errors that happened during runtime</p>
            </div>
          </div>
        </div>
        <div className="card bg-green-50 border-l-4 border-green-500">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-green-500" size={24} />
            <div>
              <p className="font-bold text-green-800">Auto-Fix</p>
              <p className="text-xs text-green-600">Missing tables/columns are auto-created on diagnose</p>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnose Report */}
      {report && (
        <div className="space-y-4">
          {/* Status Banner */}
          <div className={`card ${report.status === 'healthy' ? 'bg-green-50 border-green-300' : report.status === 'fixed' ? 'bg-blue-50 border-blue-300' : 'bg-red-50 border-red-300'} border-2`}>
            <div className="flex items-center gap-3">
              {getStatusIcon(report.status)}
              <div>
                <h2 className="text-lg font-bold">
                  {report.status === 'healthy' ? '✅ All Systems Healthy' : 
                   report.status === 'fixed' ? '🔧 Issues Auto-Fixed' : 
                   report.status === 'critical' ? '🚨 Critical Error' :
                   '⚠️ Issues Found'}
                </h2>
                <p className="text-sm text-gray-600">
                  {report.fixes?.length || 0} fixes applied, {report.errors?.length || 0} errors remaining
                  {report.started && ` • Checked at ${new Date(report.started).toLocaleString()}`}
                </p>
              </div>
            </div>
          </div>

          {/* Fixes Applied */}
          {report.fixes?.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                <CheckCircle size={18} /> Auto-Fixes Applied
              </h3>
              <div className="space-y-2">
                {report.fixes.map((fix, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-green-50 p-2 rounded-lg">
                    <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                    <span>
                      {fix.type === 'table_created' && `Created missing table "${fix.table}"`}
                      {fix.type === 'column_added' && `Added missing column "${fix.column}" to table "${fix.table}"`}
                      {fix.type === 'seed_data_inserted' && 'Inserted seed data (admin user, org)'}
                      {!fix.type?.startsWith('table') && !fix.type?.startsWith('column') && !fix.type?.startsWith('seed') && 
                        `${fix.type}: ${fix.table || ''} ${fix.column || ''}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {report.errors?.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                <XCircle size={18} /> Errors Found
              </h3>
              <div className="space-y-2">
                {report.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm bg-red-50 p-2 rounded-lg">
                    <XCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-red-800">{err.area}</span>
                      {err.table && <span className="text-red-600"> → {err.table}</span>}
                      {err.mount && <span className="text-red-600"> → {err.mount}</span>}
                      <p className="text-red-600 text-xs mt-1">{err.error || err.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tables Status */}
          <div className="card">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Database size={18} /> Database Tables
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(report.tables || {}).map(([table, status]) => (
                <div
                  key={table}
                  className={`p-2 rounded-lg text-xs cursor-pointer hover:shadow-sm transition-shadow border ${
                    status === 'exists' ? 'bg-green-50 border-green-200' :
                    status === 'created' ? 'bg-blue-50 border-blue-200' :
                    'bg-red-50 border-red-200'
                  }`}
                  onClick={() => loadTableInfo(table)}
                >
                  <div className="font-medium">{table}</div>
                  <div className={status === 'exists' ? 'text-green-600' : status === 'created' ? 'text-blue-600' : 'text-red-600'}>
                    {status === 'exists' ? '✅' : status === 'created' ? '🔧 Created' : '❌'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Routes Status */}
          <div className="card">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              🛣️ API Routes
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(report.routes || {}).map(([mount, info]) => (
                <div
                  key={mount}
                  className={`p-2 rounded-lg text-xs border ${
                    info.loaded ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="font-medium">{mount}</div>
                  <div className={info.loaded ? 'text-green-600' : 'text-red-600'}>
                    {info.loaded ? `✅ ${info.routes} routes` : `❌ FAILED`}
                  </div>
                  {!info.loaded && <div className="text-red-500 text-[10px] mt-1 truncate">{info.error}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* Table Detail */}
          {tableInfo && (
            <div className="card">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                📋 Table: {expandedTable}
              </h3>
              {tableInfo.hasMissingColumns && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                  <p className="text-red-700 font-medium text-sm">⚠️ Missing columns: {tableInfo.missingColumns.join(', ')}</p>
                  <p className="text-red-500 text-xs mt-1">Run "Diagnose & Fix" to auto-add them</p>
                </div>
              )}
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="pb-1.5 text-left font-medium">Column</th>
                    <th className="pb-1.5 text-left font-medium">Type</th>
                    <th className="pb-1.5 text-left font-medium">Nullable</th>
                    <th className="pb-1.5 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tableInfo.columnDetails?.map(col => (
                    <tr key={col.column_name} className="border-b border-gray-50">
                      <td className="py-1.5 font-medium">{col.column_name}</td>
                      <td className="py-1.5 text-gray-500">{col.data_type}</td>
                      <td className="py-1.5 text-gray-500">{col.is_nullable}</td>
                      <td className="py-1.5">
                        {tableInfo.missingColumns?.length > 0 ? 
                          (tableInfo.missingColumns.includes(col.column_name) ? 
                            <span className="text-red-500">❌ Missing</span> : 
                            <span className="text-green-500">✅</span>) :
                          <span className="text-green-500">✅</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recent Errors */}
      {errors && (
        <div className="card">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-500" /> Recent Errors ({errors.count})
          </h3>
          {errors.errors?.length === 0 ? (
            <p className="text-gray-400 text-sm italic">No errors recorded — everything is working!</p>
          ) : (
            <div className="space-y-2">
              {errors.errors.map((err, i) => (
                <div key={i} className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-orange-800">
                      {err.method} {err.url || err.area}
                    </span>
                    <span className="text-orange-500">{new Date(err.time).toLocaleString()}</span>
                  </div>
                  <p className="text-orange-700">{err.error}</p>
                  {err.body && <p className="text-orange-500 mt-1 font-mono truncate">Body: {err.body}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info box */}
      <div className="card bg-gray-50">
        <h3 className="font-bold mb-2">ℹ️ How Self-Healing Works</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <p className="font-medium text-gray-800 mb-1">Auto-Fixes on Startup:</p>
            <ul className="list-disc ml-4 space-y-0.5 text-xs">
              <li>Missing database tables → created automatically</li>
              <li>Missing database columns → added automatically</li>
              <li>Missing indexes → created automatically</li>
              <li>Missing seed data (admin user) → inserted automatically</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-800 mb-1">Runtime Protections:</p>
            <ul className="list-disc ml-4 space-y-0.5 text-xs">
              <li>Empty date strings → auto-converted to null</li>
              <li>Wrong column names (total→total_amount) → auto-renamed</li>
              <li>Frontend-only fields (customer_name, etc.) → auto-stripped</li>
              <li>Failed routes → tracked with error details, not silent 404</li>
              <li>All runtime errors → logged and tracked</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
