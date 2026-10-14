import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { getSupabaseClient } from '../lib/supabase'
import { displayTemperature, getMeasurementSystem } from '../utils/measurementUnits'
import type { Database } from '../types/database'

type Measurement = Database['public']['Tables']['health_measurements']['Row']
type TrendPoint = { day: string; [key: string]: string | number | null }
type Series = { key: string; label: string; color: string; getValue: (measurement: Measurement) => number | null }
type TrendMetric = { title: string; unit: string; series: Series[] }

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function TrendsPage() {
  const { user } = useAuth()
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const measurementSystem = getMeasurementSystem()
  const temperatureUnit = measurementSystem === 'imperial' ? '°F' : '°C'

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
        setError('Your health trends are unavailable right now. Please try again.')
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      const { data, error: queryError } = await supabase
        .from('health_measurements')
        .select('*')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(100)
      if (!active) return
      if (queryError) {
        console.error('Unable to load health trends:', queryError)
        setError('Your health trends could not be loaded. Please try again.')
        setMeasurements([])
      } else {
        setMeasurements(data ?? [])
      }
      setLoading(false)
    }
    void loadMeasurements()
    return () => { active = false }
  }, [user])

  const metrics = useMemo<TrendMetric[]>(() => [
    { title: 'Heart rate', unit: 'bpm', series: [{ key: 'heartRate', label: 'Heart rate', color: '#4CC9A8', getValue: (row) => row.heart_rate_bpm }] },
    { title: 'Blood oxygen', unit: '%', series: [{ key: 'spo2', label: 'SpO₂', color: '#7AA2FF', getValue: (row) => row.spo2_pct }] },
    { title: 'Blood pressure', unit: 'mmHg', series: [
      { key: 'systolic', label: 'Systolic', color: '#D9A441', getValue: (row) => row.systolic_mmhg },
      { key: 'diastolic', label: 'Diastolic', color: '#E35D6A', getValue: (row) => row.diastolic_mmhg },
    ] },
    { title: 'Temperature', unit: temperatureUnit, series: [{ key: 'temperature', label: 'Temperature', color: '#F08B5D', getValue: (row) => row.temperature_c === null ? null : Number(displayTemperature(row.temperature_c, measurementSystem).toFixed(1)) }] },
    { title: 'Steps', unit: 'steps', series: [{ key: 'steps', label: 'Steps', color: '#B391F5', getValue: (row) => row.steps }] },
    { title: 'Sleep duration', unit: 'hours', series: [{ key: 'sleep', label: 'Sleep', color: '#61B7C9', getValue: (row) => row.sleep_minutes === null ? null : Number((row.sleep_minutes / 60).toFixed(1)) }] },
  ], [measurementSystem, temperatureUnit])

  function makeChartData(metric: TrendMetric): TrendPoint[] {
    return measurements
      .filter((measurement) => metric.series.some((series) => series.getValue(measurement) !== null))
      .slice(0, 30)
      .reverse()
      .map((measurement) => ({
        day: formatDate(measurement.recorded_at),
        ...Object.fromEntries(metric.series.map((series) => [series.key, series.getValue(measurement)])),
      }))
  }

  return (
    <>
      <PageHeader eyebrow="Time series" title="Trends" description="Explore changes in all the measurements you have saved." />
      {error && <div role="alert" className="mb-4 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      {loading ? (
        <Card><div className="flex h-48 items-center justify-center text-sm text-haze">Loading your measurements...</div></Card>
      ) : measurements.length === 0 ? (
        <Card><div className="flex h-48 flex-col items-center justify-center gap-2 text-center"><p className="font-medium text-snow">No measurements yet</p><p className="text-sm text-haze">Add health data to see trends for heart rate, blood oxygen, blood pressure, temperature, steps, and sleep.</p></div></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {metrics.map((metric) => {
            const data = makeChartData(metric)
            return (
              <Card key={metric.title}>
                <h2 className="mb-4 font-display text-xl text-snow">{metric.title}</h2>
                {data.length === 0 ? (
                  <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-line text-sm text-haze">No {metric.title.toLowerCase()} measurements recorded yet.</div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="day" stroke="#8d97a8" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis unit={` ${metric.unit}`} stroke="#8d97a8" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ background: '#121821', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16 }} />
                        {metric.series.length > 1 && <Legend />}
                        {metric.series.map((series) => (
                          <Area key={series.key} type="monotone" dataKey={series.key} name={series.label} connectNulls stroke={series.color} fill={series.color} fillOpacity={metric.series.length === 1 ? 0.15 : 0.04} strokeWidth={2.4} />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
