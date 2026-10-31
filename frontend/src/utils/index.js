import { useState, useEffect, useRef, useCallback } from 'react'

// ═══════════════════════════════════════════
// AUTO-REFRESH HOOK — keeps data fresh at high refresh rate
// Polls API every `interval` ms (default 30s)
// Only when tab is visible (saves resources)
// ═══════════════════════════════════════════
export function useAutoRefresh(fetchFn, interval = 30000) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const fetchRef = useRef(fetchFn)
  const intervalRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => { fetchRef.current = fetchFn }, [fetchFn])

  const execute = useCallback(async () => {
    try {
      const result = await fetchRef.current()
      if (mountedRef.current) {
        setData(result)
        setLastRefresh(Date.now())
        setLoading(false)
      }
    } catch (err) {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true
    execute()
    return () => { mountedRef.current = false }
  }, [execute])

  // Auto-refresh interval - only when tab is visible
  useEffect(() => {
    const startInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          execute()
        }
      }, interval)
    }

    const stopInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    startInterval()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        execute() // Immediate refresh when tab becomes visible
        startInterval()
      } else {
        stopInterval()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      stopInterval()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [interval, execute])

  const refresh = useCallback(() => {
    setLoading(true)
    return execute()
  }, [execute])

  return { data, loading, lastRefresh, refresh }
}

// ═══════════════════════════════════════════
// ANIMATED COUNTER HOOK — smooth number counting
// ═══════════════════════════════════════════
export function useAnimatedCounter(target, duration = 1200) {
  const [value, setValue] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const start = performance.now()
    const startVal = value

    const update = (now) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      const current = Math.floor(startVal + (target - startVal) * eased)
      setValue(current)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(update)
      }
    }

    rafRef.current = requestAnimationFrame(update)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return value
}

export function numberToWords(num) {
  const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
    'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  
  function inW(n) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n/10)] + (n%10 ? ' '+a[n%10] : '');
    if (n < 1000) return a[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+inW(n%100) : '');
    if (n < 100000) return inW(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+inW(n%1000) : '');
    if (n < 10000000) return inW(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+inW(n%100000) : '');
    return inW(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+inW(n%10000000) : '');
  }
  
  const rupees = Math.round(Math.floor(num));
  const paise = Math.round((num - Math.floor(num)) * 100);
  let result = inW(rupees) + ' Rupees';
  if (paise > 0) result += ' and ' + inW(paise) + ' Paise';
  return result + ' Only';
}

export function numberToWordsCaps(num) {
  return numberToWords(num).toUpperCase().replace('RUPEES ', '').replace(' RUPEES', '');
}

export function formatIndian(num) {
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  const n = parseFloat(num);
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

export function getFY(date = new Date()) {
  const m = date.getMonth();
  const y = date.getFullYear();
  if (m < 3) return `${(y - 1) % 100}-${y % 100}`;
  return `${y % 100}-${(y + 1) % 100}`;
}

export function parseGSTIN(gstin) {
  const STATE_CODES = {
    '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
    '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh',
    '10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur',
    '15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal',
    '20':'Jharkhand','21':'Odisha','22':'Chattisgarh','23':'Madhya Pradesh',
    '24':'Gujarat','25':'Daman & Diu','26':'Dadra & Nagar Haveli','27':'Maharashtra',
    '28':'Andhra Pradesh','29':'Karnataka','30':'Goa','31':'Lakshadweep',
    '32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman & Nicobar',
    '36':'Telangana','37':'Ladakh','38':'Other Territory'
  };
  const BUSINESS_TYPES = {
    '1':'Sole Proprietorship','2':'HUF','3':'Private Limited','4':'Public Limited',
    '5':'LLP','6':'Government','7':'Trust','8':'AOP','9':'Local Authority'
  };

  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gstin)) return null;
  return {
    state_code: gstin.substring(0, 2),
    state: STATE_CODES[gstin.substring(0, 2)] || 'Unknown',
    pan: gstin.substring(2, 12),
    entity_type: BUSINESS_TYPES[gstin.charAt(12)] || 'Unknown'
  };
}

