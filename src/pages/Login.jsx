import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return (
    <div className="flex items-center justify-center min-h-[100dvh] mesh-gradient">
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center animate-pulse">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </div>
    </div>
  )
  if (user) return <Navigate to="/" />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error: err } = await signIn(email, password)
    setSubmitting(false)
    if (err) setError(err.message)
    else navigate('/')
  }

  return (
    <div className="min-h-[100dvh] mesh-gradient flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-slideUp">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <h1 className="text-3xl font-extrabold text-text tracking-tight">Lost & Found</h1>
          <p className="text-sm text-text-muted mt-2">UMT Campus — reunite with what matters</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-bold text-text mb-1">Welcome back</h2>
          <p className="text-sm text-text-muted mb-6">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text mb-1.5">Email</label>
              <input type="email" placeholder="you@umt.edu.pk" value={email} onChange={e => setEmail(e.target.value)} required className="input" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text mb-1.5">Password</label>
              <input type="password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required className="input" />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-lost-light text-lost text-sm font-medium">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-[15px]">
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-sm text-center mt-6 text-text-muted">
          Don't have an account? <Link to="/signup" className="text-primary font-semibold hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
