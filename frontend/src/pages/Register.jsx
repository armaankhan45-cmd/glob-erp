import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, UserPlus } from 'lucide-react'

export default function Register() {
  const [form, setForm] = useState({ orgName: '', name: '', email: '', phone: '', password: '', gstin: '', state: 'Maharashtra', state_code: '27', city: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      await register(form)
      navigate('/app/dashboard')
    } catch (err) {
      setError(err.response?.data?.msg || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const update = (key, val) => setForm({ ...form, [key]: val })

  const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff' }

  return (
    <main className="flex min-h-screen w-full p-2 lg:h-screen lg:overflow-hidden lg:p-4"
      style={{ background: '#06080f' }}>
      
      {/* Left Column — Visual */}
      <div className="hidden lg:flex w-[52%] relative flex-col items-center justify-end pb-32 px-12 rounded-3xl overflow-hidden"
        style={{ background: '#06080f' }}>
        {/* Floating Orbs */}
        <div className="orb" style={{ width: 400, height: 400, background: 'radial-gradient(circle, rgba(168,85,247,0.3), transparent 70%)', top: '5%', left: '5%', animation: 'orbMove2 22s ease-in-out infinite' }}></div>
        <div className="orb" style={{ width: 350, height: 350, background: 'radial-gradient(circle, rgba(239,77,35,0.25), transparent 70%)', bottom: '10%', right: '5%', animation: 'orbMove1 18s ease-in-out infinite' }}></div>
        {/* Grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)'
        }}></div>
        <div className="z-10 w-full max-w-xs space-y-8">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #ef4d23, #ff6b35)' }}>
              <span className="text-white font-extrabold text-sm">G</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Glob ERP</span>
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-white">Create <span style={{ color: '#a855f7' }}>Account</span></h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)', paddingLeft: '1rem' }}>
            Set up your organization and start managing your fabrication business.
          </p>
          <div className="space-y-2 mt-6">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(168,85,247,0.8)', color: '#fff' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(0,0,0,0.2)' }}>1</div>
              <span className="text-sm font-medium">Register your business</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(255,255,255,0.1)' }}>2</div>
              <span className="text-sm font-medium">Configure GST & settings</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(255,255,255,0.1)' }}>3</div>
              <span className="text-sm font-medium">Start using your ERP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column — Form */}
      <div className="flex-1 flex flex-col items-center justify-center py-8 lg:py-6 px-4 sm:px-12 lg:px-16 xl:px-24 overflow-y-auto lg:overflow-hidden">
        <div className="w-full max-w-xl space-y-6" style={{ animation: 'slideUp 0.8s ease-out' }}>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Create Account</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Input your details to begin the journey.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button type="button" className="flex items-center justify-center gap-3 h-12 px-4 text-sm font-medium rounded-xl transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
              G Google
            </button>
            <button type="button" className="flex items-center justify-center gap-3 h-12 px-4 text-sm font-medium rounded-xl transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
              🐱 GitHub
            </button>
          </div>

          <div className="relative flex items-center">
            <div className="flex-1" style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
            <span className="px-4 text-xs font-medium uppercase tracking-widest" style={{ background: '#06080f', color: 'rgba(255,255,255,0.2)' }}>or</span>
            <div className="flex-1" style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Organization Name *</label>
              <input value={form.orgName} onChange={e => update('orgName', e.target.value)} required placeholder="Glob Fabrication and Enterprises" className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Your Name</label>
                <input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Full name" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Phone</label>
                <input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="Optional" className="input-field" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@company.com" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">GSTIN</label>
              <input value={form.gstin} onChange={e => update('gstin', e.target.value)} placeholder="27AWAPK1209R1ZC" className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">State</label>
                <input value={form.state} onChange={e => update('state', e.target.value)} placeholder="Maharashtra" className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">City</label>
                <input value={form.city} onChange={e => update('city', e.target.value)} placeholder="Mumbai" className="input-field" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Password *</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => update('password', e.target.value)} required placeholder="Min 6 characters" className="input-field" style={{ paddingRight: '2.75rem' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full h-14 font-semibold rounded-xl mt-2 transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 text-white"
              style={{ background: 'linear-gradient(135deg, #ef4d23, #ff6b35)', boxShadow: '0 0 20px rgba(239,77,35,0.25)' }}>
              <UserPlus size={18} /> {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-medium" style={{ color: '#ef4d23' }}>Sign In</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
