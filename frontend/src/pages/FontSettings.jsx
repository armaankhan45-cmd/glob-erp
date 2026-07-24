import { useState, useEffect } from 'react'
import { Check, Type, Search } from 'lucide-react'

const ALL_FONTS = [
  // Modern (26)
  { name: 'Inter', cat: 'Modern', preview: 'Clean modern sans-serif' },
  { name: 'Roboto', cat: 'Modern', preview: 'Google default font' },
  { name: 'Open Sans', cat: 'Modern', preview: 'Friendly readable font' },
  { name: 'Lato', cat: 'Modern', preview: 'Elegant warm feeling' },
  { name: 'Montserrat', cat: 'Modern', preview: 'Geometric bold modern' },
  { name: 'Poppins', cat: 'Modern', preview: 'Round geometric clean' },
  { name: 'Raleway', cat: 'Modern', preview: 'Stylish thin elegant' },
  { name: 'Nunito', cat: 'Modern', preview: 'Rounded friendly soft' },
  { name: 'Source Sans Pro', cat: 'Modern', preview: 'Adobe professional' },
  { name: 'Ubuntu', cat: 'Modern', preview: 'Linux tech modern' },
  { name: 'Work Sans', cat: 'Modern', preview: 'Screen optimized' },
  { name: 'Mulish', cat: 'Modern', preview: 'Minimalist clean' },
  { name: 'Karla', cat: 'Modern', preview: 'Grotesque minimal' },
  { name: 'Manrope', cat: 'Modern', preview: 'Geometric modern' },
  { name: 'DM Sans', cat: 'Modern', preview: 'Low contrast clean' },
  { name: 'Plus Jakarta Sans', cat: 'Modern', preview: 'Modern Indonesian' },
  { name: 'Outfit', cat: 'Modern', preview: 'Variable geometric' },
  { name: 'Sora', cat: 'Modern', preview: 'Contemporary tech' },
  { name: 'Public Sans', cat: 'Modern', preview: 'US government style' },
  { name: 'IBM Plex Sans', cat: 'Modern', preview: 'IBM corporate font' },
  { name: 'Figtree', cat: 'Modern', preview: 'Friendly geometric' },
  { name: 'Lexend', cat: 'Modern', preview: 'Reading optimized' },
  { name: 'Albert Sans', cat: 'Modern', preview: 'Modern geometric' },
  { name: 'Red Hat Display', cat: 'Modern', preview: 'Red Hat brand font' },
  { name: 'Space Grotesk', cat: 'Modern', preview: 'Space-age grotesk' },
  { name: 'Atkinson Hyperlegible', cat: 'Modern', preview: 'Accessibility focused' },
  // Professional (10)
  { name: 'PT Sans', cat: 'Professional', preview: 'Public typography' },
  { name: 'Noto Sans', cat: 'Professional', preview: 'Universal language' },
  { name: 'Heebo', cat: 'Professional', preview: 'Multilingual clean' },
  { name: 'Rubik', cat: 'Professional', preview: 'Slightly rounded' },
  { name: 'Barlow', cat: 'Professional', preview: 'Slightly condensed' },
  { name: 'Cabin', cat: 'Professional', preview: 'Humanist sans-serif' },
  { name: 'Exo 2', cat: 'Professional', preview: 'Futuristic geometric' },
  { name: 'Titillium Web', cat: 'Professional', preview: 'Web optimized' },
  { name: 'Archivo', cat: 'Professional', preview: 'Grotesque versatile' },
  { name: 'Overpass', cat: 'Professional', preview: 'Highway signage' },
  // Serif (16)
  { name: 'Playfair Display', cat: 'Serif', preview: 'High contrast elegant' },
  { name: 'Merriweather', cat: 'Serif', preview: 'Designed for screens' },
  { name: 'Lora', cat: 'Serif', preview: 'Well-balanced calligraphy' },
  { name: 'PT Serif', cat: 'Serif', preview: 'Public typography serif' },
  { name: 'Roboto Slab', cat: 'Serif', preview: 'Slab serif companion' },
  { name: 'Bitter', cat: 'Serif', preview: 'Slab serif readable' },
  { name: 'Crimson Text', cat: 'Serif', preview: 'Old-style book font' },
  { name: 'Libre Baskerville', cat: 'Serif', preview: 'Classic web serif' },
  { name: 'EB Garamond', cat: 'Serif', preview: 'Traditional Garamond' },
  { name: 'Cormorant Garamond', cat: 'Serif', preview: 'Display version' },
  { name: 'Source Serif Pro', cat: 'Serif', preview: 'Adobe serif font' },
  { name: 'Spectral', cat: 'Serif', preview: 'Modern screen serif' },
  { name: 'Vollkorn', cat: 'Serif', preview: 'Everyday serif' },
  { name: 'Noto Serif', cat: 'Serif', preview: 'Universal serif' },
  { name: 'Cardo', cat: 'Serif', preview: 'Renaissance scholarly' },
  { name: 'Fraunces', cat: 'Serif', preview: 'Variable serif display' },
  // Display (10)
  { name: 'Oswald', cat: 'Display', preview: 'Condensed display' },
  { name: 'Bebas Neue', cat: 'Display', preview: 'All-caps display' },
  { name: 'Anton', cat: 'Display', preview: 'Tall condensed bold' },
  { name: 'Archivo Black', cat: 'Display', preview: 'Heavy display' },
  { name: 'Russo One', cat: 'Display', preview: 'Bold geometric' },
  { name: 'Fjalla One', cat: 'Display', preview: 'Medium condensed' },
  { name: 'Righteous', cat: 'Display', preview: 'Block letter style' },
  { name: 'Bungee', cat: 'Display', preview: 'Multi-line display' },
  { name: 'Teko', cat: 'Display', preview: 'Devanagari display' },
  { name: 'Saira Condensed', cat: 'Display', preview: 'Racing condensed' },
  // Unique (12)
  { name: 'Quicksand', cat: 'Unique', preview: 'Rounded modern' },
  { name: 'Comfortaa', cat: 'Unique', preview: 'Rounded geometric' },
  { name: 'Josefin Sans', cat: 'Unique', preview: '1920s geometric' },
  { name: 'Fredoka', cat: 'Unique', preview: 'Rounded playful' },
  { name: 'Acme', cat: 'Unique', preview: 'Strong impact' },
  { name: 'Asap', cat: 'Unique', preview: 'Versatile sans' },
  { name: 'Varela Round', cat: 'Unique', preview: 'Soft rounded' },
  { name: 'Signika', cat: 'Unique', preview: 'Signage optimized' },
  { name: 'Catamaran', cat: 'Unique', preview: 'Tamil Latin support' },
  { name: 'ABeeZee', cat: 'Unique', preview: 'Childrens reading' },
  { name: 'Urbanist', cat: 'Unique', preview: 'Modern urban style' },
  { name: 'Geologica', cat: 'Unique', preview: 'Variable weight modern' },
  // Elegant (8)
  { name: 'Cinzel', cat: 'Elegant', preview: 'Classical Roman caps' },
  { name: 'Marcellus', cat: 'Elegant', preview: 'Refined uppercase' },
  { name: 'Italiana', cat: 'Elegant', preview: 'Very thin elegant' },
  { name: 'Tenor Sans', cat: 'Elegant', preview: 'Elegant clean' },
  { name: 'Cormorant', cat: 'Elegant', preview: 'High contrast serif' },
  { name: 'Forum', cat: 'Elegant', preview: 'Roman influenced' },
  { name: 'Oranienbaum', cat: 'Elegant', preview: 'Classical display' },
  { name: 'Yeseva One', cat: 'Elegant', preview: 'Heavy display serif' },
  // Handwriting (12)
  { name: 'Pacifico', cat: 'Handwriting', preview: 'Brush script casual' },
  { name: 'Caveat', cat: 'Handwriting', preview: 'Casual handwriting' },
  { name: 'Dancing Script', cat: 'Handwriting', preview: 'Flowing cursive' },
  { name: 'Great Vibes', cat: 'Handwriting', preview: 'Formal cursive' },
  { name: 'Satisfy', cat: 'Handwriting', preview: 'Casual signature' },
  { name: 'Kaushan Script', cat: 'Handwriting', preview: 'Brush script' },
  { name: 'Sacramento', cat: 'Handwriting', preview: 'Monoline script' },
  { name: 'Yellowtail', cat: 'Handwriting', preview: 'Brush flowing' },
  { name: 'Indie Flower', cat: 'Handwriting', preview: 'Handdrawn casual' },
  { name: 'Permanent Marker', cat: 'Handwriting', preview: 'Marker pen style' },
  { name: 'Kalam', cat: 'Handwriting', preview: 'Indian handwriting' },
  { name: 'Gochi Hand', cat: 'Handwriting', preview: 'Casual marker' },
  // Mono (10)
  { name: 'Roboto Mono', cat: 'Mono', preview: 'Google monospace' },
  { name: 'Source Code Pro', cat: 'Mono', preview: 'Adobe code font' },
  { name: 'Fira Code', cat: 'Mono', preview: 'Programming ligatures' },
  { name: 'JetBrains Mono', cat: 'Mono', preview: 'IDE optimized' },
  { name: 'IBM Plex Mono', cat: 'Mono', preview: 'Corporate code' },
  { name: 'Space Mono', cat: 'Mono', preview: 'Original monospace' },
  { name: 'Inconsolata', cat: 'Mono', preview: 'Humanist monospace' },
  { name: 'Ubuntu Mono', cat: 'Mono', preview: 'Ubuntu terminal' },
  { name: 'Courier Prime', cat: 'Mono', preview: 'Better Courier' },
  { name: 'Red Hat Mono', cat: 'Mono', preview: 'Red Hat monospace' },
  // Indian / Multilingual (6)
  { name: 'Noto Sans Devanagari', cat: 'Indian', preview: 'Devanagari script font' },
  { name: 'Tiro Devanagari Hindi', cat: 'Indian', preview: 'Hindi reading font' },
  { name: 'Yatra One', cat: 'Indian', preview: 'Indian display font' },
  { name: 'Mukta', cat: 'Indian', preview: 'Indian + Latin support' },
  { name: 'Baloo 2', cat: 'Indian', preview: 'Fun Indian display' },
  { name: 'Hind', cat: 'Indian', preview: 'Hindi sans-serif' },
  // System (14)
  { name: 'Arial', cat: 'System', preview: 'Universal Windows font' },
  { name: 'Helvetica', cat: 'System', preview: 'Classic Swiss design' },
  { name: 'Times New Roman', cat: 'System', preview: 'Classic book serif' },
  { name: 'Georgia', cat: 'System', preview: 'Elegant web serif' },
  { name: 'Verdana', cat: 'System', preview: 'Wide and readable' },
  { name: 'Calibri', cat: 'System', preview: 'Microsoft Office default' },
  { name: 'Segoe UI', cat: 'System', preview: 'Windows 10/11 default' },
  { name: 'Tahoma', cat: 'System', preview: 'Microsoft web font' },
  { name: 'Trebuchet MS', cat: 'System', preview: 'Microsoft humanist' },
  { name: 'Cambria', cat: 'System', preview: 'Microsoft serif' },
  { name: 'Consolas', cat: 'System', preview: 'Microsoft code font' },
  { name: 'Lucida Console', cat: 'System', preview: 'Fixed-width classic' },
  { name: 'Impact', cat: 'System', preview: 'Heavy condensed display' },
  { name: 'Comic Sans MS', cat: 'System', preview: 'Casual handwriting' },
]

