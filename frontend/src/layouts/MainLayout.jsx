import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { Menu, Bot, X, Send, Copy, Check } from 'lucide-react'
import api from '../api/client'

// Mini markdown for floating chat
function MiniMarkdown({ text }) {
  if (!text) return null
  const parts = text.split(/(```[\s\S]*?```)/g)
  return (
    <div className="text-xs leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const code = part.slice(3, -3).split('\n').slice(1).join('\n').trim()
          return (
            <pre key={i} className="bg-gray-900 text-gray-100 p-2 rounded text-[10px] font-mono my-1 overflow-x-auto max-h-24">
              {code.substring(0, 500)}
            </pre>
          )
        }
        // Simple inline: bold + line breaks
        const lines = part.split('\n')
        return lines.map((line, j) => {
          if (line.startsWith('# ')) return <div key={`${i}-${j}`} className="font-bold text-sm mt-1">{line.slice(2)}</div>
          if (line.startsWith('## ')) return <div key={`${i}-${j}`} className="font-bold mt-1">{line.slice(3)}</div>
          if (line.startsWith('- ')) return <div key={`${i}-${j}`} className="ml-2">• {line.slice(2)}</div>
          if (line.trim() === '') return <div key={`${i}-${j}`} className="h-1" />
          // Bold
          const boldParts = line.split(/(\*\*[^*]+\*\*)/g)
          return <div key={`${i}-${j}`}>
            {boldParts.map((bp, k) => {
              if (bp.startsWith('**') && bp.endsWith('**')) return <strong key={k}>{bp.slice(2, -2)}</strong>
              // Inline code
              const codeParts = bp.split(/(`[^`]+`)/g)
              return codeParts.map((cp, l) => {
                if (cp.startsWith('`') && cp.endsWith('`')) return <code key={`${k}-${l}`} className="bg-gray-100 text-red-600 px-0.5 rounded text-[10px] font-mono">{cp.slice(1, -1)}</code>
                return <span key={`${k}-${l}`}>{cp}</span>
              })
            })}
          </div>
        })
      })}
    </div>
  )
}

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiMessages, setAiMessages] = useState([
    { role: 'assistant', content: 'Hi! 👋 I\'m your ERP AI assistant. I can **debug**, **fix errors**, **write code**, **run SQL**, and more. What do you need?' }
  ])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const miniChatRef = useRef(null)

  useEffect(() => {
    api.get('/ai/status').then(res => setAiStatus(res.data)).catch(() => {})
  }, [])

  // The mini chat now calls the real AI backend

  useEffect(() => {
    setAiOpen(false)
  }, [location.pathname])

  // Close mini chat when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (aiOpen && miniChatRef.current && !miniChatRef.current.contains(e.target)) {
        // Don't close if clicking the toggle button
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
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-4 text-gray-600">
            <Menu size={24} />
          </button>
        </div>
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Floating AI — not shown on the AI Assistant full page */}
      {!location.pathname.includes('ai-assistant') && (
        <>
          {/* Mini Chat Panel */}
          {aiOpen && (
            <div 
              ref={miniChatRef}
              className="fixed bottom-24 right-6 w-[380px] bg-white rounded-2xl shadow-2xl border z-50 flex flex-col overflow-hidden"
              style={{ maxHeight: '520px', animation: 'slideUp 0.2s ease-out' }}
            >
              <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }`}</style>
              
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Bot size={18} />
                  <div>
                    <span className="font-bold text-sm">AI Assistant</span>
                    <div className="text-[10px] opacity-80">
                      {aiStatus?.aiEnabled ? `✨ ${aiStatus.primaryProvider}` : '⚡ Rule-based'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => { setAiOpen(false); navigate('/app/ai-assistant') }} 
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" 
                    title="Open full page"
                  >
                    <Bot size={14} />
                  </button>
                  <button onClick={() => setAiOpen(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: '340px', minHeight: '200px' }}>
                {aiMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                        <Bot size={12} className="text-white" />
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                      m.role === 'user' 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-50 text-gray-800 border border-gray-100'
                    }`}>
                      {m.role === 'user' ? (
                        <div className="text-xs whitespace-pre-wrap">{m.content}</div>
                      ) : (
                        <MiniMarkdown text={m.content} />
                      )}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 mr-2">
                      <Bot size={12} className="text-white" />
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-[10px] text-gray-400">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Quick suggestions */}
              {aiMessages.length <= 1 && (
                <div className="px-3 pb-2 flex flex-wrap gap-1">
                  {['🔍 Diagnose', '⚠️ Errors', '🔧 Fix', '📊 Count invoices'].map(s => (
                    <button key={s} onClick={() => aiSend(s.replace(/^[^\s]+\s/, ''))} className="text-[10px] px-2 py-1 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 border border-purple-200 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              
              {/* Input */}
              <div className="flex gap-2 p-3 border-t flex-shrink-0 bg-white">
                <input
                  type="text"
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aiSend(aiInput) } }}
                  placeholder="Ask me anything..."
                  disabled={aiLoading}
                  className="flex-1 text-xs px-3 py-2 border rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-purple-400 disabled:opacity-50"
                />
                <button onClick={() => aiSend(aiInput)} disabled={aiLoading || !aiInput.trim()} className="p-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors">
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Floating Button */}
          <button
            id="ai-float-btn"
            onClick={() => setAiOpen(!aiOpen)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 text-white rounded-full shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-105 transition-all z-50 flex items-center justify-center"
            title="AI Assistant"
          >
            {aiOpen ? <X size={24} /> : <Bot size={24} />}
          </button>
        </>
      )}
    </div>
  )
}
