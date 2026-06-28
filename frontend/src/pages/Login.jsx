import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Circle, Eye, EyeOff, Chrome, Github, LogIn } from 'lucide-react'
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
          required
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
    <button
      type="button"
      className="flex items-center justify-center gap-3 bg-black border border-white/10 rounded-xl h-12 px-4 text-sm font-medium text-white hover:bg-white/5 active:scale-[0.98] transition-all duration-150 w-full"
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function StepItem({ number, text, active = false }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${active ? 'bg-white text-black border border-white' : 'bg-brand-gray text-white border-none'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${active ? 'bg-black text-white' : 'bg-white/10 text-white/40'}`}>
        {number}
      </div>
      <span className="text-sm font-medium">{text}</span>
    </div>
  )
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/app/dashboard')
    } catch (err) {
      setError(err.response?.data?.msg || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen w-full bg-black selection:bg-white/30 p-2 transition-all duration-500 lg:h-screen lg:overflow-hidden lg:p-4">
      
      {/* Left Column — Hero + Video */}
      <div className="hidden lg:flex w-[52%] relative flex-col items-center justify-end pb-32 px-12 rounded-3xl overflow-hidden shadow-2xl h-full">
        {/* Background Video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260506_081238_406ed0e3-5d83-436e-a512-0bbff7ec5b95.mp4" type="video/mp4" />
        </video>

        {/* Hero Content */}
        <div className="z-10 w-full max-w-xs space-y-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.15, delayChildren: 0.2 }}
          >
            {/* Brand */}
            <motion.div className="flex items-center gap-2.5 mb-8" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <Circle size={20} className="fill-white text-white" />
              <span className="text-xl font-semibold tracking-tight">Aurora</span>
            </motion.div>

            {/* Heading */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <h2 className="text-4xl font-medium tracking-tight whitespace-nowrap">Join Aurora</h2>
            </motion.div>
            <motion.p className="text-white/60 text-sm leading-relaxed px-4 mt-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              Follow these 3 quick phases to activate your space.
            </motion.p>

            {/* Steps */}
            <motion.div className="space-y-2 mt-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <StepItem number={1} text="Register your identity" active={true} />
              <StepItem number={2} text="Configure your studio" />
              <StepItem number={3} text="Finalize your profile" />
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Right Column — Sign In Form */}
      <div className="flex-1 flex flex-col items-center justify-center py-12 lg:py-6 px-4 sm:px-12 lg:px-16 xl:px-24 overflow-y-auto lg:overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-full max-w-xl space-y-8 lg:space-y-6 sm:space-y-10"
        >
          {/* Header */}
          <div>
            <h1 className="text-3xl font-medium tracking-tight text-white">Welcome Back</h1>
            <p className="text-white/40 text-sm mt-1">Sign in to your Glob ERP account to continue.</p>
          </div>

          {/* Social Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <SocialButton icon={<Chrome size={18} />} label="Google" />
            <SocialButton icon={<Github size={18} />} label="Github" />
          </div>

          {/* Divider */}
          <div className="relative flex items-center">
            <div className="flex-1 border-t border-white/10"></div>
            <span className="bg-black px-4 text-xs font-medium text-white/40 uppercase tracking-widest">Or</span>
            <div className="flex-1 border-t border-white/10"></div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <InputGroup label="Email" placeholder="admin@globfabrication.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-brand-gray border-none rounded-xl h-11 px-4 pr-11 text-white placeholder:text-white/20 focus:ring-2 focus:ring-white/20 focus:outline-none transition-all duration-150"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-white/30 mt-1.5">Requires at least 8 symbols.</p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-white text-black font-semibold rounded-xl hover:bg-white/90 active:scale-[0.98] mt-4 transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <LogIn size={18} />
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Footer */}
          <div className="text-center space-y-2">
            <Link to="/forgot-password" className="text-sm text-white/40 hover:text-white/60 transition-colors">
              Forgot password?
            </Link>
            <div className="text-sm text-white/40">
              Don't have an account?{' '}
              <Link to="/register" className="text-brand-orange hover:text-brand-orange/80 font-medium transition-colors">
                Register
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  )
}