const SYSTEM_FONTS = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Calibri', 'Segoe UI', 'Tahoma', 'Trebuchet MS', 'Cambria', 'Consolas', 'Lucida Console', 'Impact', 'Comic Sans MS']

// Exported so MainLayout can call it on startup
export function applyFont(fontName) {
  const fontFamily = fontName.replace(/ /g, '+')

  const oldLink = document.getElementById('app-font-loader')
  if (oldLink) oldLink.remove()

  if (!SYSTEM_FONTS.includes(fontName)) {
    const link = document.createElement('link')
    link.id = 'app-font-loader'
    link.href = 'https://fonts.googleapis.com/css2?family=' + fontFamily + ':wght@300;400;500;600;700;800;900&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }

  const oldStyle = document.getElementById('app-font-style')
  if (oldStyle) oldStyle.remove()

  const style = document.createElement('style')
  style.id = 'app-font-style'
  style.textContent = "*, body, html, div, span, p, h1, h2, h3, h4, h5, h6, button, input, select, textarea, table, th, td, label, a, li, nav { font-family: '" + fontName + "', system-ui, sans-serif !important; }"
  document.head.appendChild(style)
  document.body.style.fontFamily = "'" + fontName + "', system-ui, sans-serif"
}

export default function FontSettings() {
  const [selected, setSelected] = useState('Inter')
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [fontsLoaded, setFontsLoaded] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('selected_font') || 'Inter'
    setSelected(saved)
    // Apply font immediately on page load
    applyFont(saved)

    if (!fontsLoaded) {
      // Only load preview fonts for a subset to avoid massive CSS
      const previewCategories = ['Modern', 'Professional', 'Serif', 'Unique', 'Elegant', 'Display']
      const previewFonts = ALL_FONTS
        .filter(f => previewCategories.includes(f.cat) && !SYSTEM_FONTS.includes(f.name))
        .slice(0, 40)
        .map(f => f.name.replace(/ /g, '+') + ':wght@400;700')
        .join('&family=')

      const link = document.createElement('link')
      link.id = 'all-fonts-preview'
      link.href = 'https://fonts.googleapis.com/css2?family=' + previewFonts + '&display=swap'
      link.rel = 'stylesheet'

      if (!document.getElementById('all-fonts-preview')) {
        document.head.appendChild(link)
      }
      setFontsLoaded(true)
    }
  }, [])

  const selectFont = (fontName) => {
    localStorage.setItem('selected_font', fontName)
    setSelected(fontName)
    applyFont(fontName)
  }

  const categories = ['All', ...new Set(ALL_FONTS.map(f => f.cat))]

  const filtered = ALL_FONTS.filter(f =>
    (category === 'All' || f.cat === category) &&
    (!search || f.name.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>App Font Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Choose font for entire app ({ALL_FONTS.length} fonts) — invoices, quotations, everything</p>
      </div>

      <div className="glass rounded-2xl p-4" style={{ border: '1px solid rgba(var(--accent-rgb),0.2)', background: 'rgba(var(--accent-rgb),0.05)' }}>
        <div className="flex items-center gap-3">
          <Type size={20} style={{ color: 'var(--accent)' }} />
          <div>
            <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Current Font: <span style={{ color: 'var(--accent)' }}>{selected}</span></div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Applied to all pages, invoices, quotations, and previews</div>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search fonts..." className="w-full pl-9 pr-3 py-2 rounded-xl text-sm input-field" autoComplete="off" />
          </div>
          <div className="flex flex-wrap gap-1">
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition"
                style={category === cat
                  ? { background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.25)' }
                  : { background: 'var(--bg-glass)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
                }>
                {cat} ({cat === 'All' ? ALL_FONTS.length : ALL_FONTS.filter(f => f.cat === cat).length})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(f => {
          const isSelected = selected === f.name
          return (
            <button
              key={f.name}
              onClick={() => selectFont(f.name)}
              className="p-4 rounded-2xl text-left transition"
              style={isSelected
                ? { background: 'rgba(var(--accent-rgb),0.12)', border: `2px solid var(--accent)`, boxShadow: `0 0 20px rgba(var(--accent-rgb),0.15)` }
                : { background: 'var(--bg-glass)', border: '2px solid transparent' }
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div style={{ fontFamily: "'" + f.name + "',sans-serif", fontWeight: 700, fontSize: '20px', color: 'var(--text-primary)', lineHeight: '1.2' }}>
                    {f.name}
                  </div>
                  <div style={{ fontFamily: "'" + f.name + "',sans-serif", fontSize: '14px', fontWeight: 400, color: 'var(--text-secondary)', marginTop: '8px' }}>
                    Glob Fabrication And Enterprises
                  </div>
                  <div style={{ fontFamily: "'" + f.name + "',sans-serif", fontSize: '16px', fontWeight: 700, color: '#4ade80', marginTop: '4px' }}>
                    Rs. 18,00,000/- Invoice # GST-001
                  </div>
                  <div style={{ fontFamily: "'" + f.name + "',sans-serif", fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {f.preview}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-[9px] px-2 py-0.5 rounded font-bold" style={{ background: 'var(--bg-glass-strong)', color: 'var(--text-muted)' }}>{f.cat}</span>
                  {isSelected && <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)' }}><Check size={14} style={{ color: '#fff' }} /></div>}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
