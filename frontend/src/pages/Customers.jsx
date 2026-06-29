import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { Plus, Search, Eye, Edit, Trash2, Users as UsersIcon, X, MapPin, Phone, Mail, Building2, Hash } from 'lucide-react'
import { parseGSTIN, formatCurrency } from '../utils'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [form, setForm] = useState({ name: '', gstin: '', phone: '', email: '', address: '', city: '', state: '', state_code: '', pincode: '', contact_person: '', trade_name: '', business_type: '' })
  const navigate = useNavigate()

  useEffect(() => { loadCustomers() }, [])

  const loadCustomers = async () => {
    try {
      const res = await api.get('/customers', { params: search ? { search } : {} })
      setCustomers(res.data.customers || [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { if (search.length > 0 || search === '') loadCustomers() }, [search])

  const handleGSTINBlur = () => {
    if (form.gstin) {
      const parsed = parseGSTIN(form.gstin)
      if (parsed) {
        setForm({ ...form, state: parsed.state, state_code: parsed.state_code, business_type: parsed.entity_type })
      }
    }
  }

  const resetForm = () => {
    setForm({ name: '', gstin: '', phone: '', email: '', address: '', city: '', state: '', state_code: '', pincode: '', contact_person: '', trade_name: '', business_type: '' })
    setEditingCustomer(null)
    setShowForm(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, form)
      } else {
        const res = await api.post('/customers', form)
        setCustomers([res.data.customer, ...customers])
      }
      resetForm()
      loadCustomers()
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed')
    }
  }

  const startEdit = (customer) => {
    setForm({
      name: customer.name || '',
      gstin: customer.gstin || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      state_code: customer.state_code || '',
      pincode: customer.pincode || '',
      contact_person: customer.contact_person || '',
      trade_name: customer.trade_name || '',
      business_type: customer.business_type || ''
    })
    setEditingCustomer(customer)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this customer?')) return
    try {
      await api.delete(`/customers/${id}`)
      setCustomers(customers.filter(c => c.id !== id))
    } catch (err) {
      alert(err.response?.data?.msg || 'Cannot delete customer with invoices')
    }
  }

  const totalOutstanding = customers.reduce((s, c) => s + (parseFloat(c.credit_limit) || 0), 0)
  const withGSTIN = customers.filter(c => c.gstin).length
  const interstate = customers.filter(c => c.state_code && c.state_code !== '27').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-white/40 text-sm">Manage your customer database</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Customer</button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ background: 'rgba(79,143,255,0.12)' }}><UsersIcon size={20} className="text-blue-400" /></div>
          <p className="text-2xl font-bold text-white">{customers.length}</p>
          <p className="text-xs text-white/40">Total Customers</p>
        </div>
        <div className="card text-center">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ background: 'rgba(34,197,94,0.12)' }}><Hash size={20} className="text-green-400" /></div>
          <p className="text-2xl font-bold text-white">{withGSTIN}</p>
          <p className="text-xs text-white/40">With GSTIN</p>
        </div>
        <div className="card text-center">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ background: 'rgba(249,115,22,0.12)' }}><MapPin size={20} className="text-orange-400" /></div>
          <p className="text-2xl font-bold text-white">{interstate}</p>
          <p className="text-xs text-white/40">Inter-State</p>
        </div>
        <div className="card text-center">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ background: 'rgba(6,182,212,0.12)' }}><Building2 size={20} className="text-cyan-400" /></div>
          <p className="text-2xl font-bold text-white">{customers.length - interstate}</p>
          <p className="text-xs text-white/40">Intra-State (MH)</p>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-2.5 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, GSTIN, phone..." className="input-field pl-10" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}></div></div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12">
            <UsersIcon size={48} className="mx-auto text-white/20 mb-3" />
            <p className="text-white/30">No customers yet</p>
            <button onClick={() => setShowForm(true)} className="accent-text text-sm hover:underline mt-2 inline-block">Add your first customer</button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {customers.map(c => {
              const isIntra = !c.state_code || c.state_code === '27'
              return (
                <div key={c.id} className="card group cursor-pointer" style={{ padding: '16px' }} onClick={() => navigate(`/app/customers/${c.id}`)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white truncate">{c.name}</h3>
                      {c.trade_name && c.trade_name !== c.name && <p className="text-xs text-white/40 truncate">T/A: {c.trade_name}</p>}
                    </div>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${isIntra ? 'text-cyan-400' : 'text-orange-400'}`}
                      style={{ background: isIntra ? 'rgba(6,182,212,0.12)' : 'rgba(249,115,22,0.12)' }}>
                      {isIntra ? 'MH' : (c.state_code || '—')}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    {c.gstin && (
                      <div className="flex items-center gap-2">
                        <Hash size={13} className="text-white/30 flex-shrink-0" />
                        <span className="font-mono text-xs text-white/60">{c.gstin}</span>
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={13} className="text-white/30 flex-shrink-0" />
                        <span className="text-white/60">{c.phone}</span>
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-2">
                        <Mail size={13} className="text-white/30 flex-shrink-0" />
                        <span className="text-white/60 truncate">{c.email}</span>
                      </div>
                    )}
                    {(c.city || c.state) && (
                      <div className="flex items-center gap-2">
                        <MapPin size={13} className="text-white/30 flex-shrink-0" />
                        <span className="text-white/60 truncate">{[c.city, c.state].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-white/5" onClick={e => e.stopPropagation()}>
                    <button onClick={() => navigate(`/app/customers/${c.id}`)} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5" title="View"><Eye size={15} /></button>
                    <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg text-white/40 hover:text-blue-400 hover:bg-white/5" title="Edit"><Edit size={15} /></button>
                    <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5" title="Delete"><Trash2 size={15} /></button>
                    <span className="ml-auto text-[10px] text-white/20">{c.business_type || ''}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Customer Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => resetForm()}>
          <div className="rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: 'rgba(14,18,36,0.97)', border: '1px solid rgba(255,255,255,0.10)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg text-white">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h3>
              <button onClick={resetForm} className="text-white/30 hover:text-white/50"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Customer Name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" placeholder="Full legal name" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">GSTIN</label>
                  <input value={form.gstin} onChange={e => setForm({...form, gstin: e.target.value.toUpperCase()})} onBlur={handleGSTINBlur} className="input-field" placeholder="22AAAAA0000A1Z5" maxLength={15} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Trade Name</label>
                  <input value={form.trade_name} onChange={e => setForm({...form, trade_name: e.target.value})} className="input-field" placeholder="Doing business as" />
                </div>
              </div>

              {form.gstin && parseGSTIN(form.gstin) && (
                <div className="rounded-xl p-3" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div><span className="text-white/40 text-xs">State</span><p className="font-medium text-blue-300">{parseGSTIN(form.gstin).state}</p></div>
                    <div><span className="text-white/40 text-xs">PAN</span><p className="font-mono text-blue-300">{parseGSTIN(form.gstin).pan}</p></div>
                    <div><span className="text-white/40 text-xs">Entity</span><p className="text-blue-300">{parseGSTIN(form.gstin).entity_type}</p></div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Email</label>
                  <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field" placeholder="email@example.com" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Address</label>
                <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="input-field" placeholder="Street address" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">City</label>
                  <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="input-field" placeholder="City" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">State</label>
                  <input value={form.state} onChange={e => setForm({...form, state: e.target.value})} className="input-field" placeholder="State" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Pincode</label>
                  <input value={form.pincode} onChange={e => setForm({...form, pincode: e.target.value})} className="input-field" placeholder="400001" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Contact Person</label>
                  <input value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})} className="input-field" placeholder="Name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Business Type</label>
                  <select value={form.business_type} onChange={e => setForm({...form, business_type: e.target.value})} className="input-field">
                    <option value="">Select</option>
                    <option value="Sole Proprietorship">Sole Proprietorship</option>
                    <option value="Private Limited">Private Limited</option>
                    <option value="Public Limited">Public Limited</option>
                    <option value="LLP">LLP</option>
                    <option value="HUF">HUF</option>
                    <option value="Government">Government</option>
                    <option value="Trust">Trust</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={resetForm} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingCustomer ? 'Update Customer' : 'Add Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
