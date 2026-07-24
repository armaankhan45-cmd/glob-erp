import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { Menu, Bot, X, Send } from 'lucide-react'
import api from '../api/client'

function MiniMarkdown({ text }) {
  if (!text) return null
  const parts = text.split(/(```[\s\S]*?```)/g)
  return (
    <div className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const code = part.slice(3, -3).split('\n').slice(1).join('\n').trim()
          return <pre key={i} className="p-2 rounded text-[10px] font-mono my-1 overflow-x-auto max-h-24" style={{ background: 'var(--bg-glass-strong)', color: 'var(--text-light)' }}>{code.substring(0, 500)}</pre>
        }
        const lines = part.split('\n')
        return lines.map((line, j) => {
          if (line.startsWith('# ')) return <div key={`${i}-${j}`} className="font-bold text-sm mt-1" style={{ color: 'var(--text-primary)' }}>{line.slice(2)}</div>
          if (line.startsWith('## ')) return <div key={`${i}-${j}`} className="font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{line.slice(3)}</div>
          if (line.startsWith('- ')) return <div key={`${i}-${j}`} className="ml-2">• {line.slice(2)}</div>
          if (line.trim() === '') return <div key={`${i}-${j}`} className="h-1" />
          const boldParts = line.split(/(\*\*[^*]+\*\*)/g)
          return <div key={`${i}-${j}`}>{boldParts.map((bp, k) => {
            if (bp.startsWith('**') && bp.endsWith('**')) return <strong key={k}>{bp.slice(2, -2)}</strong>
            const codeParts = bp.split(/(`[^`]+`)/g)
            return codeParts.map((cp, l) => {
              if (cp.startsWith('`') && cp.endsWith('`')) return <code key={`${k}-${l}`} className="px-0.5 rounded text-[10px] font-mono" style={{ background: 'var(--bg-glass-strong)', color: 'var(--accent)' }}>{cp.slice(1, -1)}</code>
              return <span key={`${k}-${l}`}>{cp}</span>
            })
          })}</div>
        })
      })}
    </div>
  )
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}></div>
        <p className="text-sm mt-3 font-medium" style={{ color: 'var(--text-muted)' }}>Loading page...</p>
      </div>
    </div>
  )
}

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiMessages, setAiMessages] = useState([{ role: 'assistant', content: 'Hi! 👋 I\'m your **Nebula AI** assistant. What do you need?' }])
  const [aiLoading, setAiLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const miniChatRef = useRef(null)

  // ═══ Font Init — apply saved font on app startup ═══
  useEffect(() => {
    const savedFont = localStorage.getItem('selected_font')
    if (savedFont) {
      const SYSTEM_FONTS = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Calibri', 'Segoe UI', 'Tahoma', 'Trebuchet MS', 'Cambria', 'Consolas', 'Lucida Console', 'Impact', 'Comic Sans MS']
      if (!SYSTEM_FONTS.includes(savedFont)) {
        const fontFamily = savedFont.replace(/ /g, '+')
        const link = document.createElement('link')
        link.id = 'app-font-loader'
        link.href = 'https://fonts.googleapis.com/css2?family=' + fontFamily + ':wght@300;400;500;600;700;800;900&display=swap'
        link.rel = 'stylesheet'
        if (!document.getElementById('app-font-loader')) {
          document.head.appendChild(link)
        }
      }
      const style = document.createElement('style')
      style.id = 'app-font-style'
      style.textContent = "*, body, html, div, span, p, h1, h2, h3, h4, h5, h6, button, input, select, textarea, table, th, td, label, a, li, nav { font-family: '" + savedFont + "', system-ui, sans-serif !important; }"
      if (!document.getElementById('app-font-style')) {
        document.head.appendChild(style)
      }
      document.body.style.fontFamily = "'" + savedFont + "', system-ui, sans-serif"
    }

    // ═══ App Bold Init — apply saved bold state on startup ═══
    const savedBold = localStorage.getItem('appBold')
    if (savedBold === 'true') {
      document.documentElement.classList.add('app-bold-mode')
    }
  }, [])

  // ═══ PAGE TRANSITION ═══
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 600)
    return () => clearTimeout(timer)
  }, [])

  // Start keep-alive ping when layout loads
  useEffect(() => {
    try { api.startKeepAlive?.() } catch(e) {}
  }, [])

  const [aiStatus, setAiStatus] = useState(null)
  useEffect(() => { api.get('/ai/status').then(res => setAiStatus(res.data)).catch(() => {}) }, [])
  useEffect(() => { setAiOpen(false) }, [location.pathname])
  useEffect(() => {
    function handleClick(e) { if (aiOpen && miniChatRef.current && !miniChatRef.current.contains(e.target)) { const btn = document.getElementById('ai-float-btn'); if (btn && btn.contains(e.target)) return; setAiOpen(false) } }
    document.addEventListener('mousedown', handleClick); return () => document.removeEventListener('mousedown', handleClick)
  }, [aiOpen])

  const aiSend = useCallback(async (text) => {
    if (!text.trim() || aiLoading) return
    const msg = text.trim(); setAiInput(''); setAiMessages(prev => [...prev, { role: 'user', content: msg }]); setAiLoading(true)
    try {
      const allMessages = aiMessages.concat({ role: 'user', content: msg }).filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role, content: m.content }))
      const res = await api.post('/ai/chat', { messages: allMessages })
      setAiMessages(prev => [...prev, { role: 'assistant', content: res.data.message || 'No response', provider: res.data.provider }])
    } catch (err) { setAiMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${err.response?.data?.msg || err.message}` }]) }
    finally { setAiLoading(false) }
  }, [aiLoading, aiMessages])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Page Transition Overlay */}
      <div className="page-transition-overlay" style={{ opacity: loaded ? 0 : 1, pointerEvents: loaded ? 'none' : 'all' }}>
        <div className="page-transition-logo">
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, var(--accent), var(--accent-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 20, boxShadow: '0 0 30px rgba(var(--accent-rgb),0.3)' }}>G</div>
          <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: 3, textTransform: 'uppercase' }}>Loading</div>
          <div style={{ width: 120, height: 3, borderRadius: 2, background: 'rgba(var(--accent-rgb),0.15)', marginTop: 8, overflow: 'hidden' }}>
            <div style={{ width: '40%', height: '100%', borderRadius: 2, background: 'var(--accent)', animation: 'loadSlide 1s ease-in-out infinite' }}></div>
          </div>
        </div>
      </div>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
        <div className="lg:hidden"><button onClick={() => setSidebarOpen(true)} className="p-4" style={{ color: 'var(--text-secondary)' }}><Menu size={24} /></button></div>
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth" style={{ background: 'var(--bg-primary)' }}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      {!location.pathname.includes('ai-assistant') && (
        <>
          {aiOpen && (
            <div ref={miniChatRef} className="fixed bottom-24 right-6 w-[380px] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
              style={{ maxHeight: '520px', animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)', background: 'var(--bg-card)', border: '1px solid var(--border)', backdropFilter: 'blur(20px)' }}>
              <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ background: 'rgba(var(--accent-rgb),0.06)', borderBottom: '1px solid var(--border-md)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7, var(--accent2))' }}><Bot size={16} style={{ color: '#fff' }} /></div>
                  <div><span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>AI Assistant</span><div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>🆓 {aiStatus?.primaryProvider || 'Free AI'}</div></div>
                </div>
                <button onClick={() => setAiOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: 'var(--text-muted)' }}><X size={14} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: '340px', minHeight: '200px' }}>
                {aiMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-0.5" style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}><Bot size={12} style={{ color: '#fff' }} /></div>}
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 ${m.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'}`}
                      style={m.role === 'user' ? { background: 'linear-gradient(135deg, var(--accent), rgba(var(--accent-rgb),0.7))', color: '#fff' } : { background: 'var(--bg-glass)', border: '1px solid var(--border-md)', color: 'var(--text-light)' }}>
                      {m.role === 'user' ? <div className="text-xs whitespace-pre-wrap" style={{ color: '#fff' }}>{m.content}</div> : <MiniMarkdown text={m.content} />}
                    </div>
                  </div>
                ))}
                {aiLoading && <div className="flex justify-start"><div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg-glass)' }}><div className="flex items-center gap-2"><div className="flex gap-1"><div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)' }}></div><div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#a855f7', animationDelay: '150ms' }}></div></div><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Thinking...</span></div></div></div>}
              </div>
              <div className="flex gap-2 p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border-md)' }}>
                <input type="text" value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aiSend(aiInput) } }} placeholder="Ask me anything..." disabled={aiLoading} className="flex-1 text-xs px-3 py-2 rounded-xl disabled:opacity-50" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-md)', color: 'var(--text-bright)' }} />
                <button onClick={() => aiSend(aiInput)} disabled={aiLoading || !aiInput.trim()} className="p-2 rounded-xl disabled:opacity-50" style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)', color: '#fff' }}><Send size={14} /></button>
              </div>
            </div>
          )}
          <button id="ai-float-btn" onClick={() => setAiOpen(!aiOpen)} className="fab" style={{ background: aiOpen ? '#ef4444' : 'linear-gradient(135deg, var(--accent), #a855f7, var(--accent2))', animation: aiOpen ? 'none' : 'pulseGlow 3s ease-in-out infinite', color: '#fff' }}>
            {aiOpen ? <X size={24} /> : <Bot size={24} />}
          </button>
        </>
      )}

      {/* Animation Keyframes */}
      <style>{`
        .page-transition-overlay {
          position: fixed; inset: 0; z-index: 100000;
          background: var(--bg-primary); display: flex; align-items: center; justify-content: center;
          transition: opacity 0.6s cubic-bezier(0.16,1,0.3,1);
        }
        .page-transition-logo {
          display: flex; flex-direction: column; align-items: center; gap: 0;
        }
        @keyframes loadSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ripple { to { transform: scale(4); opacity: 0; } }
      `}</style>
    </div>
  )
}
