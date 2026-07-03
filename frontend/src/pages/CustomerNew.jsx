import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Search, Loader2, CheckCircle, AlertCircle, MapPin } from 'lucide-react'
import api from '../api/client'

const STATES = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '27': 'Maharashtra', '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa', '32': 'Kerala',
  '33': 'Tamil Nadu', '36': 'Telangana', '37': 'Andhra Pradesh'
}

const CITY_STATE_MAP = {
  'mumbai': 'Maharashtra', 'pune': 'Maharashtra', 'nagpur': 'Maharashtra', 'nashik': 'Maharashtra',
  'thane': 'Maharashtra', 'aurangabad': 'Maharashtra', 'solapur': 'Maharashtra', 'kolhapur': 'Maharashtra',
  'delhi': 'Delhi', 'new delhi': 'Delhi',
  'bangalore': 'Karnataka', 'bengaluru': 'Karnataka', 'mysore': 'Karnataka', 'hubli': 'Karnataka',
  'chennai': 'Tamil Nadu', 'coimbatore': 'Tamil Nadu', 'madurai': 'Tamil Nadu', 'salem': 'Tamil Nadu',
  'hyderabad': 'Telangana', 'warangal': 'Telangana', 'nizamabad': 'Telangana',
  'kolkata': 'West Bengal', 'howrah': 'West Bengal', 'durgapur': 'West Bengal',
  'ahmedabad': 'Gujarat', 'surat': 'Gujarat', 'vadodara': 'Gujarat', 'rajkot': 'Gujarat',
  'jaipur': 'Rajasthan', 'jodhpur': 'Rajasthan', 'udaipur': 'Rajasthan', 'kota': 'Rajasthan',
  'lucknow': 'Uttar Pradesh', 'kanpur': 'Uttar Pradesh', 'agra': 'Uttar Pradesh', 'varanasi': 'Uttar Pradesh',
  'patna': 'Bihar', 'gaya': 'Bihar',
  'bhopal': 'Madhya Pradesh', 'indore': 'Madhya Pradesh', 'gwalior': 'Madhya Pradesh',
  'raipur': 'Chhattisgarh', 'bhilai': 'Chhattisgarh',
  'ranchi': 'Jharkhand', 'jamshedpur': 'Jharkhand', 'dhanbad': 'Jharkhand',
  'bhubaneswar': 'Odisha', 'cuttack': 'Odisha',
  'guwahati': 'Assam', 'dibrugarh': 'Assam',
  'chandigarh': 'Chandigarh',
  'ludhiana': 'Punjab', 'amritsar': 'Punjab', 'jalandhar': 'Punjab',
  'ambala': 'Haryana', 'faridabad': 'Haryana', 'gurugram': 'Haryana', 'gurgaon': 'Haryana',
  'shimla': 'Himachal Pradesh', 'dharamsala': 'Himachal Pradesh',
  'dehradun': 'Uttarakhand', 'haridwar': 'Uttarakhand',
  'jammu': 'Jammu and Kashmir', 'srinagar': 'Jammu and Kashmir',
  'kochi': 'Kerala', 'thiruvananthapuram': 'Kerala', 'kozhikode': 'Kerala',
  'panaji': 'Goa', 'margao': 'Goa',
  'agartala': 'Tripura', 'shillong': 'Meghalaya', 'aizawl': 'Mizoram',
  'imphal': 'Manipur', 'kohima': 'Nagaland', 'gangtok': 'Sikkim',
  'itanagar': 'Arunachal Pradesh', 'dispur': 'Assam'
}

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

