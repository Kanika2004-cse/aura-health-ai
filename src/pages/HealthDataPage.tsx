import { useEffect, useRef, useState, type FormEvent } from 'react'

import {
  CheckCircle2,
  History,
  Save,
} from 'lucide-react'

import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { getSupabaseClient } from '../lib/supabase'
import { displayTemperature, getMeasurementSystem, storedTemperature } from '../utils/measurementUnits'
import { notifyHealthUpdate } from '../services/healthNotifications'

type FormState = {
  recordedAt: string
  heartRate: string
  spo2: string
  systolic: string
  diastolic: string
  temperature: string
  steps: string
  sleepMinutes: string
  activity: string
  duration: string
  intensity: string
  symptom: string
  symptomSeverity: string
  symptomNotes: string
  notes: string
}

type RecentMeasurement = {
  id: string
  recorded_at: string
  source: string
  heart_rate_bpm: number | null
  resting_heart_rate_bpm: number | null
  spo2_pct: number | null
  systolic_mmhg: number | null
  diastolic_mmhg: number | null
  temperature_c: number | null
  steps: number | null
  sleep_minutes: number | null
  notes: string | null
}

const initialForm: FormState = {
  recordedAt: '',
  heartRate: '',
  spo2: '',
  systolic: '',
  diastolic: '',
  temperature: '',
  steps: '',
  sleepMinutes: '',
  activity: '',
  duration: '',
  intensity: '',
  symptom: 'No unusual symptoms',
  symptomSeverity: '',
  symptomNotes: '',
  notes: '',
}

function toNumber(value: string) {
  if (value.trim() === '') return null

  const number = Number(value)

  return Number.isFinite(number) ? number : null
}

