import { useState, useEffect } from 'react'
import api from '../api/client'
import { Upload, RefreshCw, ExternalLink } from 'lucide-react'

export default function DeployControl() {
  const [services, setServices] = useState({
    github: { status: 'checking', lastDeploy: null, url: 'https://github.com/armaankhan45-cmd/glob-erp' },
    render: { status: 'checking', lastDeploy: null, url: 'https://glob-erp-api.onrender.com' },
    vercel: { status: 'checking', lastDeploy: null, url: 'https://glob-erp.vercel.app' },
  })
  const [healthData, setHealthData] = useState(null)
  const [deploying, setDeploying] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [aiStatus, setAiStatus] = useState(null)
  const [logOutput, setLogOutput] = useState('')

  useEffect(() => {
    checkHealth()
    checkAIStatus()
  }, [])

  const checkHealth = async () => {
    try {
      const res = await api.get('/health')
      setHealthData(res.data)
      setServices(prev => ({
        ...prev,
        render: { ...prev.render, status: 'live' },
      }))
    } catch {
      setServices(prev => ({ ...prev, render: { ...prev.render, status: 'down' } }))
    }
  }

  const checkAIStatus = async () => {
    try {
      const res = await api.get('/ai/status')
      setAiStatus(res.data)
    } catch {}
  }

  const handleAction = (service, action) => {
    // Require confirmation for deploy/restart actions
    if (['deploy', 'restart', 'push'].includes(action)) {
      setConfirmAction({ service, action })
      return
    }
    executeAction(service, action)
  }

  const executeAction = async (service, action) => {
    setConfirmAction(null)
    setDeploying(service)
    setLogOutput(`⏳ ${action} on ${service}...\n`)

    try {
      if (action === 'health') {
        await checkHealth()
        setLogOutput(prev => prev + '✅ Health check complete!\n')
      } else if (action === 'diagnose') {
        const res = await api.post('/ai/chat', {
          messages: [{ role: 'user', content: 'Run a full system diagnosis and tell me the status' }]
        })
        setLogOutput(prev => prev + `\n📋 Diagnosis Result:\n${res.data.message}\n`)
      } else if (action === 'deploy') {
        setLogOutput(prev => prev + `\n🚀 Triggering deploy on ${service}...\n`)
        setLogOutput(prev => prev + `\n⚠️ Note: To deploy on Render, go to Render Dashboard → Manual Deploy.\nTo push code to GitHub, use: git push origin main\n\n`)
        setLogOutput(prev => prev + `✅ You can also ask the AI assistant to help with deployments!\n`)
      } else if (action === 'logs') {
        const res = await api.get('/health')
        setLogOutput(prev => prev + `\n📊 Server Status:\n${JSON.stringify(res.data, null, 2)}\n`)
      }
    } catch (err) {
      setLogOutput(prev => prev + `\n❌ Error: ${err.message}\n`)
    } finally {
      setDeploying(null)
    }
  }

  const ServiceCard = ({ name, icon, service, data }) => {
    const statusColors = {
      live: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)', color: '#22c55e', text: '● Live' },
      checking: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.2)', color: '#eab308', text: '● Checking...' },
      down: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', color: '#ef4444', text: '● Down' },
    }
    const s = statusColors[data.status] || statusColors.checking

    return (
      <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, transparent 60%, rgba(239,77,35,0.02) 100%)', pointerEvents: 'none' }}></div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            {icon}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-white">{name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
                {s.text}
              </span>
              {data.url && (
                <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center gap-1"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <ExternalLink size={10} /> Open
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {service === 'github' && (
            <>
              <button onClick={() => handleAction('github', 'logs')} className="deploy-action-btn">
                📂 Browse Repo Files
              </button>
              <button onClick={() => handleAction('github', 'deploy')} className="deploy-action-btn">
                ⬆️ Push Code Changes
              </button>
              <button onClick={() => window.open('https://github.com/armaankhan45-cmd/glob-erp', '_blank')} className="deploy-action-btn">
                🔗 Open GitHub
              </button>
            </>
          )}
          {service === 'render' && (
            <>
              <button onClick={() => handleAction('render', 'health')} className="deploy-action-btn">
                🏥 Health Check
              </button>
              <button onClick={() => handleAction('render', 'deploy')} className="deploy-action-btn accent">
                🚀 Deploy Now
              </button>
              <button onClick={() => handleAction('render', 'logs')} className="deploy-action-btn">
                📋 View Server Status
              </button>
              <button onClick={() => window.open('https://dashboard.render.com', '_blank')} className="deploy-action-btn">
                🔗 Open Render Dashboard
              </button>
            </>
          )}
          {service === 'vercel' && (
            <>
              <button onClick={() => handleAction('vercel', 'health')} className="deploy-action-btn">
                🏥 Check Frontend
              </button>
              <button onClick={() => handleAction('vercel', 'deploy')} className="deploy-action-btn accent">
                🔄 Redeploy Frontend
              </button>
              <button onClick={() => window.open('https://vercel.com/dashboard', '_blank')} className="deploy-action-btn">
                🔗 Open Vercel Dashboard
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            <Upload size={28} style={{ color: '#ef4d23' }} /> Deploy Control
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Manage GitHub, Render, and Vercel — admin only, every action requires confirmation
          </p>
        </div>
        <button onClick={() => { checkHealth(); checkAIStatus() }} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} /> Refresh All
        </button>
      </div>

      {/* Service Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <ServiceCard name="GitHub" icon="🐙" service="github" data={services.github} />
        <ServiceCard name="Render (Backend)" icon="🔵" service="render" data={services.render} />
        <ServiceCard name="Vercel (Frontend)" icon="▲" service="vercel" data={services.vercel} />
      </div>

      {/* Health Data */}
      {healthData && (
        <div className="card">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2">
            <Monitor size={16} style={{ color: '#4f8fff' }} /> Server Health
          </h3>
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

      {/* AI Provider Status */}
      {aiStatus && (
        <div className="card">
          <h3 className="font-bold text-white mb-3 flex items-center gap-2">
            <Globe size={16} style={{ color: '#a855f7' }} /> AI Providers
          </h3>
          <div className="flex flex-wrap gap-2">
            {aiStatus.providers?.map(p => (
              <span key={p} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', color: '#c084fc' }}>
                {p}
              </span>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Primary: {aiStatus.primaryProvider} • {aiStatus.toolsAvailable} tools available
          </p>
        </div>
      )}

      {/* Log Output */}
      <div className="card">
        <h3 className="font-bold text-white mb-3 flex items-center gap-2">
          <GitBranch size={16} style={{ color: '#22d3ee' }} /> Activity Log
        </h3>
        <div className="rounded-xl p-4 font-mono text-xs overflow-auto max-h-64"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)' }}>
          {logOutput || 'No activity yet. Click an action button above to get started.'}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="font-bold text-white mb-3">⚡ Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button onClick={() => handleAction('system', 'diagnose')} className="deploy-action-btn">
            🔍 Full Diagnosis
          </button>
          <button onClick={() => handleAction('render', 'health')} className="deploy-action-btn">
            🏥 Backend Health
          </button>
          <button onClick={() => window.open('https://glob-erp-api.onrender.com/api/setup', '_blank')} className="deploy-action-btn">
            🔧 Run /api/setup
          </button>
          <button onClick={() => window.open('https://glob-erp.vercel.app', '_blank')} className="deploy-action-btn">
            🌐 Open Live App
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div className="glass-panel p-6 max-w-md w-full text-center" style={{ animation: 'slideUp 0.3s ease-out' }}>
            <div className="text-4xl mb-4">⚠️</div>
            <h4 className="text-lg font-bold text-white mb-2">
              Confirm: {confirmAction.action} on {confirmAction.service}?
            </h4>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {confirmAction.action === 'deploy' 
                ? 'This will trigger a new deployment. The current live version will be replaced. Are you sure?'
                : confirmAction.action === 'restart'
                ? 'This will restart the service. There may be brief downtime.'
                : 'This action will modify the system. Are you sure you want to proceed?'
              }
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setConfirmAction(null)} className="btn-secondary px-6">
                Cancel
              </button>
              <button onClick={() => executeAction(confirmAction.service, confirmAction.action)} className="btn-primary px-6">
                ✓ Yes, {confirmAction.action}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .deploy-action-btn {
          width: 100%;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          font-family: 'Inter', sans-serif;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.45);
        }
        .deploy-action-btn:hover {
          background: rgba(239,77,35,0.06);
          border-color: rgba(239,77,35,0.2);
          color: #ef4d23;
        }
        .deploy-action-btn.accent {
          background: rgba(239,77,35,0.08);
          border-color: rgba(239,77,35,0.15);
          color: #ef4d23;
          font-weight: 600;
        }
        .deploy-action-btn.accent:hover {
          background: rgba(239,77,35,0.15);
          box-shadow: 0 0 15px rgba(239,77,35,0.15);
        }
      `}</style>
    </div>
  )
}
