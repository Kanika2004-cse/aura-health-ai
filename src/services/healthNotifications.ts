import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { analyzeHealthHistory, type MeasurementForAnalysis } from '../utils/healthAnalysis'

export async function requestHealthNotificationPermission() {
  if (Capacitor.isNativePlatform()) {
    const current = await LocalNotifications.checkPermissions()
    if (current.display === 'granted') return true
    const requested = await LocalNotifications.requestPermissions()
    return requested.display === 'granted'
  }

  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

export async function notifyHealthUpdate(measurements: MeasurementForAnalysis[]) {
  if (!measurements.length) return
  const sorted = [...measurements].sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at))
  const analysis = analyzeHealthHistory(sorted)
  const parts: string[] = []
  const heartRate = sorted.find((reading) => reading.heart_rate_bpm !== null)?.heart_rate_bpm
  const sleepMinutes = sorted.find((reading) => reading.sleep_minutes !== null)?.sleep_minutes
  if (heartRate !== null && heartRate !== undefined) parts.push(`Heart rate ${heartRate} bpm`)
  if (sleepMinutes !== null && sleepMinutes !== undefined) parts.push(`Sleep ${(sleepMinutes / 60).toFixed(1)} hours`)

  const status = analysis.maturity === 'INITIAL'
    ? 'Aura is starting your personal pattern.'
    : `Recent-pattern status: ${analysis.status.toLowerCase()}.`
  const body = `${parts.length ? `${parts.join(' · ')}. ` : ''}${status} Based on saved readings, not a diagnosis.`
  const title = analysis.maturity === 'INITIAL' ? 'Aura health update' : `Aura pattern: ${analysis.status.toLowerCase()}`

  if (Capacitor.isNativePlatform()) {
    if (!(await requestHealthNotificationPermission())) return
    await LocalNotifications.schedule({
      notifications: [{ id: Date.now() % 2_000_000_000, title, body, schedule: { at: new Date(Date.now() + 500) } }],
    })
    return
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body })
}
