import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Database } from '../../types/database'
import { Card } from '../ui/Card'

type Measurement = Database['public']['Tables']['health_measurements']['Row']

export function BaselineChart({ measurements }: { measurements: Measurement[] }) {
  const data = measurements
    .filter((measurement) => measurement.heart_rate_bpm !== null)
    .slice(0, 14)
    .reverse()
    .map((measurement) => ({
      date: new Date(measurement.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      heartRate: measurement.heart_rate_bpm,
    }))

  return (
    <Card className="min-h-[320px]">
      <div className="mb-5">
        <h3 className="font-display text-xl text-snow">Heart rate history</h3>
        <p className="mt-1 text-sm text-haze">From your saved measurements.</p>
      </div>
      {data.length === 0 ? (
        <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-line text-sm text-haze">
          No heart rate measurements recorded yet.
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="date" stroke="#8d97a8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis unit=" bpm" stroke="#8d97a8" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#121821', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, color: '#f3f6f8' }} />
              <Line type="monotone" dataKey="heartRate" name="Heart rate" stroke="#4CC9A8" strokeWidth={2.4} dot={{ r: 4, fill: '#4CC9A8' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