export function formatCurrency(num) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(num || 0);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const dt = new Date(dateStr);
  if (isNaN(dt.getTime())) return dateStr;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ═══════════════════════════════════════════════════════════════
// CLIENT-SIDE PDF / IMAGE / PRINT / SHARE (html2canvas + jsPDF)
// Captures the real rendered document (stamp, signature, letterhead,
// QR — what you SEE is what you get) from a fixed A4-width copy so
// phones and desktops give identical output.
//  • sharp: 3x render (2.5x on iPhone to stay inside its canvas limit)
//  • A4-shaped documents (letterhead papers) fill the full page
//  • taller documents flow onto extra pages, cut on blank lines
// ═══════════════════════════════════════════════════════════════

const A4_W_MM = 210
const A4_H_MM = 297
const A4_W_PX = 794   // ≈210mm @96dpi
const MARGIN_MM = 6

const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Safe file name from parts: safeFileName('Invoice', 'GST/001/26-27', 'Tata Motors') -> Invoice_GST-001-26-27_Tata-Motors */
export function safeFileName(...parts) {
  return parts.filter(Boolean).map(p => String(p).trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-')).filter(Boolean).join('_').slice(0, 120) || 'document'
}

async function elementToCanvas(el) {
  const { default: html2canvas } = await import('html2canvas')
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready } catch (e) {}
  const wrapper = document.createElement('div')
  wrapper.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_W_PX}px;background:#fff;pointer-events:none;`
  const clone = el.cloneNode(true)
  clone.style.width = `${A4_W_PX}px`
  clone.style.maxWidth = 'none'
  clone.style.margin = '0'
  clone.style.boxShadow = 'none'
  clone.style.transform = 'none'
  wrapper.appendChild(clone)
  document.body.appendChild(wrapper)
  try {
    // wait for every image (logo, stamp, letterhead) so none are missing in the file
    await Promise.all([...clone.querySelectorAll('img')].map(img => img.complete ? null : new Promise(r => { img.onload = img.onerror = r; setTimeout(r, 4000) })))
    return await html2canvas(clone, {
      scale: isIOS() ? 2.5 : 3, useCORS: true, allowTaint: false, backgroundColor: '#ffffff',
      logging: false, width: A4_W_PX, windowWidth: A4_W_PX, scrollX: 0, scrollY: 0,
    })
  } finally {
    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper)
  }
}

// Row y (in canvas px) near `target` that is blank, so a page break never slices through text
function findBlankRow(canvas, target, searchUp) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const w = canvas.width
  for (let y = Math.min(target, canvas.height - 1); y > target - searchUp && y > 0; y--) {
    const row = ctx.getImageData(0, y, w, 1).data
    let blank = true
    for (let x = 0; x < row.length; x += 16) { if (row[x] < 245 || row[x + 1] < 245 || row[x + 2] < 245) { blank = false; break } }
    if (blank) return y
  }
  return target
}

