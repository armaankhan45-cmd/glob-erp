import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api/client'
import { Search } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════
// ItemSuggestInput — Autocomplete for item descriptions
// When user types "S" → suggests "SS PIPE" with HSN 7308, rate etc.
// Selecting a suggestion fills: description, hsn_code, unit, rate, GST rates
// ═══════════════════════════════════════════════════════════════════

export default function ItemSuggestInput({ value, onChange, onSelect, placeholder, className, style }) {
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  // Fetch suggestions from backend
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.trim().length < 1) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }
    setLoading(true)
    try {
      const res = await api.get(`/items/suggest?q=${encodeURIComponent(query.trim())}`, { timeout: 5000 })
      const items = res.data.items || []
      setSuggestions(items)
      setShowDropdown(items.length > 0)
      setHighlightIndex(-1)
    } catch {
      setSuggestions([])
      setShowDropdown(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced fetch on input change
  const handleChange = (e) => {
    const val = e.target.value
    onChange(val)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(val)
    }, 200) // 200ms debounce
  }

  // When user selects a suggestion
  const handleSelect = (item) => {
    onChange(item.description)
    if (onSelect) onSelect(item)
    setShowDropdown(false)
    setSuggestions([])
    setHighlightIndex(-1)
  }

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[highlightIndex])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      setHighlightIndex(-1)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
        setHighlightIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus input shows dropdown if we have suggestions
  const handleFocus = () => {
    if (value && value.trim().length >= 1 && suggestions.length > 0) {
      setShowDropdown(true)
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          value={value || ''}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder || 'Type item name...'}
          className={className || ''}
          style={{ ...style, width: '100%' }}
          autoComplete="off"
        />
        {loading && (
          <div style={{
            position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
            width: '12px', height: '12px', border: '2px solid rgba(var(--accent-rgb),0.2)',
            borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite'
          }} />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 1000,
          maxHeight: '280px',
          overflowY: 'auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-strong)',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          marginTop: '2px',
        }}>
          {suggestions.map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setHighlightIndex(idx)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                background: idx === highlightIndex
                  ? 'rgba(var(--accent-rgb),0.08)'
                  : 'transparent',
                borderBottom: idx < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.1s',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: idx === highlightIndex ? 'var(--accent)' : 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {item.description}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {item.hsn_code && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(var(--accent-rgb),0.1)',
                    color: 'var(--accent)',
                    fontFamily: 'monospace',
                    letterSpacing: '0.5px',
                  }}>
                    HSN {item.hsn_code}
                  </span>
                )}
                {item.rate > 0 && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '600',
                    color: 'var(--text-muted)',
                  }}>
                    ₹{item.rate}
                  </span>
                )}
                {item.unit && item.unit !== 'NOS' && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '600',
                    color: 'var(--text-muted)',
                  }}>
                    /{item.unit}
                  </span>
                )}
              </div>
            </div>
          ))}
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
    </div>
  )
}
