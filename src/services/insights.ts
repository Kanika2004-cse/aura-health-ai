import { analyzeHealthHistory, type HealthMetricKey, type MeasurementForAnalysis } from '../utils/healthAnalysis'

export type HealthInsight = {
  id: string
  title: string
  body: string
  details?: string
  kind: 'pattern' | 'change' | 'history'
  createdAt: string | null
}

const metricLabels: Record<HealthMetricKey, { label: string; unit: string; decimals?: number }> = {
  heartRate: { label: 'Heart rate', unit: 'bpm' },
  spo2: { label: 'Blood oxygen', unit: '%' },
  systolic: { label: 'Systolic blood pressure', unit: 'mmHg' },
  diastolic: { label: 'Diastolic blood pressure', unit: 'mmHg' },
  temperature: { label: 'Temperature', unit: '°C', decimals: 1 },
  steps: { label: 'Steps', unit: 'steps' },
  sleepMinutes: { label: 'Sleep duration', unit: 'minutes' },
}

function formatNumber(value: number, decimals = 0) {
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

export function buildHealthInsights(measurements: MeasurementForAnalysis[]): HealthInsight[] {
  if (measurements.length === 0) return []

  const analysis = analyzeHealthHistory(measurements)
  const insights: HealthInsight[] = []
  const comparableMetrics = analysis.metrics.filter((metric) => metric.baseline !== null)

  if (comparableMetrics.length === 0) {
    insights.push({
      id: 'personal-history',
      title: 'Your personal pattern is starting to take shape',
      body: 'Add readings over time to build your personal comparison.',
      details: 'Aura needs earlier readings before it can compare this measurement with your recent history.',
      kind: 'history',
      createdAt: analysis.latestRecordedAt,
    })
    return insights
  }

  comparableMetrics.forEach((metric) => {
    const config = metricLabels[metric.metric]
    if (metric.current === null || metric.baseline === null) return

    const changed = metric.status !== 'STABLE'
    const difference = metric.current - metric.baseline
    const formattedDifference = `${difference > 0 ? '+' : ''}${formatNumber(difference, config.decimals)} ${config.unit}`
    const currentValue = `${formatNumber(metric.current, config.decimals)} ${config.unit}`
    const baselineValue = `${formatNumber(metric.baseline, config.decimals)} ${config.unit}`

    insights.push({
      id: `metric-${metric.metric}`,
      title: changed
        ? `${config.label} differs from your recent pattern`
        : `${config.label} is close to your recent pattern`,
      body: `${currentValue} · recent average ${baselineValue} · ${formattedDifference}`,
      details: metric.explanation,
      kind: changed ? 'change' : 'pattern',
      createdAt: analysis.latestRecordedAt,
    })
  })

  return insights
}
