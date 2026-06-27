import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { Plus, Search, Eye, Edit, Trash2, Users as UsersIcon, X } from 'lucide-react'
import { parseGSTIN, formatCurrency } from '../utils'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await api.post('/customers', form)
      setCustomers([res.data.customer, ...customers])
      setShowForm(false)
      setForm({ name: '', gstin: '', phone: '', email: '', address: '', city: '', state: '', state_code: '', pincode: '', contact_person: '', trade_name: '', business_type: '' })
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed')
    }
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-gray-500 text-sm">Manage your customer database</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Customer</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center"><p className="text-sm text-gray-500">Total</p><p className="text-xl font-bold">{customers.length}</p></div>
        <div className="card text-center"><p className="text-sm text-gray-500">Active</p><p className="text-xl font-bold text-green-600">{customers.filter(c => c.gstin).length}</p></div>
        <div className="card text-center"><p className="text-sm text-gray-500">With GSTIN</p><p className="text-xl font-bold text-blue-600">{customers.filter(c => c.gstin).length}</p></div>
        <div className="card text-center"><p className="text-sm text-gray-500">Credit Limits</p><p className="text-xl font-bold text-orange-600">{formatCurrency(totalOutstanding)}</p></div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, GSTIN, phone..." className="input-field pl-10" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">GSTIN</th>
                <th className="pb-2 font-medium">Phone</th>
                <th className="pb-2 font-medium">City</th>
                <th className="pb-2 font-medium">State</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr></thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 font-medium">{c.name}</td>
                    <td className="py-3 text-gray-500 font-mono text-xs">{c.gstin || '-'}</td>
                    <td className="py-3">{c.phone || '-'}</td>
                    <td className="py-3">{c.city || '-'}</td>
                    <td className="py-3">{c.state || '-'}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/app/customers/${c.id}`)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Eye size={16} className="text-gray-500" /></button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Trash2 size={16} className="text-red-500" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Add Customer</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" placeholder="Customer Name *" required />
              <input value={form.gstin} onChange={e => setForm({...form, gstin: e.target.value.toUpperCase()})} onBlur={handleGSTINBlur} className="input-field" placeholder="GSTIN (auto-fills state)" maxLength={15} />
              {form.gstin && parseGSTIN(form.gstin) && (
                <div className="bg-blue-50 p-3 rounded-lg text-sm">
                  <p><strong>State:</strong> {parseGSTIN(form.gstin).state}</p>
                  <p><strong>PAN:</strong> {parseGSTIN(form.gstin).pan}</p>
                  <p><strong>Type:</strong> {parseGSTIN(form.gstin).entity_type}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" placeholder="Phone" />
                <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field" placeholder="Email" />
              </div>
              <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="input-field" placeholder="Address" />
              <div className="grid grid-cols-3 gap-3">
                <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="input-field" placeholder="City" />
                <input value={form.state} onChange={e => setForm({...form, state: e.target.value})} className="input-field" placeholder="State" />
                <input value={form.pincode} onChange={e => setForm({...form, pincode: e.target.value})} className="input-field" placeholder="Pincode" />
              </div>
              <input value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})} className="input-field" placeholder="Contact Person" />
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Add Customer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
