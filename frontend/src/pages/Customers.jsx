import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Edit, Trash2, Users, Phone } from 'lucide-react'
import api from '../api/client'
import useCachedApi, { invalidateCache } from '../hooks/useCachedApi'
import { PageHeader, StatTiles, SearchInput, Chips, DataTable, EmptyBlock, num, inr, compactInr } from '../components/ui'

export default function Customers() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const { data, loading, refetch } = useCachedApi('/customers', { maxAge: 30000 })
  const customers = data?.customers || []

  const del = async (c) => {
    if (!confirm(`Delete customer ${c.name}?`)) return
    try { await api.delete('/customers/' + c.id); invalidateCache('/customers'); refetch() } catch (e) { alert(e.response?.data?.msg || 'Delete failed') }
  }

  const tests = { all: () => true, outstanding: c => num(c.outstanding) > 0, gst: c => !!c.gstin, nogst: c => !c.gstin }
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers.filter(tests[filter]).filter(c => !q || [c.name, c.gstin, c.phone, c.city, c.email].some(v => v?.toLowerCase?.().includes(q)))
  }, [customers, filter, search])
  const totalOutstanding = customers.reduce((s, c) => s + num(c.outstanding), 0)

  const columns = [
    { key: 'name', label: 'Customer', mobile: 'title', render: c => (
      <span className="flex items-center gap-3">
        <span className="cust-avatar">{c.name?.charAt(0)?.toUpperCase() || 'C'}</span>
        <span className="min-w-0"><b style={{ color: 'var(--text-bright)' }}>{c.name}</b>{c.gstin && <span className="block ui-muted" style={{ fontSize: 12 }}>{c.gstin}</span>}</span>
      </span>
    ), sortValue: c => (c.name || '').toLowerCase() },
    { key: 'contact', label: 'Contact', mobile: 'sub', sortable: false, render: c => c.phone ? <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1"><Phone size={12} />{c.phone}</a> : <span className="ui-muted">{c.email || '—'}</span> },
    { key: 'city', label: 'Place', render: c => [c.city, c.state].filter(Boolean).join(', ') || '—' },
    { key: 'invoice_count', label: 'Invoices', align: 'right', render: c => num(c.invoice_count), sortValue: c => num(c.invoice_count) },
    { key: 'outstanding', label: 'Outstanding', align: 'right', mobile: 'amount', render: c => num(c.outstanding) > 0 ? <b style={{ color: 'var(--neg)' }}>{inr(c.outstanding)}</b> : <span className="ui-muted">—</span>, sortValue: c => num(c.outstanding) },
    { key: 'actions', label: '', align: 'right', sortable: false, render: c => (
      <span className="inline-flex gap-1" onClick={e => e.stopPropagation()}>
        <button className="ui-icon-btn" title="New invoice" onClick={() => navigate(`/app/invoices/new?customer=${c.id}`)}><Plus size={15} /></button>
        <button className="ui-icon-btn" title="View" onClick={() => navigate(`/app/customers/${c.id}`)}><Eye size={15} /></button>
        <button className="ui-icon-btn" title="Edit" onClick={() => navigate(`/app/customers/${c.id}/edit`)}><Edit size={15} /></button>
        <button className="ui-icon-btn danger" title="Delete" onClick={() => del(c)}><Trash2 size={15} /></button>
      </span>
    ) },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Customers" subtitle="Parties you bill"
        actions={<button onClick={() => navigate('/app/customers/new')} className="btn-primary flex items-center gap-2"><Plus size={17} />Add customer</button>} />
      <StatTiles items={[
        { label: 'Customers', value: customers.length },
        { label: 'With GSTIN', value: customers.filter(tests.gst).length, tone: 'info', sub: 'B2B' },
        { label: 'Owe you money', value: customers.filter(tests.outstanding).length, tone: 'warn' },
        { label: 'Outstanding', value: compactInr(totalOutstanding), title: inr(totalOutstanding, 2), tone: 'neg' },
      ]} />
      <div className="ui-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, GSTIN, phone, city" />
        <Chips value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'All', count: customers.length },
          { value: 'outstanding', label: 'Outstanding', count: customers.filter(tests.outstanding).length },
          { value: 'gst', label: 'B2B (GSTIN)', count: customers.filter(tests.gst).length },
          { value: 'nogst', label: 'B2C', count: customers.filter(tests.nogst).length },
        ]} />
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} initialSort={{ key: 'name', dir: 'asc' }}
        onRowClick={c => navigate(`/app/customers/${c.id}`)}
        empty={<EmptyBlock icon={Users} title={customers.length ? 'No matching customers' : 'No customers yet'}
          action={!customers.length && <button onClick={() => navigate('/app/customers/new')} className="btn-primary inline-flex items-center gap-2"><Plus size={16} />Add customer</button>} />} />
    </div>
  )
}
