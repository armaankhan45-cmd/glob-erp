import { useState, useEffect } from 'react'
import api from '../api/client'

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16)
  const g = parseInt(hex.slice(3,5), 16)
  const b = parseInt(hex.slice(5,7), 16)
  return `${r},${g},${b}`
}

export default function DeployControl() {
  const [healthData, setHealthData] = useState(null)
  const [aiStatus, setAiStatus] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [logOutput, setLogOutput] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { checkHealth(); checkAI() }, [])

  const checkHealth = async () => {
    try {
      const res = await api.get('/health')
      setHealthData(res.data)
      addLog('✅ Backend is LIVE — health check passed')
    } catch (err) { addLog('❌ Backend health check failed: ' + err.message) }
  }

  const checkAI = async () => {
    try {
      const res = await api.get('/ai/status')
      setAiStatus(res.data)
      addLog('🤖 AI: ' + (res.data.primaryProvider || 'Unknown') + ' — ' + res.data.providers?.length + ' providers')
    } catch {}
  }

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogOutput(prev => prev + `[${time}] ${msg}\n`)
  }

  const runDiagnose = async () => {
    setLoading(true); addLog('🔍 Running full system diagnosis...')
    try {
      const res = await api.post('/ai/chat', { messages: [{ role: 'user', content: 'Run a full system diagnosis and tell me the status of everything' }] })
      addLog('📋 Diagnosis complete!'); addLog(res.data.message?.substring(0, 500))
    } catch (err) { addLog('❌ Diagnosis failed: ' + err.message) }
    setLoading(false)
  }

  // FIX #2: Setup now requires SETUP_SECRET — no longer opens bare /api/setup URL
  const runSetup = () => { addLog('⚠️ /api/setup is now secured with SETUP_SECRET. Use Render dashboard to set env vars.') }


  const handleAction = (action) => { setConfirmAction(action) }

  const executeAction = (action) => {
    setConfirmAction(null)
    if (action === 'deploy') {
      addLog('🚀 Deploy instructions:'); addLog('1. Push code to GitHub: git push origin main'); addLog('2. Render auto-deploys on push'); addLog('3. Vercel auto-deploys on push')
    } else if (action === 'restart') {
      addLog('🔄 To restart backend: Go to Render Dashboard → Manual Deploy → Deploy latest commit')
    }
  }

  const services = [
    { name: 'GitHub', icon: '🐙', desc: 'Code repository', url: 'https://github.com/armaankhan45-cmd/glob-erp', status: 'Connected', actions: [
      { label: '📂 Open Repo', fn: () => window.open('https://github.com/armaankhan45-cmd/glob-erp', '_blank') },
      { label: '📋 Commits', fn: () => window.open('https://github.com/armaankhan45-cmd/glob-erp/commits/main', '_blank') },
    ]},
    { name: 'Render (Backend)', icon: '🔵', desc: 'API server — Express.js + PostgreSQL', url: 'https://glob-erp-api.onrender.com', status: healthData ? 'Live' : 'Checking...', actions: [
      { label: '🏥 Health Check', fn: checkHealth },
      { label: '🚀 Deploy Now', fn: () => handleAction('deploy') },
      { label: '🔗 Dashboard', fn: () => window.open('https://dashboard.render.com', '_blank') },
    ]},
    { name: 'Vercel (Frontend)', icon: '▲', desc: 'React app — auto-deploys on push', url: 'https://glob-erp.vercel.app', status: 'Auto-deploy', actions: [
      { label: '🌐 Open Live App', fn: () => window.open('https://glob-erp.vercel.app', '_blank') },
      { label: '🔄 Redeploy', fn: () => handleAction('deploy') },
      { label: '🔗 Dashboard', fn: () => window.open('https://vercel.com/dashboard', '_blank') },
    ]},
  ]

  return (

    <div className="space-y-6" style={{ animation: 'slideUp 0.5s ease-out' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>🚀 Deploy Control</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Manage GitHub, Render, Vercel</p>
        </div>
        <button onClick={() => { checkHealth(); checkAI() }} className="btn-secondary flex items-center gap-2 text-sm">↻ Refresh</button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {services.map((s, i) => (
          <div key={i} className="card" style={{ animation: `slideUp 0.5s ease-out ${i * 0.1}s both` }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'rgba(255,255,255,0.04)' }}>{s.icon}</div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-white text-sm">{s.name}</h4>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.desc}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{ background: (s.status === 'Live' || s.status === 'Connected') ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)', color: (s.status === 'Live' || s.status === 'Connected') ? '#22c55e' : '#eab308', border: `1px solid ${(s.status === 'Live' || s.status === 'Connected') ? 'rgba(34,197,94,0.2)' : 'rgba(234,179,8,0.2)'}` }}>
                    ● {s.status}
                  </span>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[10px] accent-text">↗ Open</a>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {s.actions.map((a, j) => (
                <button key={j} onClick={a.fn} className="w-full text-left px-3 py-2 rounded-lg text-[12px] font-medium btn-secondary">{a.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {healthData && (
        <div className="card">
          <h3 className="font-bold text-white mb-3">🖥️ Server Health</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(healthData).slice(0, 8).map(([key, val]) => (
              <div key={key} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>{key}</p>
                <p className="text-sm font-semibold text-white mt-1">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {aiStatus && (
        <div className="card">
          <h3 className="font-bold text-white mb-3">🤖 AI Providers</h3>
          <div className="flex flex-wrap gap-2">
            {aiStatus.providers?.map(p => (
              <span key={p} className="px-3 py-1.5 rounded-lg text-xs font-medium accent-bg accent-border accent-text">{p}</span>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>Primary: {aiStatus.primaryProvider} • {aiStatus.toolsAvailable} tools</p>
        </div>
      )}

      <div className="card">
        <h3 className="font-bold text-white mb-3">⚡ Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button onClick={runDiagnose} disabled={loading} className="btn-primary px-3 py-2 rounded-lg text-xs font-medium disabled:opacity-50">🔍 Full Diagnosis</button>
          <button onClick={checkHealth} className="btn-secondary px-3 py-2 rounded-lg text-xs font-medium">🏥 Backend Health</button>
          <button onClick={runSetup} className="btn-secondary px-3 py-2 rounded-lg text-xs font-medium">🔧 Run /api/setup</button>
          <button onClick={() => window.open('https://glob-erp.vercel.app', '_blank')} className="btn-secondary px-3 py-2 rounded-lg text-xs font-medium">🌐 Open Live App</button>
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold text-white mb-3">📋 Activity Log</h3>
        <div className="rounded-xl p-4 font-mono text-xs overflow-auto max-h-64" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)' }}>
          {logOutput || 'No activity yet. Click an action button above to get started.'}
        </div>
      </div>

      {confirmAction && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="glass-panel p-6 max-w-md w-full text-center" style={{ animation: 'slideUp 0.3s ease-out' }}>
            <div className="text-4xl mb-4">⚠️</div>
            <h4 className="text-lg font-bold text-white mb-2">Confirm: {confirmAction}?</h4>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>This will trigger a new deployment. Are you sure?</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setConfirmAction(null)} className="btn-secondary px-6">Cancel</button>
              <button onClick={() => executeAction(confirmAction)} className="btn-primary px-6">✓ Yes, {confirmAction}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  
)
}
