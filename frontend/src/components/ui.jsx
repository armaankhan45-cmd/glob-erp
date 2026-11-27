// Shared building blocks. Every list/form page should be assembled from these
// so spacing, colours and behaviour stay identical across the app.
import { useMemo, useState } from 'react'
import { Search, ChevronUp, ChevronDown, Inbox } from 'lucide-react'

export const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0 }
export const inr = (n, dp = 0) => '₹' + num(n).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp })
export const compactInr = (n) => {
  const v = Math.abs(num(n)), s = num(n) < 0 ? '−' : ''
  if (v >= 1e7) return `${s}₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `${s}₹${(v / 1e5).toFixed(2)} L`
  if (v >= 1e3) return `${s}₹${(v / 1e3).toFixed(1)}K`
  return `${s}₹${Math.round(v)}`
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="ui-header">
      <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      {actions && <div className="ui-header-actions">{actions}</div>}
    </div>
  )
}

const STATUS_TONE = { paid: 'pos', unpaid: 'neg', overdue: 'neg', partial: 'warn', pending: 'warn', draft: 'muted', sent: 'info', accepted: 'pos', rejected: 'neg', converted: 'info' }
export function StatusBadge({ status }) {
  const s = (status || 'Unpaid').toString()
  return <span className={`ui-badge tone-${STATUS_TONE[s.toLowerCase()] || 'muted'}`}>{s}</span>
}

export function StatTiles({ items }) {
  return (
    <div className="ui-tiles">
      {items.map(t => (
        <div key={t.label} className="ui-tile">
          <div className="ui-tile-label">{t.tone && <span className={`ui-dot tone-${t.tone}`} />}{t.label}</div>
          <div className="ui-tile-value" title={t.title}>{t.value}</div>
          {t.sub && <div className="ui-tile-sub">{t.sub}</div>}
        </div>
      ))}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Search…', autoFocus }) {
  return (
    <label className="ui-search">
      <Search size={16} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} aria-label={placeholder} />
    </label>
  )
}

export function Chips({ options, value, onChange }) {
  return (
    <div className="ui-chips" role="tablist">
      {options.map(o => {
        const key = typeof o === 'string' ? o : o.value
        const label = typeof o === 'string' ? o : o.label
        return <button key={key} role="tab" aria-selected={value === key} className={value === key ? 'on' : ''} onClick={() => onChange(key)}>{label}{o.count != null && <span className="ui-chip-count">{o.count}</span>}</button>
      })}
    </div>
  )
}

export function EmptyBlock({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="ui-empty">
      <Icon size={36} />
      <div className="ui-empty-title">{title}</div>
      {text && <div className="ui-empty-text">{text}</div>}
      {action}
    </div>
  )
}

/**
 * DataTable — sortable table on desktop, stacked cards on phones.
 * columns: [{ key, label, align, render(row), sortValue(row), mobile: 'title'|'sub'|'amount'|'badge'|false }]
 */
export function DataTable({ columns, rows, onRowClick, loading, empty, rowKey = 'id', initialSort, footer }) {
  const [sort, setSort] = useState(initialSort || null)
  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find(c => c.key === sort.key)
    const val = col?.sortValue || (r => r[sort.key])
    return [...rows].sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * (sort.dir === 'asc' ? 1 : -1) })
  }, [rows, sort, columns])

  if (loading) return <div className="ui-table-wrap">{[0, 1, 2, 3, 4].map(i => <div key={i} className="ui-skel-row" />)}</div>
  if (!rows.length) return <div className="ui-table-wrap">{empty}</div>

  const pick = (slot) => columns.find(c => c.mobile === slot)
  const cell = (c, r) => (c.render ? c.render(r) : r[c.key] ?? '—')
  const toggle = (c) => c.sortable !== false && setSort(s => ({ key: c.key, dir: s?.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))

  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        <thead><tr>{columns.map(c => (
          <th key={c.key} className={`${c.align ? 'al-' + c.align : ''} ${c.sortable === false ? '' : 'sortable'}`} onClick={() => toggle(c)} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
            {c.label}{sort?.key === c.key && (sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </th>
        ))}</tr></thead>
        <tbody>{sorted.map(r => (
          <tr key={r[rowKey]} onClick={onRowClick ? () => onRowClick(r) : undefined} className={onRowClick ? 'clickable' : ''}>
            {columns.map(c => <td key={c.key} className={c.align ? 'al-' + c.align : ''}>{cell(c, r)}</td>)}
          </tr>
        ))}</tbody>
        {footer && <tfoot><tr>{footer}</tr></tfoot>}
      </table>
      <div className="ui-cards">
        {sorted.map(r => {
          const [t, s, a, b] = ['title', 'sub', 'amount', 'badge'].map(pick)
          return (
            <div key={r[rowKey]} className="ui-card-row" onClick={onRowClick ? () => onRowClick(r) : undefined}>
              <div className="ui-card-main"><div className="ui-card-title">{t && cell(t, r)}</div><div className="ui-card-sub">{s && cell(s, r)}</div></div>
              <div className="ui-card-side"><div className="ui-card-amt">{a && cell(a, r)}</div>{b && cell(b, r)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
