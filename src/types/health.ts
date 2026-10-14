export type MetricKey =
  | 'heartRate'
  | 'spo2'
  | 'bloodPressure'
  | 'temperature'
  | 'steps'
  | 'sleep'

export interface MetricCardData {
  key: MetricKey
  label: string
  value: string
  unit: string
  hint: string
  trend: string
}

export interface BaselinePoint {
  label: string
  current: number
  baseline: number
}

export interface ActivityDay {
  day: string
  value: number
}

export interface TimelineEvent {
  id: string
  time: string
  title: string
  detail: string
}
