import { History } from 'lucide-react'
import type { TimelineEvent } from '../../types/health'
import { EmptyState } from '../ui/EmptyState'
import { Card } from '../ui/Card'

export function EventsTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <Card>
      <h3 className="font-display text-xl text-snow">Recent health events</h3>
      <p className="mt-1 mb-5 text-sm text-haze">Your latest saved health measurements.</p>
      {events.length === 0 ? (
        <EmptyState
          icon={<History className="size-5" />}
          title="No events yet"
          description="Add a measurement to start building your health history."
        />
      ) : (
        <ol className="space-y-4">
          {events.map((event) => (
            <li key={event.id} className="border-l border-line pl-4">
              <p className="text-xs uppercase tracking-[0.14em] text-haze">{event.time}</p>
              <p className="mt-1 text-snow">{event.title}</p>
              <p className="text-sm text-haze">{event.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
