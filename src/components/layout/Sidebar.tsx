import { NavLink } from 'react-router-dom'
import { AuraMark } from '../brand/AuraMark'
import { appNav } from '../../config/nav'
import { cn } from '../../utils/cn'

export function Sidebar() {
  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-ink/80 lg:flex">
      <div className="flex items-center gap-3 px-5 py-6">
        <AuraMark />
        <div>
          <p className="font-display text-sm tracking-[-0.03em] text-snow">Aura Health AI</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-haze">Personal health</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 pb-6">
        {appNav.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-white/6 text-snow shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]'
                    : 'text-haze hover:bg-white/4 hover:text-snow',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn('size-[18px]', isActive ? 'text-pulse' : 'text-haze')}
                    strokeWidth={1.75}
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
