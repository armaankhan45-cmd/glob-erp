/**
 * Invoice PDF generation utilities
 * Uses the backend PDF endpoint and opens in new tab
 */
import api from '../api/client'

/**
 * Generate and download an invoice PDF
 */
export async function generateInvoicePDF(invoice, items) {
  if (!invoice || !invoice.id) {
    throw new Error('Invalid invoice data')
  }
  const token = localStorage.getItem('token')
  const url = `${api.defaults.baseURL}/invoices/${invoice.id}/pdf?token=${token}`
  window.open(url, '_blank')
}

/**
 * Print an invoice (opens PDF in new tab for printing)
 */
export async function printInvoice(invoice, items) {
  if (!invoice || !invoice.id) {
    throw new Error('Invalid invoice data')
  }
  const token = localStorage.getItem('token')
  const url = `${api.defaults.baseURL}/invoices/${invoice.id}/pdf?token=${token}`
  const printWindow = window.open(url, '_blank')
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print()
    }
  }
}

/**
 * Preview invoice PDF in new tab
 */
export async function previewInvoicePDF(invoice, items) {
  return generateInvoicePDF(invoice, items)
}

/**
 * Generate and download a quotation PDF
 */
export async function generateQuotationPDF(quotation, items) {
  if (!quotation || !quotation.id) {
    throw new Error('Invalid quotation data')
  }
  const token = localStorage.getItem('token')
  const url = `${api.defaults.baseURL}/quotations/${quotation.id}/pdf?token=${token}`
  window.open(url, '_blank')
}
