import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { Bot, Send, X, Trash2, Lightbulb, ChevronDown, ChevronRight, Copy, Check, Cpu, Zap, Image } from 'lucide-react'

// ═══════════════════════════════════════════════
// MARKDOWN RENDERER
// ═══════════════════════════════════════════════

function MarkdownText({ text }) {
  if (!text) return null
  const parts = text.split(/(```[\s\S]*?```)/g)
  return (
    <div className="markdown-content" style={{ lineHeight: 1.65 }}>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const lines = part.slice(3, -3).split('\n')
          const lang = lines[0]?.trim() || ''
          const code = lines.slice(lang ? 1 : 0).join('\n').trim()
          return <CodeBlock key={i} language={lang} code={code} />
        }
        return <span key={i}>{processInline(part)}</span>
      })}
    </div>
  )
}

function processInline(text) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    if (line.startsWith('### ')) return <div key={i} className="font-bold text-sm mt-2 mb-1">{processBold(line.slice(4))}</div>
    if (line.startsWith('## ')) return <div key={i} className="font-bold text-base mt-3 mb-1">{processBold(line.slice(3))}</div>
    if (line.startsWith('# ')) return <div key={i} className="font-bold text-lg mt-3 mb-1">{processBold(line.slice(2))}</div>
    if (line.match(/^[-*]\s/)) return <div key={i} className="ml-3 flex"><span className="mr-2">•</span><span>{processBold(line.replace(/^[-*]\s/, ''))}</span></div>
    if (line.match(/^\d+\.\s/)) {
      const num = line.match(/^(\d+)\.\s/)[1]
      return <div key={i} className="ml-3 flex"><span className="mr-2 text-gray-500">{num}.</span><span>{processBold(line.replace(/^\d+\.\s/, ''))}</span></div>
    }
    if (line.trim() === '') return <div key={i} className="h-2" />
    if (line.match(/^---+$/)) return <hr key={i} className="my-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
    // Image line: ![alt](url)
    const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/)
    if (imgMatch) return <div key={i} className="my-2"><img src={imgMatch[2]} alt={imgMatch[1]} className="rounded-lg max-w-full" style={{maxHeight:'300px', border: '1px solid rgba(255,255,255,0.08)'}} /></div>
    return <div key={i}>{processBold(line)}</div>
  })
}

