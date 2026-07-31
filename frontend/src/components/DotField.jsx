import { useRef, useEffect, useCallback } from 'react'

/**
 * DotField — Interactive dot grid background (from ReactBits)
 * Dots react to cursor movement with bulge/physics effect
 * Uses SVG for performance — no canvas overhead
 */
export default function DotField({
  dotRadius = 1.2,
  dotSpacing = 16,
  cursorRadius = 400,
  cursorForce = 0.08,
  bulgeOnly = true,
  bulgeStrength = 50,
  glowRadius = 120,
  sparkle = false,
  waveAmplitude = 0,
  gradientFrom = 'rgba(var(--accent-rgb), 0.3)',
  gradientTo = 'rgba(var(--accent-rgb), 0.12)',
  glowColor = 'var(--accent)',
  className = '',
  style = {},
}) {
  const svgRef = useRef(null)
  const dotsRef = useRef([])
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const rafRef = useRef(null)

  const handleMouseMove = useCallback((e) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -1000, y: -1000 }
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const w = svg.clientWidth
    const h = svg.clientHeight
    const cols = Math.floor(w / dotSpacing)
    const rows = Math.floor(h / dotSpacing)
    const totalDots = cols * rows

    // Build dots array
    const dots = []
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const baseX = col * dotSpacing + dotSpacing / 2
        const baseY = row * dotSpacing + dotSpacing / 2
        dots.push({
          baseX, baseY,
          x: baseX, y: baseY,
          vx: 0, vy: 0,
          el: null,
        })
      }
    }

    // Create SVG circles
    const ns = 'http://www.w3.org/2000/svg'
    // Remove old circles
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    // Add defs for gradient
    const defs = document.createElementNS(ns, 'defs')
    const grad = document.createElementNS(ns, 'linearGradient')
    grad.id = 'dotFieldGrad'
    grad.setAttribute('x1', '0%')
    grad.setAttribute('y1', '0%')
    grad.setAttribute('x2', '100%')
    grad.setAttribute('y2', '100%')
    const stop1 = document.createElementNS(ns, 'stop')
    stop1.setAttribute('offset', '0%')
    stop1.setAttribute('stop-color', typeof gradientFrom === 'string' && gradientFrom.includes('var(') ? '#22d3ee' : gradientFrom)
    stop1.setAttribute('stop-opacity', '0.6')
    const stop2 = document.createElementNS(ns, 'stop')
    stop2.setAttribute('offset', '100%')
    stop2.setAttribute('stop-color', typeof gradientTo === 'string' && gradientTo.includes('var(') ? '#6ea8fe' : gradientTo)
    stop2.setAttribute('stop-opacity', '0.3')
    grad.appendChild(stop1)
    grad.appendChild(stop2)
    defs.appendChild(grad)

    // Add glow filter
    const filter = document.createElementNS(ns, 'filter')
    filter.id = 'dotGlow'
    const blur = document.createElementNS(ns, 'feGaussianBlur')
    blur.setAttribute('stdDeviation', '3')
    blur.setAttribute('result', 'coloredBlur')
    const merge = document.createElementNS(ns, 'feMerge')
    const mn1 = document.createElementNS(ns, 'feMergeNode')
    mn1.setAttribute('in', 'coloredBlur')
    const mn2 = document.createElementNS(ns, 'feMergeNode')
    mn2.setAttribute('in', 'SourceGraphic')
    merge.appendChild(mn1)
    merge.appendChild(mn2)
    filter.appendChild(blur)
    filter.appendChild(merge)
    defs.appendChild(filter)

    svg.appendChild(defs)

    // Create circle elements
    dots.forEach((dot, i) => {
      const circle = document.createElementNS(ns, 'circle')
      circle.setAttribute('cx', dot.baseX)
      circle.setAttribute('cy', dot.baseY)
      circle.setAttribute('r', sparkle && Math.random() < 0.03 ? dotRadius * 2 : dotRadius)
      circle.setAttribute('fill', 'url(#dotFieldGrad)')
      circle.setAttribute('opacity', '0.5')
      svg.appendChild(circle)
      dot.el = circle
    })

    dotsRef.current = dots

    // Animation loop
    let time = 0
    const animate = () => {
      time += 0.02
      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i]
        const dx = dot.baseX - mx
        const dy = dot.baseY - my
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (bulgeOnly) {
          // Bulge mode: dots push away from cursor
          if (dist < cursorRadius && dist > 0) {
            const force = (1 - dist / cursorRadius) * bulgeStrength
            dot.x = dot.baseX + (dx / dist) * force
            dot.y = dot.baseY + (dy / dist) * force
          } else {
            dot.x += (dot.baseX - dot.x) * 0.1
            dot.y += (dot.baseY - dot.y) * 0.1
          }
        } else {
          // Physics mode
          if (dist < cursorRadius && dist > 0) {
            const force = (1 - dist / cursorRadius) * cursorForce
            dot.vx += (dx / dist) * force
            dot.vy += (dy / dist) * force
          }
          dot.vx *= 0.92
          dot.vy *= 0.92
          dot.x += dot.vx
          dot.y += dot.vy
          dot.x += (dot.baseX - dot.x) * 0.02
          dot.y += (dot.baseY - dot.y) * 0.02
        }

        // Wave effect
        if (waveAmplitude > 0) {
          dot.y += Math.sin(time + dot.baseX * 0.02) * waveAmplitude
        }

        // Update DOM
        dot.el.setAttribute('cx', dot.x)
        dot.el.setAttribute('cy', dot.y)

        // Glow near cursor
        if (dist < glowRadius * 2) {
          const glowOpacity = Math.max(0, 1 - dist / (glowRadius * 2))
          dot.el.setAttribute('opacity', (0.3 + glowOpacity * 0.7).toString())
          dot.el.setAttribute('r', (dotRadius + glowOpacity * dotRadius).toString())
          if (glowOpacity > 0.3) {
            dot.el.setAttribute('filter', 'url(#dotGlow)')
          } else {
            dot.el.removeAttribute('filter')
          }
        } else {
          dot.el.setAttribute('opacity', '0.3')
          dot.el.setAttribute('r', String(dotRadius))
          dot.el.removeAttribute('filter')
        }
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [dotRadius, dotSpacing, cursorRadius, cursorForce, bulgeOnly, bulgeStrength, glowRadius, sparkle, waveAmplitude])

  return (
    <svg
      ref={svgRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
        ...style,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  )
}
