import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '../ui/Card'

const actions = [
  { to: '/health-data', title: 'Add Measurement', copy: 'Capture a raw reading.' },
  { to: '/analysis', title: 'View Analysis', copy: 'Open the analysis workspace.' },
  { to: '/trends', title: 'View Trends', copy: 'See time-series layouts.' },
  { to: '/profile', title: 'Health Profile', copy: 'Set the personal context.' },
]

export function QuickActions() {
  return (
    <Card>
      <h3 className="font-display text-xl text-snow">Quick actions</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {actions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group flex items-start justify-between rounded-2xl border border-line bg-ink px-4 py-4 transition-colors hover:border-pulse/35 hover:bg-raised"
          >
            <span>
              <span className="block font-medium text-snow">{action.title}</span>
              <span className="mt-1 block text-sm text-haze">{action.copy}</span>
            </span>
            <ArrowUpRight className="size-4 text-haze transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-pulse" />
          </Link>
        ))}
      </div>
    </Card>
  )
}
