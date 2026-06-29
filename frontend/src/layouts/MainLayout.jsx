import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useTheme } from '../context/ThemeContext'
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
          return (
            <pre key={i} className="p-2 rounded text-[10px] font-mono my-1 overflow-x-auto max-h-24"
              style={{ background: 'rgba(0,0,0,0.4)', color: '#e8eaf0' }}>
              {code.substring(0, 500)}
            </pre>
          )
        }
        const lines = part.split('\n')
        return lines.map((line, j) => {
          if (line.startsWith('# ')) return <div key={`${i}-${j}`} className="font-bold text-sm mt-1">{line.slice(2)}</div>
          if (line.startsWith('## ')) return <div key={`${i}-${j}`} className="font-bold mt-1">{line.slice(3)}</div>
          if (line.startsWith('- ')) return <div key={`${i}-${j}`} className="ml-2">• {line.slice(2)}</div>
          if (line.trim() === '') return <div key={`${i}-${j}`} className="h-1" />
          const boldParts = line.split(/(\*\*[^*]+\*\*)/g)
          return <div key={`${i}-${j}`}>
            {boldParts.map((bp, k) => {
              if (bp.startsWith('**') && bp.endsWith('**')) return <strong key={k}>{bp.slice(2, -2)}</strong>
              const codeParts = bp.split(/(`[^`]+`)/g)
              return codeParts.map((cp, l) => {
                if (cp.startsWith('`') && cp.endsWith('`')) return <code key={`${k}-${l}`} className="px-0.5 rounded text-[10px] font-mono" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>{cp.slice(1, -1)}</code>
                return <span key={`${k}-${l}`}>{cp}</span>
              })
            })}
          </div>
        })
      })}
    </div>
  )
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16)
  const g = parseInt(hex.slice(3,5), 16)
  const b = parseInt(hex.slice(5,7), 16)
  return `${r},${g},${b}`
}

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiMessages, setAiMessages] = useState([
    { role: 'assistant', content: 'Hi! 👋 I\'m your **Nebula AI** assistant — I can **debug**, **deploy**, **write code**, and more! What do you need?' }
  ])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState(null)
  const { themeKey, themes } = useTheme()
  const accent = themes[themeKey]?.color || '#06b6d4'
  const navigate = useNavigate()
  const location = useLocation()
  const miniChatRef = useRef(null)

  useEffect(() => {
    api.get('/ai/status').then(res => setAiStatus(res.data)).catch(() => {})
  }, [])

  useEffect(() => { setAiOpen(false) }, [location.pathname])

  useEffect(() => {
    function handleClick(e) {
      if (aiOpen && miniChatRef.current && !miniChatRef.current.contains(e.target)) {
        const btn = document.getElementById('ai-float-btn')
        if (btn && btn.contains(e.target)) return
        setAiOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [aiOpen])

  const aiSend = async (text) => {
    if (!text.trim() || aiLoading) return
    const msg = text.trim()
    setAiInput('')
    setAiMessages(prev => [...prev, { role: 'user', content: msg }])
    setAiLoading(true)
    try {
      const allMessages = aiMessages
        .concat({ role: 'user', content: msg })
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))
      const res = await api.post('/ai/chat', { messages: allMessages })
      setAiMessages(prev => [...prev, { role: 'assistant', content: res.data.message || 'No response', provider: res.data.provider }])
    } catch (err) {
      setAiMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${err.response?.data?.msg || err.message}` }])
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#080b14' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-4" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <Menu size={24} />
          </button>
        </div>
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6" style={{ background: '#080b14' }}>
          <Outlet />
        </main>
      </div>

      {!location.pathname.includes('ai-assistant') && (
        <>
          {aiOpen && (
            <div ref={miniChatRef}
              className="fixed bottom-24 right-6 w-[380px] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
              style={{ maxHeight: '520px', animation: 'slideUp 0.2s ease-out', background: 'rgba(12,16,32,0.97)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
              <div className="px-4 py-3 flex items-center justify-between flex-shrink-0"
                style={{ background: `rgba(${hexToRgb(accent)}, 0.06)`, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${accent}, #a855f7, #4f8fff)` }}>
                    <Bot size={16} className="text-white" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-white">AI Assistant</span>
                    <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      🆓 {aiStatus?.primaryProvider || 'Free AI'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setAiOpen(false); navigate('/app/ai-assistant') }}
                    className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}
                    title="Open full page">
                    <Bot size={14} />
                  </button>
                  <button onClick={() => setAiOpen(false)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: '340px', minHeight: '200px' }}>
                {aiMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
                        style={{ background: `linear-gradient(135deg, ${accent}, #a855f7)` }}>
                        <Bot size={12} className="text-white" />
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 ${m.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'}`}
                      style={m.role === 'user'
                        ? { background: `linear-gradient(135deg, ${accent}, ${accent}99)` }
                        : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#e8eaf0' }
                      }>
                      {m.role === 'user' ? <div className="text-xs whitespace-pre-wrap text-white">{m.content}</div> : <MiniMarkdown text={m.content} />}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mr-2"
                      style={{ background: `linear-gradient(135deg, ${accent}, #a855f7)` }}>
                      <Bot size={12} className="text-white" />
                    </div>
                    <div className="rounded-xl px-3 py-2"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: accent, animationDelay: '0ms' }}></div>
                          <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#a855f7', animationDelay: '150ms' }}></div>
                          <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#4f8fff', animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {aiMessages.length <= 1 && (
                <div className="px-3 pb-2 flex flex-wrap gap-1">
                  {['🔍 Diagnose', '⚠️ Errors', '🚀 Deploy', '🔧 Fix'].map(s => (
                    <button key={s} onClick={() => aiSend(s.replace(/^[^\s]+\s/, ''))}
                      className="text-[10px] px-2 py-1 rounded-lg transition-colors"
                      style={{ background: `rgba(${hexToRgb(accent)}, 0.08)`, color: accent, border: `1px solid rgba(${hexToRgb(accent)}, 0.15)` }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 p-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <input type="text" value={aiInput} onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aiSend(aiInput) } }}
                  placeholder="Ask me anything..." disabled={aiLoading}
                  className="flex-1 text-xs px-3 py-2 rounded-xl disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }} />
                <button onClick={() => aiSend(aiInput)} disabled={aiLoading || !aiInput.trim()}
                  className="p-2 rounded-xl text-white disabled:opacity-50 transition-all"
                  style={{ background: `linear-gradient(135deg, ${accent}, #a855f7)` }}>
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}
          <button id="ai-float-btn" onClick={() => setAiOpen(!aiOpen)}
            className="fixed bottom-6 right-6 w-14 h-14 text-white rounded-full shadow-lg hover:scale-105 transition-all z-50 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${accent}, #a855f7, #4f8fff)`, animation: 'pulseGlow 3s ease-in-out infinite', boxShadow: `0 0 20px ${accent}4D` }}
            title="AI Assistant">
            {aiOpen ? <X size={24} /> : <Bot size={24} />}
          </button>
        </>
      )}
    </div>
  )
}