function processBold(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    const codeParts = part.split(/(`[^`]+`)/g)
    return codeParts.map((cp, j) => {
      if (cp.startsWith('`') && cp.endsWith('`')) return <code key={`${i}-${j}`} className="px-1 py-0.5 rounded text-xs font-mono" style={{ background: 'rgba(239,77,35,0.12)', color: '#ef4d23' }}>{cp.slice(1, -1)}</code>
      return <span key={`${i}-${j}`}>{cp}</span>
    })
  })
}

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div className="my-2 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.4)' }}>
      <div className="flex items-center justify-between px-3 py-1.5 text-xs" style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
        <span className="font-mono">{language || 'code'}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 hover:text-white transition-colors">
          {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed" style={{ maxWidth: '100%', color: '#e8eaf0' }}><code>{code}</code></pre>
    </div>
  )
}

function ToolCallDisplay({ name, args, result, expanded: defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const success = result && !result.error
  const icon = success ? '✅' : '❌'
  return (
    <div className="my-1.5 rounded-lg overflow-hidden text-xs" style={{ border: '1px solid rgba(79,143,255,0.12)' }}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
        style={success 
          ? { background: 'rgba(34,197,94,0.06)', color: '#4ade80' }
          : { background: 'rgba(239,68,68,0.06)', color: '#f87171' }
        }>
        <span>{icon}</span><Cpu size={12} /><span className="font-mono font-medium">{name}</span>
        {args && Object.keys(args).length > 0 && <span style={{ color: 'rgba(255,255,255,0.25)' }} className="truncate">{Object.entries(args).map(([k,v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', ')}</span>}
        <span className="ml-auto">{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
      </button>
      {expanded && result && (
        <div className="p-3 font-mono text-[10px] max-h-48 overflow-auto"
          style={{ background: 'rgba(0,0,0,0.3)', color: '#e8eaf0' }}>
          <pre>{JSON.stringify(result, null, 2).substring(0, 2000)}</pre>
        </div>
      )}
    </div>
  )
}

const SUGGESTIONS = [
  { icon: '🔍', text: 'Run full system diagnosis' },
  { icon: '⚠️', text: 'Show recent errors' },
  { icon: '🔧', text: 'Fix all errors automatically' },
  { icon: '📊', text: 'How many invoices do I have?' },
  { icon: '🚀', text: 'Check deploy status' },
  { icon: '🖼️', text: 'Generate an image of a steel tank' },
]

const PROVIDER_LABELS = {
  'auto': '🔄 Auto (Best Available)',
  'Groq Llama 3.3 70B': '⚡ Groq (Fast)',
  'Gemini 2.5 Pro': '✨ Gemini Pro',
  'Gemini 2.5 Flash': '💫 Gemini Flash',
  'DeepSeek V3': '🧠 DeepSeek (Code)',
  'Cerebras': '🏃 Cerebras (Fast)',
  'Pollinations AI (Free)': '🌸 Pollinations (Free)',
  'OpenRouter': '🌐 OpenRouter',
}

export default function AIAssistant() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState(null)
  const [selectedProvider, setSelectedProvider] = useState('auto')
  const [showProviders, setShowProviders] = useState(false)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    api.get('/ai/status').then(res => setAiStatus(res.data)).catch(() => {})
    setMessages([{
      role: 'assistant',
      content: `# 👋 Welcome to Glob ERP AI Assistant!\n\nI'm your **personal ERP expert** — powered by **FREE AI**!\n\nI can do everything a developer can do:\n\n🔍 **Debug & Diagnose** — Check system health, find errors\n🔧 **Fix Problems** — Auto-repair broken tables, missing columns\n📝 **Write Code** — Read, modify, and create source code\n📊 **Query Data** — Run SQL queries, list records, check invoices\n🖼️ **Generate Images** — Create images from text descriptions\n🚀 **Deploy Control** — Deploy to Render, check GitHub/Vercel status\n🔄 **Server Management** — Restart server, check environment, view logs\n\n### Quick Start:\n- "Deploy the latest code to Render"\n- "Show me the invoice routes code"\n- "Generate an image of a steel tank"\n- "How many unpaid invoices do I have?"\n- "Check server health and environment"\n\n🆓 **100% FREE** — No API key, no signup, no credit card! 🎉\n\n💡 **Tip:** Use the provider dropdown ↑ to switch between AI models!`,
      toolCalls: []
    }])
  }, [])

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return
    const userMsg = text.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const allMessages = [...messages, { role: 'user', content: userMsg }]
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))
      if (allMessages.length > 0 && allMessages[0].role === 'assistant') allMessages.shift()

      // Check if user wants image generation
      const wantsImage = /\b(generate|create|draw|make|design)\b.*\b(image|img|picture|photo|logo|icon|illustration)\b/i.test(userMsg)

      if (wantsImage) {
        // Generate image using Pollinations Image API (FREE, no key!)
        try {
          const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(userMsg)}?width=1024&height=1024&nologo=true`
          // Pre-load the image
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.src = imageUrl
          
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `🖼️ **Image Generated!**\n\n![Generated Image](${imageUrl})\n\n*Prompt: "${userMsg}"*\n\n💡 You can right-click the image to save it, or ask me to generate another!`,
            toolCalls: [],
            provider: 'Pollinations Image (Free)'
          }])
        } catch (err) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `❌ Image generation failed: ${err.message}. Try a simpler description.`,
            toolCalls: [], provider: 'error'
          }])
        }
      } else {
        // Regular chat - send with provider preference
        const body = { messages: allMessages }
        if (selectedProvider !== 'auto') body.provider = selectedProvider
        
        const res = await api.post('/ai/chat', body)
        const data = res.data
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message || 'No response',
          toolCalls: data.toolCalls || [],
          provider: data.provider
        }])
      }
    } catch (err) {
      const errMsg = err.response?.data?.msg || err.message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ **Error:** ${errMsg}\n\nThe AI service might be temporarily unavailable. Try again.`,
        toolCalls: [], isError: true
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }
  const clearChat = () => { setMessages([{ role: 'assistant', content: '🗑️ Chat cleared! How can I help you?', toolCalls: [] }]) }

  const availableProviders = ['auto', ...(aiStatus?.providers || ['Pollinations AI (Free)'])]

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-8rem)] flex flex-col" style={{ position: 'relative' }}>
      {/* Background orbs */}
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', filter: 'blur(120px)', opacity: 0.15, pointerEvents: 'none', top: -100, right: -100, background: 'radial-gradient(circle, #a855f7, transparent)', animation: 'orbMove1 18s ease-in-out infinite' }}></div>
      <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', filter: 'blur(120px)', opacity: 0.1, pointerEvents: 'none', bottom: -100, left: -100, background: 'radial-gradient(circle, #4f8fff, transparent)', animation: 'orbMove2 22s ease-in-out infinite' }}></div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #ef4d23, #a855f7, #4f8fff)', animation: 'pulseGlow 4s infinite' }}>
            <Bot size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: '"Space Grotesk", sans-serif', background: 'linear-gradient(135deg, #ef4d23, #4f8fff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AI Assistant</h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e' }}></span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                🆓 {aiStatus?.aiEnabled 
                  ? (aiStatus.providers?.length > 1 
                    ? `${aiStatus.primaryProvider} +${aiStatus.providers.length - 1} more` 
                    : aiStatus.primaryProvider || 'AI')
                  : 'Free AI Active'} • {aiStatus?.toolsAvailable || 15} tools
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Provider Switcher */}
          <div className="relative">
            <button 
              onClick={() => setShowProviders(!showProviders)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
            >
              <Cpu size={14} style={{ color: '#ef4d23' }} />
              <span className="max-w-[120px] truncate">{PROVIDER_LABELS[selectedProvider] || selectedProvider}</span>
              <ChevronDown size={12} />
            </button>
            {showProviders && (
              <div className="absolute right-0 top-full mt-1 rounded-xl shadow-xl z-50 min-w-[220px] py-1 overflow-hidden"
                style={{ background: 'rgba(12,16,32,0.97)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}>
                {availableProviders.map(p => (
                  <button
                    key={p}
                    onClick={() => { setSelectedProvider(p); setShowProviders(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors"
                    style={selectedProvider === p 
                      ? { background: 'rgba(239,77,35,0.08)', color: '#ef4d23', fontWeight: 600 }
                      : { color: 'rgba(255,255,255,0.6)' }
                    }
                  >
                    {PROVIDER_LABELS[p] || p}
                    {selectedProvider === p && <Check size={14} className="ml-auto" style={{ color: '#ef4d23' }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={clearChat} className="p-2 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.3)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.background = 'transparent' }}
            title="Clear chat">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto rounded-2xl mb-4 relative z-10" style={{ minHeight: 0, background: 'rgba(14,18,36,0.5)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)' }}>
        <div className="p-5 space-y-5">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mr-3 mt-1"
                  style={{ background: 'linear-gradient(135deg, #ef4d23, #a855f7)' }}>
                  <Bot size={16} className="text-white" />
                </div>
              )}
              <div className={`max-w-[85%]`}>
                <div className={`rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user' ? 'rounded-br-md' 
                  : msg.isError ? 'rounded-bl-md' 
                  : 'rounded-bl-md'
                }`}
                  style={msg.role === 'user' 
                    ? { background: 'linear-gradient(135deg, #ef4d23, #ff6b35)', color: '#fff' }
                    : msg.isError 
                    ? { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }
                    : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#e8eaf0' }
                  }
                >
                  {msg.role === 'user' ? <div className="whitespace-pre-wrap">{msg.content}</div> : <MarkdownText text={msg.content} />}
                </div>
                {msg.toolCalls?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.toolCalls.map((tc, j) => <ToolCallDisplay key={j} name={tc.name} args={tc.args} result={tc.result} />)}
                  </div>
                )}
                {msg.role === 'assistant' && msg.provider && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {msg.provider === 'rule-based' ? '⚡ Rule-based' : msg.provider === 'fallback' ? '⚡ Fallback' : msg.provider.includes('Image') ? '🖼️ Image Gen' : `🆓 ${msg.provider}`}
                    </span>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ml-3 mt-1"
                  style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>You</span>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mr-3 mt-1"
                style={{ background: 'linear-gradient(135deg, #ef4d23, #a855f7)' }}>
                <Bot size={16} className="text-white" />
              </div>
              <div className="rounded-2xl rounded-bl-md px-4 py-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#ef4d23', animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#a855f7', animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#4f8fff', animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Suggestions */}
      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-2 mb-3 px-1 relative z-10">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => sendMessage(s.text)}
              className="text-xs px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
              style={{ background: 'rgba(239,77,35,0.06)', border: '1px solid rgba(239,77,35,0.12)', color: '#ef4d23' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,77,35,0.12)'; e.currentTarget.style.borderColor = 'rgba(239,77,35,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,77,35,0.06)'; e.currentTarget.style.borderColor = 'rgba(239,77,35,0.12)' }}
            >
              <span>{s.icon}</span><span>{s.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex gap-2 items-end relative z-10">
        <div className="flex-1 relative">
          <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Ask me anything — debug, deploy, write code, generate images..."
            disabled={loading} rows={1}
            className="w-full pl-4 pr-4 py-3 rounded-2xl text-sm resize-none disabled:opacity-50 transition-all"
            style={{ minHeight: '48px', maxHeight: '120px', background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.06)', color: '#fff' }}
            onInput={(e) => { e.target.style.height = '48px'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
          />
        </div>
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
          className="p-3 text-white rounded-2xl disabled:opacity-40 transition-all flex items-center justify-center"
          style={{ minWidth: '48px', height: '48px', background: 'linear-gradient(135deg, #ef4d23, #a855f7)' }}
        >
          <Send size={20} />
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] relative z-10" style={{ color: 'rgba(255,255,255,0.2)' }}>
        <span>Glob ERP AI v5.0 • Nebula</span>
        <span>•</span>
        <span>🆓 100% Free AI + Image Gen + Deploy</span>
        <span>•</span>
        <span>{aiStatus?.toolsAvailable || 15} tools</span>
      </div>
    </div>
  )
}
