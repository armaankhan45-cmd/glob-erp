import { useState, useRef, useEffect } from 'react'
import api from '../api/client'
import { Bot, Send, X, Trash2, Lightbulb } from 'lucide-react'

const SUGGESTIONS = [
  'Fix the last error that happened',
  'Run a health check on the system',
  'Show me recent errors',
  'What features are not working?',
  'Check if all database tables exist',
  'How do I change my invoice format?',
  'Reset the admin password',
  'Add a new HSN code mapping',
]

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I'm your **Glob ERP AI Assistant** 🤖

I can help you:
- 🔍 **Diagnose & fix errors** in your ERP
- 📊 **Check system health** (tables, routes, connections)
- 🛠️ **Run repairs** when something breaks
- 💡 **Answer questions** about how to use features
- 📋 **View recent errors** and suggest fixes

Just tell me what you need, like "fix the last error" or "check system health"!`
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return
    
    const userMsg = text.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      // The AI assistant calls the backend diagnose/health endpoints and processes user requests
      const response = await processUserMessage(userMsg)
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${err.message}\n\nI couldn't process your request. Try again or check the Diagnostics page manually.`, isError: true }])
    } finally {
      setLoading(false)
    }
  }

  const processUserMessage = async (msg) => {
    const lower = msg.toLowerCase()

    // Health check
    if (lower.includes('health') || lower.includes('check') || lower.includes('diagnos') || lower.includes('status')) {
      try {
        const res = await api.get('/diagnose')
        const data = res.data
        const tableCount = Object.keys(data.tables || {}).length
        const existingTables = Object.values(data.tables || {}).filter(v => v === 'exists').length
        const createdTables = Object.values(data.tables || {}).filter(v => v === 'created').length
        const routeCount = Object.keys(data.routes || {}).length
        const loadedRoutes = Object.values(data.routes || {}).filter(v => v.loaded).length
        const failedRoutes = Object.values(data.routes || {}).filter(v => !v.loaded).length

        let status = '✅ HEALTHY'
        let details = ''
        if (data.status === 'fixed') { status = '🔧 FIXED (issues auto-repaired)'; details = `\n\n**Auto-fixes applied:** ${data.fixes?.length || 0}` }
        if (data.status === 'issues_found') { status = '⚠️ ISSUES FOUND'; details = `\n\n**Errors:** ${data.errors?.length || 0}` }
        if (data.status === 'critical') { status = '🚨 CRITICAL'; details = '\n\n**Database connection may be down!**' }

        let failedList = ''
        if (failedRoutes > 0) {
          failedList = '\n\n**Failed Routes:**\n' + Object.entries(data.routes || {})
            .filter(([, v]) => !v.loaded)
            .map(([mount, v]) => `- ❌ ${mount}: ${v.error}`)
            .join('\n')
        }

        let fixesList = ''
        if (data.fixes?.length > 0) {
          fixesList = '\n\n**Auto-fixes applied:**\n' + data.fixes.map(f => `- ✅ ${f.type}: ${f.table || ''} ${f.column || ''}`).join('\n')
        }

        return `🔍 **System Health Report**

**Status:** ${status}
**Database Tables:** ${existingTables}/${tableCount} exist${createdTables > 0 ? `, ${createdTables} created` : ''}
**API Routes:** ${loadedRoutes}/${routeCount} loaded${failedRoutes > 0 ? `, ${failedRoutes} FAILED` : ''}
**Fixes Applied:** ${data.fixes?.length || 0}
**Errors Remaining:** ${data.errors?.length || 0}${details}${fixesList}${failedList}`
      } catch (err) {
        return `❌ Could not reach the diagnostics endpoint. The server might be down.\n\nError: ${err.message}`
      }
    }

    // Recent errors
    if (lower.includes('error') || lower.includes('recent') || lower.includes('what broke') || lower.includes('what failed')) {
      try {
        const res = await api.get('/diagnose/errors')
        const errors = res.data.errors || []
        if (errors.length === 0) {
          return '✅ **No recent errors!** Everything is working smoothly.'
        }
        const errorList = errors.slice(0, 10).map((e, i) => 
          `${i + 1}. **${e.area || e.method || 'Runtime'}** ${e.url || ''}\n   ${e.error}\n   _${new Date(e.time).toLocaleString()}_`
        ).join('\n\n')
        return `⚠️ **Recent Errors (${errors.length}):**\n\n${errorList}\n\n💡 _Say "fix the last error" to run diagnostics and auto-fix_`
      } catch (err) {
        return `❌ Could not fetch errors: ${err.message}`
      }
    }

    // Fix / repair
    if (lower.includes('fix') || lower.includes('repair') || lower.includes('solve') || lower.includes('broken')) {
      try {
        const res = await api.get('/diagnose')
        const data = res.data
        
        if (data.status === 'healthy') {
          return '✅ **System is already healthy!** No issues to fix.'
        }

        let result = `🔧 **Auto-Fix Results:**\n\n**Status:** ${data.status}\n`

        if (data.fixes?.length > 0) {
          result += `\n**Fixes Applied (${data.fixes.length}):**\n` + 
            data.fixes.map(f => {
              if (f.type === 'table_created') return `✅ Created missing table "${f.table}"`
              if (f.type === 'column_added') return `✅ Added column "${f.column}" to table "${f.table}"`
              if (f.type === 'seed_data_inserted') return `✅ Inserted seed data (admin user, org)`
              return `✅ ${f.type}: ${f.table || ''} ${f.column || ''}`
            }).join('\n')
        }

        if (data.errors?.length > 0) {
          result += `\n\n**Remaining Issues (${data.errors.length}):**\n` +
            data.errors.map(e => `❌ ${e.area}: ${e.error || e.message}`).join('\n')
          result += '\n\n⚠️ Some issues cannot be auto-fixed. Check the Diagnostics page for details.'
        }

        return result
      } catch (err) {
        return `❌ Could not run auto-fix: ${err.message}\n\nTry visiting the Diagnostics page manually at /app/diagnostics`
      }
    }

    // Table info
    if (lower.includes('table') || lower.includes('database') || lower.includes('column')) {
      try {
        const res = await api.get('/diagnose')
        const tables = res.data.tables || {}
        const tableList = Object.entries(tables).map(([name, status]) => {
          const icon = status === 'exists' ? '✅' : status === 'created' ? '🔧' : '❌'
          return `${icon} ${name}`
        }).join('\n')
        return `📊 **Database Tables:**\n\n${tableList}\n\n💡 _Say "check table [name]" for column details_`
      } catch (err) {
        return `❌ Could not fetch table info: ${err.message}`
      }
    }

    // Specific table check
    const tableMatch = lower.match(/check table (\w+)/)
    if (tableMatch) {
      try {
        const res = await api.get(`/diagnose/table/${tableMatch[1]}`)
        const data = res.data
        if (!data.exists) return `❌ Table "${tableMatch[1]}" does NOT exist!`
        
        let result = `📋 **Table: ${data.table}**\n\n**Columns (${data.actualColumns?.length || 0}):**\n`
        result += (data.columnDetails || []).map(c => `- ${c.column_name} (${c.data_type}, ${c.is_nullable === 'YES' ? 'nullable' : 'required'})`).join('\n')
        
        if (data.missingColumns?.length > 0) {
          result += `\n\n⚠️ **Missing columns:** ${data.missingColumns.join(', ')}\n💡 _Run "fix errors" to auto-add them_`
        }
        return result
      } catch (err) {
        return `❌ Could not check table: ${err.message}`
      }
    }

    // How-to questions
    if (lower.includes('how') || lower.includes('change') || lower.includes('setting') || lower.includes('invoice format') || lower.includes('quotation format')) {
      if (lower.includes('invoice format') || lower.includes('invoice font') || lower.includes('invoice text')) {
        return `📝 **Changing Invoice Format:**\n\n1. Go to **Settings** page (/app/settings)\n2. Scroll to **"Invoice Text Settings"**\n3. Change:\n   - Font Family (Arial, Georgia, etc.)\n   - Font Size (8-14pt)\n   - Description Size\n   - Bold/Normal text\n4. Click **Save All Settings**\n\n💡 You can also upload your **stamp** and **signature** in the Images section — they'll auto-appear on invoices!`
      }
      if (lower.includes('quotation format') || lower.includes('quotation font')) {
        return `📝 **Changing Quotation Format:**\n\n1. Go to **Settings** page (/app/settings)\n2. Scroll to **"Quotation Font Settings"**\n3. Change font family and size\n4. On any Quotation detail page, use the **Name size buttons** (10-20) and **Bold ON/OFF** to adjust\n5. Click **Save All Settings**`
      }
      if (lower.includes('password') || lower.includes('reset')) {
        return `🔐 **Reset Password:**\n\n1. Go to **Settings** page (/app/settings)\n2. Scroll to **"Change Password"**\n3. Enter your current password and new password\n4. Click "Change Password"\n\nIf you're locked out, go to the login page and click "Forgot Password".`
      }
      if (lower.includes('hsn') || lower.includes('auto detect')) {
        return `🔢 **HSN Auto-Detect:**\n\nThe system automatically suggests HSN codes based on item descriptions:\n- **SS TANK** → HSN 7309\n- **CHASSIS** → HSN 8708\n- **VALVE** → HSN 8481\n- **PIPE** → HSN 7307\n\nJust type the description and the HSN field will auto-fill! You can also manually select from the HSN dropdown.`
      }
      return `💡 **Settings Help:**\n\nGo to **Settings** (/app/settings) to change:\n- Company details & GSTIN\n- Bank details & UPI\n- Logo, stamp, signature uploads\n- Invoice & quotation fonts\n- Print layout (letterhead space)\n- Document numbering prefixes\n\nWhat specific setting do you need help with?`
    }

    // GST reports
    if (lower.includes('gst report') || lower.includes('gst pay') || lower.includes('tax report')) {
      return `📊 **GST Reports:**\n\nGo to **GST Reports** (/app/gst) to see:\n- Monthly sales & purchase GST\n- How much GST you need to pay\n- Carry-forward balance to next month\n- Drill-down into individual bills\n\nThe report calculates: **Output GST (Sales) - Input GST (Purchases) = GST Payable/Credit**`
    }

    // Share / WhatsApp / Email
    if (lower.includes('share') || lower.includes('whatsapp') || lower.includes('email') || lower.includes('send')) {
      return `📤 **Sharing Invoices & Quotations:**\n\nOn any Invoice or Quotation detail page:\n1. Click the **Share** button\n2. Choose:\n   - **WhatsApp** — Opens WhatsApp with the document attached/link\n   - **Email** — Sends the document as email with PDF attachment\n\n💡 The share feature uses the Web Share API on mobile to attach files directly!`
    }

    // General help
    if (lower.includes('help') || lower.includes('what can you do') || lower.includes('feature')) {
      return `🤖 **I can help you with:**\n\n🔍 **Diagnostics:**\n- "Check system health" — full system diagnosis\n- "Show recent errors" — view runtime errors\n- "Fix the errors" — auto-repair issues\n- "Check table invoices" — inspect a table\n\n💡 **How-To:**\n- "How to change invoice format"\n- "How to reset password"\n- "How does HSN auto-detect work"\n- "How to share via WhatsApp"\n\nJust ask me anything about your ERP!`
    }

    // Default response
    return `🤔 I'm not sure how to help with that. Here are some things I can do:\n\n- **"Check system health"** — Run diagnostics\n- **"Show recent errors"** — View errors\n- **"Fix the errors"** — Auto-repair issues\n- **"How to change invoice format"** — Help with settings\n- **"Check table invoices"** — Inspect a database table\n\nWhat would you like to do?`
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
      content: '🗑️ Chat cleared! How can I help you?'
    }])
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
            <Bot size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Assistant</h1>
            <p className="text-xs text-gray-500">Your ERP helper — diagnose, fix, and learn</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearChat} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500" title="Clear chat">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto bg-white rounded-xl border shadow-sm p-4 space-y-4 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === 'user' 
                ? 'bg-primary-600 text-white rounded-br-md' 
                : msg.isError 
                  ? 'bg-red-50 text-red-800 border border-red-200 rounded-bl-md' 
                  : 'bg-gray-100 text-gray-800 rounded-bl-md'
            }`}>
              <div className="whitespace-pre-wrap" style={{ lineHeight: 1.6 }}>
                {msg.content.split('**').map((part, idx) => 
                  idx % 2 === 1 ? <strong key={idx}>{part}</strong> : <span key={idx}>{part}</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                Thinking...
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => sendMessage(s)}
              className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 border border-purple-200 transition-colors"
            >
              <Lightbulb size={12} className="inline mr-1" />{s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your ERP..."
            disabled={loading}
            className="w-full pl-4 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm disabled:opacity-50"
          />
        </div>
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          className="px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:hover:shadow-none transition-all flex items-center gap-2"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
