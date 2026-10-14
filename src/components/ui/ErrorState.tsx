import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface ErrorStateProps {
  title?: string
  description: string
  action?: ReactNode
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'rounded-[1.2rem] border border-alert/25 bg-alert/8 p-5 text-sm',
        className,
      )}
    >
      <p className="font-display text-base text-snow">{title}</p>
      <p className="mt-1 leading-6 text-haze">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
