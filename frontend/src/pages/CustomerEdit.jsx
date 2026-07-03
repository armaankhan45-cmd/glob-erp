import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, CheckCircle, AlertCircle, MapPin } from 'lucide-react'
import api from '../api/client'

const STATE_CODE_MAP = {
  'Jammu and Kashmir': '01', 'Himachal Pradesh': '02', 'Punjab': '03', 'Chandigarh': '04',
  'Uttarakhand': '05', 'Haryana': '06', 'Delhi': '07', 'Rajasthan': '08',
  'Uttar Pradesh': '09', 'Bihar': '10', 'Sikkim': '11', 'Arunachal Pradesh': '12',
  'Nagaland': '13', 'Manipur': '14', 'Mizoram': '15', 'Tripura': '16',
  'Meghalaya': '17', 'Assam': '18', 'West Bengal': '19', 'Jharkhand': '20',
  'Odisha': '21', 'Chhattisgarh': '22', 'Madhya Pradesh': '23', 'Gujarat': '24',
  'Maharashtra': '27', 'Andhra Pradesh': '28', 'Karnataka': '29', 'Goa': '30',
  'Kerala': '32', 'Tamil Nadu': '33', 'Telangana': '36'
}

const CITY_STATE_MAP = {
  'mumbai': 'Maharashtra', 'pune': 'Maharashtra', 'nagpur': 'Maharashtra', 'nashik': 'Maharashtra',
  'thane': 'Maharashtra', 'delhi': 'Delhi', 'new delhi': 'Delhi',
  'bangalore': 'Karnataka', 'bengaluru': 'Karnataka', 'mysore': 'Karnataka',
  'chennai': 'Tamil Nadu', 'coimbatore': 'Tamil Nadu', 'madurai': 'Tamil Nadu',
  'hyderabad': 'Telangana', 'kolkata': 'West Bengal', 'howrah': 'West Bengal',
  'ahmedabad': 'Gujarat', 'surat': 'Gujarat', 'vadodara': 'Gujarat',
  'jaipur': 'Rajasthan', 'lucknow': 'Uttar Pradesh', 'kanpur': 'Uttar Pradesh',
  'patna': 'Bihar', 'bhopal': 'Madhya Pradesh', 'indore': 'Madhya Pradesh',
  'raipur': 'Chhattisgarh', 'ranchi': 'Jharkhand', 'bhubaneswar': 'Odisha',
  'chandigarh': 'Chandigarh', 'ludhiana': 'Punjab', 'amritsar': 'Punjab',
  'faridabad': 'Haryana', 'gurugram': 'Haryana', 'gurgaon': 'Haryana',
  'kochi': 'Kerala', 'thiruvananthapuram': 'Kerala', 'panaji': 'Goa'
}

export default function CustomerEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [form, setForm] = useState(null)

  useEffect(() => {
    api.get('/customers/' + id).then(r => {
      setForm(r.data.customer)
    }).catch(() => navigate('/app/customers'))
  }, [id])

  const fetchByPincode = async (pin) => {
    if (pin.length < 6) {
      setForm(prev => ({ ...prev, pincode: pin }))
      return
    }
    if (pin.length === 6) {
      try {
        const r = await fetch('https://api.postalpincode.in/pincode/' + pin)
        const data = await r.json()
        if (data[0]?.Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
          const po = data[0].PostOffice[0]
          setForm(prev => ({
            ...prev,
            pincode: pin,
            city: po.District || po.Block || '',
            state: po.State || '',
            state_code: STATE_CODE_MAP[po.State] || ''
          }))
        } else {
          setForm(prev => ({ ...prev, pincode: pin, city: '', state: '', state_code: '' }))
        }
      } catch (e) {
        setForm(prev => ({ ...prev, pincode: pin }))
      }
    }
  }

  const handleCityChange = (val) => {
    const lower = val.toLowerCase().trim()
    if (CITY_STATE_MAP[lower]) {
      const st = CITY_STATE_MAP[lower]
      setForm(prev => ({ ...prev, city: val, state: st, state_code: STATE_CODE_MAP[st] || prev.state_code }))
    } else {
      setForm(prev => ({ ...prev, city: val }))
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.put('/customers/' + id, form)
      setMessage({ type: 'success', text: 'Customer updated successfully!' })
      setTimeout(() => navigate('/app/customers/' + id), 1000)
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.msg || 'Update failed' })
      setLoading(false)
    }
  }

  if (!form) return <div className="flex items-center justify-center h-96"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/customers/' + id)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white"><ArrowLeft size={16} /></button>
        <div>
          <h1 className="text-2xl font-bold text-white">Edit Customer</h1>
          <p className="text-slate-400 text-sm">Update customer details</p>
        </div>
      </div>

      {message.text && (
        <div className={"p-3 rounded-xl flex items-center gap-2 text-sm " + (message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400')}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}{message.text}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-3">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-400">Name *</label><input required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-slate-700 text-sm mt-1" /></div>
            <div><label className="text-xs text-slate-400">GSTIN</label><input value={form.gstin || ''} onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })} maxLength="15" className="w-full px-3 py-2.5 rounded-xl border border-slate-700 text-sm mt-1 font-mono" /></div>
            <div><label className="text-xs text-slate-400">Phone</label><input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-slate-700 text-sm mt-1" /></div>
            <div><label className="text-xs text-slate-400">Email</label><input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-slate-700 text-sm mt-1" /></div>
            <div><label className="text-xs text-slate-400">Contact Person</label><input value={form.contact_person || ''} onChange={e => setForm({ ...form, contact_person: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-slate-700 text-sm mt-1" /></div>
            <div><label className="text-xs text-slate-400">Business Type</label><select value={form.business_type || ''} onChange={e => setForm({ ...form, business_type: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-slate-700 text-sm mt-1"><option value="">Select</option><option>Proprietorship</option><option>Partnership</option><option>Private Limited</option><option>Public Limited</option><option>LLP</option></select></div>
            <div className="md:col-span-2"><label className="text-xs text-slate-400">Address</label><textarea value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} rows="2" className="w-full px-3 py-2.5 rounded-xl border border-slate-700 text-sm mt-1" /></div>
            <div><label className="text-xs text-slate-400">City <span className="text-blue-400 text-[10px]">(auto-fills state)</span></label><input value={form.city || ''} onChange={e => handleCityChange(e.target.value)} placeholder="Mumbai, Pune..." className="w-full px-3 py-2.5 rounded-xl border border-slate-700 text-sm mt-1" /></div>
            <div><label className="text-xs text-slate-400">State</label><input value={form.state || ''} onChange={e => setForm({ ...form, state: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-slate-700 text-sm mt-1" /></div>
            <div><label className="text-xs text-slate-400">Pincode <span className="text-emerald-400 text-[10px]">(auto-fetch)</span></label><input value={form.pincode || ''} onChange={e => fetchByPincode(e.target.value)} maxLength="6" placeholder="400074" className="w-full px-3 py-2.5 rounded-xl border border-slate-700 text-sm mt-1" /></div>
            <div><label className="text-xs text-slate-400">Credit Limit</label><input type="number" value={form.credit_limit || 0} onChange={e => setForm({ ...form, credit_limit: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-slate-700 text-sm mt-1" /></div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/app/customers/' + id)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl text-sm font-bold">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {loading ? 'Saving...' : 'Update Customer'}
          </button>
        </div>
      </form>
    </div>
  )
}
