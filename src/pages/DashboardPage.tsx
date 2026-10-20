import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ActivityViz } from '../components/dashboard/ActivityViz'
import { BaselineChart } from '../components/dashboard/BaselineChart'
import { EventsTimeline } from '../components/dashboard/EventsTimeline'
import { HeroStatus } from '../components/dashboard/HeroStatus'
import { InsightCard } from '../components/dashboard/InsightCard'
import { MetricCard } from '../components/dashboard/MetricCard'
import { QuickActions } from '../components/dashboard/QuickActions'
import { AuraMark } from '../components/brand/AuraMark'
import { Card } from '../components/ui/Card'
import { useAuth } from '../context/AuthContext'
import { getSupabaseClient } from '../lib/supabase'
import { buildHealthInsights } from '../services/insights'
import type { MetricCardData, MetricKey, TimelineEvent } from '../types/health'
import type { Database } from '../types/database'
import { displayTemperature, getMeasurementSystem } from '../utils/measurementUnits'
import { ActiveAlertBanner } from '../components/ActiveAlertBanner.tsx'
import { HealthTrendsChart } from '../components/HealthTrendsChart'
import { synchronizeHealthData, isNativeHealthSyncAvailable } from '../services/wearableSync';
import { NotificationDrawer } from '../components/NotificationDrawer.tsx'

type Measurement = Database['public']['Tables']['health_measurements']['Row']
type MetricDefinition = {
  key: MetricKey
  label: string
  unit: string
  value: (measurement: Measurement) => number | string | null
}

const metricDefinitions: MetricDefinition[] = [
  { key: 'heartRate', label: 'Heart Rate', unit: 'bpm', value: (row) => row.heart_rate_bpm },
  { key: 'spo2', label: 'SpO₂', unit: '%', value: (row) => row.spo2_pct },
  {
    key: 'bloodPressure',
    label: 'Blood Pressure',
    unit: 'mmHg',
    value: (row) => row.systolic_mmhg !== null && row.diastolic_mmhg !== null
      ? `${row.systolic_mmhg}/${row.diastolic_mmhg}`
      : null,
  },
  { key: 'temperature', label: 'Temperature', unit: '°C', value: (row) => row.temperature_c === null ? null : Number(displayTemperature(row.temperature_c).toFixed(1)) },
  { key: 'steps', label: 'Steps', unit: 'steps', value: (row) => row.steps },
  { key: 'sleep', label: 'Sleep', unit: 'hrs', value: (row) => row.sleep_minutes === null ? null : Number((row.sleep_minutes / 60).toFixed(1)) },
]

