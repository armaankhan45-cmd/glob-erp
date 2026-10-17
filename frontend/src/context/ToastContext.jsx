import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(() => {})
export const useToast = () => useContext(ToastContext)

let idCounter = 0
const STYLES = {
  error:   { border: 'rgba(239,68,68,0.35)',  icon: XCircle,      color: '#f87171' },
  success: { border: 'rgba(34,197,94,0.35)',  icon: CheckCircle2, color: '#4ade80' },
  info:    { border: 'rgba(110,168,254,0.35)', icon: Info,        color: '#6ea8fe' },
}
function guessType(text) {
  if (/fail|error|invalid|not found|denied|cannot|can't|unable|required|please|wrong|expired/i.test(text)) return 'error'
  if (/success|saved|sent|created|deleted|updated|done|copied|✓|✅/i.test(text)) return 'success'
  return 'info'
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const dismiss = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), [])
  const toast = useCallback((message, type, duration = 4500) => {
    const text = String(message ?? '')
    const id = ++idCounter
    setToasts(prev => [...prev.slice(-3), { id, message: text, type: type || guessType(text) }])
    if (duration > 0) setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  // Every existing alert('…') in the app now shows a clean toast instead of a browser popup.
  useEffect(() => {
    const native = window.alert
    window.alert = (msg) => { toast(msg) }
    return () => { window.alert = native }
  }, [toast])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed z-[9999] flex flex-col gap-2 pointer-events-none"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)', right: 16, maxWidth: 'min(400px, calc(100vw - 32px))' }}>
        {toasts.map(t => {
          const s = STYLES[t.type] || STYLES.info, Icon = s.icon
          return (
            <div key={t.id} className="pointer-events-auto flex items-start gap-2.5 rounded-xl px-4 py-3 anim-toast-in"
              style={{ background: 'rgba(12,16,32,0.97)', border: `1px solid ${s.border}`, boxShadow: '0 12px 32px rgba(0,0,0,.35)', backdropFilter: 'blur(18px)' }}>
              <Icon size={18} style={{ color: s.color, flexShrink: 0, marginTop: 1 }} />
              <p className="text-sm leading-snug flex-1" style={{ color: 'rgba(255,255,255,.92)' }}>{t.message}</p>
              <button onClick={() => dismiss(t.id)} style={{ color: 'rgba(255,255,255,.4)' }}><X size={15} /></button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
