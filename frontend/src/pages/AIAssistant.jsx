import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { Bot, Send, X, Trash2, Lightbulb, ChevronDown, ChevronRight, Copy, Check, Cpu, Zap } from 'lucide-react'

// ═══════════════════════════════════════════════
// MARKDOWN RENDERER
// ═══════════════════════════════════════════════

function MarkdownText({ text }) {
  if (!text) return null
  
  // Split by code blocks first
  const parts = text.split(/(```[\s\S]*?```)/g)
  
  return (
    <div className="markdown-content" style={{ lineHeight: 1.65 }}>
      {parts.map((part, i) => {
        // Code block
        if (part.startsWith('```')) {
          const lines = part.slice(3, -3).split('\n')
          const lang = lines[0]?.trim() || ''
          const code = lines.slice(lang ? 1 : 0).join('\n').trim()
          return <CodeBlock key={i} language={lang} code={code} />
        }
        
        // Process inline markdown line by line
        return <span key={i}>{processInline(part)}</span>
      })}
    </div>
  )
}

function processInline(text) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    // Headers
    if (line.startsWith('### ')) return <div key={i} className="font-bold text-sm mt-2 mb-1">{processBold(line.slice(4))}</div>
    if (line.startsWith('## ')) return <div key={i} className="font-bold text-base mt-3 mb-1">{processBold(line.slice(3))}</div>
    if (line.startsWith('# ')) return <div key={i} className="font-bold text-lg mt-3 mb-1">{processBold(line.slice(2))}</div>
    
    // List items
    if (line.match(/^[-*]\s/)) return <div key={i} className="ml-3 flex"><span className="mr-2">•</span><span>{processBold(line.replace(/^[-*]\s/, ''))}</span></div>
    if (line.match(/^\d+\.\s/)) {
      const num = line.match(/^(\d+)\.\s/)[1]
      return <div key={i} className="ml-3 flex"><span className="mr-2 text-gray-500">{num}.</span><span>{processBold(line.replace(/^\d+\.\s/, ''))}</span></div>
    }
    
    // Empty line
    if (line.trim() === '') return <div key={i} className="h-2" />
    
    // Horizontal rule
    if (line.match(/^---+$/)) return <hr key={i} className="border-gray-200 my-2" />
    
    // Regular line
    return <div key={i}>{processBold(line)}{i < lines.length - 1 ? '' : ''}</div>
  })
}

