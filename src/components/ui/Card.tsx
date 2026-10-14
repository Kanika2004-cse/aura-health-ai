import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface CardProps {
  children: ReactNode
  className?: string
  padded?: boolean
}

export function Card({ children, className, padded = true }: CardProps) {
  return (
    <section
      className={cn(
        'rounded-[1.35rem] border border-line bg-panel/90 shadow-[0_10px_40px_rgb(0_0_0/0.22)]',
        padded && 'p-5 sm:p-6',
        className,
      )}
    >
      {children}
    </section>
  )
}
