import { useState } from 'react'
import { Calculator, X } from 'lucide-react'

export default function GSTCalcModal() {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState(18)
  const [mode, setMode] = useState('add')

  const base = mode === 'add' ? parseFloat(amount || 0) / (1 + rate / 100) : parseFloat(amount || 0)
  const gst = mode === 'add' ? parseFloat(amount || 0) - base : base * (rate / 100)
  const total = mode === 'add' ? parseFloat(amount || 0) : base + gst

  const rates = [0, 5, 12, 18, 28]

  return (
    <>
      {/* ═══ MOVED: bottom-24 so it doesn't overlap with AI FAB (bottom-6 right-6) ═══ */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-xl flex items-center justify-center hover:scale-110 transition-all z-30"
        style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff' }}
        title="GST Calculator"
      >
        <Calculator size={24} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} />
          <div className="fixed bottom-40 right-6 z-50 rounded-2xl shadow-2xl p-6 w-80"
            style={{ background: 'rgba(14,18,36,0.97)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-white">GST Calculator</h3>
              <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white/60"><X size={20} /></button>
            </div>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount" className="input-field mb-3" />
            <div className="flex gap-2 mb-3">
              <button onClick={() => setMode('add')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'add' ? 'bg-primary-600 text-white' : 'bg-white/6 text-white/60 hover:bg-white/10'}`}>Add GST</button>
              <button onClick={() => setMode('remove')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'remove' ? 'bg-primary-600 text-white' : 'bg-white/6 text-white/60 hover:bg-white/10'}`}>Remove GST</button>
            </div>
            <div className="flex gap-2 mb-4">
              {rates.map(r => (<button key={r} onClick={() => setRate(r)} className={`flex-1 py-1.5 rounded text-xs font-semibold transition-colors ${rate === r ? 'bg-primary-600 text-white' : 'bg-white/6 text-white/60 hover:bg-white/10'}`}>{r}%</button>))}
            </div>
            <div className="rounded-xl p-4 space-y-2 text-sm" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="flex justify-between"><span className="text-white/50">Base Amount</span><span className="font-semibold text-white">₹{base.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-white/50">GST ({rate}%)</span><span className="font-semibold accent-text">₹{gst.toFixed(2)}</span></div>
              <hr className="border-white/10" />
              <div className="flex justify-between text-base"><span className="font-semibold text-white">Total</span><span className="font-bold accent-text">₹{total.toFixed(2)}</span></div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
