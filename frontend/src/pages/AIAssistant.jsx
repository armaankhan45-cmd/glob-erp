import { useState, useRef, useEffect, useCallback } from 'react'
import api from '../api/client'
import {
  Bot, Send, Trash2, ChevronDown, Copy, Check, Cpu, Sparkles,
  Wallet, BarChart3, Users, Boxes, FileText, Search, Wrench, Code2, Rocket,
  AlertTriangle, IndianRupee, PackageOpen, Receipt
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// MARKDOWN RENDERER (kept from original — works well)
// ═══════════════════════════════════════════════════════════════

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
    const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/)
    if (imgMatch) return <div key={i} className="my-2"><img src={imgMatch[2]} alt={imgMatch[1]} className="rounded-lg max-w-full" style={{ maxHeight: '300px', border: '1px solid rgba(255,255,255,0.08)' }} /></div>
    return <div key={i}>{processBold(line)}</div>
  })
}

function processBold(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    const codeParts = part.split(/(`[^`]+`)/g)
    return codeParts.map((cp, j) => {
      if (cp.startsWith('`') && cp.endsWith('`')) return <code key={`${i}-${j}`} className="px-1 py-0.5 rounded text-xs font-mono" style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)' }}>{cp.slice(1, -1)}</code>
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

// ═══════════════════════════════════════════════════════════════
// TOOL CALL DISPLAY — redesigned: clean chip with status + expandable detail
// ═══════════════════════════════════════════════════════════════
const TOOL_META = {
  get_business_overview: { icon: <BarChart3 size={12} />, label: 'Business overview' },
  get_dashboard_stats: { icon: <BarChart3 size={12} />, label: 'Dashboard stats' },
  get_gst_summary: { icon: <Receipt size={12} />, label: 'GST summary' },
  get_outstanding_invoices: { icon: <Wallet size={12} />, label: 'Outstanding invoices' },
  get_outstanding_bills: { icon: <FileText size={12} />, label: 'Outstanding bills' },
  get_top_customers: { icon: <Users size={12} />, label: 'Top customers' },
  search_customer: { icon: <Search size={12} />, label: 'Search customers' },
  get_inventory_status: { icon: <Boxes size={12} />, label: 'Inventory status' },
  get_recent_payments: { icon: <IndianRupee size={12} />, label: 'Recent payments' },
  get_expense_summary: { icon: <PackageOpen size={12} />, label: 'Expense summary' },
  diagnose_system: { icon: <AlertTriangle size={12} />, label: 'System diagnosis' },
  fix_system: { icon: <Wrench size={12} />, label: 'Auto-fix' },
  run_sql: { icon: <Code2 size={12} />, label: 'SQL query' },
  get_recent_errors: { icon: <AlertTriangle size={12} />, label: 'Recent errors' },
  read_file: { icon: <Code2 size={12} />, label: 'Read file' },
  write_file: { icon: <Code2 size={12} />, label: 'Write file' },
  deploy_render: { icon: <Rocket size={12} />, label: 'Deploy' },
}

function ToolCallDisplay({ name, args, result }) {
  const [expanded, setExpanded] = useState(false)
  const success = result && !result.error
  const meta = TOOL_META[name] || { icon: <Cpu size={12} />, label: name }
  return (
    <div className="my-1.5 rounded-lg overflow-hidden text-xs" style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-white/[0.03]">
        <span className={success ? 'text-green-400' : 'text-red-400'}>{success ? '✓' : '✕'}</span>
        <span style={{ color: 'var(--accent)' }}>{meta.icon}</span>
        <span className="font-medium text-white/70">{meta.label}</span>
        <span className="ml-auto text-white/25 flex items-center gap-0.5">{expanded ? <ChevronDown size={13} /> : 'details'}</span>
      </button>
      {expanded && result && (
        <div className="px-3 pb-2 pt-1 font-mono text-[10px] max-h-48 overflow-auto" style={{ background: 'rgba(0,0,0,0.25)', color: '#c9cede' }}>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2).substring(0, 1800)}</pre>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// WELCOME SCREEN — capability cards + smart suggestions
// ═══════════════════════════════════════════════════════════════
const CAPABILITIES = [
  { icon: <IndianRupee size={18} />, title: 'Business Numbers', desc: 'Revenue, profit, GST payable, receivables & payables', color: '#22c55e', chip: 'How is my business doing?' },
  { icon: <Wallet size={18} />, title: 'Money Tracking', desc: 'Who owes you, unpaid bills, recent payments, expenses', color: '#3b82f6', chip: 'Who owes me money?' },
  { icon: <Boxes size={18} />, title: 'Stock & Customers', desc: 'Inventory alerts, top customers, quick customer search', color: '#a855f7', chip: 'Am I low on stock?' },
  { icon: <Receipt size={18} />, title: 'GST & Compliance', desc: 'Output/input tax, net payable per FY', color: '#f97316', chip: 'How much GST do I owe?' },
  { icon: <Wrench size={18} />, title: 'System Doctor', desc: 'Diagnose, auto-fix errors, inspect tables & routes', color: '#ef4444', chip: 'Run full system diagnosis' },
  { icon: <Rocket size={18} />, title: 'Developer', desc: 'Read/write code, run SQL, check deploys & server', color: '#06b6d4', chip: 'Check deploy status' },
]

const SUGGESTIONS = [
  { icon: '📈', text: 'How is my business doing?' },
  { icon: '💰', text: 'Who owes me money?' },
  { icon: '🧾', text: 'How much GST do I owe?' },
  { icon: '🏦', text: 'What do I owe suppliers?' },
  { icon: '👑', text: 'Who is my top customer?' },
  { icon: '📦', text: 'Am I low on stock?' },
  { icon: '💵', text: 'What payments came in recently?' },
  { icon: '💸', text: 'What are my expenses?' },
]

const PROVIDER_LABELS = {
  'auto': '🔄 Auto (Best Available)',
  'Groq Llama 3.3 70B': '⚡ Groq Llama 3.3',
  'Gemini 2.5 Pro': '✨ Gemini Pro',
  'Gemini 2.5 Flash': '💫 Gemini Flash',
  'DeepSeek V3': '🧠 DeepSeek',
  'Cerebras': '🏃 Cerebras',
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

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, loading, scrollToBottom])

  useEffect(() => {
    api.get('/ai/status').then(res => setAiStatus(res.data)).catch(() => {})
    setMessages([{
      role: 'assistant',
      welcome: true,
      content: `# 👋 Namaste! I'm your Glob ERP Copilot\n\nI'm plugged into your **live ERP database**, so I can answer real business questions with **real numbers** — no guessing.\n\nTry asking:\n\n📈 **"How is my business doing?"** — revenue, profit, GST at a glance\n💰 **"Who owes me money?"** — unpaid & overdue invoices\n🧾 **"How much GST do I owe?"** — output vs input tax\n📦 **"Am I low on stock?"** — inventory alerts\n\n…or use me as your **system engineer**: diagnose errors, auto-fix issues, read/write code, and check deploys.`,
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

      // Image generation shortcut (free, no key)
      const wantsImage = /\b(generate|create|draw|make|design)\b.*\b(image|img|picture|photo|logo|icon|illustration)\b/i.test(userMsg)

      if (wantsImage) {
        try {
          const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(userMsg)}?width=1024&height=1024&nologo=true`
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `🖼️ **Image Generated!**\n\n![Generated Image](${imageUrl})\n\n*Prompt: "${userMsg}"*\n\n💡 Right-click the image to save it, or ask me for another.`,
            toolCalls: [],
            provider: 'Pollinations Image (Free)'
          }])
        } catch (err) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `❌ Image generation failed: ${err.message}. Try a simpler description.`,
            toolCalls: [], isError: true
          }])
        }
      } else {
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
        content: `❌ **Error:** ${errMsg}\n\nThe AI service might be temporarily unavailable. Try again in a moment.`,
        toolCalls: [], isError: true
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }
  const clearChat = () => setMessages([{ role: 'assistant', welcome: true, content: '🗑️ Chat cleared! What would you like to know?', toolCalls: [] }])

  const availableProviders = ['auto', ...(aiStatus?.providers || ['Pollinations AI (Free)'])]
  const toolCount = aiStatus?.toolsAvailable || 30
  const showWelcome = messages.length === 1 && messages[0].welcome

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-7rem)] flex flex-col" style={{ position: 'relative' }}>
      {/* Ambient background */}
      <div style={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', filter: 'blur(130px)', opacity: 0.14, pointerEvents: 'none', top: -120, right: -80, background: 'radial-gradient(circle, var(--accent), transparent)' }} />

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}>
            <Bot size={22} className="text-white" />
            <span className="absolute inset-0" style={{ background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)', animation: 'sheen 3.5s ease-in-out infinite' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: '"Space Grotesk", sans-serif', background: 'linear-gradient(135deg, var(--accent), #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Glob ERP Copilot</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {aiStatus?.primaryProvider || 'AI'} · {toolCount} tools · live database access
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Provider selector */}
          <div className="relative">
            <button onClick={() => setShowProviders(!showProviders)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)' }}>
              <Cpu size={13} style={{ color: 'var(--accent)' }} />
              <span className="max-w-[130px] truncate">{PROVIDER_LABELS[selectedProvider] || selectedProvider}</span>
              <ChevronDown size={12} style={{ color: 'rgba(255,255,255,0.35)' }} />
            </button>
            {showProviders && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProviders(false)} />
                <div className="absolute right-0 top-full mt-1 rounded-xl shadow-2xl z-50 min-w-[230px] py-1.5 overflow-hidden"
                  style={{ background: 'rgba(10,14,28,0.98)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}>
                  <p className="px-4 pt-1 pb-2 text-[10px] uppercase tracking-wider font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>AI Model</p>
                  {availableProviders.map(p => (
                    <button key={p} onClick={() => { setSelectedProvider(p); setShowProviders(false) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-left transition-colors"
                      style={selectedProvider === p ? { background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', fontWeight: 600 } : { color: 'rgba(255,255,255,0.65)' }}>
                      <span>{PROVIDER_LABELS[p] || p}</span>
                      {selectedProvider === p && <Check size={14} className="ml-auto" style={{ color: 'var(--accent)' }} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button onClick={clearChat} className="p-2 rounded-lg transition-colors" style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'transparent' }}
            title="Clear chat">
            <Trash2 size={17} />
          </button>
        </div>
      </div>

      {/* ── Chat area ── */}
      <div className="flex-1 overflow-y-auto rounded-2xl mb-3 relative z-10 scroll-smooth" style={{ minHeight: 0, background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="p-5 space-y-5">
          {showWelcome && (
            <div className="mb-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CAPABILITIES.map((c, i) => (
                  <button key={i} onClick={() => sendMessage(c.chip)}
                    className="group text-left rounded-xl p-3.5 transition-all hover:-translate-y-0.5"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = c.color + '66'; e.currentTarget.style.background = c.color + '0d' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ background: c.color + '1a', color: c.color }}>{c.icon}</div>
                    <p className="text-[13px] font-semibold text-white/90">{c.title}</p>
                    <p className="text-[11px] text-white/40 mt-0.5 leading-snug">{c.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mr-3 mt-1"
                  style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}>
                  <Bot size={16} className="text-white" />
                </div>
              )}
              <div className={`max-w-[85%] ${msg.role === 'assistant' ? 'group' : ''}`}>
                <div className={`rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'}`}
                  style={msg.role === 'user'
                    ? { background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #a855f7))', color: '#fff' }
                    : msg.isError
                      ? { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171' }
                      : { background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.06)', color: '#e8eaf0' }
                  }>
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
                      {msg.provider === 'rule-based' ? '⚡ Rule-based' : msg.provider === 'fallback' ? '⚡ Fallback engine' : msg.provider.includes('Image') ? '🖼️ Image Gen' : `✦ ${msg.provider}`}
                    </span>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ml-3 mt-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>You</span>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mr-3 mt-1" style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}>
                <Bot size={16} className="text-white" />
              </div>
              <div className="rounded-2xl rounded-bl-md px-4 py-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#a855f7', animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#4f8fff', animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Working…</span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* ── Quick suggestions ── */}
      {showWelcome && (
        <div className="flex flex-wrap gap-2 mb-3 px-1 relative z-10">
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => sendMessage(s.text)}
              className="text-xs px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5"
              style={{ background: 'rgba(var(--accent-rgb),0.07)', border: '1px solid rgba(var(--accent-rgb),0.14)', color: 'var(--accent)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.14)'; e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb),0.3)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.07)'; e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb),0.14)' }}>
              <span>{s.icon}</span><span>{s.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Input ── */}
      <div className="flex gap-2 items-end relative z-10">
        <div className="flex-1 relative">
          <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Ask about revenue, receivables, GST, stock — or ask me to diagnose & fix the system…"
            disabled={loading} rows={1}
            className="w-full pl-4 pr-4 py-3 rounded-2xl text-sm resize-none disabled:opacity-50 transition-all outline-none"
            style={{ minHeight: '48px', maxHeight: '120px', background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.08)', color: '#fff' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb),0.4)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
            onInput={(e) => { e.target.style.height = '48px'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }} />
        </div>
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
          className="p-3 text-white rounded-2xl disabled:opacity-40 transition-all flex items-center justify-center hover:scale-[1.03] active:scale-95"
          style={{ minWidth: '48px', height: '48px', background: 'linear-gradient(135deg, var(--accent), #a855f7)', boxShadow: '0 4px 18px rgba(var(--accent-rgb),0.3)' }}>
          <Send size={19} />
        </button>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-center gap-3 mt-2 text-[10px] relative z-10" style={{ color: 'rgba(255,255,255,0.2)' }}>
        <span className="flex items-center gap-1"><Sparkles size={10} /> Glob ERP Copilot</span>
        <span>•</span>
        <span>{toolCount} tools · answers from live data</span>
      </div>

      <style>{`
        @keyframes sheen { 0%,60% { transform: translateX(-120%) } 100% { transform: translateX(220%) } }
      `}</style>
    </div>
  )
}
