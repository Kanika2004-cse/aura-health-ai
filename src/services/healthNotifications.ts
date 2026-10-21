import { LocalNotifications } from '@capacitor/local-notifications'
import { getSupabaseClient } from '../lib/supabase'
import { fireAlert } from '../engine/alerting'
import type { RiskSeverity } from '../engine/riskEngine/decision'

type MeasurementRow = {
  id: string
  recorded_at: string
  systolic_mmhg: number | null
  diastolic_mmhg: number | null
  heart_rate_bpm: number | null
  spo2_pct: number | null
  temperature_c: number | null
  steps: number | null
  sleep_minutes: number | null
}

export async function requestHealthNotificationPermission() {
  try {
    const permStatus = await LocalNotifications.checkPermissions()
    if (permStatus.display !== 'granted') {
      await LocalNotifications.requestPermissions()
    }
    return true
  } catch (e) {
    console.log('Notifications not available or web environment:', e)
    return false
  }
}

export async function notifyHealthUpdate(measurements: MeasurementRow[]) {
  return await evaluateAndNotifyHealth(measurements)
}

/**
 * Evaluates health telemetry measurements and triggers local notifications / alerts
 * if anomalies or priority risk levels are detected.
 */
export async function evaluateAndNotifyHealth(measurements: MeasurementRow[]) {
  if (!measurements || measurements.length === 0) {
    return
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return
  }

  // Get current authenticated user ID
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id

  if (!userId) {
    console.log('No active user session found for health notifications.')
    return
  }

  // Sort measurements newest first
  const sorted = [...measurements].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  )

  const latest = sorted[0]

  let verdict: { finalStatus: RiskSeverity; rationale: string } | null = null

  if (latest.systolic_mmhg !== null && latest.systolic_mmhg >= 140) {
    verdict = {
      finalStatus: 'PRIORITY',
      rationale: `Critical Alert: Systolic blood pressure reached ${latest.systolic_mmhg} mmHg. Sustained high readings indicate cardiovascular strain.`
    }
  } else if (latest.heart_rate_bpm !== null && (latest.heart_rate_bpm > 120 || latest.heart_rate_bpm < 50)) {
    verdict = {
      finalStatus: 'MONITOR',
      rationale: `Heart Rate Notice: Recorded heart rate of ${latest.heart_rate_bpm} BPM deviates from normal resting baselines.`
    }
  }

  if (verdict) {
    try {
      await fireAlert(verdict, { userId })
    } catch (err) {
      console.error('Failed to fire health notification alert:', err)
    }
  }
}