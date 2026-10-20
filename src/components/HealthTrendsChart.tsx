import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceArea, CartesianGrid } from 'recharts';
import { getSupabaseClient } from '../lib/supabase';

interface VitalRecord {
  timestamp: string;
  value: number;
  label: string;
}

export function HealthTrendsChart() {
  const [data, setData] = useState<VitalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [zScoreBounds, setZScoreBounds] = useState<{ lower: number; upper: number }>({ lower: 90, upper: 120 });

  useEffect(() => {
    fetchExistingTrends();
  }, []);

  const fetchExistingTrends = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: readings, error } = await supabase
      .from('health_measurements')
      .select('recorded_at, heart_rate_bpm')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: true })
      .limit(30) as { data: Array<{ recorded_at: string; heart_rate_bpm: number | null }> | null; error: any };

    if (error) {
      console.error('Error fetching trends:', error);
      setLoading(false);
      return;
    }

    if (readings && readings.length > 0) {
      const validReadings = readings.filter(r => r.heart_rate_bpm !== null) as Array<{ recorded_at: string; heart_rate_bpm: number }>;
      
      if (validReadings.length > 0) {
        // Calculate Mean (μ) and Standard Deviation (σ)
        const values = validReadings.map(r => r.heart_rate_bpm);
        const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance) || 5; // fallback to 5 if standard deviation is 0

        // Define Z-Score threshold upper bound (e.g., Mean + 1.5 * StdDev)
        const upperThreshold = Math.round(mean + (1.5 * stdDev));
        const lowerThreshold = Math.round(Math.max(40, mean - (1.5 * stdDev)));

        setZScoreBounds({ lower: lowerThreshold, upper: upperThreshold });

        const formatted = validReadings.map(r => ({
          timestamp: new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          value: r.heart_rate_bpm,
          label: 'Heart Rate (BPM)'
        }));
        setData(formatted);
      }
    }
    setLoading(false);
  };

  if (loading) return <div className="p-4 text-slate-400">Loading your trends...</div>;
  if (data.length === 0) return <div className="p-4 text-slate-400">No trend data available yet.</div>;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg my-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Biometric Z-Score Trends</h3>
        <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
          Dynamic Baseline Active ($\mu$ & $\sigma$)
        </span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="timestamp" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" domain={[40, 150]} />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
            
            {/* Dynamic Z-Score Warning Band based on user's rolling mean & std dev */}
            <ReferenceArea y1={zScoreBounds.upper} y2={zScoreBounds.upper + 25} fill="#f87171" fillOpacity={0.15} />

            <Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2} dot={{ fill: '#38bdf8' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}