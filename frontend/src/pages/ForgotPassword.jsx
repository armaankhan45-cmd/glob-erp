import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { KeyRound } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [step, setStep] = useState(1) // 1=email, 2=otp, 3=new password
  const [resetToken, setResetToken] = useState('')
  const [userId, setUserId] = useState(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const sendOTP = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await api.post('/auth/forgot-password', { email })
      setMsg('OTP sent to your email (check console in dev mode)')
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed')
    }
  }

  const verifyOTP = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const res = await api.post('/auth/verify-otp', { email, otp })
      setResetToken(res.data.resetToken)
      setUserId(res.data.userId)
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.msg || 'Invalid OTP')
    }
  }

  const resetPassword = async (e) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 6) { setError('Min 6 characters'); return }
    try {
      await api.post('/auth/reset-password', { userId, newPassword })
      setMsg('Password reset! You can now login.')
      setStep(4)
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-3">
            <KeyRound size={28} />
          </div>
          <h1 className="text-2xl font-bold">Reset Password</h1>
        </div>

        <div className="card">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>}
          {msg && <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm mb-4">{msg}</div>}

          {step === 1 && (
            <form onSubmit={sendOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="input-field" />
              </div>
              <button type="submit" className="btn-primary w-full">Send OTP</button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={verifyOTP} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP</label>
                <input value={otp} onChange={e => setOtp(e.target.value)} required className="input-field" placeholder="6-digit OTP" />
              </div>
              <button type="submit" className="btn-primary w-full">Verify OTP</button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={resetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="input-field" placeholder="Min 6 characters" />
              </div>
              <button type="submit" className="btn-primary w-full">Reset Password</button>
            </form>
          )}

          {step === 4 && (
            <div className="text-center">
              <Link to="/login" className="btn-primary inline-block">Go to Login</Link>
            </div>
          )}

          <p className="mt-4 text-center text-sm text-gray-500">
            <Link to="/login" className="text-primary-600 hover:underline">Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
