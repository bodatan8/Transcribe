import { useState, useCallback, memo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

/**
 * Optimized Login
 */
export const Login = memo(() => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (isSignUp) {
        await signUp(email, password, fullName)
        toast.success('Account created! Check your email.')
      } else {
        await signIn(email, password)
        toast.success('Welcome back')
      }
    } catch (err) {
      toast.error(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [isSignUp, email, password, fullName, signIn, signUp])

  const toggleMode = useCallback(() => {
    setIsSignUp(s => !s)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <img src="/Spratt_Logo.png" alt="Spratt" className="h-14 mx-auto" loading="eager" />
        </div>

        <div className="card p-8">
          {isSignUp && <p className="text-center text-sm text-slate-500 mb-6">Create your account</p>}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Full name</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                required
                className="input"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <input
                type="password"
                required
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full py-3 text-base">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                isSignUp ? 'Create account' : 'Sign in'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <button type="button" onClick={toggleMode} className="text-sm font-medium text-spratt-blue hover:text-spratt-blue-700">
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">Secure · Private · Professional</p>
      </div>
    </div>
  )
})

Login.displayName = 'Login'
