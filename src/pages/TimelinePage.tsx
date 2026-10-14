import { useEffect, useMemo, useState } from 'react'
import { Activity, CalendarClock, Footprints, HeartPulse, NotebookPen, Wind } from 'lucide-react'

import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { getSupabaseClient } from '../lib/supabase'
import { displayTemperature, getMeasurementSystem } from '../utils/measurementUnits'

type TimelineKind = 'measurement' | 'activity' | 'symptom' | 'event'
type TimelineItem = {
  id: string
  kind: TimelineKind
  occurredAt: string
  title: string
  details: string[]
}
type TimelineFilter = 'all' | TimelineKind
type MeasurementRow = {
  id: string; recorded_at: string; heart_rate_bpm: number | null; spo2_pct: number | null
  systolic_mmhg: number | null; diastolic_mmhg: number | null; temperature_c: number | null
  steps: number | null; sleep_minutes: number | null; notes: string | null
}
type ActivityRow = { id: string; occurred_at: string; activity_type: string; duration_minutes: number | null; intensity: string | null; notes: string | null }
type SymptomRow = { id: string; occurred_at: string; name: string; severity: number | null; notes: string | null }
type HealthEventRow = { id: string; occurred_at: string; event_type: string; title: string; description: string | null }

const filters: { id: TimelineFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'measurement', label: 'Measurements' },
  { id: 'activity', label: 'Activity' },
  { id: 'symptom', label: 'Symptoms' },
  { id: 'event', label: 'Events' },
]

const kindLabels: Record<TimelineKind, string> = {
  measurement: 'Measurement',
  activity: 'Activity',
  symptom: 'Symptom',
  event: 'Health event',
}

const kindIcons = {
  measurement: HeartPulse,
  activity: Footprints,
  symptom: Wind,
  event: CalendarClock,
} satisfies Record<TimelineKind, typeof HeartPulse>

function measurementDetails(row: {
  heart_rate_bpm: number | null
  spo2_pct: number | null
  systolic_mmhg: number | null
  diastolic_mmhg: number | null
  temperature_c: number | null
  steps: number | null
  sleep_minutes: number | null
  notes: string | null
}) {
  const details: string[] = []
  if (row.heart_rate_bpm !== null) details.push(`Heart rate ${row.heart_rate_bpm} bpm`)
  if (row.spo2_pct !== null) details.push(`SpO₂ ${row.spo2_pct}%`)
  if (row.systolic_mmhg !== null || row.diastolic_mmhg !== null) {
    details.push(`Blood pressure ${row.systolic_mmhg ?? '—'}/${row.diastolic_mmhg ?? '—'} mmHg`)
  }
  if (row.temperature_c !== null) details.push(`Temperature ${displayTemperature(row.temperature_c).toFixed(1)}°${getMeasurementSystem() === 'imperial' ? 'F' : 'C'}`)
  if (row.steps !== null) details.push(`${row.steps.toLocaleString()} steps`)
  if (row.sleep_minutes !== null) details.push(`Sleep ${(row.sleep_minutes / 60).toFixed(1)} hours`)
  if (row.notes) details.push(row.notes)
  return details.length ? details : ['Measurement recorded']
}

async function loadActivityRows(supabase: NonNullable<ReturnType<typeof getSupabaseClient>>, userId: string) {
  const currentSchema = await supabase.from('activity_context')
    .select('id, occurred_at, activity_type, duration_minutes, intensity, notes')
    .eq('user_id', userId).order('occurred_at', { ascending: false }).limit(100)

  if (!currentSchema.error) {
    return { rows: (currentSchema.data ?? []) as unknown as ActivityRow[], error: null as string | null }
  }

  if (!currentSchema.error.message.toLowerCase().includes('occurred_at')) {
    return { rows: [] as ActivityRow[], error: currentSchema.error.message }
  }

  const legacySchema = await supabase.from('activity_context')
    .select('id, activity_date, activity_type, duration_minutes, intensity')
    .eq('user_id', userId).order('activity_date', { ascending: false }).limit(100)

  if (legacySchema.error) {
    return { rows: [] as ActivityRow[], error: legacySchema.error.message }
  }

  const rows = (legacySchema.data ?? []) as unknown as Array<{
    id: string
    activity_date: string
    activity_type: string
    duration_minutes: number | null
    intensity: string | null
  }>

  return {
    rows: rows.map((row) => ({ ...row, occurred_at: row.activity_date, notes: null })),
    error: null as string | null,
  }
}

