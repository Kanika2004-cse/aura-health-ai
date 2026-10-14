import { NavLink } from 'react-router-dom'
import { appNav } from '../../config/nav'
import { cn } from '../../utils/cn'
import { AuraMark } from '../brand/AuraMark'

interface MobileNavProps {
  open: boolean
  onClose: () => void
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-void/70"
        aria-label="Close navigation"
        onClick={onClose}
      />
      <div className="relative flex h-full w-[min(20rem,86vw)] flex-col border-r border-line bg-ink p-4">
        <div className="mb-6 flex items-center gap-3 px-2">
          <AuraMark />
          <p className="font-display text-snow">Aura Health AI</p>
        </div>
        <nav className="flex flex-col gap-1">
          {appNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm',
                    isActive ? 'bg-white/6 text-snow' : 'text-haze',
                  )
                }
              >
                <Icon className="size-4 text-pulse" strokeWidth={1.75} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
