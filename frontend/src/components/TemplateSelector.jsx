import { useState } from 'react'
import { LayoutTemplate } from 'lucide-react'

const TEMPLATES = [
  { id: 'standard', name: 'Standard', desc: 'Default GST invoice format' },
  { id: 'compact', name: 'Compact', desc: 'Reduced spacing, more items per page' },
  { id: 'detailed', name: 'Detailed', desc: 'Full details with bank info' },
]

export default function TemplateSelector() {
  const [selected, setSelected] = useState(() => {
    return localStorage.getItem('invoice_template') || 'standard'
  })
  const [open, setOpen] = useState(false)

  const select = (id) => {
    setSelected(id)
    localStorage.setItem('invoice_template', id)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm text-white transition"
      >
        <LayoutTemplate size={14} className="text-blue-400" />
        {TEMPLATES.find(t => t.id === selected)?.name || 'Standard'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 rounded-xl p-2 min-w-[220px]"
            style={{ background: 'rgba(14,18,36,0.97)', border: '1px solid rgba(255,255,255,0.10)' }}>
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => select(t.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition ${
                  selected === t.id
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-white/70 hover:bg-white/5'
                }`}
              >
                <div className="font-bold">{t.name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{t.desc}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
