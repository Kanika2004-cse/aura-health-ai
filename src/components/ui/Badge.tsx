import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

type Tone = 'neutral' | 'pulse' | 'flux' | 'ember' | 'alert'

const tones: Record<Tone, string> = {
  neutral: 'bg-white/6 text-haze border-white/8',
  pulse: 'bg-pulse/12 text-pulse border-pulse/20',
  flux: 'bg-flux/12 text-flux border-flux/20',
  ember: 'bg-ember/12 text-ember border-ember/20',
  alert: 'bg-alert/12 text-alert border-alert/20',
}

interface BadgeProps {
  children: ReactNode
  tone?: Tone
  className?: string
}

export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
