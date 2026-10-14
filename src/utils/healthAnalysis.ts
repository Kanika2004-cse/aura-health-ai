import {
  combineDecisionStatuses,
  decideMetricStatus,
} from './decision'

export type HealthMetricKey =
  | 'heartRate'
  | 'spo2'
  | 'systolic'
  | 'diastolic'
  | 'temperature'
  | 'steps'
  | 'sleepMinutes'

export type AnalysisMaturity =
  | 'INITIAL'
  | 'EARLY_HISTORY'
  | 'EMERGING_PATTERN'
  | 'ESTABLISHED_7_DAY'

export type HealthStatus =
  | 'STABLE'
  | 'MONITOR'
  | 'PRIORITY'

export type MeasurementForAnalysis = {
  id: string
  recorded_at: string
  heart_rate_bpm: number | null
  spo2_pct: number | null
  systolic_mmhg: number | null
  diastolic_mmhg: number | null
  temperature_c: number | null
  steps: number | null
  sleep_minutes: number | null
}

export type BaselineSummary = {
  metric: HealthMetricKey
  baseline: number | null
  current: number | null
  min: number | null
  max: number | null
  count: number
  deviation: number | null
  deviationPercent: number | null
}

export type MetricAnalysis = {
  metric: HealthMetricKey
  current: number | null
  baseline: number | null
  deviation: number | null
  deviationPercent: number | null
  historyCount: number
  persistentReadings: number
  persistenceWindow: number
  status: HealthStatus
  explanation: string
}

export type HealthAnalysis = {
  maturity: AnalysisMaturity
  status: HealthStatus
  measurementCount: number
  windowDays: number
  latestRecordedAt: string | null
  metrics: MetricAnalysis[]
  summary: string
}

const metricFields: Record<
  HealthMetricKey,
  keyof MeasurementForAnalysis
> = {
  heartRate: 'heart_rate_bpm',
  spo2: 'spo2_pct',
  systolic: 'systolic_mmhg',
  diastolic: 'diastolic_mmhg',
  temperature: 'temperature_c',
  steps: 'steps',
  sleepMinutes: 'sleep_minutes',
}

const allMetrics: HealthMetricKey[] = [
  'heartRate',
  'spo2',
  'systolic',
  'diastolic',
  'temperature',
  'steps',
  'sleepMinutes',
]

function getMetricValue(
  measurement: MeasurementForAnalysis,
  metric: HealthMetricKey,
): number | null {
  const value = measurement[metricFields[metric]]

  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return null
  }

  return value
}

function sortMeasurements(
  measurements: MeasurementForAnalysis[],
) {
  return [...measurements].sort(
    (a, b) =>
      new Date(b.recorded_at).getTime() -
      new Date(a.recorded_at).getTime(),
  )
}

/**
 * Determines how mature the user's personal history is.
 *
 * This is separate from health status.
 *
 * Multiple readings on the same day do not count as
 * multiple days of history.
 */
export function getAnalysisMaturity(
  measurements: MeasurementForAnalysis[],
): AnalysisMaturity {
  if (measurements.length === 0) {
    return 'INITIAL'
  }

  const sorted = sortMeasurements(measurements)

  const latestTime = new Date(
    sorted[0].recorded_at,
  ).getTime()

  if (!Number.isFinite(latestTime)) {
    return 'INITIAL'
  }

  const earliestValidMeasurement = [...sorted]
    .reverse()
    .find((measurement) => {
      const time = new Date(
        measurement.recorded_at,
      ).getTime()

      return Number.isFinite(time)
    })

  if (!earliestValidMeasurement) {
    return 'INITIAL'
  }

  const earliestTime = new Date(
    earliestValidMeasurement.recorded_at,
  ).getTime()

  const historySpanDays =
    (latestTime - earliestTime) /
    (24 * 60 * 60 * 1000)

  if (historySpanDays <= 0) {
    return 'INITIAL'
  }

  if (historySpanDays < 2) {
    return 'EARLY_HISTORY'
  }

  if (historySpanDays < 7) {
    return 'EMERGING_PATTERN'
  }

  return 'ESTABLISHED_7_DAY'
}

/**
 * Calculates a personal baseline from previous readings
 * inside the latest 7-day window.
 *
 * The current reading is excluded from the baseline.
 */
