import { useEffect, useState } from 'react'
import { IndianRupee, Trash2, Loader2 } from 'lucide-react'
import api from '../api/client'
import { invalidateCache } from '../hooks/useCachedApi'
import { StatusBadge, inr, num } from './ui'

const MODES = ['Cash', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'Cheque', 'Card', 'Bank Transfer', 'Other']
const today = () => new Date().toISOString().slice(0, 10)

// Record and list payments against one invoice. The invoice status
// (Unpaid / Partial / Paid) is worked out by the server from these payments.
export default function PaymentsPanel({ invoice, onChange }) {
  const [payments, setPayments] = useState([])
  const [form, setForm] = useState({ amount: '', payment_date: today(), payment_mode: 'UPI', reference: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const total = num(invoice.total_amount)
  const paid = payments.reduce((s, p) => s + num(p.amount), 0)
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100)

  const load = () => api.get('/payments', { params: { invoice_id: invoice.id } }).then(r => setPayments(r.data.payments || [])).catch(() => {})
  useEffect(() => { load() }, [invoice.id])
  useEffect(() => { setForm(f => ({ ...f, amount: balance ? String(balance) : '' })) }, [balance])

  const refresh = () => { invalidateCache('/invoices'); load(); onChange && onChange() }
  const add = async (e) => {
    e.preventDefault(); setError('')
    if (!(num(form.amount) > 0)) return setError('Enter an amount')
    if (num(form.amount) > balance + 0.01 && !confirm(`₹${num(form.amount)} is more than the balance of ${inr(balance, 2)}. Record it anyway?`)) return
    setBusy(true)
    try { await api.post('/payments', { ...form, invoice_id: invoice.id, customer_id: invoice.customer_id }); refresh() }
    catch (err) { setError(err.response?.data?.msg || 'Could not record payment') } finally { setBusy(false) }
  }
  const remove = async (p) => {
    if (!confirm(`Delete the ${inr(p.amount, 2)} payment of ${String(p.payment_date || '').slice(0, 10)}?`)) return
    try { await api.delete(`/payments/${p.id}`); refresh() } catch { alert('Delete failed') }
  }

  return (
    <section className="ui-section no-print">
      <div className="ui-section-title">
        <span className="flex items-center gap-2"><IndianRupee size={16} />Payments</span>
        <StatusBadge status={invoice.payment_status} />
      </div>
      <div className="pay-summary">
        <div><span>Invoice total</span><b>{inr(total, 2)}</b></div>
        <div><span>Received</span><b style={{ color: 'var(--pos)' }}>{inr(paid, 2)}</b></div>
        <div><span>Balance due</span><b style={{ color: balance ? 'var(--neg)' : 'var(--pos)' }}>{inr(balance, 2)}</b></div>
      </div>

      {balance > 0 && (
        <form className="pay-form" onSubmit={add}>
          <label className="ui-field"><span>Amount</span><input type="number" min="0" step="any" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label>
          <label className="ui-field"><span>Date</span><input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} /></label>
          <label className="ui-field"><span>Mode</span><select value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })}>{MODES.map(m => <option key={m}>{m}</option>)}</select></label>
          <label className="ui-field"><span>Reference</span><input value={form.reference} placeholder="UTR / cheque no." onChange={e => setForm({ ...form, reference: e.target.value })} /></label>
          <button className="btn-primary flex items-center justify-center gap-2" disabled={busy}>{busy && <Loader2 size={15} className="animate-spin" />}Record payment</button>
        </form>
      )}
      {error && <div className="ui-error mt-2">{error}</div>}

      {payments.length > 0 && (
        <div className="mt-4">
          {payments.map(p => (
            <div key={p.id} className="db-row">
              <div className="db-row-main"><div className="db-row-title">{inr(p.amount, 2)} · {p.payment_mode || 'Cash'}</div><div className="db-row-sub">{String(p.payment_date || '').slice(0, 10)}{p.reference ? ` · ${p.reference}` : ''}</div></div>
              <button className="ui-icon-btn danger" title="Delete payment" onClick={() => remove(p)}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
