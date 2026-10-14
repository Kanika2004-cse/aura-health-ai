import { useEffect, useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { getSupabaseClient } from '../lib/supabase'
import { displayHeight, displayWeight, getMeasurementSystem, storedHeight, storedWeight } from '../utils/measurementUnits'

export function ProfilePage() {
  const { user } = useAuth()
  const supabase = getSupabaseClient()

  const [displayName, setDisplayName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [biologicalSex, setBiologicalSex] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [timezone, setTimezone] = useState('Asia/Kolkata')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [showSavedToast, setShowSavedToast] = useState(false)
  const savedToastTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (savedToastTimer.current !== null) window.clearTimeout(savedToastTimer.current)
  }, [])

  useEffect(() => {
    async function loadProfile() {
      if (!user || !supabase) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      const { data, error: profileError } = await supabase
        .from('health_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      if (data) {
        const profile = data as {
          display_name: string | null
          date_of_birth: string | null
          biological_sex: string | null
          height_cm: number | null
          weight_kg: number | null
          timezone: string | null
        }
      
        setDisplayName(profile.display_name ?? '')
        setDateOfBirth(profile.date_of_birth ?? '')
        setBiologicalSex(profile.biological_sex ?? '')
        setHeight(profile.height_cm === null ? '' : displayHeight(profile.height_cm).toFixed(1))
        setWeight(profile.weight_kg === null ? '' : displayWeight(profile.weight_kg).toFixed(1))
        setTimezone(profile.timezone ?? 'Asia/Kolkata')
        setSaved(true)
      }
      setLoading(false)
    }

    loadProfile()
  }, [user, supabase])

  async function handleSave() {
    if (!user || !supabase) {
      setError('You must be signed in to save your profile.')
      return
    }

    setError('')
    setSaved(false)
    setSaving(true)

    const { error: saveError } = await supabase
  .from('health_profiles')
  .upsert(
    {
      user_id: user.id,
      display_name: displayName.trim() || null,
      date_of_birth: dateOfBirth || null,
      biological_sex: biologicalSex || null,
      height_cm: height ? storedHeight(Number(height)) : null,
      weight_kg: weight ? storedWeight(Number(weight)) : null,
      timezone: timezone || 'Asia/Kolkata',
    } as any,
    {
      onConflict: 'user_id',
    },
  )

    setSaving(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    setSaved(true)
    setShowSavedToast(true)
    if (savedToastTimer.current !== null) window.clearTimeout(savedToastTimer.current)
    savedToastTimer.current = window.setTimeout(() => setShowSavedToast(false), 1500)
  }

  if (loading) {
    return (
      <>
        <PageHeader
          eyebrow="Identity"
          title="Health profile"
          description="Loading your health profile..."
        />

        <Card>
          <p className="text-sm text-haze">
            Loading profile data...
          </p>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="Identity"
        title="Health profile"
        description="Manage your profile details. Aura does not infer missing information or use this profile to diagnose conditions."
        actions={
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save profile'}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-xl">
              Personal context
            </h2>

            <Badge>
              {saved ? 'Saved' : 'Draft'}
            </Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-haze">
                Display name
              </span>

              <input
                type="text"
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value)
                  setSaved(false)
                }}
                placeholder="Alex Morgan"
                className="mt-2 h-12 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-snow outline-none transition focus:border-pulse"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-haze">
                Date of birth
              </span>

              <input
                type="date"
                value={dateOfBirth}
                onChange={(event) => {
                  setDateOfBirth(event.target.value)
                  setSaved(false)
                }}
                className="mt-2 h-12 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-snow outline-none transition focus:border-pulse"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-haze">
                Biological sex
              </span>

              <select
                value={biologicalSex}
                onChange={(event) => {
                  setBiologicalSex(event.target.value)
                  setSaved(false)
                }}
                className="mt-2 h-12 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-snow outline-none transition focus:border-pulse"
              >
                <option value="">Select</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="intersex">Intersex</option>
                <option value="prefer_not_to_say">
                  Prefer not to say
                </option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-haze">
                Height ({getMeasurementSystem() === 'imperial' ? 'ft + in' : 'cm'})
              </span>

              {getMeasurementSystem() === 'imperial' ? (
                <div className="mt-2 flex gap-2">
                  <input aria-label="Height in feet" type="number" min="0" max="8" value={height === '' ? '' : Math.floor(Number(height) / 12)} onChange={(event) => { const feet = Number(event.target.value) || 0; const inches = height === '' ? 0 : Number(height) % 12; setHeight(event.target.value === '' && inches === 0 ? '' : String(feet * 12 + inches)); setSaved(false) }} placeholder="ft" className="h-12 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-snow outline-none transition focus:border-pulse" />
                  <input aria-label="Height in inches" type="number" min="0" max="11.9" step="0.1" value={height === '' ? '' : Number((Number(height) % 12).toFixed(1))} onChange={(event) => { const feet = height === '' ? 0 : Math.floor(Number(height) / 12); const inches = Number(event.target.value) || 0; setHeight(event.target.value === '' && feet === 0 ? '' : String(feet * 12 + inches)); setSaved(false) }} placeholder="in" className="h-12 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-snow outline-none transition focus:border-pulse" />
                </div>
              ) : (
                <input type="number" min="50" max="250" value={height} onChange={(event) => { setHeight(event.target.value); setSaved(false) }} placeholder="165" className="mt-2 h-12 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-snow outline-none transition focus:border-pulse" />
              )}
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-haze">
                Weight ({getMeasurementSystem() === 'imperial' ? 'lb' : 'kg'})
              </span>

              <input
                type="number"
                min={getMeasurementSystem() === 'imperial' ? '44' : '20'}
                max={getMeasurementSystem() === 'imperial' ? '661' : '300'}
                step="0.1"
                value={weight}
                onChange={(event) => {
                  setWeight(event.target.value)
                  setSaved(false)
                }}
                placeholder={getMeasurementSystem() === 'imperial' ? '137' : '62'}
                className="mt-2 h-12 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-snow outline-none transition focus:border-pulse"
              />
            </label>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-haze">
                Timezone
              </span>

              <select
                value={timezone}
                onChange={(event) => {
                  setTimezone(event.target.value)
                  setSaved(false)
                }}
                className="mt-2 h-12 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-snow outline-none transition focus:border-pulse"
              >
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="Asia/Dubai">Asia/Dubai</option>
                <option value="Asia/Singapore">Asia/Singapore</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">
                  America/New_York
                </option>
                <option value="America/Los_Angeles">
                  America/Los_Angeles
                </option>
              </select>
            </label>
          </div>

          {error && (
            <p className="mt-5 rounded-2xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-snow">
              {error}
            </p>
          )}

          {showSavedToast && !error && (
            <p role="status" className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
              <CheckCircle2 className="size-4" /> Profile saved successfully.
            </p>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-xl">
            About your profile
          </h2>

          <p className="mt-3 text-sm leading-6 text-haze">
            The details here are provided by you and are kept separate from
            your recorded health measurements.
          </p>
        </Card>
      </div>
    </>
  )
}
