import { useState, useEffect } from 'react'
import { Bold } from 'lucide-react'

export default function BoldToggle() {
  const [bold, setBold] = useState(() => {
    return localStorage.getItem('invoice_text_bold') === 'true'
  })

  useEffect(() => {
    localStorage.setItem('invoice_text_bold', String(bold))
    // Apply to invoice print area
    const printArea = document.getElementById('invoice-print-area')
    if (printArea) {
      printArea.style.fontWeight = bold ? '700' : '400'
    }
    // CSS class approach
    if (bold) {
      document.body.classList.add('invoice-bold-text')
    } else {
      document.body.classList.remove('invoice-bold-text')
    }
  }, [bold])

  return (
    <button
      onClick={() => setBold(!bold)}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition ${
        bold
          ? 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
          : 'bg-slate-800 hover:bg-slate-700 text-white'
      }`}
      title={bold ? 'Bold text ON' : 'Bold text OFF'}
    >
      <Bold size={14} />
      B
    </button>
  )
}
