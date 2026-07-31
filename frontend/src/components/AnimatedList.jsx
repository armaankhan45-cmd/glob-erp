import { useRef, useEffect, useState, useCallback } from 'react'

/**
 * AnimatedList — Smooth scrollable list with fade gradients (from ReactBits)
 * Perfect for Recent Invoices, Top Customers, etc.
 * Keyboard navigation + selection support
 */
export default function AnimatedList({
  items = [],
  onItemSelect,
  showGradients = true,
  enableArrowNavigation = true,
  displayScrollbar = false,
  className = '',
  itemClassName = '',
  initialSelectedIndex = -1,
  renderItem,
  keyExtractor,
}) {
  const listRef = useRef(null)
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex)
  const [isFocused, setIsFocused] = useState(false)

  // Keyboard navigation
  useEffect(() => {
    if (!enableArrowNavigation) return

    const handleKeyDown = (e) => {
      if (!isFocused) return

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1))
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault()
        onItemSelect?.(items[selectedIndex], selectedIndex)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enableArrowNavigation, isFocused, items, selectedIndex, onItemSelect])

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex < 0 || !listRef.current) return
    const selectedEl = listRef.current.children[selectedIndex]
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [selectedIndex])

  const handleClick = useCallback((item, index) => {
    setSelectedIndex(index)
    onItemSelect?.(item, index)
  }, [onItemSelect])

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
      }}
      className={className}
    >
      {/* Top gradient */}
      {showGradients && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '40px',
            background: 'linear-gradient(to bottom, var(--bg-card, rgba(22,28,38,0.97)), transparent)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* List */}
      <div
        ref={listRef}
        tabIndex={0}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: displayScrollbar ? 'thin' : 'none',
          msOverflowStyle: displayScrollbar ? 'auto' : 'none',
          outline: 'none',
          padding: '8px 0',
          scrollBehavior: 'smooth',
        }}
      >
        {!displayScrollbar && (
          <style>{`
            .animated-list-inner::-webkit-scrollbar { display: none; }
          `}</style>
        )}
        <div className="animated-list-inner">
          {items.map((item, index) => {
            const isSelected = index === selectedIndex
            const key = keyExtractor ? keyExtractor(item, index) : index

            return (
              <div
                key={key}
                className={itemClassName}
                onClick={() => handleClick(item, index)}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  borderRadius: '10px',
                  margin: '2px 4px',
                  background: isSelected
                    ? 'rgba(var(--accent-rgb), 0.08)'
                    : 'transparent',
                  border: isSelected
                    ? '1px solid rgba(var(--accent-rgb), 0.15)'
                    : '1px solid transparent',
                  opacity: 1,
                  transform: 'translateY(0)',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.borderColor = 'transparent'
                  }
                }}
              >
                {renderItem ? renderItem(item, index, isSelected) : (
                  <span style={{
                    color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: isSelected ? 600 : 400,
                  }}>
                    {typeof item === 'string' ? item : JSON.stringify(item)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom gradient */}
      {showGradients && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '40px',
            background: 'linear-gradient(to top, var(--bg-card, rgba(22,28,38,0.97)), transparent)',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
