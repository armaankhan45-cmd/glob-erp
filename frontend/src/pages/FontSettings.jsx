import { useState, useEffect } from 'react'
import api from '../api/client'
import { Save } from 'lucide-react'

const GOOGLE_FONTS = [
  'Georgia', 'Times New Roman', 'Arial', 'Courier New',
  'Trebuchet MS', 'Verdana', 'Palatino', 'Garamond',
  'Book Antiqua', 'Lucida Console'
]

export default function FontSettings() {
  const [fontFamily, setFontFamily] = useState('Georgia')
  const [fontSize, setFontSize] = useState('9.5')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.get('/settings').then(res => {
      setFontFamily(res.data.settings?.print_font_family || 'Georgia')
      setFontSize(res.data.settings?.print_font_size || '9.5')
    }).catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.post('/settings', {
        settings: { print_font_family: fontFamily, print_font_size: fontSize }
      })
      setMsg('✓ Font settings saved!')
    } catch { setMsg('✗ Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">App Font Settings</h1>

      <div className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Print Font Family</label>
          <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="input-field">
            {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Description Font Size: {fontSize}pt</label>
          <input type="range" min="7" max="14" step="0.5" value={fontSize} onChange={e => setFontSize(e.target.value)} className="w-full" />
        </div>
      </div>

      {/* Preview — print-preview class forces dark text on white bg */}
      <div className="card">
        <h3 className="font-bold mb-3">Preview</h3>
        <div className="border rounded-lg p-6 print-preview" style={{ fontFamily, fontSize: `${fontSize}pt`, background: '#fff' }}>
          <p style={{ lineHeight: 1.35 }}>
            MODEL NO - TATA SIGNA 4425.T<br />
            DESIGN, MANUFACTURE & FABRICATION OF TOP-LOADING SS304CR TANK USING JINDAL-CERTIFIED MATERIAL WITH TC REPORT.<br />
            • SHELL: 3.5 MM THICK<br />
            • DISH END: 3.5 MM THICK<br />
            • 76 OD SS304 DELIVERY PIPELINE
          </p>
        </div>
      </div>

      {msg && <div className={`p-3 rounded-lg text-sm ${msg.includes('✗') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>{msg}</div>}

      <button onClick={handleSave} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
        <Save size={18} /> {saving ? 'Saving...' : 'Save Font Settings'}
      </button>
    </div>
  )
}
