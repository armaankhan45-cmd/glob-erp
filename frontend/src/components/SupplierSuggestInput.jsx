import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api/client'

export default function SupplierSuggestInput({ value, onChange, onSelect, placeholder, className, style }) {
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const wrapperRef = useRef(null)
  const debounceRef = useRef(null)

  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.trim().length < 1) { setSuggestions([]); setShowDropdown(false); return }
    setLoading(true)
    try {
      const res = await api.get(`/items/suppliers?q=${encodeURIComponent(query.trim())}`, { timeout: 5000 })
      const suppliers = res.data.suppliers || []
      setSuggestions(suppliers)
      setShowDropdown(suppliers.length > 0)
      setHighlightIndex(-1)
    } catch { setSuggestions([]); setShowDropdown(false) }
    finally { setLoading(false) }
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { fetchSuggestions(val) }, 200)
  }

  const handleSelect = (item) => {
    onChange(item.supplier_name)
    if (onSelect) onSelect(item)
    setShowDropdown(false); setSuggestions([]); setHighlightIndex(-1)
  }

  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex(prev => Math.min(prev + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex(prev => Math.max(prev - 1, 0)) }
    else if (e.key === 'Enter' && highlightIndex >= 0) { e.preventDefault(); handleSelect(suggestions[highlightIndex]) }
    else if (e.key === 'Escape') { setShowDropdown(false); setHighlightIndex(-1) }
  }

  useEffect(() => {
    function handleClickOutside(e) { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) { setShowDropdown(false); setHighlightIndex(-1) } }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input value={value || ''} onChange={handleChange} onKeyDown={handleKeyDown} placeholder={placeholder || 'Supplier name...'} className={className || ''} style={{ ...style, width: '100%' }} autoComplete="off" />
      {showDropdown && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, maxHeight: '220px', overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', marginTop: '2px' }}>
          {suggestions.map((s, idx) => (
            <div key={idx} onClick={() => handleSelect(s)} onMouseEnter={() => setHighlightIndex(idx)}
              style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '2px', background: idx === highlightIndex ? 'rgba(var(--accent-rgb),0.08)' : 'transparent', borderBottom: idx < suggestions.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: idx === highlightIndex ? 'var(--accent)' : 'var(--text-primary)' }}>{s.supplier_name}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.supplier_gstin ? `GSTIN: ${s.supplier_gstin}` : ''}{s.supplier_phone ? ` | ${s.supplier_phone}` : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
