import { useState } from 'react'
import { Bold } from 'lucide-react'

export default function BoldToggle() {
  const [bold, setBold] = useState(() => localStorage.getItem('invBold') === 'true')

  const toggle = () => {
    const val = !bold
    setBold(val)
    localStorage.setItem('invBold', String(val))
  }

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition ${
        bold
          ? 'bg-white/10 text-white border border-white/15'
          : 'bg-slate-800 hover:bg-slate-700 text-white'
      }`}
      title={bold ? 'Bold text ON' : 'Bold text OFF'}
    >
      <Bold size={14} />
      B {bold ? 'ON' : 'OFF'}
    </button>
  )
}
