import type { MeasurementForAnalysis, HealthMetricKey } from '../utils/healthAnalysis'

export const PERSONAL_ANOMALY_MODEL_NAME = 'Aura personal anomaly model'
export const PERSONAL_ANOMALY_MODEL_VERSION = '1.1.0'
export const MINIMUM_TRAINING_READINGS = 5
export const ANOMALY_ROBUST_Z_LIMIT = 3.5
const TRAINING_WINDOW_DAYS = 30

type NumericField = Exclude<keyof MeasurementForAnalysis, 'id' | 'recorded_at'>
type FeatureConfig = { metric: HealthMetricKey; label: string; unit: string; field: NumericField; minimumScale: number }
export type AnalysisContextEvent = { occurred_at: string; label: string }

export type PersonalAnomalyResult = {
  measurementId: string
  metric: HealthMetricKey
  label: string
  unit: string
  current: number
  previous: number | null
  previousRecordedAt: string | null
  changeFromPrevious: number | null
  nearbyActivity: string | null
  nearbySymptoms: string[]
  baselineMedian: number | null
  trainingReadings: number
  robustDeviation: number | null
  status: 'learning' | 'typical' | 'unusual'
}

const features: FeatureConfig[] = [
  { metric: 'heartRate', label: 'Heart rate', unit: 'bpm', field: 'heart_rate_bpm', minimumScale: 1 },
  { metric: 'spo2', label: 'Blood oxygen', unit: '%', field: 'spo2_pct', minimumScale: 0.5 },
  { metric: 'systolic', label: 'Systolic pressure', unit: 'mmHg', field: 'systolic_mmhg', minimumScale: 1 },
  { metric: 'diastolic', label: 'Diastolic pressure', unit: 'mmHg', field: 'diastolic_mmhg', minimumScale: 1 },
  { metric: 'temperature', label: 'Temperature', unit: '°C', field: 'temperature_c', minimumScale: 0.1 },
  { metric: 'steps', label: 'Steps', unit: 'steps', field: 'steps', minimumScale: 1 },
  { metric: 'sleepMinutes', label: 'Sleep duration', unit: 'minutes', field: 'sleep_minutes', minimumScale: 1 },
]

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

/**
 * Fits a simple unsupervised, user-specific robust distribution for each
 * measurement. It reports statistical novelty only; it is not a clinical model.
 */
export function detectPersonalAnomalies(
  measurements: MeasurementForAnalysis[],
  activities: AnalysisContextEvent[] = [],
  symptoms: AnalysisContextEvent[] = [],
): PersonalAnomalyResult[] {
  const sorted = [...measurements].sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at))
  const results: PersonalAnomalyResult[] = []

  for (const feature of features) {
    const currentIndex = sorted.findIndex((row) => typeof row[feature.field] === 'number' && Number.isFinite(row[feature.field]))
    if (currentIndex < 0) continue
    const currentRow = sorted[currentIndex]
    const current = currentRow[feature.field] as number
    const previousRow = sorted.slice(currentIndex + 1).find((row) => {
      const value = row[feature.field]
      return typeof value === 'number' && Number.isFinite(value)
    })
    const previous = previousRow?.[feature.field] as number | undefined
    const currentTime = Date.parse(currentRow.recorded_at)
    const comparison = {
      previous: previous ?? null,
      previousRecordedAt: previousRow?.recorded_at ?? null,
      changeFromPrevious: previous === undefined ? null : current - previous,
    }
    const nearbyContext = (events: AnalysisContextEvent[]) => events
      .map((event) => ({
        ...event,
        distance: Math.abs(Date.parse(event.occurred_at) - currentTime),
      }))
      .filter((event) => Number.isFinite(event.distance) && event.distance <= 30 * 60 * 1000)
      .sort((a, b) => a.distance - b.distance)
    const closestActivity = nearbyContext(activities)[0]?.label ?? null
    const nearbySymptoms = nearbyContext(symptoms).map((event) => event.label)
    const context = { nearbyActivity: closestActivity, nearbySymptoms }
    const windowStart = currentTime - TRAINING_WINDOW_DAYS * 24 * 60 * 60 * 1000
    const history = sorted.slice(currentIndex + 1)
      .filter((row) => {
        const timestamp = Date.parse(row.recorded_at)
        return Number.isFinite(timestamp) && timestamp >= windowStart && timestamp <= currentTime
      })
      .map((row) => row[feature.field])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

    if (history.length < MINIMUM_TRAINING_READINGS) {
      results.push({ measurementId: currentRow.id, metric: feature.metric, label: feature.label, unit: feature.unit, current, ...comparison, ...context, baselineMedian: history.length ? median(history) : null, trainingReadings: history.length, robustDeviation: null, status: 'learning' })
      continue
    }

    const baselineMedian = median(history)
    const medianAbsoluteDeviation = median(history.map((value) => Math.abs(value - baselineMedian)))
    const scale = medianAbsoluteDeviation || feature.minimumScale
    const robustDeviation = Math.abs(0.6745 * (current - baselineMedian) / scale)
    results.push({
      measurementId: currentRow.id,
      metric: feature.metric,
      label: feature.label,
      unit: feature.unit,
      current,
      ...comparison,
      ...context,
      baselineMedian,
      trainingReadings: history.length,
      robustDeviation,
      status: robustDeviation >= ANOMALY_ROBUST_Z_LIMIT ? 'unusual' : 'typical',
    })
  }

  return results
}