function calculateMetricSummary(
  measurements: MeasurementForAnalysis[],
  metric: HealthMetricKey,
): BaselineSummary {
  if (measurements.length === 0) {
    return {
      metric,
      baseline: null,
      current: null,
      min: null,
      max: null,
      count: 0,
      deviation: null,
      deviationPercent: null,
    }
  }

  const sorted = sortMeasurements(measurements)

  const current = getMetricValue(
    sorted[0],
    metric,
  )

  const latestTime = new Date(
    sorted[0].recorded_at,
  ).getTime()

  if (!Number.isFinite(latestTime)) {
    return {
      metric,
      baseline: null,
      current,
      min: null,
      max: null,
      count: 0,
      deviation: null,
      deviationPercent: null,
    }
  }

  const sevenDaysAgo =
    latestTime -
    7 * 24 * 60 * 60 * 1000

  const previousValues = sorted
    .filter((measurement, index) => {
      if (index === 0) return false

      const time = new Date(
        measurement.recorded_at,
      ).getTime()

      return (
        Number.isFinite(time) &&
        time >= sevenDaysAgo &&
        time <= latestTime
      )
    })
    .map((measurement) =>
      getMetricValue(
        measurement,
        metric,
      ),
    )
    .filter(
      (value): value is number =>
        value !== null,
    )

  if (current === null) {
    return {
      metric,
      baseline: null,
      current: null,
      min:
        previousValues.length > 0
          ? Math.min(...previousValues)
          : null,
      max:
        previousValues.length > 0
          ? Math.max(...previousValues)
          : null,
      count: previousValues.length,
      deviation: null,
      deviationPercent: null,
    }
  }

  if (previousValues.length === 0) {
    return {
      metric,
      baseline: null,
      current,
      min: current,
      max: current,
      count: 0,
      deviation: null,
      deviationPercent: null,
    }
  }

  const baseline =
    previousValues.reduce(
      (sum, value) => sum + value,
      0,
    ) / previousValues.length

  const deviation = current - baseline

  const deviationPercent =
    baseline !== 0
      ? (deviation / Math.abs(baseline)) * 100
      : null

  return {
    metric,
    baseline,
    current,
    min: Math.min(...previousValues),
    max: Math.max(...previousValues),
    count: previousValues.length,
    deviation,
    deviationPercent,
  }
}

/**
 * Measures whether recent readings repeatedly move in the
 * same direction as the current deviation.
 *
 * This is intentionally a temporal evidence feature.
 * It is NOT a clinical rule.
 */
function calculatePersistence(
  measurements: MeasurementForAnalysis[],
  metric: HealthMetricKey,
  baseline: number | null,
): {
  persistentReadings: number
  persistenceWindow: number
} {
  if (
    baseline === null ||
    !Number.isFinite(baseline)
  ) {
    return {
      persistentReadings: 0,
      persistenceWindow: 0,
    }
  }

  const sorted = sortMeasurements(
    measurements,
  )

  const current = getMetricValue(
    sorted[0],
    metric,
  )

  if (current === null) {
    return {
      persistentReadings: 0,
      persistenceWindow: 0,
    }
  }

  const currentDirection =
    current > baseline
      ? 'UP'
      : current < baseline
        ? 'DOWN'
        : 'NONE'

  if (currentDirection === 'NONE') {
    return {
      persistentReadings: 0,
      persistenceWindow: 0,
    }
  }

  /**
   * Look at up to the three previous valid readings.
   * These are evidence for persistence, not a clinical
   * threshold.
   */
  const previousValues = sorted
    .slice(1, 4)
    .map((measurement) =>
      getMetricValue(
        measurement,
        metric,
      ),
    )
    .filter(
      (value): value is number =>
        value !== null,
    )

  const persistentReadings =
    previousValues.filter((value) => {
      if (currentDirection === 'UP') {
        return value > baseline
      }

      return value < baseline
    }).length

  return {
    persistentReadings,
    persistenceWindow:
      previousValues.length,
  }
}

export function buildSevenDayBaseline(
  measurements: MeasurementForAnalysis[],
): Record<
  HealthMetricKey,
  BaselineSummary
> {
  return {
    heartRate:
      calculateMetricSummary(
        measurements,
        'heartRate',
      ),
    spo2:
      calculateMetricSummary(
        measurements,
        'spo2',
      ),
    systolic:
      calculateMetricSummary(
        measurements,
        'systolic',
      ),
    diastolic:
      calculateMetricSummary(
        measurements,
        'diastolic',
      ),
    temperature:
      calculateMetricSummary(
        measurements,
        'temperature',
      ),
    steps:
      calculateMetricSummary(
        measurements,
        'steps',
      ),
    sleepMinutes:
      calculateMetricSummary(
        measurements,
        'sleepMinutes',
      ),
  }
}

/**
 * Determines whether the deviation is large enough to
 * be considered meaningful evidence.
 *
 * This is deliberately NOT converted directly into
 * Stable / Monitor / Priority.
 *
 * The decision layer also considers persistence.
 */
function hasMeaningfulDeviation(
  deviationPercent: number | null,
): boolean {
  if (
    deviationPercent === null ||
    !Number.isFinite(deviationPercent)
  ) {
    return false
  }

  /**
   * Small changes are treated as normal measurement
   * variation for this initial implementation.
   *
   * This is only a feature-engineering boundary.
   * It does not determine the final health status.
   */
  return Math.abs(deviationPercent) >= 10
}