export function HealthDataPage() {
  const { user } = useAuth()
  const measurementSystem = getMeasurementSystem()

  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    recordedAt: new Date().toISOString().slice(0, 16),
  }))

  const [recentMeasurements, setRecentMeasurements] = useState<
    RecentMeasurement[]
  >([])

  const [loadingHistory, setLoadingHistory] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedToastTimer = useRef<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => () => {
    if (savedToastTimer.current !== null) window.clearTimeout(savedToastTimer.current)
  }, [])

  useEffect(() => {
    async function loadRecentMeasurements() {
      if (!user) {
        setRecentMeasurements([])
        setLoadingHistory(false)
        return
      }

      const supabase = getSupabaseClient()

      if (!supabase) {
        setLoadingHistory(false)
        return
      }

      setLoadingHistory(true)

      try {
        const { data, error } = await supabase
          .from('health_measurements')
          .select(
            `
              id,
              recorded_at,
              source,
              heart_rate_bpm,
              resting_heart_rate_bpm,
              spo2_pct,
              systolic_mmhg,
              diastolic_mmhg,
              temperature_c,
              steps,
              sleep_minutes,
              notes
            `,
          )
          .eq('user_id', user.id)
          .order('recorded_at', { ascending: false })
          .limit(20)

        if (error) throw error

        setRecentMeasurements(
          (data ?? []) as RecentMeasurement[],
        )
      } catch (historyError) {
        console.error(
          'Unable to load health history:',
          historyError,
        )
      } finally {
        setLoadingHistory(false)
      }
    }

    void loadRecentMeasurements()
  }, [user])

  function updateField(
    field: keyof FormState,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))

    setSaved(false)
    setError('')
  }

  function validate() {
    const heartRate = toNumber(form.heartRate)
    const spo2 = toNumber(form.spo2)
    const systolic = toNumber(form.systolic)
    const diastolic = toNumber(form.diastolic)
    const enteredTemperature = toNumber(form.temperature)
    const temperature = enteredTemperature === null ? null : storedTemperature(enteredTemperature, measurementSystem)
    const steps = toNumber(form.steps)
    const sleepMinutes = toNumber(form.sleepMinutes)
    const duration = toNumber(form.duration)

    const hasMeasurement =
      heartRate !== null ||
      spo2 !== null ||
      systolic !== null ||
      diastolic !== null ||
      temperature !== null ||
      steps !== null ||
      sleepMinutes !== null

    if (!hasMeasurement) {
      return 'Enter at least one health measurement.'
    }

    if (!form.recordedAt) {
      return 'Please select a date and time.'
    }

    if (
      heartRate !== null &&
      (heartRate < 20 || heartRate > 250)
    ) {
      return 'Heart rate must be between 20 and 250 BPM.'
    }

    if (
      spo2 !== null &&
      (spo2 < 50 || spo2 > 100)
    ) {
      return 'SpO₂ must be between 50% and 100%.'
    }

    if (
      systolic !== null &&
      (systolic < 60 || systolic > 260)
    ) {
      return 'Systolic blood pressure must be between 60 and 260 mmHg.'
    }

    if (
      diastolic !== null &&
      (diastolic < 30 || diastolic > 160)
    ) {
      return 'Diastolic blood pressure must be between 30 and 160 mmHg.'
    }

    if (
      systolic !== null &&
      diastolic !== null &&
      diastolic >= systolic
    ) {
      return 'Diastolic blood pressure must be lower than systolic pressure.'
    }

    if (
      temperature !== null &&
      (temperature < 25 || temperature > 45)
    ) {
      return 'Temperature must be between 25°C and 45°C.'
    }

    if (
      steps !== null &&
      (steps < 0 || steps > 200000)
    ) {
      return 'Steps must be between 0 and 200,000.'
    }

    if (
      sleepMinutes !== null &&
      (sleepMinutes < 0 || sleepMinutes > 1440)
    ) {
      return 'Sleep duration must be between 0 and 1,440 minutes.'
    }

    if (form.activity && duration === null) {
      return 'Please enter the activity duration.'
    }

    if (
      duration !== null &&
      (duration <= 0 || duration > 1440)
    ) {
      return 'Activity duration must be between 1 and 1,440 minutes.'
    }

    if (form.symptom !== 'No unusual symptoms') {
      const severity = toNumber(form.symptomSeverity)

      if (
        severity === null ||
        severity < 1 ||
        severity > 5
      ) {
        return 'Please select a symptom severity from 1 to 5.'
      }
    }

    return ''
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setSaved(false)
    setError('')

    const validationError = validate()

    if (validationError) {
      setError(validationError)
      return
    }

    if (!user) {
      setError('You must be signed in to save health data.')
      return
    }

    const supabase = getSupabaseClient()

    if (!supabase) {
      setError('Your health data cannot be saved right now. Please try again.')
      return
    }

    setSaving(true)

    try {
      const recordedAt = new Date(form.recordedAt)

      if (Number.isNaN(recordedAt.getTime())) {
        setError('The selected date and time is invalid.')
        return
      }

      // --------------------------------------------------
      // Save health measurement
      // --------------------------------------------------

      const { error: measurementError } = await supabase
        .from('health_measurements')
        .insert({
          user_id: user.id,
          recorded_at: recordedAt.toISOString(),
          source: 'manual',
          heart_rate_bpm: toNumber(form.heartRate),
          spo2_pct: toNumber(form.spo2),
          systolic_mmhg: toNumber(form.systolic),
          diastolic_mmhg: toNumber(form.diastolic),
          temperature_c: form.temperature.trim() === '' ? null : storedTemperature(Number(form.temperature), measurementSystem),
          steps: toNumber(form.steps),
          sleep_minutes: toNumber(form.sleepMinutes),
          notes: form.notes.trim() || null,
        } as any)

      if (measurementError) {
        throw measurementError
      }

      // --------------------------------------------------
      // Save activity context
      //
      // Activity remains duration-based.
      // The current database uses occurred_at.
      // We intentionally keep this simple for Phase 1.
      // --------------------------------------------------

      if (form.activity) {
        const activityPayload = {
          user_id: user.id,
          activity_type: form.activity,
          duration_minutes: toNumber(form.duration),
          intensity: form.intensity || null,
          notes: null,
        }
        const { error: activityError } = await supabase
          .from('activity_context')
          .insert({
            ...activityPayload,
            occurred_at: recordedAt.toISOString(),
          } as any)

        if (activityError?.message.toLowerCase().includes('occurred_at')) {
          const { error: legacyActivityError } = await supabase
            .from('activity_context')
            .insert({
              ...activityPayload,
              activity_date: recordedAt.toISOString().slice(0, 10),
            } as any)

          if (legacyActivityError) throw legacyActivityError
        } else if (activityError) {
          throw activityError
        }
      }

      // --------------------------------------------------
      // Save symptom
      // --------------------------------------------------

      if (form.symptom !== 'No unusual symptoms') {
        const { error: symptomError } = await supabase
          .from('symptoms')
          .insert({
            user_id: user.id,
            occurred_at: recordedAt.toISOString(),
            name: form.symptom,
            severity: toNumber(form.symptomSeverity),
            notes: form.symptomNotes.trim() || null,
          } as any)

        if (symptomError) {
          throw symptomError
        }
      }

      // --------------------------------------------------
      // Refresh health memory
      // --------------------------------------------------

      const { data: latestMeasurements } = await supabase
        .from('health_measurements')
        .select(
          `
            id,
            recorded_at,
            source,
            heart_rate_bpm,
            resting_heart_rate_bpm,
            spo2_pct,
            systolic_mmhg,
            diastolic_mmhg,
            temperature_c,
            steps,
            sleep_minutes,
            notes
          `,
        )
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(20)

      setRecentMeasurements(
        (latestMeasurements ?? []) as RecentMeasurement[],
      )

      if (user.user_metadata?.aura_notifications_enabled !== false && latestMeasurements?.length) {
        void notifyHealthUpdate(latestMeasurements as any).catch((notificationError) => console.warn('Health notification could not be shown:', notificationError))
      }

      setSaved(true)

      setForm({
        ...initialForm,
        recordedAt: new Date().toISOString().slice(0, 16),
      })

      if (savedToastTimer.current !== null) window.clearTimeout(savedToastTimer.current)
      savedToastTimer.current = window.setTimeout(() => setSaved(false), 1500)
    } catch (saveError) {
      console.error(
        'Unable to save health data:',
        saveError,
      )

      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save the health reading.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Health data"
        description="Record your health measurements, symptoms, and activity."
      />

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {/* --------------------------------------------------
            Measurements
        -------------------------------------------------- */}

        <Card>
          <div className="mb-5">
            <h2 className="font-display text-xl text-snow">
              Measurements
            </h2>

            <p className="mt-1 text-sm text-haze">
              Enter whatever measurements you have. You do not need
              to fill every field.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Heart rate"
              unit="BPM"
              type="number"
              value={form.heartRate}
              onChange={(value) =>
                updateField('heartRate', value)
              }
              placeholder="e.g. 72"
              min="20"
              max="250"
            />

            <Field
              label="SpO₂"
              unit="%"
              type="number"
              value={form.spo2}
              onChange={(value) =>
                updateField('spo2', value)
              }
              placeholder="e.g. 98"
              min="50"
              max="100"
            />

            <Field
              label="Systolic blood pressure"
              unit="mmHg"
              type="number"
              value={form.systolic}
              onChange={(value) =>
                updateField('systolic', value)
              }
              placeholder="e.g. 120"
              min="60"
              max="260"
            />

            <Field
              label="Diastolic blood pressure"
              unit="mmHg"
              type="number"
              value={form.diastolic}
              onChange={(value) =>
                updateField('diastolic', value)
              }
              placeholder="e.g. 80"
              min="30"
              max="160"
            />

            <Field
              label="Temperature"
              unit={measurementSystem === 'imperial' ? '°F' : '°C'}
              type="number"
              step="0.1"
              value={form.temperature}
              onChange={(value) =>
                updateField('temperature', value)
              }
              placeholder={measurementSystem === 'imperial' ? 'e.g. 98.1' : 'e.g. 36.7'}
              min={measurementSystem === 'imperial' ? '77' : '25'}
              max={measurementSystem === 'imperial' ? '113' : '45'}
            />

            <Field
              label="Steps"
              unit="steps"
              type="number"
              value={form.steps}
              onChange={(value) =>
                updateField('steps', value)
              }
              placeholder="e.g. 4500"
              min="0"
              max="200000"
            />

            <Field
              label="Sleep duration"
              unit="minutes"
              type="number"
              value={form.sleepMinutes}
              onChange={(value) =>
                updateField('sleepMinutes', value)
              }
              placeholder="e.g. 420"
              min="0"
              max="1440"
            />

            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-haze">
                  Recorded at
                </span>

                <input
                  type="datetime-local"
                  value={form.recordedAt}
                  onChange={(event) =>
                    updateField(
                      'recordedAt',
                      event.target.value,
                    )
                  }
                  className="mt-2 h-12 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-snow outline-none transition focus:border-pulse"
                />
              </label>
            </div>
          </div>
        </Card>

        {/* --------------------------------------------------
            Activity
        -------------------------------------------------- */}

        <Card>
          <div className="mb-5">
            <h2 className="font-display text-xl text-snow">
              Activity context
            </h2>

            <p className="mt-1 text-sm text-haze">
              Log activity duration so Aura can understand the
              conditions around your measurements.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField
              label="What were you doing?"
              value={form.activity}
              onChange={(value) =>
                updateField('activity', value)
              }
              options={[
                ['', 'Select activity'],
                ['Resting', 'Resting'],
                ['Walking', 'Walking'],
                ['Exercise', 'Exercise'],
                ['Recovery', 'Recovery'],
                ['Sleeping', 'Sleeping'],
                ['Other', 'Other'],
              ]}
            />

            <Field
              label="Duration"
              unit="minutes"
              type="number"
              value={form.duration}
              onChange={(value) =>
                updateField('duration', value)
              }
              placeholder="e.g. 30"
              min="1"
              max="1440"
            />

            <SelectField
              label="Intensity"
              value={form.intensity}
              onChange={(value) =>
                updateField('intensity', value)
              }
              options={[
                ['', 'Select intensity'],
                ['Low', 'Low'],
                ['Moderate', 'Moderate'],
                ['High', 'High'],
              ]}
            />
          </div>
        </Card>

        {/* --------------------------------------------------
            Symptoms
        -------------------------------------------------- */}

        <Card>
          <div className="mb-5">
            <h2 className="font-display text-xl text-snow">
              Symptoms
            </h2>

            <p className="mt-1 text-sm text-haze">
              Optional. Aura shows symptoms alongside readings recorded at a similar time.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Symptom"
              value={form.symptom}
              onChange={(value) =>
                updateField('symptom', value)
              }
              options={[
                [
                  'No unusual symptoms',
                  'No unusual symptoms',
                ],
                ['Dizziness', 'Dizziness'],
                [
                  'Shortness of breath',
                  'Shortness of breath',
                ],
                ['Chest discomfort', 'Chest discomfort'],
                ['Weakness', 'Weakness'],
                ['Other', 'Other'],
              ]}
            />

            {form.symptom !== 'No unusual symptoms' && (
              <>
                <SelectField
                  label="Severity"
                  value={form.symptomSeverity}
                  onChange={(value) =>
                    updateField(
                      'symptomSeverity',
                      value,
                    )
                  }
                  options={[
                    ['', 'Select severity'],
                    ['1', '1 — Mild'],
                    ['2', '2 — Mild to moderate'],
                    ['3', '3 — Moderate'],
                    ['4', '4 — Significant'],
                    ['5', '5 — Severe'],
                  ]}
                />

                <div className="sm:col-span-2">
                  <TextAreaField
                    label="Symptom notes"
                    value={form.symptomNotes}
                    onChange={(value) =>
                      updateField(
                        'symptomNotes',
                        value,
                      )
                    }
                    placeholder="Describe what you experienced..."
                  />
                </div>
              </>
            )}
          </div>
        </Card>

        {/* --------------------------------------------------
            Additional notes
        -------------------------------------------------- */}

        <Card>
          <TextAreaField
            label="Additional notes"
            value={form.notes}
            onChange={(value) =>
              updateField('notes', value)
            }
            placeholder="Optional notes about this reading..."
          />
        </Card>

        {/* --------------------------------------------------
            Status
        -------------------------------------------------- */}

        {error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {saved && (
          <div role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            <CheckCircle2 className="size-4" />
            Health reading saved successfully.
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={saving}
          >
            <Save className="mr-2 size-4" />

            {saving
              ? 'Saving...'
              : 'Save health reading'}
          </Button>
        </div>
      </form>

      {/* --------------------------------------------------
          Health Memory
      -------------------------------------------------- */}

      <div className="mt-8">
        <Card>
          <div className="mb-5 flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-pulse/10 text-pulse">
              <History className="size-5" />
            </div>

            <div>
              <h2 className="font-display text-xl text-snow">
                Recent measurements
              </h2>

              <p className="mt-1 text-sm text-haze">
                Aura keeps your previous readings so analysis can
                understand your personal pattern over time.
              </p>
            </div>
          </div>

          {loadingHistory ? (
            <div className="rounded-2xl border border-line bg-ink px-4 py-6 text-center text-sm text-haze">
              Loading your health history...
            </div>
          ) : recentMeasurements.length === 0 ? (
            <div className="rounded-2xl border border-line bg-ink px-4 py-6 text-center text-sm text-haze">
              No previous measurements yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recentMeasurements.map((measurement) => (
                <div
                  key={measurement.id}
                  className="rounded-2xl border border-line bg-ink p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-snow">
                      {new Date(
                        measurement.recorded_at,
                      ).toLocaleString()}
                    </span>

                    <span className="text-xs text-haze">
                      {measurement.source === 'manual' ? 'Manual entry' : measurement.source === 'healthkit' ? 'Apple Health' : measurement.source === 'health_connect' ? 'Health Connect' : 'Imported reading'}
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {measurement.heart_rate_bpm !== null && (
                      <HistoryMetric
                        label="Heart rate"
                        value={`${measurement.heart_rate_bpm} BPM`}
                      />
                    )}

                    {measurement.resting_heart_rate_bpm !== null && (
                      <HistoryMetric
                        label="Resting heart rate"
                        value={`${measurement.resting_heart_rate_bpm} BPM`}
                      />
                    )}

                    {measurement.spo2_pct !== null && (
                      <HistoryMetric
                        label="SpO₂"
                        value={`${measurement.spo2_pct}%`}
                      />
                    )}

                    {measurement.systolic_mmhg !== null &&
                      measurement.diastolic_mmhg !== null && (
                        <HistoryMetric
                          label="Blood pressure"
                          value={`${measurement.systolic_mmhg}/${measurement.diastolic_mmhg} mmHg`}
                        />
                      )}

                    {measurement.temperature_c !== null && (
                      <HistoryMetric
                        label="Temperature"
                        value={`${displayTemperature(measurement.temperature_c, measurementSystem).toFixed(1)}°${measurementSystem === 'imperial' ? 'F' : 'C'}`}
                      />
                    )}

                    {measurement.steps !== null && (
                      <HistoryMetric
                        label="Steps"
                        value={measurement.steps.toLocaleString()}
                      />
                    )}

                    {measurement.sleep_minutes !== null && (
                      <HistoryMetric
                        label="Sleep"
                        value={`${measurement.sleep_minutes} min`}
                      />
                    )}
                  </div>

                  {measurement.notes && (
                    <p className="mt-3 border-t border-line pt-3 text-sm text-haze">
                      {measurement.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}

function HistoryMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-line/70 bg-void/40 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-haze">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-snow">
        {value}
      </p>
    </div>
  )
}

function Field({
  label,
  unit,
  type = 'text',
  step,
  value,
  onChange,
  placeholder,
  min,
  max,
}: {
  label: string
  unit?: string
  type?: string
  step?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  min?: string
  max?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-haze">
        {label}
      </span>

      <div className="relative mt-2">
        <input
          type={type}
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder={placeholder}
          className="h-12 w-full rounded-2xl border border-line bg-ink px-4 pr-20 text-sm text-snow outline-none transition placeholder:text-haze/60 focus:border-pulse"
        />

        {unit && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-haze">
            {unit}
          </span>
        )}
      </div>
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: [string, string][]
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-haze">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-2 h-12 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-snow outline-none transition focus:border-pulse"
      >
        {options.map(
          ([optionValue, optionLabel]) => (
            <option
              key={optionValue}
              value={optionValue}
            >
              {optionLabel}
            </option>
          ),
        )}
      </select>
    </label>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-haze">
        {label}
      </span>

      <textarea
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        rows={4}
        className="mt-2 w-full resize-none rounded-2xl border border-line bg-ink px-4 py-3 text-sm text-snow outline-none transition placeholder:text-haze/60 focus:border-pulse"
      />
    </label>
  )
}