export default function CustomerNew() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [gstLoading, setGstLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const [name, setName] = useState('')
  const [gstin, setGstin] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [stateCode, setStateCode] = useState('')
  const [pincode, setPincode] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNo, setAccountNo] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [upiId, setUpiId] = useState('')

  const handleCityChange = (val) => {
    setCity(val)
    const lower = val.toLowerCase().trim()
    if (CITY_STATE_MAP[lower]) {
      const st = CITY_STATE_MAP[lower]
      setState(st)
      setStateCode(STATE_CODE_MAP[st] || '')
      setMessage({ type: 'info', text: 'State auto-filled: ' + st })
      setTimeout(() => setMessage({ type: '', text: '' }), 2000)
    }
  }

  const fetchByPincode = async (pin) => {
    setPincode(pin)
    if (pin.length < 6) {
      setCity(''); setState(''); setStateCode('')
      setMessage({ type: '', text: '' })
      return
    }
    if (pin.length === 6) {
      setMessage({ type: 'info', text: 'Fetching address...' })
      try {
        const r = await fetch('https://api.postalpincode.in/pincode/' + pin)
        const data = await r.json()
        if (data[0]?.Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
          const po = data[0].PostOffice[0]
          setCity(po.District || po.Block || '')
          setState(po.State || '')
          setStateCode(STATE_CODE_MAP[po.State] || '')
          setAddress(po.Name + ', ' + po.District)
          setMessage({ type: 'success', text: 'Address fetched: ' + po.District + ', ' + po.State })
          setTimeout(() => setMessage({ type: '', text: '' }), 3000)
        } else {
          setCity(''); setState(''); setStateCode('')
          setMessage({ type: 'error', text: 'Invalid PIN code: ' + pin })
          setTimeout(() => setMessage({ type: '', text: '' }), 3000)
        }
      } catch (e) {
        setMessage({ type: 'error', text: 'Failed to fetch address. Check internet.' })
        setTimeout(() => setMessage({ type: '', text: '' }), 3000)
      }
    }
  }

  const fetchGST = async () => {
    const g = gstin.trim().toUpperCase()
    if (g.length !== 15) {
      setMessage({ type: 'error', text: 'GSTIN must be 15 characters' })
      return
    }
    setGstLoading(true)
    try {
      const r = await api.post('/customers/gst-lookup', { gstin: g })
      if (r.data.success) {
        const d = r.data.data
        setGstin(d.gstin || g)
        if (d.state) setState(d.state)
        if (d.state_code) setStateCode(d.state_code)
        if (d.business_type) setBusinessType(d.business_type)
        if (d.name) setName(d.name)
        setMessage({ type: 'success', text: d.message || 'Details extracted!' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.msg || 'Failed' })
    } finally {
      setGstLoading(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Customer name is required' })
      return
    }
    setLoading(true)
    try {
      const r = await api.post('/customers', {
        name, gstin, phone, email, address, city, state, state_code: stateCode,
        pincode, credit_limit: parseFloat(creditLimit) || 0,
        contact_person: contactPerson, trade_name: tradeName,
        business_type: businessType, bank_name: bankName,
        account_no: accountNo, ifsc, upi_id: upiId
      })
      setMessage({ type: 'success', text: 'Customer added! Redirecting...' })
      setTimeout(() => navigate('/app/customers'), 800)
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.msg || 'Failed' })
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/customers')} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white"><ArrowLeft size={16} /></button>
        <div>
          <h1 className="text-2xl font-bold text-white">Add New Customer</h1>
          <p className="text-slate-400 text-sm">Enter GSTIN to auto-fill State & PAN</p>
        </div>
      </div>

      {message.text && (
        <div className={"p-4 rounded-xl flex items-start gap-2 text-sm " + (
          message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' :
          message.type === 'info' ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400' :
          'bg-red-500/10 border border-red-500/30 text-red-400'
        )}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <div className="glass rounded-2xl p-5 border border-blue-500/20 bg-blue-500/5">
          <h3 className="text-sm font-bold text-blue-400 mb-3">GSTIN Lookup</h3>
          <p className="text-xs text-slate-400 mb-4">Type 15-digit GSTIN to auto-fill State and PAN</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              maxLength="15"
              placeholder="Example: 27AAACR5055K1Z7"
              className="flex-1 px-4 py-3 rounded-xl text-base font-mono uppercase tracking-wider"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={fetchGST}
              disabled={gstLoading || gstin.length !== 15}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {gstLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {gstLoading ? 'Fetching...' : 'Validate'}
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1.5">Customer Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sharma Steel Works" required className="w-full px-3 py-2.5 rounded-xl text-sm" autoComplete="off" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1.5">Trade Name</label>
              <input type="text" value={tradeName} onChange={(e) => setTradeName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm" autoComplete="off" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1.5">Contact Person</label>
              <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Mr. Rajesh" className="w-full px-3 py-2.5 rounded-xl text-sm" autoComplete="off" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1.5">Business Type</label>
              <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm">
                <option value="">Select Type</option>
                <option>Sole Proprietorship</option>
                <option>Partnership</option>
                <option>Private Limited</option>
                <option>Public Limited</option>
                <option>LLP</option>
                <option>Government</option>
              </select>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-4">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1.5">Phone Number</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" className="w-full px-3 py-2.5 rounded-xl text-sm" autoComplete="off" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm" autoComplete="off" />
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-4">Address Details</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1.5">Full Address</label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Building, Street, Area" rows="2" className="w-full px-3 py-2.5 rounded-xl text-sm" autoComplete="off" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1.5">City <span className="text-blue-400">(auto-fills state)</span></label>
                <input type="text" value={city} onChange={(e) => handleCityChange(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm" autoComplete="off" placeholder="Mumbai, Pune..." />
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1.5">State</label>
                <input type="text" value={state} onChange={(e) => setState(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm" autoComplete="off" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1.5">State Code</label>
                <input type="text" value={stateCode} onChange={(e) => setStateCode(e.target.value)} maxLength="2" className="w-full px-3 py-2.5 rounded-xl text-sm font-mono" autoComplete="off" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold mb-1.5">Pincode <span className="text-emerald-400">(auto-fetch)</span></label>
                <div className="relative">
                  <input type="text" value={pincode} onChange={(e) => fetchByPincode(e.target.value)} maxLength="6" className="w-full px-3 py-2.5 rounded-xl text-sm pr-8" autoComplete="off" placeholder="400074" />
                  <MapPin size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-400" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-4">Bank Details (Optional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1.5">Bank Name</label>
              <input type="text" value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm" autoComplete="off" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1.5">Account Number</label>
              <input type="text" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm font-mono" autoComplete="off" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1.5">IFSC Code</label>
              <input type="text" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} className="w-full px-3 py-2.5 rounded-xl text-sm font-mono uppercase" autoComplete="off" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 font-semibold mb-1.5">UPI ID</label>
              <input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm" autoComplete="off" />
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="text-sm font-bold text-white mb-4">Credit Limit</h3>
          <input type="text" inputMode="decimal" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="50000" className="w-full md:w-1/3 px-3 py-2.5 rounded-xl text-sm" autoComplete="off" />
        </div>

        <div className="flex gap-3 sticky bottom-0 bg-slate-900/95 backdrop-blur p-4 rounded-2xl border border-slate-800">
          <button type="button" onClick={() => navigate('/app/customers')} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl text-sm font-bold transition">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:shadow-lg text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {loading ? 'Saving...' : 'Save Customer'}
          </button>
        </div>
      </form>
    </div>
  )
}