function analyzeMetric(
  summary: BaselineSummary,
  measurements: MeasurementForAnalysis[],
): MetricAnalysis {
  if (summary.current === null) {
    return {
      metric: summary.metric,
      current: null,
      baseline: summary.baseline,
      deviation: null,
      deviationPercent: null,
      historyCount: summary.count,
      persistentReadings: 0,
      persistenceWindow: 0,
      status: 'STABLE',
      explanation:
        'No current measurement is available for this metric.',
    }
  }

  /**
   * First reading:
   *
   * Aura analyzes the measurement but does not pretend
   * that a personal baseline exists.
   */
  if (summary.count === 0) {
    return {
      metric: summary.metric,
      current: summary.current,
      baseline: null,
      deviation: null,
      deviationPercent: null,
      historyCount: 0,
      persistentReadings: 0,
      persistenceWindow: 0,
      status: 'STABLE',
      explanation:
        'This is an initial reading. Aura will use it as part of your growing personal health history.',
    }
  }

  const persistence =
    calculatePersistence(
      measurements,
      summary.metric,
      summary.baseline,
    )

  const meaningfulDeviation =
    hasMeaningfulDeviation(
      summary.deviationPercent,
    )

  const status =
    decideMetricStatus({
      metric: summary.metric,
      current: summary.current,
      baseline: summary.baseline,
      deviationPercent:
        summary.deviationPercent,
      historyCount: summary.count,
      persistentReadings:
        persistence.persistentReadings,
      persistenceWindow:
        persistence.persistenceWindow,
      hasMeaningfulDeviation:
        meaningfulDeviation,
    })

  let explanation =
    'This reading is relatively close to your recent personal pattern.'

  if (!meaningfulDeviation) {
    explanation =
      'This reading is relatively close to your recent personal pattern.'
  } else if (
    persistence.persistentReadings >= 3
  ) {
    explanation =
      'This reading differs from your recent personal pattern and similar changes have appeared repeatedly in recent readings.'
  } else if (
    persistence.persistentReadings >= 2
  ) {
    explanation =
      'This reading differs from your recent personal pattern and similar changes have appeared in multiple recent readings.'
  } else {
    explanation =
      'This reading differs from your recent personal pattern, but there is not yet enough repeated evidence to determine whether the change is persistent.'
  }

  return {
    metric: summary.metric,
    current: summary.current,
    baseline: summary.baseline,
    deviation: summary.deviation,
    deviationPercent:
      summary.deviationPercent,
    historyCount: summary.count,
    persistentReadings:
      persistence.persistentReadings,
    persistenceWindow:
      persistence.persistenceWindow,
    status,
    explanation,
  }
}

export function analyzeHealthHistory(
  measurements: MeasurementForAnalysis[],
): HealthAnalysis {
  const sorted =
    sortMeasurements(measurements)

  if (sorted.length === 0) {
    return {
      maturity: 'INITIAL',
      status: 'STABLE',
      measurementCount: 0,
      windowDays: 0,
      latestRecordedAt: null,
      metrics: [],
      summary:
        'Add a health reading to begin your personal health analysis.',
    }
  }

  const latestRecordedAt =
    sorted[0].recorded_at

  const maturity =
    getAnalysisMaturity(sorted)

  const baselines =
    buildSevenDayBaseline(sorted)

  const metrics = allMetrics
    .map((metric) =>
      analyzeMetric(
        baselines[metric],
        sorted,
      ),
    )
    .filter(
      (analysis) =>
        analysis.current !== null,
    )

  const status =
    combineDecisionStatuses(metrics)

  const earliestValidMeasurement =
    [...sorted]
      .reverse()
      .find((measurement) => {
        const time = new Date(
          measurement.recorded_at,
        ).getTime()

        return Number.isFinite(time)
      })

  let windowDays = 0

  if (earliestValidMeasurement) {
    const latestTime = new Date(
      sorted[0].recorded_at,
    ).getTime()

    const earliestTime = new Date(
      earliestValidMeasurement.recorded_at,
    ).getTime()

    if (
      Number.isFinite(latestTime) &&
      Number.isFinite(earliestTime) &&
      latestTime >= earliestTime
    ) {
      windowDays = Math.floor(
        (latestTime - earliestTime) /
          (24 * 60 * 60 * 1000),
      )
    }
  }

  let summary: string

  switch (maturity) {
    case 'INITIAL':
      summary =
        'Your first reading has been analyzed. Aura is beginning to learn your personal pattern.'
      break

    case 'EARLY_HISTORY':
      summary =
        'Aura has started comparing your readings with your recent history. Your personal pattern is still developing.'
      break

    case 'EMERGING_PATTERN':
      summary =
        'Aura is beginning to identify your recent personal pattern. More history will make the comparison more reliable.'
      break

    case 'ESTABLISHED_7_DAY':
      summary =
        'Aura has enough recent history to establish an initial 7-day personal pattern and track changes over time.'
      break
  }

  return {
    maturity,
    status,
    measurementCount:
      sorted.length,
    windowDays,
    latestRecordedAt,
    metrics,
    summary,
  }
}