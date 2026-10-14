import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

export function SignupPage() {
  const { signUp } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setMessage('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    const result = await signUp(email.trim(), password)

    setLoading(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    setMessage(
      'Account created. Check your email to confirm your account before signing in.',
    )

    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <main className="aura-safe-screen flex min-h-[100dvh] items-center justify-center bg-void px-4 py-10 text-snow">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 font-display text-lg tracking-tight"
        >
          <span className="text-pulse">AURA</span>
          <span>HEALTH AI</span>
        </Link>

        <div className="rounded-[2rem] border border-line bg-raised p-6 sm:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-haze">
              Get started
            </p>

            <h1 className="mt-2 font-display text-3xl">
              Create your Aura account
            </h1>

            <p className="mt-3 text-sm leading-6 text-haze">
              Your health data will be stored privately under your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-haze">
                Email
              </span>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="mt-2 h-12 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-snow outline-none transition focus:border-pulse"
                placeholder="you@example.com"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-haze">
                Password
              </span>

              <div className="relative mt-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="h-12 w-full rounded-2xl border border-line bg-ink px-4 pr-12 text-sm text-snow outline-none transition focus:border-pulse"
                  placeholder="At least 6 characters"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-xl text-haze transition hover:text-snow"
                  aria-label={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-haze">
                Confirm password
              </span>

              <div className="relative mt-2">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="h-12 w-full rounded-2xl border border-line bg-ink px-4 pr-12 text-sm text-snow outline-none transition focus:border-pulse"
                  placeholder="Repeat your password"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword((value) => !value)
                  }
                  className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-xl text-haze transition hover:text-snow"
                  aria-label={
                    showConfirmPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </label>

            {error && (
              <p className="rounded-2xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-snow">
                {error}
              </p>
            )}

            {message && (
              <p className="rounded-2xl border border-pulse/30 bg-pulse/10 px-4 py-3 text-sm text-snow">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-2xl bg-pulse px-5 font-display text-sm text-void transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-haze">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-snow underline decoration-pulse underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
