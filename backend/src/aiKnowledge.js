/**
 * ═══════════════════════════════════════════════════════════════
 * GLOB ERP — BUSINESS KNOWLEDGE BASE
 * Lightweight retrieval (no vector DB needed): keyword-scored chunks
 * are injected into the AI's system prompt so it answers from YOUR
 * domain knowledge — products, GST rules, customers, formats.
 *
 * To edit knowledge: just add/edit entries below and redeploy.
 * ═══════════════════════════════════════════════════════════════
 */

const KNOWLEDGE_BASE = [
  {
    id: 'company',
    category: 'Company',
    title: 'Company Profile',
    keywords: ['company', 'gstin', 'address', 'bank', 'ifsc', 'upi', 'phone', 'contact', 'profile', 'who', 'about', 'reach', 'details'],
    content: `Glob Fabrication and Enterprises — Maharashtra, India.
GSTIN: 27AWAPK1209R1ZC (state code 27 = Maharashtra)
Address: Plot No. 45, MIDC Industrial Area, Pune - 411026
Phone: 9876543210 · Email: info@globfabrication.com
Bank: State Bank of India · A/C 3456789012345 · IFSC SBIN0001234 · UPI: glob@sbi
Business: fabrication / manufacturing of SS tanks, tankers and chassis mounting.`,
  },
  {
    id: 'product-tanker',
    category: 'Products',
    title: 'SS304 Tankers (TATA Signa 4425)',
    keywords: ['tanker', 'tank', 'ss304', 'chassis', 'tata', 'signa', '4425', 'capacity', '37kl', 'compartment', 'fabrication', 'product', 'manufacture', 'build', 'make'],
    content: `Our flagship product is the top-loading SS304CR tank mounted on a TATA Signa 4425.T chassis.
Capacity: 37KL in 6 compartments.
Construction: shell 3.5mm thick, dish end 3.5mm, 76 OD SS304 delivery pipeline, 6 SS304 top valves.
Inclusions: ladder, catwalk, rear mudguard, GI sheet fitting, SS304 wall box, deep rod carrier, fire extinguisher holder, modified exhaust line with spark arrestor, manholes (bolt-welded) with P.V. valves / air vents / emergency valves, rear bottom lever with fusible link (MS), side platform with SS304 railing, D-box dome cover, full painting, tank mounted on chassis.
Material: Jindal-certified SS304 with TC (test certificate) report.`,
  },
  {
    id: 'product-docs',
    category: 'Products',
    title: 'Explosive Licence & Forms',
    keywords: ['license', 'licence', 'explosive', 'form 22', 'form 17', '9no', '9 no', 'document', 'paperwork', 'petrol', 'fuel', 'diesel'],
    content: `For fuel tankers we provide the explosive licence (9NO) paperwork — ready for 3 years — plus Form 22 and Form 17 documents.`,
  },
  {
    id: 'gst-rules',
    category: 'GST',
    title: 'GST Calculation Rules',
    keywords: ['gst', 'cgst', 'sgst', 'igst', 'tax', 'rate', '18', 'interstate', 'intrastate', 'state code', 'payable', 'input', 'output', 'owe'],
    content: `GST rules we follow:
- Same state (both state code 27 Maharashtra) → CGST + SGST split 50/50.
- Different states → IGST at the full rate.
- State is always derived from the first 2 digits of the GSTIN (ours = 27).
- Default GST rate: 18%.
- Payable = output GST (on sales) − input GST (on purchases). Only excess input credit carries forward.`,
  },
  {
    id: 'hsn-codes',
    category: 'GST',
    title: 'HSN Codes We Use',
    keywords: ['hsn', 'code', '7309', '8708', '8481', '7307', '7308', '7326', '8716', 'classification'],
    content: `Common HSN codes: 7309 (reservoirs/tanks/vats), 8708 (motor vehicle parts), 8481 (valves), 7307 (pipe fittings), 7308 (structures & parts), 7326 (other iron/steel articles), 8716 (trailers).`,
  },
  {
    id: 'invoice-format',
    category: 'GST',
    title: 'Invoice & Document Numbering',
    keywords: ['invoice number', 'numbering', 'prefix', 'gst-', 'q-', 'financial year', 'fy', 'format', '26-27', '27-28'],
    content: `Invoice numbers follow {prefix}{nextId}/{FY}, e.g. GST-0001/26-27 (prefix default 'GST-'). Quotations use the 'Q-' prefix.
Financial year is April–March: Apr 2026 → FY 26-27, Jan 2027 → still 26-27, Apr 2027 → 27-28. Never use calendar year for FY.`,
  },
  {
    id: 'quotation-format',
    category: 'Products',
    title: 'Quotation Format',
    keywords: ['quotation', 'quote', 'format', 'print', 'a4', 'bold', 'draft', 'proposal'],
    content: `Quotations are A4 print format: no dates, no HSN column, typeable customer name, bordered box format with a bold toggle. Customer name is stored internally as Name|||PAN/Vehicle|||Notes.`,
  },
  {
    id: 'customers-base',
    category: 'Customers',
    title: 'Customer Base',
    keywords: ['customer', 'client', 'transport', 'logistics', 'buyer', 'who buys'],
    content: `Typical customers are transporters and logistics/fuel companies (e.g. Shree Ganesh Transport - Mumbai, Patel Logistics - Ahmedabad, Mumbai Fuels Corporation - Navi Mumbai). For current customers always use the search_customer / get_top_customers tools to get real records.`,
  },
  {
    id: 'materials',
    category: 'Products',
    title: 'Materials & Quality Standards',
    keywords: ['material', 'ss304', 'jindal', 'quality', 'tc report', 'thickness', 'gi sheet', 'ms', 'steel', 'certified'],
    content: `We use Jindal-certified SS304 with TC report. Shell and dish end are 3.5mm thick. Fittings are SS304 and GI sheet. Fuel-transport compliance fittings include PV valves, fusible link and spark arrestor.`,
  },
  {
    id: 'quotation-howto',
    category: 'Products',
    title: 'How to Draft a Quotation (guidance)',
    keywords: ['quotation', 'quote', 'draft', 'write', 'make a quote', 'prepare', 'proposal', 'offer'],
    content: `When drafting a quotation for a tanker, include: model/chassis (e.g. TATA Signa 4425.T), tank capacity and compartments, shell/dish thickness, SS304 delivery pipeline and valves, ladder/catwalk/railing, safety fittings (PV valves, fusible link, spark arrestor), explosive licence 9NO + Form 22/17, material certification (Jindal SS304 with TC), and full painting + mounting. Pricing must come from actual quotations in the system (use the database), never invent prices.`,
  },
];

