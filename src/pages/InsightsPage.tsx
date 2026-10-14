import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowUpRight, Sparkles } from 'lucide-react'

import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { getSupabaseClient } from '../lib/supabase'
import { buildHealthInsights } from '../services/insights'
import type { MeasurementForAnalysis } from '../utils/healthAnalysis'

export function InsightsPage() {
  const { user } = useAuth()
  const [measurements, setMeasurements] = useState<MeasurementForAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadMeasurements() {
      if (!user) {
        setMeasurements([])
        setLoading(false)
        return
      }

      const supabase = getSupabaseClient()
      if (!supabase) {
        setError('Your insights are unavailable right now. Please try again.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')
      const { data, error: queryError } = await supabase
        .from('health_measurements')
        .select('id, recorded_at, heart_rate_bpm, spo2_pct, systolic_mmhg, diastolic_mmhg, temperature_c, steps, sleep_minutes')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(100)

      if (!active) return
      if (queryError) {
        console.error('Unable to load measurements for insights:', queryError)
        setError('Your measurements could not be loaded. Please try again.')
      } else {
        setMeasurements(data ?? [])
      }
      setLoading(false)
    }

    void loadMeasurements()
    return () => { active = false }
  }, [user])

  const insights = useMemo(() => buildHealthInsights(measurements), [measurements])

  return (
    <>
      <PageHeader
        eyebrow="Personal patterns"
        title="Insights"
        description="Quick summaries of patterns in your saved readings. Open any insight for more detail."
      />

      {error && <div role="alert" className="mb-5 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      {loading ? (
        <Card className="flex items-center gap-3 p-6 text-sm text-haze"><Activity className="size-5 animate-pulse" />Analyzing your saved measurements...</Card>
      ) : measurements.length === 0 ? (
        <Card className="p-7">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-pulse/10 text-pulse"><Sparkles className="size-5" /></div>
          <h2 className="mt-4 font-display text-xl text-snow">Your insights will grow from your data</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-haze">Add a health measurement to start. As you record readings over time, Aura can compare them with your personal history.</p>
          <Link to="/health-data" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-pulse hover:text-snow">Add a measurement <ArrowUpRight className="size-4" /></Link>
        </Card>
      ) : (
        <div className="space-y-5">
          <Card className="border-pulse/20 bg-pulse/[0.04]">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pulse/10 text-pulse"><Sparkles className="size-5" /></div>
              <div>
                <h2 className="font-display text-lg text-snow">Your personal history</h2>
                <p className="mt-1 text-sm leading-6 text-haze">{measurements.length} saved measurement{measurements.length === 1 ? '' : 's'} are included. Comparisons use your available readings from the previous seven days.</p>
              </div>
            </div>
          </Card>

          <section className="grid gap-4 lg:grid-cols-2">
            {insights.map((insight) => (
              <Card key={insight.id} className="h-full">
                <div className="flex items-start gap-3">
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${insight.kind === 'change' ? 'bg-amber-400/10 text-amber-200' : 'bg-pulse/10 text-pulse'}`}>
                    <Activity className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg text-snow">{insight.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-snow">{insight.body}</p>
                  </div>
                </div>
                {insight.details && <details className="mt-4 border-t border-line pt-3 text-sm text-haze">
                  <summary className="w-fit cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-pulse">Why this insight?</summary>
                  <p className="mt-2 leading-6">{insight.details}</p>
                </details>}
                {insight.createdAt && <p className="mt-4 border-t border-line pt-3 text-xs text-haze">Based on readings through {new Date(insight.createdAt).toLocaleString()}</p>}
              </Card>
            ))}
          </section>
        </div>
      )}
    </>
  )
}
