/**
 * Common HSN codes for fabrication/manufacturing business
 * Used in InvoiceNew, InvoiceEdit, QuotationForm, PurchaseNew
 * Add more codes here as needed — all forms will auto-update.
 */
export const HSN_CODES = [
  { code: '7309', label: '7309 - Reservoirs, tanks, vats (iron/steel)' },
  { code: '8708', label: '8708 - Parts & accessories of motor vehicles' },
  { code: '7308', label: '7308 - Structures & parts (iron/steel)' },
  { code: '7310', label: '7310 - Tanks, casks, drums, cans (iron/steel)' },
  { code: '8716', label: '8716 - Trailers & semi-trailers' },
  { code: '8707', label: '8707 - Bodies for motor vehicles' },
  { code: '7326', label: '7326 - Other articles of iron/steel' },
  { code: '7610', label: '7610 - Aluminium structures & parts' },
  { code: '8428', label: '8428 - Lifting/handling machinery' },
  { code: '8431', label: '8431 - Parts for lifting/handling machinery' },
  { code: '8479', label: '8479 - Machines & mechanical appliances NES' },
  { code: '6815', label: '6815 - Articles of stone/substances NES' },
  { code: '6907', label: '6907 - Ceramic sinks, tanks, etc.' },
  { code: '3925', label: '3925 - Plastics tanks, reservoirs, etc.' },
  { code: '4016', label: '4016 - Vulcanised rubber articles NES' },
  { code: '8481', label: '8481 - Valves & similar appliances' },
  { code: '7312', label: '7312 - Chain, rope, cable (iron/steel)' },
  { code: '7315', label: '7315 - Chain & parts (iron/steel)' },
  { code: '7318', label: '7318 - Screws, bolts, nuts (iron/steel)' },
  { code: '7317', label: '7317 - Nails, tacks, staples (iron/steel)' },
]

/**
 * HSN keyword mapping for auto-detection from item descriptions
 * Used by findHSN() — called from InvoiceNew, InvoiceEdit forms
 */
const HSN_KEYWORDS = [
  { keywords: ['TANK', 'TANKER', 'RESERVOIR', 'VAT', 'DRUM', 'CASK'], hsn: '7309' },
  { keywords: ['CHASSIS', 'MOUNTING', 'MUDGUARD', 'EXHAUST', 'BUMPER', 'BRAKE', 'CLUTCH', 'GEAR', 'AXLE', 'SUSPENSION', 'STEERING'], hsn: '8708' },
  { keywords: ['STRUCTURE', 'PLATFORM', 'CATWALK', 'LADDER', 'RAILING', 'FRAME', 'COLUMN', 'BEAM', 'TRUSS', 'GIRDER'], hsn: '7308' },
  { keywords: ['TRAILER', 'SEMI-TRAILER', 'TROLLEY'], hsn: '8716' },
  { keywords: ['BODY', 'CABIN', 'CAB', 'D-BOX', 'DOME', 'COCKPIT'], hsn: '8707' },
  { keywords: ['VALVE', 'COCK', 'TAP', 'FITTING', 'FLANGE', 'MANHOLE'], hsn: '8481' },
  { keywords: ['PIPE', 'TUBE', 'PIPELINE', 'HOSE', 'DUCT'], hsn: '7308' },
  { keywords: ['BOLT', 'NUT', 'SCREW', 'RIVET', 'WASHER', 'STUD', 'ANCHOR'], hsn: '7318' },
  { keywords: ['NAIL', 'TACK', 'STAPLE', 'PIN'], hsn: '7317' },
  { keywords: ['CHAIN', 'HOOK', 'SHACKLE', 'SLING'], hsn: '7315' },
  { keywords: ['ROPE', 'CABLE', 'WIRE', 'STRAND'], hsn: '7312' },
  { keywords: ['CRANE', 'HOIST', 'LIFT', 'CONVEYOR', 'ELEVATOR', 'WINCH'], hsn: '8428' },
  { keywords: ['ALUMINIUM', 'ALUMINUM', 'ALUM'], hsn: '7610' },
  { keywords: ['PLASTIC', 'PVC', 'HDPE', 'PP', 'NYLON'], hsn: '3925' },
  { keywords: ['RUBBER', 'GASKET', 'SEAL', 'O-RING', 'BELT'], hsn: '4016' },
  { keywords: ['PAINT', 'COATING', 'PRIMER', 'VARNISH', 'LACQUER'], hsn: '3208' },
  { keywords: ['WELDING', 'ELECTRODE', 'FILLER', 'FLUX', 'SOLDER'], hsn: '8311' },
  { keywords: ['PUMP', 'COMPRESSOR', 'FAN', 'BLOWER', 'MOTOR', 'ENGINE', 'GENERATOR'], hsn: '8413' },
]

/**
 * Find HSN code from item description
 * @param {string} description - Item description text
 * @returns {string} HSN code or empty string
 */
export function findHSN(description) {
  if (!description) return ''
  const upper = description.toUpperCase()
  for (const rule of HSN_KEYWORDS) {
    for (const kw of rule.keywords) {
      if (upper.includes(kw)) return rule.hsn
    }
  }
  return ''
}
