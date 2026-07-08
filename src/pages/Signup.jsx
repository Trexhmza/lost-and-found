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

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="card w-full max-w-sm text-center">
          <h2 className="text-xl font-bold mb-2">Check your email</h2>
          <p className="text-sm text-gray-500">We sent a verification link to <strong>{email}</strong></p>
          <Link to="/login" className="btn-primary inline-block mt-4">Go to Login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-1">Lost & Found</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Create your account</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required className="w-full border border-gray-300 rounded-lg p-3 text-sm" />
          <input type="email" placeholder="email@umt.edu.pk" value={email} onChange={e => setEmail(e.target.value)} required className="w-full border border-gray-300 rounded-lg p-3 text-sm" />
          <input type="password" placeholder="Password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="w-full border border-gray-300 rounded-lg p-3 text-sm" />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Creating account...' : 'Sign Up'}</button>
        </form>
        <p className="text-sm text-center mt-4 text-gray-500">Already have an account? <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link></p>
      </div>
    </div>
  )
}