function processBold(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    // Inline code
    const codeParts = part.split(/(`[^`]+`)/g)
    return codeParts.map((cp, j) => {
      if (cp.startsWith('`') && cp.endsWith('`')) {
        return <code key={`${i}-${j}`} className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-xs font-mono">{cp.slice(1, -1)}</code>
      }
      return <span key={`${i}-${j}`}>{cp}</span>
    })
  })
}

// ═══════════════════════════════════════════════
// CODE BLOCK WITH COPY BUTTON
// ═══════════════════════════════════════════════

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-gray-700 bg-gray-900">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 text-gray-400 text-xs">
        <span className="font-mono">{language || 'code'}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 hover:text-white transition-colors">
          {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs text-gray-100 font-mono leading-relaxed" style={{ maxWidth: '100%' }}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

// ═══════════════════════════════════════════════
// TOOL CALL DISPLAY
// ═══════════════════════════════════════════════

function ToolCallDisplay({ name, args, result, expanded: defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const success = result && !result.error
  const icon = success ? '✅' : '❌'
  
  return (
    <div className="my-1.5 border rounded-lg overflow-hidden text-xs">
      <button 
        onClick={() => setExpanded(!expanded)} 
        className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${success ? 'bg-green-50 hover:bg-green-100 text-green-800' : 'bg-red-50 hover:bg-red-100 text-red-800'}`}
      >
        <span>{icon}</span>
        <Cpu size={12} />
        <span className="font-mono font-medium">{name}</span>
        {args && Object.keys(args).length > 0 && (
          <span className="text-gray-500 truncate">{Object.entries(args).map(([k,v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', ')}</span>
        )}
        <span className="ml-auto">{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
      </button>
      {expanded && result && (
        <div className="bg-gray-900 text-gray-100 p-3 font-mono text-[10px] max-h-48 overflow-auto">
          <pre>{JSON.stringify(result, null, 2).substring(0, 2000)}</pre>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// SUGGESTIONS
// ═══════════════════════════════════════════════

const SUGGESTIONS = [
  { icon: '🔍', text: 'Run full system diagnosis' },
  { icon: '⚠️', text: 'Show recent errors' },
  { icon: '🔧', text: 'Fix all errors automatically' },
  { icon: '📊', text: 'How many invoices do I have?' },
  { icon: '📋', text: 'Check table structure of invoices' },
  { icon: '📄', text: 'Read the invoice routes code' },
  { icon: '⚙️', text: 'Show my current settings' },
  { icon: '🔢', text: 'Run a SQL query' },
  { icon: '📝', text: 'List all route files' },
  { icon: '💡', text: 'What can you do?' },
]

// ═══════════════════════════════════════════════
// MAIN AI ASSISTANT COMPONENT
// ═══════════════════════════════════════════════

export default function AIAssistant() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState(null)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    // Check AI status on mount
    api.get('/ai/status').then(res => setAiStatus(res.data)).catch(() => {})
    
    // Welcome message
    setMessages([{
      role: 'assistant',
      content: `# 👋 Welcome to Glob ERP AI Assistant!\n\nI'm your **personal ERP expert** — powered by **FREE AI** (no paid API needed!)\n\nI can do everything a developer can do:\n\n🔍 **Debug & Diagnose** — Check system health, find errors, identify issues\n🔧 **Fix Problems** — Auto-repair broken tables, missing columns, failed routes\n📝 **Write Code** — Read, modify, and create source code files on your server\n📊 **Query Data** — Run SQL queries, list records, check invoices\n⚙️ **Manage Settings** — View and update your ERP configuration\n\n### Quick Start:\nJust type what you need, like:\n- "My quotations are failing, fix it"\n- "Show me the invoice routes code"\n- "Add a column for phone numbers to customers table"\n- "How many unpaid invoices do I have?"\n\n🆓 **This AI is 100% FREE** — Powered by Pollinations AI (no API key needed, no signup, no credit card). You can also add your own free API keys in Render for even faster responses:\n\n- **Gemini 2.5 Pro** — Free at https://aistudio.google.com/apikey\n- **Groq** — Free at https://console.groq.com/keys\n- **DeepSeek** — Free at https://platform.deepseek.com\n\nBut you **don't need to** — the AI works right now, for free! 🎉`,
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
      
      // Remove the welcome message for the API call
      if (allMessages.length > 0 && allMessages[0].role === 'assistant') {
        allMessages.shift()
      }

      const res = await api.post('/ai/chat', { messages: allMessages })
      const data = res.data
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message || 'No response',
        toolCalls: data.toolCalls || [],
        provider: data.provider
      }])
    } catch (err) {
      const errMsg = err.response?.data?.msg || err.message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ **Error:** ${errMsg}\n\nThe AI service might be temporarily unavailable. Try again or use the Diagnostics page directly.`,
        toolCalls: [],
        isError: true
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: '🗑️ Chat cleared! How can I help you?',
      toolCalls: []
    }])
  }

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-gradient-to-br from-purple-500 via-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Bot size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              AI Assistant
            </h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-xs text-gray-500">
                🆓 {aiStatus?.aiEnabled 
                  ? (aiStatus.providers?.length > 1 
                    ? `${aiStatus.primaryProvider} +${aiStatus.providers.length - 1} more` 
                    : aiStatus.primaryProvider || 'AI')
                  : 'Free AI Active'} • {aiStatus?.toolsAvailable || 15} tools
              </span>
            </div>
          </div>
        </div>
        <button onClick={clearChat} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors" title="Clear chat">
          <Trash2 size={18} />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto bg-white rounded-2xl border shadow-sm mb-4" style={{ minHeight: 0 }}>
        <div className="p-5 space-y-5">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {/* AI Avatar */}
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 mr-3 mt-1">
                  <Bot size={16} className="text-white" />
                </div>
              )}
              
              <div className={`max-w-[85%] ${msg.role === 'user' ? '' : ''}`}>
                {/* Message bubble */}
                <div className={`rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-br-md' 
                    : msg.isError 
                      ? 'bg-red-50 text-red-800 border border-red-200 rounded-bl-md' 
                      : 'bg-gray-50 text-gray-800 border border-gray-100 rounded-bl-md'
                }`}>
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <MarkdownText text={msg.content} />
                  )}
                </div>
                
                {/* Tool calls display */}
                {msg.toolCalls?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.toolCalls.map((tc, j) => (
                      <ToolCallDisplay 
                        key={j} 
                        name={tc.name} 
                        args={tc.args} 
                        result={tc.result} 
                      />
                    ))}
                  </div>
                )}
                
                {/* Provider badge */}
                {msg.role === 'assistant' && msg.provider && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 font-medium">
                      {msg.provider === 'rule-based' ? '⚡ Rule-based' : msg.provider === 'fallback' ? '⚡ Fallback' : `🆓 ${msg.provider}`}
                    </span>
                  </div>
                )}
              </div>
              
              {/* User Avatar */}
              {msg.role === 'user' && (
                <div className="w-8 h-8 bg-gray-300 rounded-xl flex items-center justify-center flex-shrink-0 ml-3 mt-1">
                  <span className="text-xs font-bold text-gray-600">You</span>
                </div>
              )}
            </div>
          ))}
          
          {/* Loading indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 mr-3 mt-1">
                <Bot size={16} className="text-white" />
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-xs text-gray-500">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Suggestions — show when few messages */}
      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-2 mb-3 px-1">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => sendMessage(s.text)}
              className="text-xs px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>{s.icon}</span>
              <span>{s.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything — debug errors, write code, query data, fix problems..."
            disabled={loading}
            rows={1}
            className="w-full pl-4 pr-4 py-3 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-400 focus:border-purple-400 text-sm resize-none disabled:opacity-50 transition-all"
            style={{ minHeight: '48px', maxHeight: '120px' }}
            onInput={(e) => {
              e.target.style.height = '48px'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
        </div>
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          className="p-3 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-2xl hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-40 disabled:hover:shadow-none transition-all flex items-center justify-center"
          style={{ minWidth: '48px', height: '48px' }}
        >
          <Send size={20} />
        </button>
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-gray-400">
        <span>Glob ERP AI v3.0</span>
        <span>•</span>
        <span>🆓 100% Free AI</span>
        <span>•</span>
        <span>{aiStatus?.toolsAvailable || 15} tools available</span>
      </div>
    </div>
  )
}
