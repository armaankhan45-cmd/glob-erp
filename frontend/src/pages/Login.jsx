import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Eye, EyeOff, LogIn } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { themeKey, themes } = useTheme()
  const accent = themes[themeKey]?.color || '#06b6d4'
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
    <main className="flex min-h-screen w-full p-2 lg:h-screen lg:overflow-hidden lg:p-4" style={{ background: '#06080f' }}>
      
      {/* Left Column */}
      <div className="hidden lg:flex w-[52%] relative flex-col items-center justify-end pb-32 px-12 rounded-3xl overflow-hidden" style={{ background: '#06080f' }}>
        <div className="orb" style={{ width: 400, height: 400, background: `radial-gradient(circle, ${accent}4D, transparent 70%)`, top: '5%', left: '5%', animation: 'orbMove1 20s ease-in-out infinite' }}></div>
        <div className="orb" style={{ width: 350, height: 350, background: 'radial-gradient(circle, rgba(79,143,255,0.25), transparent 70%)', top: '25%', right: '0%', animation: 'orbMove2 25s ease-in-out infinite' }}></div>
        <div className="orb" style={{ width: 300, height: 300, background: 'radial-gradient(circle, rgba(168,85,247,0.2), transparent 70%)', bottom: '5%', left: '25%', animation: 'orbMove1 22s ease-in-out infinite reverse' }}></div>
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)'
        }}></div>

        <div className="z-10 w-full max-w-xs space-y-8">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}>
              <span className="text-white font-extrabold text-sm">G</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Glob ERP</span>
          </div>

          <h2 className="text-4xl font-bold tracking-tight text-white">
            Welcome to <span style={{ color: accent }}>Nebula</span>
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)', paddingLeft: '1rem' }}>
            Your fabrication business, powered by AI and modern design.
          </p>

          <div className="space-y-2 mt-6">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: accent, color: '#fff' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(0,0,0,0.2)' }}>1</div>
              <span className="text-sm font-medium">Sign in to your account</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(255,255,255,0.1)' }}>2</div>
              <span className="text-sm font-medium">Configure your workspace</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(255,255,255,0.1)' }}>3</div>
              <span className="text-sm font-medium">Start managing your ERP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="flex-1 flex flex-col items-center justify-center py-12 lg:py-6 px-4 sm:px-12 lg:px-16 xl:px-24 overflow-y-auto lg:overflow-hidden">
        <div className="w-full max-w-xl space-y-8 lg:space-y-6 sm:space-y-10" style={{ animation: 'slideUp 0.8s ease-out' }}>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Sign In</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Welcome back! Enter your credentials.</p>
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@globfabrication.com" className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" className="input-field" style={{ paddingRight: '2.75rem' }} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.2)' }}>Requires at least 8 symbols.</p>
            </div>
            <button type="submit" disabled={loading}
              className="w-full h-14 font-semibold rounded-xl mt-4 transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 text-white"
              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)`, boxShadow: `0 0 20px ${accent}40` }}>
              <LogIn size={18} />
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="text-center space-y-2">
            <Link to="/forgot-password" className="text-sm transition-colors" style={{ color: 'rgba(255,255,255,0.3)' }}>Forgot password?</Link>
            <div className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Don't have an account?{' '}
              <Link to="/register" className="font-medium transition-colors" style={{ color: accent }}>Register</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
