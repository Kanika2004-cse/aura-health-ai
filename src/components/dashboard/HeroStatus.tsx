import type { Database } from '../../types/database'

type Measurement = Database['public']['Tables']['health_measurements']['Row']

export function HeroStatus({ latestMeasurement }: { latestMeasurement: Measurement | null }) {
  return (
    <section className="relative overflow-hidden rounded-[1.7rem] border border-line bg-ink p-6 sm:p-8">
      <div className="pointer-events-none absolute inset-0 aura-grid opacity-40" />
      <div className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-pulse/10 blur-3xl" />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-haze">Health data</p>
        <h2 className="mt-2 font-display text-4xl tracking-[-0.06em] text-snow sm:text-5xl">
          {latestMeasurement ? 'Latest measurement' : 'Your health overview'}
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-haze sm:text-base">
          {latestMeasurement
            ? `Recorded ${new Date(latestMeasurement.recorded_at).toLocaleString()}. Values below come from your saved measurements.`
            : 'Your saved health measurements will appear here after you add your first entry.'}
        </p>
      </div>
    </section>
  )
}