export function TimelinePage() {
  const { user } = useAuth()
  const [items, setItems] = useState<TimelineItem[]>([])
  const [filter, setFilter] = useState<TimelineFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  useEffect(() => {
    let active = true
    async function loadTimeline() {
      if (!user) {
        setItems([])
        setError('')
        setWarning('')
        setLoading(false)
        return
      }

      const supabase = getSupabaseClient()
      if (!supabase) {
        setError('Your health timeline is unavailable right now. Please try again.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')
      setWarning('')
      try {
        const [measurementsResult, symptomsResult, eventsResult] = await Promise.all([
          supabase.from('health_measurements')
            .select('id, recorded_at, heart_rate_bpm, spo2_pct, systolic_mmhg, diastolic_mmhg, temperature_c, steps, sleep_minutes, notes')
            .eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(100),
          supabase.from('symptoms')
            .select('id, occurred_at, name, severity, notes')
            .eq('user_id', user.id).order('occurred_at', { ascending: false }).limit(100),
          supabase.from('health_events')
            .select('id, occurred_at, event_type, title, description')
            .eq('user_id', user.id).order('occurred_at', { ascending: false }).limit(100),
        ])
        const activityResult = await loadActivityRows(supabase, user.id)

        if (!active) return
        const failedSources = [
          measurementsResult.error ? `measurements: ${measurementsResult.error.message}` : null,
          activityResult.error ? `activity: ${activityResult.error}` : null,
          symptomsResult.error ? `symptoms: ${symptomsResult.error.message}` : null,
          eventsResult.error ? `health events: ${eventsResult.error.message}` : null,
        ].filter((failure): failure is string => failure !== null)
        if (failedSources.length > 0) {
          console.error('Some timeline sources could not be loaded:', failedSources)
          setWarning(`Some entries could not be loaded: ${failedSources.join(' · ')}. Other available entries are shown.`)
        }

        const measurementRows = (measurementsResult.data ?? []) as unknown as MeasurementRow[]
        const activityRows = activityResult.rows
        const symptomRows = (symptomsResult.data ?? []) as unknown as SymptomRow[]
        const eventRows = (eventsResult.data ?? []) as unknown as HealthEventRow[]
        const measurementItems: TimelineItem[] = measurementRows.map((row) => ({
          id: `measurement-${row.id}`,
          kind: 'measurement',
          occurredAt: row.recorded_at,
          title: 'Health measurement',
          details: measurementDetails(row),
        }))
        const activityItems: TimelineItem[] = activityRows.map((row) => ({
          id: `activity-${row.id}`,
          kind: 'activity',
          occurredAt: row.occurred_at,
          title: row.activity_type,
          details: [
            ...(row.duration_minutes !== null ? [`${row.duration_minutes} minutes`] : []),
            ...(row.intensity ? [`${row.intensity} intensity`] : []),
            ...(row.notes ? [row.notes] : []),
          ],
        }))
        const symptomItems: TimelineItem[] = symptomRows.map((row) => ({
          id: `symptom-${row.id}`,
          kind: 'symptom',
          occurredAt: row.occurred_at,
          title: row.name,
          details: [
            ...(row.severity !== null ? [`Severity ${row.severity} of 5`] : []),
            ...(row.notes ? [row.notes] : []),
          ],
        }))
        const eventItems: TimelineItem[] = eventRows.map((row) => ({
          id: `event-${row.id}`,
          kind: 'event',
          occurredAt: row.occurred_at,
          title: row.title,
          details: [row.event_type, ...(row.description ? [row.description] : [])],
        }))

        setItems([...measurementItems, ...activityItems, ...symptomItems, ...eventItems]
          .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()))
      } catch (queryError) {
        if (!active) return
        console.error('Unable to load health timeline:', queryError)
        setError('Your timeline could not be loaded. Check your connection and try again.')
        setItems([])
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadTimeline()
    return () => { active = false }
  }, [user])

  const visibleItems = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => item.kind === filter)),
    [items, filter],
  )

  return (
    <>
      <PageHeader
        eyebrow="Your health history"
        title="Timeline"
        description="Measurements, activities, symptoms, and health events in chronological order."
      />

      {error && <div role="alert" className="mb-5 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      {warning && <div role="status" className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{warning}</div>}

      <Card>
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter timeline entries">
          {filters.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              aria-pressed={filter === option.id}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${filter === option.id ? 'border-pulse/30 bg-pulse/10 text-pulse' : 'border-line text-haze hover:text-snow'}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-12 text-sm text-haze"><Activity className="size-5 animate-pulse" />Loading your health history...</div>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center">
            <NotebookPen className="mx-auto size-7 text-haze" />
            <h2 className="mt-3 font-display text-lg text-snow">{items.length === 0 ? 'Your timeline is empty' : `No ${filter === 'all' ? '' : `${filter} `}entries`}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-haze">{items.length === 0 ? 'Entries you add in Health Data will appear here, along with saved activity, symptoms, and health events.' : 'Choose another filter to see more of your health history.'}</p>
          </div>
        ) : (
          <ol className="space-y-0">
            {visibleItems.map((item, index) => {
              const Icon = kindIcons[item.kind]
              return (
                <li key={item.id} className="relative flex gap-4 pb-7 last:pb-0">
                  {index < visibleItems.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[19px] top-10 w-px bg-line" />}
                  <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-panel text-pulse"><Icon className="size-4" /></span>
                  <div className="min-w-0 flex-1 rounded-2xl border border-line bg-ink/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-haze">{kindLabels[item.kind]}</span>
                        <h3 className="mt-1 font-medium text-snow">{item.title}</h3>
                      </div>
                      <time className="text-xs text-haze" dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString()}</time>
                    </div>
                    {item.details.length > 0 && <p className="mt-2 text-sm leading-6 text-haze">{item.details.join(' · ')}</p>}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </Card>
    </>
  )
}
