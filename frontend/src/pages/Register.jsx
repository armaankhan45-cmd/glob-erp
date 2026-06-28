import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Circle, Eye, EyeOff, Chrome, Github, UserPlus } from 'lucide-react'
import { motion } from 'framer-motion'

function InputGroup({ label, placeholder, type = 'text', value, onChange, rightIcon }) {
  return (
    <div>
      <label className="block text-sm font-medium text-white mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-brand-gray border-none rounded-xl h-11 px-4 text-white placeholder:text-white/20 focus:ring-2 focus:ring-white/20 focus:outline-none transition-all duration-150"
          required={!placeholder?.includes('optional')}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 cursor-pointer hover:text-white/60 transition-colors">
            {rightIcon}
          </div>
        )}
      </div>
    </div>
  )
}

function SocialButton({ icon, label }) {
  return (
    <button type="button" className="flex items-center justify-center gap-3 bg-black border border-white/10 rounded-xl h-12 px-4 text-sm font-medium text-white hover:bg-white/5 active:scale-[0.98] transition-all duration-150 w-full">
      {icon}<span>{label}</span>
    </button>
  )
}

function StepItem({ number, text, active = false }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${active ? 'bg-white text-black border border-white' : 'bg-brand-gray text-white border-none'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${active ? 'bg-black text-white' : 'bg-white/10 text-white/40'}`}>{number}</div>
      <span className="text-sm font-medium">{text}</span>
    </div>
  )
}

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

  return (
    <main className="flex min-h-screen w-full bg-black selection:bg-white/30 p-2 transition-all duration-500 lg:h-screen lg:overflow-hidden lg:p-4">
      
      {/* Left Column — Hero + Video */}
      <div className="hidden lg:flex w-[52%] relative flex-col items-center justify-end pb-32 px-12 rounded-3xl overflow-hidden shadow-2xl h-full">
        <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover">
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4" type="video/mp4" />
        </video>
        <div className="z-10 w-full max-w-xs space-y-8">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ staggerChildren: 0.15, delayChildren: 0.2 }}>
            <motion.div className="flex items-center gap-2.5 mb-8" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Circle size={20} className="fill-white text-white" />
              <span className="text-xl font-semibold tracking-tight">Aurora</span>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <h2 className="text-4xl font-medium tracking-tight whitespace-nowrap">Join Aurora</h2>
            </motion.div>
            <motion.p className="text-white/60 text-sm leading-relaxed px-4 mt-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              Follow these 3 quick phases to activate your space.
            </motion.p>
            <motion.div className="space-y-2 mt-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <StepItem number={1} text="Register your identity" active={true} />
              <StepItem number={2} text="Configure your studio" />
              <StepItem number={3} text="Finalize your profile" />
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Right Column — Registration Form */}
      <div className="flex-1 flex flex-col items-center justify-center py-8 lg:py-6 px-4 sm:px-12 lg:px-16 xl:px-24 overflow-y-auto lg:overflow-hidden">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, ease: 'easeOut' }} className="w-full max-w-xl space-y-6">
          <div>
            <h1 className="text-3xl font-medium tracking-tight text-white">Create New Profile</h1>
            <p className="text-white/40 text-sm mt-1">Input your details to begin the journey.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <SocialButton icon={<Chrome size={18} />} label="Google" />
            <SocialButton icon={<Github size={18} />} label="Github" />
          </div>

          <div className="relative flex items-center">
            <div className="flex-1 border-t border-white/10"></div>
            <span className="bg-black px-4 text-xs font-medium text-white/40 uppercase tracking-widest">Or</span>
            <div className="flex-1 border-t border-white/10"></div>
          </div>

          {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Organization Name *</label>
              <input value={form.orgName} onChange={e => update('orgName', e.target.value)} required placeholder="Glob Fabrication and Enterprises" className="w-full bg-brand-gray border-none rounded-xl h-11 px-4 text-white placeholder:text-white/20 focus:ring-2 focus:ring-white/20 focus:outline-none transition-all duration-150" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InputGroup label="Your Name" placeholder="Full name" value={form.name} onChange={e => update('name', e.target.value)} />
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Phone</label>
                <input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="Optional" className="w-full bg-brand-gray border-none rounded-xl h-11 px-4 text-white placeholder:text-white/20 focus:ring-2 focus:ring-white/20 focus:outline-none transition-all duration-150" />
              </div>
            </div>
            <InputGroup label="Email" placeholder="you@company.com" type="email" value={form.email} onChange={e => update('email', e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">GSTIN</label>
              <input value={form.gstin} onChange={e => update('gstin', e.target.value)} placeholder="27AWAPK1209R1ZC" className="w-full bg-brand-gray border-none rounded-xl h-11 px-4 text-white placeholder:text-white/20 focus:ring-2 focus:ring-white/20 focus:outline-none transition-all duration-150" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">State</label>
                <input value={form.state} onChange={e => update('state', e.target.value)} placeholder="Maharashtra" className="w-full bg-brand-gray border-none rounded-xl h-11 px-4 text-white placeholder:text-white/20 focus:ring-2 focus:ring-white/20 focus:outline-none transition-all duration-150" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">City</label>
                <input value={form.city} onChange={e => update('city', e.target.value)} placeholder="Mumbai" className="w-full bg-brand-gray border-none rounded-xl h-11 px-4 text-white placeholder:text-white/20 focus:ring-2 focus:ring-white/20 focus:outline-none transition-all duration-150" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Password *</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => update('password', e.target.value)} required placeholder="Min 6 characters" className="w-full bg-brand-gray border-none rounded-xl h-11 px-4 pr-11 text-white placeholder:text-white/20 focus:ring-2 focus:ring-white/20 focus:outline-none transition-all duration-150" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full h-14 bg-white text-black font-semibold rounded-xl hover:bg-white/90 active:scale-[0.98] mt-2 transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2">
              <UserPlus size={18} /> {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-white/40">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-orange hover:text-brand-orange/80 font-medium transition-colors">Sign In</Link>
          </p>
        </motion.div>
      </div>
    </main>
  )
}
