/**
 * printPdf — shared client-side PDF + print helpers.
 *
 * Renders the actual on-screen invoice/quotation DOM (`.print-area`) into a
 * high-resolution canvas and then either:
 *   • downloads a REAL A4 .pdf (single page, auto-scaled to fit), or
 *   • prints it as a single A4 page.
 *
 * Why this is better than the old approach:
 *   - Whatever you SEE on screen (stamp, signature, logo, QR) is exactly what
 *     you get — html2canvas captures the rendered pixels, so stamp/signature
 *     can never go missing again.
 *   - The output is scaled to fit ONE A4 page, so it never spills to 2 pages.
 *   - The download is a genuine PDF file (not an .html file).
 */

const A4_W_MM = 210
const A4_H_MM = 297

// Fit a source (w×h) into A4 with a small margin; returns the target size in px
function fitA4(w, h) {
  const margin = 6 // mm of padding on each side
  const maxW = A4_W_MM - margin * 2
  const maxH = A4_H_MM - margin * 2
  const scale = Math.min(maxW / w, maxH / h)
  return { w: w * scale, h: h * scale, scale }
}

/**
 * Render a DOM element to a canvas at high resolution.
 */
async function elementToCanvas(el) {
  const html2canvas = (await import('html2canvas')).default
  const canvas = await html2canvas(el, {
    scale: 2,                 // crisp print quality
    useCORS: true,            // allow external images (QR codes)
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: el.scrollWidth || el.offsetWidth || 794,
  })
  return canvas
}

/**
 * Download a DOM element as a real A4 PDF (single page, fits exactly).
 * @param {HTMLElement} el     the `.print-area` element
 * @param {string} filename    e.g. "Invoice_GST-0001-26-27.pdf"
 */
export async function downloadPdf(el, filename) {
  if (!el) throw new Error('Nothing to export')
  const canvas = await elementToCanvas(el)
  const jsPDF = (await import('jspdf')).jsPDF
  const { w: imgW, h: imgH } = fitA4(canvas.width, canvas.height)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const offX = (A4_W_MM - imgW) / 2
  const offY = (A4_H_MM - imgH) / 2
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', offX, offY, imgW, imgH)
  pdf.save(filename.endsWith('.pdf') ? filename : filename + '.pdf')
}

/**
 * Print a DOM element as a single A4 page (exact WYSIWYG — includes
 * stamp/signature, guaranteed single page).
 * Falls back to the native print window if canvas rendering fails.
 * @param {HTMLElement} el     the `.print-area` element
 * @param {string} title       window title
 */
export async function printElement(el, title = 'Document') {
  if (!el) { window.print(); return }

  try {
    const canvas = await elementToCanvas(el)
    const { w: imgW, h: imgH } = fitA4(canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95)

    const w = window.open('', '_blank', 'width=900,height=650')
    if (!w) { window.print(); return }
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  img.print-sheet { width: 100%; height: auto; display: block; margin: 0 auto; }
  /* FIX: fixed-size print image was left-aligned by default (no auto margins),
     which shifted the header/footer left on the printed page for both
     Pro and Classic layouts. Centering it horizontally fixes that. */
  @media print { img.print-sheet { width: ${Math.round(imgW)}px; height: ${Math.round(imgH)}px; margin: 0 auto; display: block; } }
</style></head><body><img class="print-sheet" src="${dataUrl}" onload="setTimeout(()=>window.print(), 120)" /></body></html>`)
    w.document.close()
    w.focus()
  } catch (e) {
    // Canvas failed (e.g. tainted external image) — fall back to native print
    window.print()
  }
}

/**
 * Fallback: download the server-rendered document (legacy endpoint).
 */
export async function downloadServerFile(url, filename) {
  const token = localStorage.getItem('token')
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
}
