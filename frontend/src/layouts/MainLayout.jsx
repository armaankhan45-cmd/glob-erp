import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { Menu, Bot, X, Send } from 'lucide-react'
import api from '../api/client'

function MiniMarkdown({ text }) {
  if (!text) return null
  const parts = text.split(/(```[\s\S]*?```)/g)
  return (
    <div className="text-xs leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const code = part.slice(3, -3).split('\n').slice(1).join('\n').trim()
          return <pre key={i} className="p-2 rounded text-[10px] font-mono my-1 overflow-x-auto max-h-24" style={{ background: 'rgba(0,0,0,0.4)', color: '#e8eaf0' }}>{code.substring(0, 500)}</pre>
        }
        const lines = part.split('\n')
        return lines.map((line, j) => {
          if (line.startsWith('# ')) return <div key={`${i}-${j}`} className="font-bold text-sm mt-1">{line.slice(2)}</div>
          if (line.startsWith('## ')) return <div key={`${i}-${j}`} className="font-bold mt-1">{line.slice(3)}</div>
          if (line.startsWith('- ')) return <div key={`${i}-${j}`} className="ml-2">• {line.slice(2)}</div>
          if (line.trim() === '') return <div key={`${i}-${j}`} className="h-1" />
          const boldParts = line.split(/(\*\*[^*]+\*\*)/g)
          return <div key={`${i}-${j}`}>{boldParts.map((bp, k) => {
            if (bp.startsWith('**') && bp.endsWith('**')) return <strong key={k}>{bp.slice(2, -2)}</strong>
            const codeParts = bp.split(/(`[^`]+`)/g)
            return codeParts.map((cp, l) => {
              if (cp.startsWith('`') && cp.endsWith('`')) return <code key={`${k}-${l}`} className="px-0.5 rounded text-[10px] font-mono" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>{cp.slice(1, -1)}</code>
              return <span key={`${k}-${l}`}>{cp}</span>
            })
          })}</div>
        })
      })}
    </div>
  )
}

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiMessages, setAiMessages] = useState([{ role: 'assistant', content: 'Hi! 👋 I\'m your **Nebula AI** assistant. What do you need?' }])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState(null)
  const [pageKey, setPageKey] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const miniChatRef = useRef(null)

  useEffect(() => { api.get('/ai/status').then(res => setAiStatus(res.data)).catch(() => {}) }, [])
  
  // Page transition on route change
  useEffect(() => {
    setAiOpen(false)
    setPageKey(prev => prev + 1)
  }, [location.pathname])

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
    <div className="flex h-screen overflow-hidden" style={{ background: '#080b14' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden relative" style={{ background: '#080b14' }}>
        {/* Animated Background Mesh */}
        <div className="bg-mesh">
          <div className="bg-orb"></div>
          <div className="bg-orb"></div>
          <div className="bg-orb"></div>
        </div>
        <div className="lg:hidden"><button onClick={() => setSidebarOpen(true)} className="p-4" style={{ color: 'rgba(255,255,255,0.6)' }}><Menu size={24} /></button></div>
        <TopBar />
        <main key={pageKey} className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth page-enter" style={{ background: 'transparent', position: 'relative', zIndex: 1 }}>
          <Outlet />
        </main>
      </div>
      {!location.pathname.includes('ai-assistant') && (
        <>
          {aiOpen && (
            <div ref={miniChatRef} className="fixed bottom-24 right-6 w-[380px] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
              style={{ maxHeight: '520px', animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)', background: 'rgba(12,16,32,0.97)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
              <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ background: 'rgba(6,182,212,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #06b6d4, #a855f7, #4f8fff)' }}><Bot size={16} className="text-white" /></div>
                  <div><span className="font-bold text-sm text-white">AI Assistant</span><div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>🆓 {aiStatus?.primaryProvider || 'Free AI'}</div></div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setAiOpen(false); navigate('/app/ai-assistant') }} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: 'rgba(255,255,255,0.4)' }}><Bot size={14} /></button>
                  <button onClick={() => setAiOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: 'rgba(255,255,255,0.4)' }}><X size={14} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: '340px', minHeight: '200px' }}>
                {aiMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`} style={{ animation: `slideUp 0.2s ease-out ${i * 0.05}s both` }}>
                    {m.role === 'assistant' && <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-0.5" style={{ background: 'linear-gradient(135deg, #06b6d4, #a855f7)' }}><Bot size={12} className="text-white" /></div>}
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 ${m.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'}`}
                      style={m.role === 'user' ? { background: 'linear-gradient(135deg, var(--accent), rgba(var(--accent-rgb),0.7))' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#e8eaf0' }}>
                      {m.role === 'user' ? <div className="text-xs whitespace-pre-wrap text-white">{m.content}</div> : <MiniMarkdown text={m.content} />}
                    </div>
                  </div>
                ))}
                {aiLoading && <div className="flex justify-start"><div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mr-2" style={{ background: 'linear-gradient(135deg, #06b6d4, #a855f7)' }}><Bot size={12} className="text-white" /></div><div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}><div className="flex items-center gap-2"><div className="flex gap-1"><div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)' }}></div><div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#a855f7', animationDelay: '150ms' }}></div><div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#4f8fff', animationDelay: '300ms' }}></div></div><span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Thinking...</span></div></div></div>}
              </div>
              {aiMessages.length <= 1 && <div className="px-3 pb-2 flex flex-wrap gap-1">{['🔍 Diagnose', '⚠️ Errors', '🚀 Deploy', '🔧 Fix'].map(s => <button key={s} onClick={() => aiSend(s.replace(/^[^\s]+\s/, ''))} className="text-[10px] px-2 py-1 rounded-lg chip" style={{ background: 'rgba(var(--accent-rgb),0.08)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.15)' }}>{s}</button>)}</div>}
              <div className="flex gap-2 p-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <input type="text" value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aiSend(aiInput) } }} placeholder="Ask me anything..." disabled={aiLoading} className="flex-1 text-xs px-3 py-2 rounded-xl disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }} />
                <button onClick={() => aiSend(aiInput)} disabled={aiLoading || !aiInput.trim()} className="p-2 rounded-xl text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}><Send size={14} /></button>
              </div>
            </div>
          )}
          <button id="ai-float-btn" onClick={() => setAiOpen(!aiOpen)} className="fab"
            style={{ background: aiOpen ? '#ef4444' : 'linear-gradient(135deg, var(--accent), #a855f7, #4f8fff)', animation: aiOpen ? 'none' : 'pulseGlow 3s ease-in-out infinite' }}>
            {aiOpen ? <X size={24} /> : <Bot size={24} />}
          </button>
        </>
      )}
    </div>
  )
}
