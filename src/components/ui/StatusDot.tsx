import { cn } from '../../utils/cn'

type Tone = 'pulse' | 'ember' | 'alert' | 'haze'

const tones: Record<Tone, string> = {
  pulse: 'bg-pulse shadow-[0_0_10px_rgb(76_201_168/0.55)]',
  ember: 'bg-ember shadow-[0_0_10px_rgb(217_164_65/0.45)]',
  alert: 'bg-alert shadow-[0_0_10px_rgb(227_93_106/0.45)]',
  haze: 'bg-haze',
}

interface StatusDotProps {
  tone?: Tone
  className?: string
}

export function StatusDot({ tone = 'pulse', className }: StatusDotProps) {
  return (
    <span
      className={cn('inline-block size-2 rounded-full', tones[tone], className)}
      aria-hidden
    />
  )
}
