import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Eye, Edit, Trash2, ShoppingCart } from 'lucide-react'
import api from '../api/client'
import { PageHeader, StatTiles, SearchInput, Chips, DataTable, StatusBadge, EmptyBlock, num, inr, compactInr } from '../components/ui'
import { formatDate } from '../utils'

const gstOf = (p) => num(p.cgst_amount) + num(p.sgst_amount) + num(p.igst_amount)

export default function Purchases() {
  const navigate = useNavigate()
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const load = async () => {
    try { const res = await api.get('/purchases'); setPurchases(res.data.purchases || res.data || []) }
    catch { setPurchases([]) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const del = async (p) => {
    if (!confirm(`Delete purchase bill ${p.bill_number}? This cannot be undone.`)) return
    try { await api.delete(`/purchases/${p.id}`); load() } catch { alert('Delete failed') }
  }

  const tests = { all: () => true, unpaid: p => p.payment_status !== 'Paid', paid: p => p.payment_status === 'Paid' }
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return purchases.filter(tests[filter]).filter(p => !q || p.bill_number?.toLowerCase().includes(q) || p.supplier_name?.toLowerCase().includes(q))
  }, [purchases, filter, search])
  const sum = f => rows.reduce((s, p) => s + f(p), 0)

  const columns = [
    { key: 'bill_number', label: 'Bill no.', mobile: 'sub', render: p => <span className="ui-link">{p.bill_number || '—'}</span> },
    { key: 'supplier_name', label: 'Supplier', mobile: 'title', render: p => <b style={{ color: 'var(--text-bright)' }}>{p.supplier_name || '—'}</b> },
    { key: 'bill_date', label: 'Date', render: p => formatDate(p.bill_date), sortValue: p => String(p.bill_date || '') },
    { key: 'gst', label: 'Input GST', align: 'right', render: p => <span className="ui-muted">{inr(gstOf(p))}</span>, sortValue: gstOf },
    { key: 'total_amount', label: 'Total', align: 'right', mobile: 'amount', render: p => <b>{inr(p.total_amount)}</b>, sortValue: p => num(p.total_amount) },
    { key: 'payment_status', label: 'Status', align: 'center', mobile: 'badge', render: p => <StatusBadge status={p.payment_status} /> },
    { key: 'actions', label: '', align: 'right', sortable: false, render: p => (
      <span className="inline-flex gap-1" onClick={e => e.stopPropagation()}>
        <button className="ui-icon-btn" title="View" onClick={() => navigate(`/app/purchases/${p.id}`)}><Eye size={15} /></button>
        <button className="ui-icon-btn" title="Edit" onClick={() => navigate(`/app/purchases/${p.id}/edit`)}><Edit size={15} /></button>
        <button className="ui-icon-btn danger" title="Delete" onClick={() => del(p)}><Trash2 size={15} /></button>
      </span>
    ) },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Purchases" subtitle="Supplier bills and input GST"
        actions={<Link to="/app/purchases/new" className="btn-primary flex items-center gap-2"><Plus size={17} />New purchase</Link>} />
      <StatTiles items={[
        { label: 'Bills', value: rows.length },
        { label: 'Purchased', value: compactInr(sum(p => num(p.total_amount))), title: inr(sum(p => num(p.total_amount)), 2), tone: 'info' },
        { label: 'Input GST (ITC)', value: compactInr(sum(gstOf)), tone: 'pos' },
        { label: 'Unpaid', value: compactInr(sum(p => (p.payment_status === 'Paid' ? 0 : num(p.total_amount)))), tone: 'neg' },
      ]} />
      <div className="ui-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search bill no. or supplier" />
        <Chips value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'All', count: purchases.length },
          { value: 'unpaid', label: 'Unpaid', count: purchases.filter(tests.unpaid).length },
          { value: 'paid', label: 'Paid', count: purchases.filter(tests.paid).length },
        ]} />
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} initialSort={{ key: 'bill_date', dir: 'desc' }}
        onRowClick={p => navigate(`/app/purchases/${p.id}`)}
        empty={<EmptyBlock icon={ShoppingCart} title={purchases.length ? 'No matching bills' : 'No purchases yet'} text={purchases.length ? 'Try another filter or search.' : 'Record supplier bills to claim input GST.'}
          action={!purchases.length && <Link to="/app/purchases/new" className="btn-primary inline-flex items-center gap-2"><Plus size={16} />New purchase</Link>} />} />
    </div>
  )
}
