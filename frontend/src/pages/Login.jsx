import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import DotField from '../components/DotField'
import MagnetLines from '../components/MagnetLines'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setRetrying(false)
    try {
      await login(email, password)
      navigate('/app/dashboard')
    } catch (err) {
      if (err.code === 'COLD_START' || err.message?.includes('waking up')) {
        setError('Server is waking up from sleep. Please try again in 30 seconds.')
        setRetrying(true)
      } else if (err.message?.includes('timeout') || err.code === 'ECONNABORTED') {
        setError('Connection timed out. The server may be starting up — please try again.')
        setRetrying(true)
      } else if (!err.response) {
        setError('Network error. Please check your internet connection and try again.')
      } else if (err.response?.status === 401) {
        setError('Invalid email or password.')
      } else if (err.response?.status >= 500) {
        setError('Server error. Please try again in a moment.')
        setRetrying(true)
      } else {
        setError(err.response?.data?.msg || 'Login failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen w-full p-2 lg:h-screen lg:overflow-hidden lg:p-4" style={{ background: '#06080f' }}>
      {/* ═══════════════════════════════════════════════════════════
          AURORA LEFT PANEL — Interactive DotField + MagnetLines
          Premium fabrication business feel with subtle interactive dots
          ═══════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex w-[52%] relative flex-col items-center justify-end pb-32 px-12 rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #06080f 0%, #0d1a2d 40%, #1a0a2e 70%, #06080f 100%)' }}>
        {/* Interactive DotField Background */}
        <DotField
          dotRadius={1.2}
          dotSpacing={18}
          cursorRadius={350}
          bulgeStrength={35}
          glowRadius={100}
          sparkle={true}
          style={{ opacity: 0.7 }}
        />

        {/* MagnetLines — subtle directional lines */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.3, pointerEvents: 'none' }}>
          <MagnetLines
            rows={6}
            columns={8}
            lineColor="rgba(var(--accent-rgb), 0.08)"
            lineHeight="20px"
            lineWidth="1px"
            baseAngle={-10}
          />
        </div>

        {/* Static gradient overlays */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 40%, rgba(6,182,212,0.08), transparent 60%)' }}></div>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 30%, rgba(79,143,255,0.06), transparent 60%)' }}></div>

        {/* Content */}
        <div className="z-10 w-full max-w-xs space-y-8">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-light))', boxShadow: '0 0 15px rgba(var(--accent-rgb), 0.3)', padding: 0, minWidth: 32, height: 32 }}><span className="text-white font-extrabold text-sm">G</span></div>
            <span className="text-xl font-bold tracking-tight text-white">Glob ERP</span>
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-white">GST-Compliant <span style={{ color: 'var(--accent)' }}>Fabrication ERP</span></h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)', paddingLeft: '1rem' }}>Invoicing, quotations, purchase bills, and GST reports — all in one place.</p>
          <div className="space-y-2 mt-6">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl btn-primary" style={{ animation: 'slideUp 0.5s ease-out 0.2s both' }}><div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(0,0,0,0.2)' }}>1</div><span className="text-sm font-medium">Sign in to your account</span></div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', animation: 'slideUp 0.5s ease-out 0.4s both' }}><div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(255,255,255,0.1)' }}>2</div><span className="text-sm font-medium">Configure your workspace</span></div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', animation: 'slideUp 0.5s ease-out 0.6s both' }}><div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(255,255,255,0.1)' }}>3</div><span className="text-sm font-medium">Start managing your ERP</span></div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          RIGHT FORM PANEL — Clean login with subtle dot field
          ═══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col items-center justify-center py-12 lg:py-6 px-4 sm:px-12 lg:px-16 xl:px-24 overflow-y-auto lg:overflow-hidden relative" style={{ background: '#06080f' }}>
        {/* Subtle dot field on right side too */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.15, pointerEvents: 'none' }}>
          <DotField
            dotRadius={0.8}
            dotSpacing={24}
            cursorRadius={250}
            bulgeStrength={20}
            glowRadius={60}
            sparkle={false}
          />
        </div>

        <div className="w-full max-w-xl space-y-8 lg:space-y-6 sm:space-y-10 relative z-10" style={{ animation: 'slideUp 0.6s cubic-bezier(0.16,1,0.3,1)' }}>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Sign In</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Welcome back! Enter your credentials.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button type="button" className="flex items-center justify-center gap-3 h-12 px-4 text-sm font-medium rounded-xl transition-all duration-200 hover:bg-white/[0.06] active:scale-[0.98]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>G Google</button>
            <button type="button" className="flex items-center justify-center gap-3 h-12 px-4 text-sm font-medium rounded-xl transition-all duration-200 hover:bg-white/[0.06] active:scale-[0.98]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>🐱 GitHub</button>
          </div>
          <div className="relative flex items-center">
            <div className="flex-1" style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
            <span className="px-4 text-xs font-medium uppercase tracking-widest" style={{ background: '#06080f', color: 'rgba(255,255,255,0.2)' }}>or</span>
            <div className="flex-1" style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
          </div>
          {error && (
            <div className="p-3 rounded-xl text-sm" style={{
              background: retrying ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
              border: retrying ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(239,68,68,0.2)',
              color: retrying ? '#fbbf24' : '#f87171',
              animation: 'slideUp 0.3s ease-out'
            }}>
              {retrying && <span style={{ marginRight: 6 }}>⏳</span>}
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="block text-sm font-medium text-white mb-1.5">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="input-field" required /></div>
            <div><label className="block text-sm font-medium text-white mb-1.5">Password</label><div className="relative"><input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="input-field" style={{ paddingRight: '2.75rem' }} required /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 transition-all duration-200 hover:scale-110" style={{ color: 'rgba(255,255,255,0.3)' }}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.2)' }}>Minimum 6 characters.</p></div>
            <button type="submit" disabled={loading} className="w-full h-14 font-semibold rounded-xl mt-4 transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 text-white btn-primary">
              <LogIn size={18} />{loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <div className="text-center space-y-2">
            <Link to="/forgot-password" className="text-sm transition-colors duration-200 hover:text-white/50" style={{ color: 'rgba(255,255,255,0.3)' }}>Forgot password?</Link>
            <div className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Don't have an account? <Link to="/register" className="font-medium accent-text">Register</Link></div>
          </div>
        </div>
      </div>
    </main>
  )
}
