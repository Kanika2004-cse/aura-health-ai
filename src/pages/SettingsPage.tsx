import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowDownToLine, CheckCircle2, Eye, KeyRound, Monitor, Moon, Smartphone, Globe2, UserRound, Sun, Trash2, Bell, HeartHandshake } from 'lucide-react'

import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { getSupabaseClient } from '../lib/supabase'
import { getMeasurementSystem, setMeasurementSystem, type MeasurementSystem } from '../utils/measurementUnits'
import { createHealthReportPdf } from '../utils/healthReportPdf'
import { getHealthAvailability, isNativeHealthSyncAvailable, synchronizeHealthData } from '../services/wearableSync'
import { notifyHealthUpdate, requestHealthNotificationPermission } from '../services/healthNotifications'

type Appearance = 'light' | 'dark' | 'system'
const APPEARANCE_KEY = 'aura-appearance'

function applyAppearance(appearance: Appearance) {
  const isDark = appearance === 'dark' || (appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
}

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const supabase = getSupabaseClient()
  const [appearance, setAppearance] = useState<Appearance>(() => {
    const saved = localStorage.getItem(APPEARANCE_KEY)
    return saved === 'light' || saved === 'system' ? saved : 'dark'
  })
  const [measurementSystem, setMeasurementSystemState] = useState<MeasurementSystem>(getMeasurementSystem)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [savingNotifications, setSavingNotifications] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [healthDataConfirmation, setHealthDataConfirmation] = useState('')
  const [deletingHealthData, setDeletingHealthData] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [syncingWearable, setSyncingWearable] = useState(false)
  const [wearableAvailable, setWearableAvailable] = useState(false)
  const [wearableStatus, setWearableStatus] = useState('')
  const [lastWearableSync, setLastWearableSync] = useState<string | null>(null)

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(''), 1500)
    return () => window.clearTimeout(timer)
  }, [message])

  useEffect(() => {
    let active = true
    async function loadDisplayName() {
      if (!user) return
      const supabase = getSupabaseClient()
      if (!supabase) return
      const { data } = await supabase.from('health_profiles').select('display_name').eq('user_id', user.id).maybeSingle()
      const profile = data as { display_name: string | null } | null
      if (active && profile?.display_name) setDisplayName(profile.display_name)
    }
    void loadDisplayName()
    return () => { active = false }
  }, [user])

  useEffect(() => {
    let active = true
    void getHealthAvailability().then((availability) => {
      if (active) setWearableAvailable(availability.available)
    }).catch(() => {
      if (active) setWearableAvailable(false)
    })
    if (user && supabase) {
      void (supabase.from('connected_devices') as any).select('last_synced_at').eq('user_id', user.id).in('device_type', ['healthkit', 'health_connect']).order('last_synced_at', { ascending: false }).limit(1).maybeSingle().then(({ data }: { data: { last_synced_at: string | null } | null }) => {
        if (active) setLastWearableSync(data?.last_synced_at ?? null)
      })
    }
    return () => { active = false }
  }, [user, supabase])

  useEffect(() => {
    applyAppearance(appearance)
    if (appearance !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateTheme = () => applyAppearance('system')
    media.addEventListener('change', updateTheme)
    return () => media.removeEventListener('change', updateTheme)
  }, [appearance])

  useEffect(() => {
    setNotificationsEnabled(user?.user_metadata?.aura_notifications_enabled !== false)
    const accountUnits = user?.user_metadata?.aura_measurement_system
    if (accountUnits === 'metric' || accountUnits === 'imperial') {
      setMeasurementSystemState(accountUnits)
      setMeasurementSystem(accountUnits)
    }
  }, [user])

  async function changeNotifications(enabled: boolean) {
    if (!supabase) return setError('Your preferences cannot be saved right now. Please try again.')
    setError('')
    setMessage('')
    setSavingNotifications(true)
    if (enabled) {
      try {
        const granted = await requestHealthNotificationPermission()
        if (!granted) {
          setSavingNotifications(false)
          return setError('Allow notifications in your device settings to receive Aura health updates.')
        }
      } catch {
        setSavingNotifications(false)
        return setError('Notifications are not available on this device.')
      }
    }
    const { error: updateError } = await supabase.auth.updateUser({ data: { aura_notifications_enabled: enabled } })
    setSavingNotifications(false)
    if (updateError) return setError(`Could not save notification preference: ${updateError.message}`)
    setNotificationsEnabled(enabled)
    setMessage(`Notifications turned ${enabled ? 'on' : 'off'}.`)
  }

  async function changeMeasurementSystem(system: MeasurementSystem) {
    if (!supabase) return setError('Your preferences cannot be saved right now. Please try again.')
    setError('')
    setMessage('')
    const { error: updateError } = await supabase.auth.updateUser({ data: { aura_measurement_system: system } })
    if (updateError) return setError(`Could not save unit preference: ${updateError.message}`)
    setMeasurementSystemState(system)
    setMeasurementSystem(system)
    setMessage(`Measurement units changed to ${system === 'metric' ? 'Metric' : 'Imperial'}.`)
  }

  async function syncWearable() {
    if (!supabase || !user) return setError('Sign in to connect health data.')
    setError('')
    setMessage('')
    setWearableStatus('')
    setSyncingWearable(true)
    try {
      const result = await synchronizeHealthData(supabase, user.id)
      setLastWearableSync(new Date().toISOString())
      setWearableStatus(`${result.inserted} new readings added${result.totalRead > result.inserted ? ` · ${result.totalRead - result.inserted} already up to date` : ''}${result.denied.length ? ` · ${result.denied.length} data type${result.denied.length === 1 ? '' : 's'} not permitted` : ''}`)
      setMessage('Health data synced.')
      if (result.inserted > 0 && user.user_metadata?.aura_notifications_enabled !== false) {
        const { data } = await supabase.from('health_measurements').select('id, recorded_at, heart_rate_bpm, spo2_pct, systolic_mmhg, diastolic_mmhg, temperature_c, steps, sleep_minutes').eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(30)
        if (data?.length) void notifyHealthUpdate(data as any).catch((notificationError) => console.warn('Health notification could not be shown:', notificationError))
      }
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Could not sync health data. Please try again.')
    } finally {
      setSyncingWearable(false)
    }
  }

  async function deleteHealthData() {
    if (healthDataConfirmation !== 'DELETE HEALTH DATA') return setError('Type DELETE HEALTH DATA to confirm.')
    if (!supabase || !user) return setError('Your health data cannot be deleted right now. Please try again.')
    setError('')
    setMessage('')
    setDeletingHealthData(true)
    const deletions = await Promise.all([
      supabase.from('health_measurements').delete().eq('user_id', user.id),
      supabase.from('activity_context').delete().eq('user_id', user.id),
      supabase.from('symptoms').delete().eq('user_id', user.id),
      supabase.from('personal_baselines').delete().eq('user_id', user.id),
      supabase.from('health_events').delete().eq('user_id', user.id),
      supabase.from('health_insights').delete().eq('user_id', user.id),
      supabase.from('analysis_results').delete().eq('user_id', user.id),
      supabase.from('model_predictions').delete().eq('user_id', user.id),
      supabase.from('emergency_contacts').delete().eq('user_id', user.id),
      supabase.from('connected_devices').delete().eq('user_id', user.id),
      (supabase.from('health_profiles') as any).update({ date_of_birth: null, biological_sex: null, height_cm: null, weight_kg: null, blood_group: null, allergies: null, medications: null, conditions: null, doctor_name: null, doctor_phone: null, hospital_name: null, hospital_phone: null, medical_notes: null }).eq('user_id', user.id),
    ])
    setDeletingHealthData(false)
    const failed = deletions.find((result) => result.error)
    if (failed?.error) return setError('Some health data could not be deleted. Please try again.')
    setHealthDataConfirmation('')
    setMessage('Your health data and emergency profile have been deleted. Your Aura account remains active.')
  }

  async function deleteAccount() {
    if (deleteConfirmation !== 'DELETE') return setError('Type DELETE to confirm account removal.')
    if (!supabase) return setError('Account deletion is unavailable right now. Please try again later.')
    setError('')
    setDeletingAccount(true)
    const { error: deleteError } = await supabase.functions.invoke('delete-account')
    setDeletingAccount(false)
    if (deleteError) {
      console.error('Account deletion failed:', deleteError)
      setError('Account deletion is unavailable right now. Please try again later.')
      return
    }
    localStorage.removeItem(APPEARANCE_KEY)
    localStorage.removeItem('aura-measurement-system')
    await supabase.auth.signOut({ scope: 'local' })
    window.location.assign('/login')
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (newPassword.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError('Password updates are unavailable right now. Please try again.')
      return
    }
    setSavingPassword(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setNewPassword('')
    setConfirmPassword('')
    setChangingPassword(false)
    setMessage('Password updated.')
  }

  async function exportHealthData() {
    const supabase = getSupabaseClient()
    if (!supabase || !user) {
      setError('Your health data cannot be exported right now. Please try again.')
      return
    }
    setError('')
    setMessage('')
    setExporting(true)
    try {
      const [profile, measurements, activities, symptoms, baselines, events, insights, contacts, analysis] = await Promise.all([
        supabase.from('health_profiles').select('*').eq('user_id', user.id),
        supabase.from('health_measurements').select('*').eq('user_id', user.id).order('recorded_at', { ascending: false }),
        supabase.from('activity_context').select('*').eq('user_id', user.id),
        supabase.from('symptoms').select('*').eq('user_id', user.id),
        supabase.from('personal_baselines').select('*').eq('user_id', user.id),
        supabase.from('health_events').select('*').eq('user_id', user.id),
        supabase.from('health_insights').select('*').eq('user_id', user.id),
        supabase.from('emergency_contacts').select('*').eq('user_id', user.id),
        supabase.from('analysis_results').select('*').eq('user_id', user.id),
      ])
      const results = [profile, measurements, activities, symptoms, baselines, events, insights, contacts, analysis]
      const failed = results.find((result) => result.error)
      if (failed?.error) {
        setError('Your health report could not be created. Please try again.')
        return
      }

      const exportedAt = new Date()
      const report = createHealthReportPdf({
        exportedAt,
        accountEmail: user.email,
        profile: (profile.data?.[0] ?? null) as Record<string, unknown> | null,
        measurements: (measurements.data ?? []) as unknown as Record<string, unknown>[],
        activities: (activities.data ?? []) as unknown as Record<string, unknown>[],
        symptoms: (symptoms.data ?? []) as unknown as Record<string, unknown>[],
        baselines: (baselines.data ?? []) as unknown as Record<string, unknown>[],
        events: (events.data ?? []) as unknown as Record<string, unknown>[],
        insights: (insights.data ?? []) as unknown as Record<string, unknown>[],
        contacts: (contacts.data ?? []) as unknown as Record<string, unknown>[],
        analyses: (analysis.data ?? []) as unknown as Record<string, unknown>[],
      })
      const blobUrl = URL.createObjectURL(report)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `aura-health-report-${exportedAt.toISOString().slice(0, 10)}.pdf`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
      setMessage('Your health report PDF was downloaded.')
    } catch (exportError) {
      console.error('Unable to create health report:', exportError)
      setError('Your health report could not be created. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  async function handleSignOut() {
    setError('')
    const result = await signOut()
    if (result.error) setError(result.error.message)
  }

  return (
    <>
      <PageHeader eyebrow="Your account" title="Settings" description="Manage your account, health experience, and privacy preferences." />

      {(error || message) && <div role={error ? 'alert' : 'status'} className={`mb-5 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-red-400/30 bg-red-400/10 text-red-200' : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'}`}>{message && !error && <CheckCircle2 className="size-4" />}{error || message}</div>}

      <div className="space-y-5">
        <section>
          <SectionHeading title="Profile & account" />
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-pulse/10 text-pulse"><UserRound className="size-5" /></span>
                <div><p className="font-medium text-snow">{displayName || user?.email || 'Aura account'}</p><p className="mt-1 text-sm text-haze">{user?.email ?? 'Email unavailable'}</p><p className="mt-2 text-xs text-haze">Identity details only. Medical information is managed in your Health Card.</p></div>
              </div>
              <Link to="/profile" className="text-sm font-medium text-pulse hover:text-snow">Edit profile</Link>
            </div>
            <div className="mt-5 border-t border-line pt-4">
              {!changingPassword ? (
                <button type="button" onClick={() => { setChangingPassword(true); setError(''); setMessage('') }} className="inline-flex items-center gap-2 text-sm font-medium text-haze hover:text-snow"><KeyRound className="size-4" />Change password</button>
              ) : (
                <form onSubmit={handlePasswordChange} className="grid gap-3 sm:grid-cols-2">
                  <label className="block"><span className="text-xs font-semibold uppercase tracking-[0.12em] text-haze">New password</span><input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-line bg-ink px-3 text-sm text-snow outline-none focus:border-pulse" /></label>
                  <label className="block"><span className="text-xs font-semibold uppercase tracking-[0.12em] text-haze">Confirm new password</span><input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-line bg-ink px-3 text-sm text-snow outline-none focus:border-pulse" /></label>
                  <div className="flex gap-3 sm:col-span-2"><Button type="submit" disabled={savingPassword}>{savingPassword ? 'Updating...' : 'Update password'}</Button><Button type="button" variant="secondary" onClick={() => { setChangingPassword(false); setNewPassword(''); setConfirmPassword('') }}>Cancel</Button></div>
                </form>
              )}
            </div>
          </Card>
        </section>

        <section>
          <SectionHeading title="Health preferences" />
          <Card className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-snow">Personalized analysis</p><p className="mt-1 max-w-2xl text-sm leading-6 text-haze">Aura uses your health history, context, and recent patterns when analyzing measurements.</p></div><Badge tone="pulse"><Activity className="size-3.5" />Active</Badge></div>
            <label className="flex max-w-sm items-center justify-between gap-3 rounded-xl border border-line bg-ink px-3 py-3"><span className="flex items-center gap-2 text-sm text-haze"><Monitor className="size-4" />Units</span><select aria-label="Measurement units" value={measurementSystem} onChange={(event) => void changeMeasurementSystem(event.target.value as MeasurementSystem)} className="rounded-lg border border-line bg-panel px-2 py-1.5 text-sm text-snow"><option value="metric">Metric (kg, cm, °C)</option><option value="imperial">Imperial (lb, ft + in, °F)</option></select></label>
          </Card>
        </section>

        <section>
          <SectionHeading title="Emergency & safety" />
          <Card className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-start gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-red-400/10 text-red-300"><HeartHandshake className="size-4" /></span><div><p className="font-medium text-snow">Emergency contacts & health card</p><p className="mt-1 text-sm text-haze">Manage trusted contacts and the medical information shown on your emergency card.</p></div></div><Link to="/emergency" className="rounded-full border border-line px-4 py-2 text-sm font-medium text-snow hover:border-pulse/40">Manage emergency details</Link></Card>
        </section>

        <section>
          <SectionHeading title="Notifications" />
          <Card className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-start gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-white/5 text-haze"><Bell className="size-4" /></span><div><p className="font-medium text-snow">Aura health updates</p><p className="mt-1 text-sm leading-6 text-haze">Get a device notification when new readings are saved or synced, including heart rate, sleep, and a recent-pattern status. Aura does not monitor readings in the background.</p></div></div><button type="button" role="switch" aria-checked={notificationsEnabled} aria-label="Aura notifications" disabled={savingNotifications} onClick={() => void changeNotifications(!notificationsEnabled)} className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-60 ${notificationsEnabled ? 'bg-pulse' : 'bg-raised'}`}><span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} /></button></Card>
        </section>

        <section>
          <SectionHeading title="Privacy & data" />
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-white/5 text-haze"><Eye className="size-4" /></span><div><p className="font-medium text-snow">Personal health analysis</p><p className="mt-1 max-w-2xl text-sm leading-6 text-haze">Your measurements and health context are analyzed to generate your patterns, trends, and insights. Analysis results are stored separately from raw measurements, and Row Level Security restricts your records to your account.</p></div></div>
              <Button type="button" variant="secondary" onClick={() => void exportHealthData()} disabled={exporting}><ArrowDownToLine className="size-4" />{exporting ? 'Preparing report...' : 'Export health report (PDF)'}</Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-4"><Link to="/health-data" className="text-sm font-medium text-pulse hover:text-snow">View stored health data</Link><Link to="/timeline" className="text-sm font-medium text-pulse hover:text-snow">Review timeline</Link></div>
            <div className="mt-4 border-t border-line pt-4"><p className="font-medium text-red-300">Delete health data</p><p className="mt-1 text-sm leading-6 text-haze">Delete your measurements, analysis, health history, emergency contacts, and medical details while keeping your Aura account and display name.</p><div className="mt-3 flex flex-wrap gap-3"><input aria-label="Type DELETE HEALTH DATA to confirm" value={healthDataConfirmation} onChange={(event) => setHealthDataConfirmation(event.target.value)} placeholder="Type DELETE HEALTH DATA" className="h-11 min-w-56 rounded-xl border border-line bg-ink px-3 text-sm text-snow outline-none focus:border-red-400" /><Button type="button" variant="secondary" disabled={deletingHealthData || healthDataConfirmation !== 'DELETE HEALTH DATA'} onClick={() => void deleteHealthData()} className="border-red-400/30 text-red-200 hover:bg-red-400/10">{deletingHealthData ? 'Deleting health data...' : 'Delete health data'}</Button></div></div>
          </Card>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section>
            <SectionHeading title="Connected devices" />
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-white/5 text-haze"><Smartphone className="size-4" /></span><div><p className="font-medium text-snow">{wearableAvailable ? (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'Apple Health' : 'Health Connect') : 'Health platform sync'}</p><p className="mt-1 max-w-xl text-sm leading-6 text-haze">Import heart rate, blood oxygen, blood pressure, steps, and sleep from a phone health app. Your watch must first sync its readings to Apple Health or Health Connect.</p></div></div>
                <Button type="button" onClick={() => void syncWearable()} disabled={!wearableAvailable || syncingWearable || !isNativeHealthSyncAvailable()}>{syncingWearable ? 'Syncing…' : lastWearableSync ? 'Sync now' : 'Connect health data'}</Button>
              </div>
              {!isNativeHealthSyncAvailable() && <p className="mt-4 rounded-xl border border-line bg-ink px-3 py-2.5 text-sm text-haze">To connect a watch, open Aura on its Android or iPhone app. This browser version cannot access phone health data.</p>}
              {isNativeHealthSyncAvailable() && !wearableAvailable && <p className="mt-4 rounded-xl border border-line bg-ink px-3 py-2.5 text-sm text-haze">Health Connect or Apple Health is not available on this device yet.</p>}
              {lastWearableSync && <p className="mt-4 text-xs text-haze">Last synced {new Date(lastWearableSync).toLocaleString()}</p>}
              {wearableStatus && <p className="mt-3 text-sm text-haze">{wearableStatus}</p>}
              <p className="mt-3 text-xs leading-5 text-haze">Aura requests read access only and syncs when you tap the button. A platform can return no readings when your watch app has not shared data to it.</p>
            </Card>
          </section>
          <section>
            <SectionHeading title="App preferences" />
            <Card className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink px-3 py-3"><span className="flex items-center gap-2 text-sm text-haze">{appearance === 'light' ? <Sun className="size-4" /> : <Moon className="size-4" />}Appearance</span><select aria-label="Appearance" value={appearance} onChange={(event) => { const next = event.target.value as Appearance; setAppearance(next); localStorage.setItem(APPEARANCE_KEY, next) }} className="rounded-lg border border-line bg-panel px-2 py-1.5 text-sm text-snow"><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></label>
              <PreferenceValue icon={<Globe2 className="size-4" />} label="Language" value="English" />
            </Card>
          </section>
        </div>

        <section>
          <SectionHeading title="Account management" />
          <Card className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-medium text-snow">Sign out</p><p className="mt-1 text-sm text-haze">End your current Aura session on this device.</p></div><Button type="button" variant="secondary" onClick={() => void handleSignOut()}>Sign out</Button></div>
            <div className="border-t border-line pt-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-medium text-red-300">Delete account and data</p><p className="mt-1 max-w-2xl text-sm leading-6 text-haze">Permanently remove your Aura account and its server data. This cannot be undone. Type DELETE to confirm.</p></div><Trash2 className="size-5 text-red-300" /></div><div className="mt-3 flex flex-wrap gap-3"><input aria-label="Type DELETE to confirm" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder="Type DELETE" className="h-11 rounded-xl border border-line bg-ink px-3 text-sm text-snow outline-none focus:border-red-400" /><Button type="button" variant="secondary" disabled={deletingAccount || deleteConfirmation !== 'DELETE'} onClick={() => void deleteAccount()} className="border-red-400/30 text-red-200 hover:bg-red-400/10">{deletingAccount ? 'Deleting account...' : 'Delete account'}</Button></div></div>
          </Card>
        </section>
      </div>
    </>
  )
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.18em] text-haze">{title}</h2>
}

function PreferenceValue({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink px-3 py-3"><span className="flex items-center gap-2 text-sm text-haze">{icon}{label}</span><span className="text-sm font-medium text-snow">{value}</span></div>
}
