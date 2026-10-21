import { useEffect, useState } from 'react'
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'

import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { getSupabaseClient } from '../lib/supabase'
import { evaluateClinicalTrends10Day, type MeasurementForAnalysis, type ActivityContextForAnalysis } from '../utils/healthAnalysis'

export function InsightsPage() {
  const { user } = useAuth()
  const [measurements, setMeasurements] = useState<MeasurementForAnalysis[]>([])
  const [activities, setActivities] = useState<ActivityContextForAnalysis[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!user) {
        setLoading(false)
        return
      }

      const supabase = getSupabaseClient()
      if (!supabase) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        // Fetch recent measurements
        const { data: measData } = await supabase
          .from('health_measurements')
          .select('id, recorded_at, systolic_mmhg, diastolic_mmhg, heart_rate_bpm, spo2_pct, temperature_c, steps, sleep_minutes')
          .eq('user_id', user.id)
          .order('recorded_at', { ascending: false })
          .limit(50)

        if (measData) setMeasurements(measData as MeasurementForAnalysis[])

        // Fetch recent activities
        const { data: actData } = await (supabase.from('activity_context' as any) as any)
          .select('id, occurred_at, activity_type, intensity')
          .eq('user_id', user.id)
          .order('occurred_at', { ascending: false })
          .limit(50)

        if (actData) setActivities(actData as ActivityContextForAnalysis[])
      } catch (err) {
        console.error('Error loading data for insights:', err)
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [user])

  const clinicalEvaluation = evaluateClinicalTrends10Day(measurements, activities)

  return (
    <>
      <PageHeader
        title="Insights & Clinical Analysis"
        description="AI-powered 10-day rolling baseline intelligence and pattern monitoring."
      />

      <div className="space-y-6">
        {/* 10-Day Sustained Clinical Pattern Card */}
        <Card className={`p-6 border ${
          clinicalEvaluation.status.includes('hypertension') || clinicalEvaluation.status.includes('strain')
            ? 'border-amber-400/40 bg-amber-400/5'
            : 'border-line bg-ink'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`flex size-11 items-center justify-center rounded-2xl font-bold ${
              clinicalEvaluation.status.includes('hypertension') || clinicalEvaluation.status.includes('strain')
                ? 'bg-amber-400/20 text-amber-300'
                : 'bg-pulse/10 text-pulse'
            }`}>
              {clinicalEvaluation.status.includes('hypertension') ? <AlertTriangle className="size-5" /> : <TrendingUp className="size-5" />}
            </div>
            <div>
              <h2 className="font-display text-lg text-snow">{clinicalEvaluation.title}</h2>
              <p className="text-xs text-haze">7-to-10 day rolling baseline intelligence engine</p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-haze">Analyzing health telemetry patterns...</p>
          ) : (
            <p className="text-sm text-snow leading-relaxed">
              {clinicalEvaluation.message}
            </p>
          )}
        </Card>

        {/* Supporting Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5 border border-line bg-ink">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex size-9 items-center justify-center rounded-xl bg-pulse/10 text-pulse">
                <Calendar className="size-4" />
              </div>
              <h3 className="font-display text-sm text-snow">Monitoring Window</h3>
            </div>
            <p className="text-xs text-haze">
              Active tracking window: Last 10 days ({measurements.length} total readings recorded).
            </p>
          </Card>

          <Card className="p-5 border border-line bg-ink">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                <CheckCircle2 className="size-4" />
              </div>
              <h3 className="font-display text-sm text-snow">Differential Gating</h3>
            </div>
            <p className="text-xs text-haze">
              Active: Cross-references physical activity and exercise logs to filter out temporary stress spikes.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}