function formatMetricValue(value: number | string) {
  return typeof value === 'number' ? value.toLocaleString() : value
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function buildMetrics(measurements: Measurement[]): MetricCardData[] {
  return metricDefinitions.flatMap((definition) => {
    const unit = definition.key === 'temperature' && getMeasurementSystem() === 'imperial' ? '°F' : definition.unit
    const currentIndex = measurements.findIndex((measurement) => definition.value(measurement) !== null)
    if (currentIndex < 0) return []
    const currentMeasurement = measurements[currentIndex]
    const value = definition.value(currentMeasurement)
    if (value === null) return []

    const previousValue = measurements.slice(currentIndex + 1)
      .map(definition.value)
      .find((candidate) => candidate !== null)
    let trend = 'Latest recorded value'
    if (typeof value === 'number' && typeof previousValue === 'number') {
      const difference = Number((value - previousValue).toFixed(1))
      trend = difference === 0
        ? 'Unchanged from previous entry'
        : `${difference > 0 ? '+' : ''}${difference} from previous entry`
    }

    return [{
      key: definition.key,
      label: definition.label,
      value: formatMetricValue(value),
      unit,
      hint: formatDate(currentMeasurement.recorded_at),
      trend,
    }]
  })
}

function toTimelineEvents(measurements: Measurement[]): TimelineEvent[] {
  return measurements.slice(0, 5).map((row) => {
    const values = metricDefinitions.flatMap((definition) => {
      const value = definition.value(row)
      const unit = definition.key === 'temperature' && getMeasurementSystem() === 'imperial' ? '°F' : definition.unit
      return value === null ? [] : [`${definition.label}: ${formatMetricValue(value)} ${unit}`]
    })
    return {
      id: row.id,
      time: formatDate(row.recorded_at),
      title: 'Health measurement',
      detail: values.length ? values.join(' · ') : row.notes ?? 'Measurement recorded',
    }
  })
}

export function DashboardPage() {
  const { user } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
 useEffect(() => {
    let active = true

    async function loadDashboard() {
      if (!user) {
        setMeasurements([])
        setDisplayName('')
        setLoading(false)
        return
      }

      const supabase = getSupabaseClient()
      if (!supabase) {
        setError('Your health data is unavailable right now. Please try again.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      // 🚀 Trigger native health data background sync if available on device
      if (isNativeHealthSyncAvailable()) {
        try {
          await synchronizeHealthData(supabase, user.id, 7) // Syncs past 7 days automatically
        } catch (syncErr) {
          console.error('Background sync skipped or failed:', syncErr)
        }
      }

      const [profileResult, measurementsResult] = await Promise.all([
        supabase.from('health_profiles').select('display_name').eq('user_id', user.id).maybeSingle(),
        supabase.from('health_measurements').select('*').eq('user_id', user.id)
          .order('recorded_at', { ascending: false }).limit(100),
      ])

      if (!active) return
      const firstError = profileResult.error ?? measurementsResult.error
      if (firstError) {
        console.error('Unable to load dashboard data:', firstError)
        setError('Your health data could not be loaded. Please try again.')
      } else {
        const profile = profileResult.data as { display_name: string | null } | null
        setDisplayName(profile?.display_name ?? '')
        setMeasurements(measurementsResult.data ?? [])
      }
      setLoading(false)
    }

    void loadDashboard()
    return () => { active = false }
  }, [user])

  const metrics = useMemo(() => buildMetrics(measurements), [measurements])
  const events = useMemo(() => toTimelineEvents(measurements), [measurements])
  const insights = useMemo(() => buildHealthInsights(measurements), [measurements])
  const latestMeasurement = measurements[0]

  return (
    <div className="space-y-6">
      <ActiveAlertBanner />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <AuraMark className="size-10" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-haze">Personal health intelligence</p>
            <h1 className="font-display text-3xl tracking-[-0.04em] text-snow">
              {displayName ? `Welcome back, ${displayName}` : 'Welcome back'}
            </h1>
          </div>
        </div>
        <div className="text-sm text-haze sm:text-right">
          <p className="text-snow">Your health overview</p>
          <p>{latestMeasurement ? `Updated ${formatDate(latestMeasurement.recorded_at)}` : 'Your saved measurements and health insights'}</p>
        </div>
      </div>

      {error && <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      {loading ? (
        <Card><p className="py-8 text-center text-sm text-haze">Loading your health data...</p></Card>
      ) : (
        <>
          <HeroStatus latestMeasurement={latestMeasurement ?? null} />
          {metrics.length > 0 ? (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {metrics.map((metric) => <MetricCard key={metric.key} metric={metric} />)}
            </section>
          ) : (
            <Card className="flex flex-col items-start gap-3">
              <h2 className="font-display text-xl text-snow">No measurements yet</h2>
              <p className="text-sm text-haze">Add a health measurement and your dashboard will show the values you entered.</p>
              <Link to="/health-data" className="inline-flex h-11 items-center justify-center rounded-full bg-pulse px-4 text-sm font-medium text-void transition-colors hover:bg-[#63d8bb]">Add a measurement</Link>
            </Card>
          )}

          <section className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3"><BaselineChart measurements={measurements} /></div>
            <div className="lg:col-span-2"><ActivityViz measurements={measurements} /></div>
          </section>

          {/* Render the Z-Score Trends Chart */}
          <HealthTrendsChart />

          <InsightCard insights={insights} />

          <section className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3"><EventsTimeline events={events} /></div>
            <div className="lg:col-span-2"><QuickActions /></div>
          </section>
        </>
      )}
      {/* In-App Notification History Drawer */}
      <NotificationDrawer 
        isOpen={isNotificationOpen} 
        onClose={() => setIsNotificationOpen(false)} 
      />
    </div>
  )
}
    