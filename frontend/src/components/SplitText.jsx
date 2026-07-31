import { useRef, useEffect, useState, useCallback } from 'react'

/**
 * SplitText — Animated text that reveals letter by letter (from ReactBits)
 * Uses GSAP for smooth animations
 * Perfect for welcome headings, section titles
 */
export default function SplitText({
  text = '',
  tag: Tag = 'p',
  className = '',
  delay = 40,
  duration = 0.8,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 20 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  textAlign = 'left',
  onLetterAnimationComplete,
}) {
  const containerRef = useRef(null)
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    if (!text || animated) return

    const el = containerRef.current
    if (!el) return

    // Wait for element to be visible
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect()
          runAnimation()
        }
      },
      { threshold }
    )

    observer.observe(el)

    // Also start animation if element is already visible
    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      observer.disconnect()
      runAnimation()
    }

    return () => observer.disconnect()
  }, [text, animated])

  const runAnimation = useCallback(() => {
    const el = containerRef.current
    if (!el || animated) return

    const spans = el.querySelectorAll('.split-char, .split-word')

    // Simple CSS-based animation (no GSAP dependency required)
    spans.forEach((span, i) => {
      const totalDelay = i * (delay / 1000)
      const fromOpacity = from.opacity ?? 0
      const fromY = from.y ?? 20
      const fromX = from.x ?? 0

      span.style.opacity = fromOpacity
      span.style.transform = `translate(${fromX}px, ${fromY}px)`
      span.style.transition = `opacity ${duration}s ${ease} ${totalDelay}s, transform ${duration}s ${ease} ${totalDelay}s`

      // Force reflow
      span.offsetHeight

      requestAnimationFrame(() => {
        span.style.opacity = to.opacity ?? 1
        span.style.transform = `translate(${to.x ?? 0}px, ${to.y ?? 0}px)`
      })
    })

    // Mark complete after all animations finish
    const totalTime = (spans.length * delay / 1000) + duration
    setTimeout(() => {
      setAnimated(true)
      onLetterAnimationComplete?.()
    }, totalTime * 1000)
  }, [animated, delay, duration, ease, from, to, onLetterAnimationComplete])

  // Split text into parts
  const parts = splitType === 'words'
    ? text.split(' ').map((word, i) => ({
        type: 'word',
        content: word,
        key: i,
        needsSpace: i < text.split(' ').length - 1,
      }))
    : text.split('').map((char, i) => ({
        type: 'char',
        content: char === ' ' ? '\u00A0' : char,
        key: i,
        needsSpace: false,
      }))

  return (
    <Tag
      ref={containerRef}
      className={className}
      style={{ textAlign, display: 'inline' }}
    >
      {parts.map((part) => (
        <span
          key={part.key}
          className={part.type === 'word' ? 'split-word' : 'split-char'}
          style={{
            display: 'inline-block',
            willChange: 'opacity, transform',
          }}
        >
          {part.content}
          {part.needsSpace && <span>&nbsp;</span>}
        </span>
      ))}
    </Tag>
  )
}
