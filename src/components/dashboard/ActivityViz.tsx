import type { Database } from '../../types/database'
import { Card } from '../ui/Card'

type Measurement = Database['public']['Tables']['health_measurements']['Row']

export function ActivityViz({ measurements }: { measurements: Measurement[] }) {
  const byDay = new Map<string, number>()
  measurements.forEach((measurement) => {
    if (measurement.steps === null) return
    const date = new Date(measurement.recorded_at)
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    if (!byDay.has(key)) byDay.set(key, measurement.steps)
  })
  const days = [...byDay.entries()].slice(0, 7).reverse().map(([key, value]) => ({
    day: new Date(key.split('-').map(Number)[0], Number(key.split('-')[1]), Number(key.split('-')[2])).toLocaleDateString(undefined, { weekday: 'short' }),
    value,
  }))
  const maxSteps = Math.max(...days.map((day) => day.value), 1)

  return (
    <Card>
      <div className="mb-5">
        <h3 className="font-display text-xl text-snow">Steps</h3>
        <p className="mt-1 text-sm text-haze">From your saved daily measurements.</p>
      </div>
      {days.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-line text-center text-sm text-haze">
          No step measurements recorded yet.
        </div>
      ) : (
        <div className="flex h-40 items-end gap-2 sm:gap-3">
          {days.map((day, index) => (
            <div key={`${day.day}-${index}`} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[10px] text-haze">{day.value.toLocaleString()}</span>
              <div className="relative flex h-28 w-full items-end overflow-hidden rounded-2xl bg-ink">
                <div className="w-full rounded-2xl bg-gradient-to-t from-pulse/80 to-flux/70" style={{ height: `${Math.max((day.value / maxSteps) * 100, 4)}%` }} />
              </div>
              <span className="text-[11px] uppercase tracking-[0.12em] text-haze">{day.day}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
