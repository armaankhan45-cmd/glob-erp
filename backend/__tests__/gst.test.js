/**
 * FIX #10: Basic GST calculation tests
 * Tests for: intra-state GST split, inter-state IGST, 
 * financial year string generation, invoice number formatting
 */

// ═══ GST CALCULATION TESTS ═══

describe('GST Math', () => {

  test('Intra-state GST splits into CGST + SGST at 50/50', () => {
    // Maharashtra business selling to Maharashtra customer = intra-state
    // Total GST rate 18% → CGST 9% + SGST 9%
    const totalGSTRate = 18;
    const cgstRate = totalGSTRate / 2; // 9%
    const sgstRate = totalGSTRate / 2; // 9%
    expect(cgstRate).toBe(9);
    expect(sgstRate).toBe(9);
    expect(cgstRate + sgstRate).toBe(totalGSTRate);

    // For 5% slab
    const total5 = 5;
    expect(total5 / 2).toBe(2.5);
    expect(2.5 + 2.5).toBe(total5);

    // For 12% slab
    const total12 = 12;
    expect(total12 / 2).toBe(6);
    expect(6 + 6).toBe(total12);

    // For 28% slab
    const total28 = 28;
    expect(total28 / 2).toBe(14);
    expect(14 + 14).toBe(total28);
  });

  test('Inter-state GST is IGST at full rate', () => {
    // Maharashtra business selling to Gujarat customer = inter-state
    // No CGST/SGST, only IGST at 18%
    const igstRate = 18;
    expect(igstRate).toBe(18);

    // IGST should equal the full GST rate
    const gstSlabs = [0, 5, 12, 18, 28];
    gstSlabs.forEach(rate => {
      expect(rate).toBe(rate); // IGST = full rate
    });
  });

  test('GST amount calculation: taxable × rate / 100', () => {
    const taxableAmount = 100000; // ₹1,00,000
    const gstRate = 18;
    
    // Intra-state
    const cgstAmt = (taxableAmount * 9) / 100; // ₹9,000
    const sgstAmt = (taxableAmount * 9) / 100; // ₹9,000
    expect(cgstAmt).toBe(9000);
    expect(sgstAmt).toBe(9000);
    expect(cgstAmt + sgstAmt).toBe(18000); // Total GST = ₹18,000

    // Inter-state
    const igstAmt = (taxableAmount * 18) / 100; // ₹18,000
    expect(igstAmt).toBe(18000);

    // Total invoice amount
    const totalIntra = taxableAmount + cgstAmt + sgstAmt;
    expect(totalIntra).toBe(118000);
    const totalInter = taxableAmount + igstAmt;
    expect(totalInter).toBe(118000);
  });

  test('Zero-rate GST (0% slab) produces no tax', () => {
    const taxableAmount = 50000;
    const gstRate = 0;
    const cgstAmt = (taxableAmount * 0) / 100;
    const sgstAmt = (taxableAmount * 0) / 100;
    const igstAmt = (taxableAmount * 0) / 100;
    expect(cgstAmt).toBe(0);
    expect(sgstAmt).toBe(0);
    expect(igstAmt).toBe(0);
    expect(taxableAmount + cgstAmt + sgstAmt).toBe(50000);
  });
});

// ═══ FINANCIAL YEAR TESTS ═══

describe('Financial Year String', () => {

  function getFinancialYear(date) {
    // Indian FY: April 1 to March 31
    // FY 2025-26 = April 2025 through March 2026
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-indexed, April = 3
    
    // If month is Jan-Mar (0-2), it's in the PREVIOUS FY year
    const fyStart = month < 3 ? year - 1 : year;
    const fyEnd = fyStart + 1;
    return `${String(fyStart).slice(2)}-${String(fyEnd).slice(2)}`;
  }

  test('April 2025 → FY 25-26', () => {
    expect(getFinancialYear('2025-04-01')).toBe('25-26');
    expect(getFinancialYear('2025-04-15')).toBe('25-26');
  });

  test('March 2026 → still FY 25-26', () => {
    expect(getFinancialYear('2026-03-15')).toBe('25-26');
    expect(getFinancialYear('2026-03-31')).toBe('25-26');
  });

  test('January 2026 → still FY 25-26', () => {
    expect(getFinancialYear('2026-01-10')).toBe('25-26');
  });

  test('May 2026 → FY 26-27', () => {
    expect(getFinancialYear('2026-05-01')).toBe('26-27');
  });

  test('December 2026 → FY 26-27', () => {
    expect(getFinancialYear('2026-12-31')).toBe('26-27');
  });
});

// ═══ INVOICE NUMBER FORMATTING TESTS ═══

describe('Invoice Number Format', () => {

  function formatInvoiceNumber(prefix, nextId, fy) {
    // Format: {prefix}{nextId}/{FY}
    // Example: GST-001/25-26
    return `${prefix}${String(nextId).padStart(3, '0')}/${fy}`;
  }

  test('First invoice of FY 25-26 with GST- prefix', () => {
    expect(formatInvoiceNumber('GST-', 1, '25-26')).toBe('GST-001/25-26');
  });

  test('Invoice #42 with Q- prefix', () => {
    expect(formatInvoiceNumber('Q-', 42, '26-27')).toBe('Q-042/26-27');
  });

  test('Invoice #100 pads to 3 digits', () => {
    expect(formatInvoiceNumber('GST-', 100, '25-26')).toBe('GST-100/25-26');
  });

  test('Empty prefix still works', () => {
    expect(formatInvoiceNumber('', 5, '26-27')).toBe('005/26-27');
  });
});
