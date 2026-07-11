import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
  const { user, loading, signUp } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  if (loading) return (
    <div className="flex items-center justify-center min-h-[100dvh] mesh-gradient">
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center animate-pulse">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </div>
    </div>
  )
  if (user) return <Navigate to="/" />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.endsWith('@umt.edu.pk')) {
      setError('Only @umt.edu.pk emails are allowed')
      return
    }
    setSubmitting(true)
    const { error: err } = await signUp(email, password, name)
    setSubmitting(false)
    if (err) setError(err.message)
    else setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-[100dvh] mesh-gradient flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md animate-slideUp">
          <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/20">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
          </div>
          <div className="card text-center py-8">
            <h2 className="text-xl font-extrabold text-text mb-2">Check your email</h2>
            <p className="text-sm text-text-muted mb-6">We sent a verification link to<br /><strong className="text-text">{email}</strong></p>
            <Link to="/login" className="btn-primary inline-flex px-8">Go to Login</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] mesh-gradient flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-slideUp">
        <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/20">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <h1 className="text-3xl font-extrabold text-text tracking-tight">Lost & Found</h1>
          <p className="text-sm text-text-muted mt-2">UMT Campus — join the community</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-bold text-text mb-1">Create your account</h2>
          <p className="text-sm text-text-muted mb-6">Start reporting lost & found items</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text mb-1.5">Full Name</label>
              <input placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required className="input" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text mb-1.5">University Email</label>
              <input type="email" placeholder="you@umt.edu.pk" value={email} onChange={e => setEmail(e.target.value)} required className="input" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text mb-1.5">Password</label>
              <input type="password" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="input" />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-lost-light text-lost text-sm font-medium">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-[15px]">
              {submitting ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>
        </div>

        <p className="text-sm text-center mt-6 text-text-muted">
          Already have an account? <Link to="/login" className="text-accent font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
