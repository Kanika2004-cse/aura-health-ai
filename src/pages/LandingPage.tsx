import { ArrowRight, Activity, Brain, ShieldCheck } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'

import { AuraMark } from '../components/brand/AuraMark'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'

const pillars = [
  {
    icon: Activity,
    title: 'Know your pattern',
    copy: 'Aura learns from your health history to understand what is typical for you, not just what is typical on paper.',
  },
  {
    icon: Brain,
    title: 'Understand the shift',
    copy: 'Changes are evaluated against your personal history and the context surrounding each measurement.',
  },
  {
    icon: ShieldCheck,
    title: 'Act with clarity',
    copy: 'Get clear explanations and practical next steps when something meaningfully changes.',
  },
]

export function LandingPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="aura-safe-screen flex min-h-[100dvh] items-center justify-center bg-void text-haze">Loading Aura Health AI...</div>
  }

  if (user) return <Navigate to="/dashboard" replace />
  if (Capacitor.isNativePlatform()) return <Navigate to="/login" replace />

  return (
    <div className="aura-safe-screen relative flex min-h-[100dvh] flex-col overflow-hidden bg-void">
      <div className="pointer-events-none absolute inset-0 aura-grid opacity-30" />

      <div className="pointer-events-none absolute left-[-10%] top-[-20%] size-[28rem] rounded-full bg-pulse/15 blur-3xl" />

      <div className="pointer-events-none absolute right-[-10%] top-[20%] size-[24rem] rounded-full bg-flux/12 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AuraMark />

            <span className="font-display text-sm tracking-[-0.03em]">
              Aura Health AI
            </span>
          </div>

          <Link to="/login">
            <Button size="sm">
              Sign In
            </Button>
          </Link>
        </header>

        <main className="flex flex-1 flex-col justify-center py-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-pulse">
            Personal health risk insights & decision support
          </p>

          <h1 className="mt-5 max-w-4xl font-display text-5xl leading-[0.95] tracking-[-0.06em] text-snow sm:text-7xl">
            Know your baseline.
            <span className="block text-haze">
              Understand what changes.
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-haze sm:text-lg">
            Aura brings your health measurements, personal patterns, and
            context together to surface notable changes and explain why they
            may deserve a closer look. Use these non-diagnostic insights to
            support informed conversations and everyday decisions about your
            wellbeing.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup">
              <Button size="lg">
                Create Account
                <ArrowRight className="size-4" />
              </Button>
            </Link>

            <Link to="/login">
              <Button size="lg" variant="secondary">
                Sign In
              </Button>
            </Link>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            {pillars.map((pillar) => {
              const Icon = pillar.icon

              return (
                <article
                  key={pillar.title}
                  className="rounded-[1.35rem] border border-line bg-panel/70 p-5"
                >
                  <div className="flex size-10 items-center justify-center rounded-xl border border-line bg-void/60">
                    <Icon className="size-5 text-pulse" />
                  </div>

                  <h2 className="mt-5 font-display text-lg text-snow">
                    {pillar.title}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-haze">
                    {pillar.copy}
                  </p>
                </article>
              )
            })}
          </div>
        </main>
      </div>
    </div>
  )
}