async function buildPdf(el, title) {
  const canvas = await elementToCanvas(el)
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  if (title) pdf.setProperties({ title, author: 'Glob Fabrication & Enterprises', creator: 'Glob ERP' })
  const ratio = canvas.height / canvas.width
  const a4Ratio = A4_H_MM / A4_W_MM
  const jpeg = c => c.toDataURL('image/jpeg', 0.96)

  // 1) A4-shaped document (letterhead papers): fill the page edge to edge
  if (Math.abs(ratio - a4Ratio) < 0.04) {
    pdf.addImage(jpeg(canvas), 'JPEG', 0, 0, A4_W_MM, A4_H_MM)
    return pdf
  }
  // 2) fits (or only slightly taller than) one page: keep it on ONE page, shrinking up to ~15% if needed
  const innerW = A4_W_MM - MARGIN_MM * 2
  const innerH = A4_H_MM - MARGIN_MM * 2
  const mmPerPx = innerW / canvas.width
  const totalMm = canvas.height * mmPerPx
  if (totalMm <= innerH * 1.18) {
    const k = Math.min(1, innerH / totalMm)
    const w = innerW * k, h = totalMm * k
    pdf.addImage(jpeg(canvas), 'JPEG', (A4_W_MM - w) / 2, MARGIN_MM, w, h)
    return pdf
  }
  // 3) long document: flow across pages, breaking on blank lines
  const pagePx = Math.floor(innerH / mmPerPx)
  let y = 0, page = 0
  while (y < canvas.height - 2) {
    let end = Math.min(y + pagePx, canvas.height)
    if (end < canvas.height) end = findBlankRow(canvas, end, Math.floor(pagePx * 0.12))
    if (end <= y + 20) end = Math.min(y + pagePx, canvas.height)
    const slice = document.createElement('canvas')
    slice.width = canvas.width; slice.height = end - y
    const sctx = slice.getContext('2d'); sctx.fillStyle = '#fff'; sctx.fillRect(0, 0, slice.width, slice.height)
    sctx.drawImage(canvas, 0, y, canvas.width, end - y, 0, 0, canvas.width, end - y)
    if (page > 0) pdf.addPage()
    pdf.addImage(jpeg(slice), 'JPEG', MARGIN_MM, MARGIN_MM, innerW, (end - y) * mmPerPx)
    y = end; page++
  }
  return pdf
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

// iPhone Safari ignores a.download — open the share sheet (Save to Files / WhatsApp / Print) instead
async function saveBlob(blob, filename, mime) {
  if (isIOS()) {
    try {
      const file = new File([blob], filename, { type: mime })
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return }
    } catch (e) { if (e && e.name === 'AbortError') return }
    const url = URL.createObjectURL(blob)
    if (!window.open(url, '_blank')) window.location.href = url
    return
  }
  triggerDownload(blob, filename)
}

/** Download the element as a real A4 PDF (sharp, multi-page when long). */
export async function downloadPdf(el, filename) {
  if (!el) throw new Error('Nothing to export')
  const name = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  const pdf = await buildPdf(el, name.replace(/\.pdf$/, '').replace(/_/g, ' '))
  await saveBlob(pdf.output('blob'), name, 'application/pdf')
}

/** Download the element as a PNG image (good for WhatsApp / email previews). */
export async function downloadImage(el, filename) {
  if (!el) throw new Error('Nothing to export')
  const canvas = await elementToCanvas(el)
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('Could not create image')
  await saveBlob(blob, filename.endsWith('.png') ? filename : `${filename}.png`, 'image/png')
}

/** True when this browser can share a file (phones, some desktops). */
export function canShareFiles() {
  try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })) } catch (e) { return false }
}

/** Open the native share sheet with the PDF attached (WhatsApp, Mail, Drive…). */
export async function sharePdf(el, filename, text = '') {
  if (!el) throw new Error('Nothing to export')
  const name = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  const pdf = await buildPdf(el, name.replace(/\.pdf$/, '').replace(/_/g, ' '))
  const file = new File([pdf.output('blob')], name, { type: 'application/pdf' })
  try { await navigator.share({ files: [file], title: name, text }) }
  catch (e) { if (!e || e.name !== 'AbortError') throw e }
}

/** Print the element — prints the exact same pages as the PDF download. */
export async function printElement(el, title = 'Document') {
  if (!el) { window.print(); return }
  try {
    const pdf = await buildPdf(el, title)
    // render the exact PDF pages as images so print == download
    const blobUrl = URL.createObjectURL(pdf.output('blob'))
    // Prefer the native PDF viewer where available (crisp vector-like output)
    if (!isIOS()) {
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;'
      iframe.src = blobUrl
      document.body.appendChild(iframe)
      iframe.onload = () => {
        setTimeout(() => {
          try { iframe.contentWindow.focus(); iframe.contentWindow.print() } catch (e) { window.open(blobUrl, '_blank') }
          setTimeout(() => { try { document.body.removeChild(iframe) } catch (e) {} URL.revokeObjectURL(blobUrl) }, 60000)
        }, 250)
      }
      return
    }
    window.open(blobUrl, '_blank') || (window.location.href = blobUrl)
  } catch (e) {
    window.print()
  }
}
