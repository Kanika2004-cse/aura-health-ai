import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-[1.2rem] border border-dashed border-line bg-ink/50 p-6',
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-2xl bg-white/4 text-pulse">
        {icon}
      </div>
      <div>
        <h3 className="font-display text-lg text-snow">{title}</h3>
        <p className="mt-1 max-w-md text-sm leading-6 text-haze">{description}</p>
      </div>
      {action}
    </div>
  )
}
