import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';

export function ActiveAlertBanner() {
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    async function analyzeVitals() {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch recent measurements for trend analysis
      const { data: readings } = await supabase
        .from('health_measurements')
        .select('*')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(5) as { data: Array<any> | null; error: any };

      if (!readings || readings.length === 0) return;

      const latest = readings[0];
      const detectedAlerts: string[] = [];

      // 1. Oxygen Saturation Check (Sustained or critical single point)
      if (latest.spo2_pct && latest.spo2_pct < 94) {
        detectedAlerts.push(`Low Oxygen Saturation (${latest.spo2_pct}%).`);
      }

      // 2. Blood Pressure Check (Systolic >= 130 or Diastolic >= 85)
      if (latest.systolic_mmhg && latest.systolic_mmhg >= 130) {
        detectedAlerts.push(`Elevated Blood Pressure (${latest.systolic_mmhg}/${latest.diastolic_mmhg ?? '--'} mmHg).`);
      }

      // 3. Temperature Check (> 37.5°C / 99.5°F)
      if (latest.temperature_c && latest.temperature_c > 37.5) {
        detectedAlerts.push(`Elevated Temperature (${latest.temperature_c}°C).`);
      }

      // 4. Heart Rate Check
      if (latest.heart_rate_bpm && (latest.heart_rate_bpm > 110 || latest.heart_rate_bpm < 45)) {
        detectedAlerts.push(`Abnormal Heart Rate (${latest.heart_rate_bpm} BPM).`);
      }

      setAlerts(detectedAlerts);

      // Trigger Browser/Device Notification if critical alerts exist
      if (detectedAlerts.length > 0 && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('⚠️ Aura Health Alert', {
            body: `Multiple concerns detected: ${detectedAlerts.join(' ')}`,
            icon: '/favicon.ico'
          });
        } else if (Notification.permission !== 'denied') {
          void Notification.requestPermission();
        }
      }
    }

    void analyzeVitals();
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="bg-red-950/80 border border-red-500/40 rounded-2xl p-4 text-red-200 shadow-xl backdrop-blur-md my-2 space-y-2">
      <div className="font-bold text-sm flex items-center gap-2">
        <span>🚨 Clinical Decision Support: Multiple Indicators Require Attention</span>
      </div>
      <ul className="list-disc list-inside text-xs space-y-1 text-red-100">
        {alerts.map((alert, index) => (
          <li key={index}>{alert}</li>
        ))}
      </ul>
    </div>
  );
}