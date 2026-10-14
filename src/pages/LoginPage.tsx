import { useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

const REMEMBERED_ACCOUNTS_KEY = 'aura-remembered-accounts'

function readRememberedAccounts(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(REMEMBERED_ACCOUNTS_KEY) ?? '[]')
    return Array.isArray(value)
      ? value.filter((email): email is string => typeof email === 'string' && email.includes('@'))
      : []
  } catch {
    return []
  }
}

export function LoginPage() {
  const { signIn, user, loading: authLoading } = useAuth()

  const navigate = useNavigate()
  const location = useLocation()

  const [rememberedAccounts, setRememberedAccounts] = useState(readRememberedAccounts)
  const [email, setEmail] = useState(() => readRememberedAccounts()[0] ?? '')
  const [rememberMe, setRememberMe] = useState(() => readRememberedAccounts().length > 0)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && user) {
      const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'
      navigate(from, { replace: true })
    }
  }, [authLoading, user, location.state, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError('')
    setLoading(true)

    const result = await signIn(email.trim(), password)

    setLoading(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    const normalizedEmail = email.trim().toLowerCase()
    const nextAccounts = rememberMe
      ? [normalizedEmail, ...rememberedAccounts.filter((account) => account.toLowerCase() !== normalizedEmail)]
      : rememberedAccounts.filter((account) => account.toLowerCase() !== normalizedEmail)
    localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(nextAccounts))
    setRememberedAccounts(nextAccounts)

    const from =
      (location.state as { from?: string } | null)?.from ?? '/dashboard'

    navigate(from, { replace: true })
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-void px-4 py-4 text-snow">
      <div className="w-full max-w-sm rounded-[2rem] border border-line bg-raised p-4 sm:p-7">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-2 font-display text-lg tracking-tight"
        >
          <span className="text-pulse">AURA</span>
          <span>HEALTH AI</span>
        </Link>

          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-haze">
              Welcome back
            </p>

            <h1 className="mt-2 font-display text-3xl">
              Sign in to Aura
            </h1>

            <p className="mt-2 text-sm leading-6 text-haze">
              Access your personal health intelligence dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            {rememberedAccounts.length > 0 && (
              <label className="block">
                <span className="text-xs uppercase tracking-[0.14em] text-haze">Choose a remembered account</span>
                <select
                  value={rememberedAccounts.some((account) => account.toLowerCase() === email.toLowerCase()) ? email.toLowerCase() : ''}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1.5 h-11 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-snow outline-none focus:border-pulse"
                >
                  <option value="">Enter another email</option>
                  {rememberedAccounts.map((account) => <option key={account} value={account}>{account}</option>)}
                </select>
              </label>
            )}
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
                className="mt-1.5 h-11 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-snow outline-none transition focus:border-pulse"
                placeholder="you@example.com"
              />
            </label>

            <label className="flex items-center gap-2.5 py-1 text-sm text-haze">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="size-4 accent-[var(--color-pulse)]"
              />
              Remember this account on this device
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
                  autoComplete="current-password"
                  className="h-11 w-full rounded-2xl border border-line bg-ink px-4 pr-12 text-sm text-snow outline-none transition focus:border-pulse"
                  placeholder="Your password"
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

            {error && (
              <p className="rounded-2xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-snow">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-2xl bg-pulse px-5 font-display text-sm text-void transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-haze">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="text-snow underline decoration-pulse underline-offset-4"
            >
              Create one
            </Link>
          </p>
      </div>
    </main>
  )
}
