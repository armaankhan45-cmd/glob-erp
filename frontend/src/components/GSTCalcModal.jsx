import { useState } from 'react'
import { Calculator, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function GSTCalcModal() {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState(18)
  const [mode, setMode] = useState('add') // add or remove

  const base = mode === 'add' ? parseFloat(amount || 0) / (1 + rate / 100) : parseFloat(amount || 0)
  const gst = mode === 'add' ? parseFloat(amount || 0) - base : base * (rate / 100)
  const total = mode === 'add' ? parseFloat(amount || 0) : base + gst

  const rates = [0, 5, 12, 18, 28]

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-primary-700 transition-all z-30 hover:scale-110"
        title="GST Calculator"
      >
        <Calculator size={24} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="fixed bottom-24 right-6 z-50 bg-white rounded-2xl shadow-2xl p-6 w-80"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">GST Calculator</h3>
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="input-field mb-3"
              />

              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setMode('add')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'add' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  Add GST
                </button>
                <button
                  onClick={() => setMode('remove')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'remove' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  Remove GST
                </button>
              </div>

              <div className="flex gap-2 mb-4">
                {rates.map(r => (
                  <button
                    key={r}
                    onClick={() => setRate(r)}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold transition-colors ${rate === r ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {r}%
                  </button>
                ))}
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Base Amount</span>
                  <span className="font-semibold">₹{base.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">GST ({rate}%)</span>
                  <span className="font-semibold text-primary-600">₹{gst.toFixed(2)}</span>
                </div>
                <hr className="border-gray-200" />
                <div className="flex justify-between text-base">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-primary-700">₹{total.toFixed(2)}</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