/**
 * Simple keyword-scored retrieval. Returns top matching chunks for a query.
 */
function searchKnowledge(query, limit = 4) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return [];
  const words = q.split(/[^a-z0-9.]+/).filter(w => w.length > 1);

  const scored = KNOWLEDGE_BASE.map(chunk => {
    let score = 0;
    const title = chunk.title.toLowerCase();
    const content = chunk.content.toLowerCase();
    const kws = (chunk.keywords || []).join(' ').toLowerCase();

    for (const w of words) {
      if (title.includes(w)) score += 3;
      if (kws.includes(w)) score += 2;
      if (content.includes(w)) score += 1;
    }
    // Whole-phrase matches count extra
    if (q.length > 3) {
      if (title.includes(q)) score += 5;
      if (content.includes(q)) score += 3;
    }
    return { chunk, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.chunk);
}

/**
 * Returns a markdown block of the most relevant knowledge for a query,
 * suitable for injecting into the AI system prompt.
 */
function knowledgeContext(query, limit = 4) {
  const chunks = searchKnowledge(query, limit);
  if (!chunks.length) return '';
  return chunks
    .map(c => `### ${c.title} (${c.category})\n${c.content}`)
    .join('\n\n');
}

module.exports = { KNOWLEDGE_BASE, searchKnowledge, knowledgeContext };
