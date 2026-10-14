import { cn } from '../../utils/cn'

interface LoadingStateProps {
  label?: string
  className?: string
}

export function LoadingState({ label = 'Loading', className }: LoadingStateProps) {
  return (
    <div className={cn('flex items-center gap-3 text-sm text-haze', className)}>
      <span className="size-2 rounded-full bg-pulse animate-[aura-pulse_1.4s_ease-in-out_infinite]" />
      {label}
    </div>
  )
}
