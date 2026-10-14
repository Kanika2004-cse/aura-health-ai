import { ArrowLeft, Menu } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

interface TopBarProps {
  onMenu: () => void
}

export function TopBar({ onMenu }: TopBarProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const showBackButton = location.pathname !== '/dashboard'

  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-line px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {showBackButton && (
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-line bg-raised text-haze transition hover:text-snow"
            aria-label="Go back"
            title="Go back"
          >
            <ArrowLeft className="size-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onMenu}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-line bg-raised text-snow lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-4" />
        </button>

      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <Link
          to="/profile"
          className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-pulse/80 to-flux/70 font-display text-sm text-void"
          aria-label="Profile"
        >
          AH
        </Link>
      </div>
    </header>
  )
}
