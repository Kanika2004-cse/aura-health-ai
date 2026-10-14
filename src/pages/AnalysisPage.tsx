import { useEffect, useMemo, useState } from 'react'

import {
  Activity,
  HeartPulse,
  History,
  Thermometer,
  Wind,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { getSupabaseClient } from '../lib/supabase'

import {
  analyzeHealthHistory,
  type HealthAnalysis,
  type HealthStatus,
  type HealthMetricKey,
  type MeasurementForAnalysis,
} from '../utils/healthAnalysis'

import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { Badge } from '../components/ui/Badge'
import {
  detectPersonalAnomalies,
  PERSONAL_ANOMALY_MODEL_NAME,
  PERSONAL_ANOMALY_MODEL_VERSION,
  MINIMUM_TRAINING_READINGS,
  type AnalysisContextEvent,
} from '../services/personalAnomalyModel'
import type { PersonalAnomalyResult } from '../services/personalAnomalyModel'

type ActivityRecord = {
  id: string
  occurred_at: string
  activity_type: string
  duration_minutes: number | null
  intensity: string | null
}

const metricConfig: Array<{
  key: HealthMetricKey
  label: string
  unit: string
  icon: typeof HeartPulse
}> = [
  {
    key: 'heartRate',
    label: 'Heart rate',
    unit: 'BPM',
    icon: HeartPulse,
  },
  {
    key: 'spo2',
    label: 'Blood oxygen',
    unit: '%',
    icon: Wind,
  },
  {
    key: 'systolic',
    label: 'Systolic pressure',
    unit: 'mmHg',
    icon: Activity,
  },
  {
    key: 'temperature',
    label: 'Temperature',
    unit: '°C',
    icon: Thermometer,
  },
]

function formatValue(value: number | null, decimals = 0) {
  if (value === null || !Number.isFinite(value)) {
    return '—'
  }

  return value.toFixed(decimals)
}

function getRecordedReadingValues(measurement: MeasurementForAnalysis) {
  return [
    measurement.heart_rate_bpm !== null && `HR ${formatValue(measurement.heart_rate_bpm)} BPM`,
    measurement.spo2_pct !== null && `SpO₂ ${formatValue(measurement.spo2_pct, 1)}%`,
    measurement.systolic_mmhg !== null && measurement.diastolic_mmhg !== null &&
      `BP ${formatValue(measurement.systolic_mmhg)}/${formatValue(measurement.diastolic_mmhg)} mmHg`,
    measurement.temperature_c !== null && `Temp ${formatValue(measurement.temperature_c, 1)} °C`,
    measurement.steps !== null && `Steps ${formatValue(measurement.steps)}`,
    measurement.sleep_minutes !== null && `Sleep ${formatValue(measurement.sleep_minutes / 60, 1)} hr`,
  ].filter((value): value is string => typeof value === 'string')
}

function getHistoryDays(measurements: MeasurementForAnalysis[]) {
  if (measurements.length < 2) {
    return 0
  }

  const timestamps = measurements
    .map((measurement) =>
      new Date(measurement.recorded_at).getTime(),
    )
    .filter(Number.isFinite)

  if (timestamps.length < 2) {
    return 0
  }

  const latest = Math.max(...timestamps)
  const earliest = Math.min(...timestamps)

  return Math.floor(
    (latest - earliest) / (24 * 60 * 60 * 1000),
  )
}

function getStatusLabel(status: HealthStatus) {
  switch (status) {
    case 'STABLE':
      return 'Stable'
    case 'MONITOR':
      return 'Monitor'
    case 'PRIORITY':
      return 'Priority'
  }
}

function getStatusSymbol(status: HealthStatus) {
  switch (status) {
    case 'STABLE':
      return '🟢'
    case 'MONITOR':
      return '🟡'
    case 'PRIORITY':
      return '🔴'
  }
}

function getStatusClasses(status: HealthStatus) {
  switch (status) {
    case 'STABLE':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
    case 'MONITOR':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-200'
    case 'PRIORITY':
      return 'border-red-400/20 bg-red-400/10 text-red-200'
  }
}

function getMaturityLabel(analysis: HealthAnalysis) {
  switch (analysis.maturity) {
    case 'INITIAL':
      return 'Starting personal pattern'
    case 'EARLY_HISTORY':
      return 'Early personal pattern'
    case 'EMERGING_PATTERN':
      return 'Emerging personal pattern'
    case 'ESTABLISHED_7_DAY':
      return '7-day personal pattern'
  }
}

function getStatusDescription(status: HealthStatus) {
  switch (status) {
    case 'STABLE':
      return 'Your available measurements are currently consistent with the pattern Aura can see.'

    case 'MONITOR':
      return 'One or more measurements differ from your recent personal pattern. Aura will continue watching the trend.'

    case 'PRIORITY':
      return 'A meaningful change has been detected in the available data. Review the details and continue monitoring the pattern.'
  }
}

function BaselineMetricCard({
  metric,
  analysis,
}: {
  metric: (typeof metricConfig)[number]
  analysis: HealthAnalysis
}) {
  const metricResult = analysis.metrics.find(
    (item) => item.metric === metric.key,
  )

  if (!metricResult || metricResult.current === null) {
    return null
  }

  const Icon = metric.icon
  const decimals = metric.key === 'temperature' ? 1 : 0

  return (
    <Card className="p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-haze">
            {metric.label}
          </p>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-snow">
              {formatValue(metricResult.current, decimals)}
            </span>

            <span className="text-sm text-haze">
              {metric.unit}
            </span>
          </div>
        </div>

        <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
          <Icon className="size-5 text-snow" />
        </div>
      </div>

      <div
        className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${getStatusClasses(
          metricResult.status,
        )}`}
      >
        <span>{getStatusSymbol(metricResult.status)}</span>
        <span>{getStatusLabel(metricResult.status)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <p className="text-xs text-haze">
            Personal baseline
          </p>

          <p className="mt-1 text-lg font-semibold text-snow">
            {metricResult.baseline !== null
              ? `${formatValue(
                  metricResult.baseline,
                  decimals,
                )} ${metric.unit}`
              : 'Building'}
          </p>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <p className="text-xs text-haze">
            Change
          </p>

          <p className="mt-1 text-lg font-semibold text-snow">
            {metricResult.deviation !== null
              ? `${metricResult.deviation > 0 ? '+' : ''}${formatValue(
                  metricResult.deviation,
                  1,
                )}`
              : '—'}
          </p>

          {metricResult.deviationPercent !== null && (
            <p className="text-xs text-haze">
              {metricResult.deviationPercent > 0 ? '+' : ''}
              {formatValue(
                metricResult.deviationPercent,
                1,
              )}
              %
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 text-xs text-haze">
        {metricResult.historyCount} previous reading
        {metricResult.historyCount === 1 ? '' : 's'} used
        for comparison.
      </div>
    </Card>
  )
}

function AnomalyResultCard({ result }: { result: PersonalAnomalyResult }) {
  const tone = result.status === 'unusual' ? 'ember' : result.status === 'typical' ? 'pulse' : 'neutral'
  const statusLabel = result.status === 'unusual'
    ? 'Different from recent pattern'
    : result.status === 'typical'
      ? 'Close to recent pattern'
      : 'Building your history'
  const decimals = result.metric === 'temperature' || result.metric === 'spo2' ? 1 : 0

  return (
    <div className="rounded-xl border border-line bg-ink/70 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-snow">{result.label}</p>
        <Badge tone={tone}>{statusLabel}</Badge>
      </div>
      <p className="mt-3 text-2xl font-semibold text-snow">{formatValue(result.current, decimals)} <span className="text-sm font-normal text-haze">{result.unit}</span></p>
      <p className="mt-2 text-xs leading-5 text-haze">
        {result.previous === null
          ? 'No earlier reading is available for a direct comparison.'
          : <>Previous: {formatValue(result.previous, decimals)} {result.unit}
            {result.previousRecordedAt && <> · {new Date(result.previousRecordedAt).toLocaleString()}</>}
            {result.changeFromPrevious !== null && <> · Change {result.changeFromPrevious > 0 ? '+' : ''}{formatValue(result.changeFromPrevious, decimals)} {result.unit}</>}
          </>}
      </p>
      <p className="mt-2 text-xs leading-5 text-haze">
        {result.nearbyActivity || result.nearbySymptoms.length > 0
          ? <>Logged within 30 minutes: {[result.nearbyActivity, ...result.nearbySymptoms].filter(Boolean).join(' · ')}</>
          : 'No activity or symptom was logged within 30 minutes.'}
      </p>
      <p className="mt-2 text-xs leading-5 text-haze">
        {result.status === 'learning'
          ? `${result.trainingReadings} earlier reading${result.trainingReadings === 1 ? '' : 's'} saved. Add ${MINIMUM_TRAINING_READINGS - result.trainingReadings} more to compare this pattern.`
          : `Recent typical value: ${formatValue(result.baselineMedian, decimals)} ${result.unit} · Based on ${result.trainingReadings} earlier readings.`}
      </p>
    </div>
  )
}

export function AnalysisPage() {
  const { user } = useAuth()

  const [measurements, setMeasurements] = useState<
    MeasurementForAnalysis[]
  >([])

  const [activities, setActivities] = useState<
    ActivityRecord[]
  >([])
  const [symptoms, setSymptoms] = useState<Array<{ occurred_at: string; name: string; severity: number | null }>>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadAnalysisData() {
      if (!user) {
        setMeasurements([])
        setActivities([])
        setSymptoms([])
        setLoading(false)
        return
      }

      const supabase = getSupabaseClient()

      if (!supabase) {
        setError('Your health analysis is unavailable right now. Please try again.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const {
          data: measurementData,
          error: measurementError,
        } = await supabase
          .from('health_measurements')
          .select(
            `
              id,
              recorded_at,
              heart_rate_bpm,
              spo2_pct,
              systolic_mmhg,
              diastolic_mmhg,
              temperature_c,
              steps,
              sleep_minutes
            `,
          )
          .eq('user_id', user.id)
          .order('recorded_at', {
            ascending: false,
          })
          .limit(100)

        if (measurementError) {
          throw measurementError
        }

        setMeasurements(
          (measurementData ??
            []) as MeasurementForAnalysis[],
        )

        const activityQuery = await supabase
          .from('activity_context')
          .select(
            `
              id,
              occurred_at,
              activity_type,
              duration_minutes,
              intensity
            `,
          )
          .eq('user_id', user.id)
          .order('occurred_at', {
            ascending: false,
          })
          .limit(100)

        let availableActivities = (activityQuery.data ?? []) as ActivityRecord[]
        if (activityQuery.error?.message.toLowerCase().includes('occurred_at')) {
          const legacyQuery = await supabase
            .from('activity_context')
            .select('id, activity_date, activity_type, duration_minutes')
            .eq('user_id', user.id)
            .order('activity_date', { ascending: false })
            .limit(100)

          if (!legacyQuery.error) {
            availableActivities = ((legacyQuery.data ?? []) as unknown as Array<{
              id: string
              activity_date: string
              activity_type: string
              duration_minutes: number | null
            }>).map((activity) => ({
              id: activity.id,
              occurred_at: `${activity.activity_date}T00:00:00.000Z`,
              activity_type: activity.activity_type,
              duration_minutes: activity.duration_minutes,
              intensity: null,
            }))
          } else {
            console.warn('Activity context is unavailable to analysis:', legacyQuery.error.message)
            availableActivities = []
          }
        } else if (activityQuery.error) {
          // Activity is optional context. Its schema or availability must not
          // prevent the primary measurements from being analyzed.
          console.warn('Activity context is unavailable to analysis:', activityQuery.error.message)
          availableActivities = []
        }

        setActivities(availableActivities)

        const symptomQuery = await supabase
          .from('symptoms')
          .select('occurred_at, name, severity')
          .eq('user_id', user.id)
          .order('occurred_at', { ascending: false })
          .limit(100)

        if (symptomQuery.error) {
          console.warn('Symptom context is unavailable to analysis:', symptomQuery.error.message)
          setSymptoms([])
        } else {
          setSymptoms((symptomQuery.data ?? []) as Array<{ occurred_at: string; name: string; severity: number | null }>)
        }
      } catch (queryError) {
        console.error(
          'Unable to load analysis data:',
          queryError,
        )

        setError(
          queryError instanceof Error
            ? queryError.message
            : 'Unable to load health analysis.',
        )

        setMeasurements([])
        setActivities([])
        setSymptoms([])
      } finally {
        setLoading(false)
      }
    }

    void loadAnalysisData()
  }, [user])

  const analysis = useMemo(() => {
    return analyzeHealthHistory(measurements)
  }, [measurements])

  const analysisActivities = useMemo<AnalysisContextEvent[]>(() => activities.map((activity) => ({
    occurred_at: activity.occurred_at,
    label: `${activity.activity_type}${activity.duration_minutes ? ` · ${activity.duration_minutes} min` : ''}${activity.intensity ? ` · ${activity.intensity} intensity` : ''}`,
  })), [activities])
  const analysisSymptoms = useMemo<AnalysisContextEvent[]>(() => symptoms.map((symptom) => ({
    occurred_at: symptom.occurred_at,
    label: `${symptom.name}${symptom.severity === null ? '' : ` · severity ${symptom.severity}/5`}`,
  })), [symptoms])
  const anomalyResults = useMemo(
    () => detectPersonalAnomalies(measurements, analysisActivities, analysisSymptoms),
    [measurements, analysisActivities, analysisSymptoms],
  )

  useEffect(() => {
    if (!user || measurements.length === 0 || anomalyResults.length === 0) return
    const userId = user.id
    let active = true
    async function saveModelResults() {
      const supabase = getSupabaseClient()
      if (!supabase) return
      const { data: modelVersion, error: modelVersionError } = await (supabase
        .from('model_versions') as any)
        .select('id')
        .eq('name', PERSONAL_ANOMALY_MODEL_NAME)
        .eq('version', PERSONAL_ANOMALY_MODEL_VERSION)
        .maybeSingle()
      if (!active) return
      if (modelVersionError || !modelVersion) {
        console.warn('Personal anomaly model version is unavailable. Apply its Supabase migration to enable result storage.')
        return
      }

      const grouped = new Map<string, PersonalAnomalyResult[]>()
      for (const result of anomalyResults) {
        grouped.set(result.measurementId, [...(grouped.get(result.measurementId) ?? []), result])
      }
      const predictions = Array.from(grouped, ([measurementId, results]) => ({
        user_id: userId,
        source_measurement_id: measurementId,
        model_version_id: modelVersion.id,
        payload: {
          model: PERSONAL_ANOMALY_MODEL_NAME,
          version: PERSONAL_ANOMALY_MODEL_VERSION,
          training_window_days: 30,
          minimum_training_readings: MINIMUM_TRAINING_READINGS,
          results: results.map(({ measurementId: _measurementId, ...result }) => result),
        },
      }))
      const { error: saveError } = await supabase
        .from('model_predictions')
        .upsert(predictions as any, { onConflict: 'user_id,source_measurement_id,model_version_id' })
      if (!active) return
      if (saveError) console.warn('Unable to save personal model results:', saveError.message)
    }
    void saveModelResults()
    return () => { active = false }
  }, [user, measurements, anomalyResults])

  const latestMeasurement = measurements[0]

  const historyDays = useMemo(() => {
    return getHistoryDays(measurements)
  }, [measurements])

  const recentActivities = useMemo(() => {
    if (!latestMeasurement) {
      return []
    }

    const latestDay = new Date(
      latestMeasurement.recorded_at,
    )
      .toISOString()
      .slice(0, 10)

    return activities.filter(
      (activity) => new Date(activity.occurred_at).toISOString().slice(0, 10) === latestDay,
    )
  }, [activities, latestMeasurement])

  return (
    <>
      <PageHeader
        title="Analysis"
        description="Your readings and personal patterns."
      />

      {loading ? (
        <Card className="p-6">
          <div className="flex items-center gap-3 text-sm text-haze">
            <Activity className="size-5 animate-pulse" />
            Loading your health history...
          </div>
        </Card>
      ) : error ? (
        <Card className="p-6">
          <p className="text-sm text-red-300">
            {error}
          </p>
        </Card>
      ) : measurements.length === 0 ? (
        <Card className="p-8">
          <div className="mx-auto max-w-lg text-center">
            <History className="mx-auto size-8 text-haze" />

            <h2 className="mt-4 text-lg font-semibold text-snow">
              Your analysis will appear here
            </h2>

            <p className="mt-2 text-sm leading-6 text-haze">
              Add your first health measurement to start
              Aura&apos;s personal health memory. You do
              not need seven days of history before analysis
              can begin.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <Card className="mb-6 overflow-hidden">
            <div className="border-b border-white/8 p-6">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-medium text-haze">
                    Current health analysis
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${getStatusClasses(
                        analysis.status,
                      )}`}
                    >
                      <span>
                        {getStatusSymbol(
                          analysis.status,
                        )}
                      </span>

                      <span>
                        {getStatusLabel(
                          analysis.status,
                        )}
                      </span>
                    </span>

                    <span className="text-xl font-semibold text-snow">
                      {getMaturityLabel(analysis)}
                    </span>
                  </div>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-haze">
                    {getStatusDescription(
                      analysis.status,
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs text-haze">
                    Measurements stored
                  </p>

                  <p className="mt-1 text-xl font-semibold text-snow">
                    {analysis.measurementCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-3">
              <div>
                <p className="text-xs text-haze">
                  Latest reading
                </p>

                <p className="mt-1 font-medium text-snow">
                  {latestMeasurement
                    ? new Date(
                        latestMeasurement.recorded_at,
                      ).toLocaleString()
                    : '—'}
                </p>
              </div>

              <div>
                <p className="text-xs text-haze">
                  History span
                </p>

                <p className="mt-1 font-medium text-snow">
                  {historyDays} day
                  {historyDays === 1 ? '' : 's'}
                </p>
              </div>

              <div>
                <p className="text-xs text-haze">
                  Pattern status
                </p>

                <p className="mt-1 font-medium text-snow">
                  {getMaturityLabel(analysis)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="mb-6 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl text-snow">Recent readings</h2>
                <p className="mt-1 text-sm text-haze">Your three latest saved entries, with their recorded times.</p>
              </div>
              <p className="max-w-sm text-sm leading-6 text-haze">
                <span className="font-medium text-snow">Current outlook: {getStatusLabel(analysis.status)}.</span>{' '}
                {analysis.measurementCount < 3
                  ? 'Add readings over time for a clearer personal pattern.'
                  : 'This reflects the readings saved so far; it is not a diagnosis.'}
              </p>
            </div>
            <ol className="mt-5 divide-y divide-white/8">
              {measurements.slice(0, 3).map((measurement) => {
                const values = getRecordedReadingValues(measurement)
                return (
                  <li key={measurement.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                    <time className="shrink-0 text-sm text-haze" dateTime={measurement.recorded_at}>
                      {new Date(measurement.recorded_at).toLocaleString()}
                    </time>
                    <p className="text-sm leading-6 text-snow">
                      {values.length > 0 ? values.join(' · ') : 'No numeric readings were saved for this entry.'}
                    </p>
                  </li>
                )
              })}
            </ol>
            {measurements.length < 3 && (
              <p className="mt-4 text-xs text-haze">Showing {measurements.length} of 3 available entries. Aura won’t fill in readings that haven’t been recorded.</p>
            )}
          </Card>

          <Card className="mb-6 p-6">
            <div className="mb-5">
              <p className="text-sm font-medium text-haze">
                Current reading
              </p>

              <h2 className="mt-1 text-xl font-semibold text-snow">
                Current readings
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {analysis.metrics
                .filter(
                  (metric) => metric.current !== null,
                )
                .map((metric) => {
                  const config = metricConfig.find(
                    (item) => item.key === metric.metric,
                  )

                  if (!config) {
                    return null
                  }

                  const decimals =
                    metric.metric === 'temperature'
                      ? 1
                      : 0

                  return (
                    <CurrentMetric
                      key={metric.metric}
                      label={config.label}
                      value={`${formatValue(
                        metric.current,
                        decimals,
                      )} ${config.unit}`}
                    />
                  )
                })}
            </div>
          </Card>

          <Card className="mt-6 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl text-snow">Personal pattern</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {anomalyResults.map((result) => (
                <AnomalyResultCard key={`${result.measurementId}-${result.metric}`} result={result} />
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-haze">Pattern comparisons are not diagnoses. Seek medical help for serious or worsening symptoms.</p>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {metricConfig.map((metric) => (
              <BaselineMetricCard
                key={metric.key}
                metric={metric}
                analysis={analysis}
              />
            ))}
          </div>

          {recentActivities.length > 0 && (
            <Card className="mt-6 p-6">
              <div className="mb-5">
                <div className="flex items-center gap-2">
                  <Activity className="size-5 text-snow" />

                  <p className="text-sm font-medium text-haze">
                    Activity context
                  </p>
                </div>

                <h2 className="mt-2 text-xl font-semibold text-snow">
                  Activity recorded on the latest
                  measurement day
                </h2>

              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-xl border border-white/8 bg-white/[0.03] p-4"
                  >
                    <p className="text-sm font-semibold text-snow">
                      {activity.activity_type}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-haze">
                      {activity.duration_minutes !==
                        null && (
                        <span>
                          {activity.duration_minutes} min
                        </span>
                      )}

                      {activity.intensity && (
                        <span>
                          {activity.intensity} intensity
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

        </>
      )}
    </>
  )
}

function CurrentMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-haze">
        {label}
      </p>

      <p className="mt-2 text-xl font-semibold text-snow">
        {value}
      </p>
    </div>
  )
}
