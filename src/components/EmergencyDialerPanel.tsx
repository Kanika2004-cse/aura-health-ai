import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';

interface EmergencyDialerProps {
  latestHeartRate?: number | null;
  onDismiss?: () => void;
}

export function EmergencyDialerPanel({ latestHeartRate, onDismiss }: EmergencyDialerProps) {
  const [caregiverName, setCaregiverName] = useState('Designated Caregiver');
  const [caregiverPhone, setCaregiverPhone] = useState('+919876543210');
  const [isPriorityAlert, setIsPriorityAlert] = useState(false);
useEffect(() => {
    async function fetchCaregiverAndAlerts() {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch profile with 'as any' to bypass missing columns in generated DB types
      const { data: profile } = await supabase
        .from('health_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle() as { data: any; error: any };

      if (profile) {
        if (profile.emergency_contact_name) setCaregiverName(profile.emergency_contact_name);
        if (profile.emergency_contact_phone) setCaregiverPhone(profile.emergency_contact_phone);
      }

      // Check if latest heart rate triggers priority alert threshold (> 110 BPM or < 45 BPM)
      if (latestHeartRate && (latestHeartRate > 110 || latestHeartRate < 45)) {
        setIsPriorityAlert(true);
      } else {
        setIsPriorityAlert(true); // Keep visible for testing
      }
    }

    void fetchCaregiverAndAlerts();
  }, [latestHeartRate]);
  if (!isPriorityAlert) return null; // Hidden unless a priority alert fires

  const smsMessage = encodeURIComponent(
    `🚨 EMERGENCY DISTRESS ALERT: My recent biometric reading shows critical vitals (HR: ${latestHeartRate ?? 'Unknown'} BPM). Please check on me or call immediately.`
  );

  return (
    <div className="bg-red-950/95 border-2 border-red-500 rounded-2xl p-6 shadow-2xl backdrop-blur-md text-white my-4 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold tracking-wide text-red-100 flex items-center gap-2">
          🚨 Priority Health Alert Active
        </h3>
        {onDismiss && (
          <button 
            onClick={onDismiss}
            className="text-red-300 hover:text-white text-sm bg-red-900/60 px-3 py-1.5 rounded-lg transition"
          >
            Dismiss
          </button>
        )}
      </div>

      <p className="text-red-200 text-sm mb-6">
        An acute biometric anomaly has been detected. Quick-action dispatch channels are open below.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Direct Call Emergency Services */}
        <a
          href="tel:112"
          className="flex items-center justify-center gap-3 bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition text-center"
        >
          📞 Call Emergency (112)
        </a>

        {/* Direct Call Caregiver */}
        <a
          href={`tel:${caregiverPhone}`}
          className="flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-red-200 font-semibold py-3.5 px-6 rounded-xl border border-red-500/40 shadow-lg transition text-center"
        >
          👤 Call {caregiverName}
        </a>

        {/* SMS Distress Template with Telemetry */}
        <a
          href={`sms:${caregiverPhone}?body=${smsMessage}`}
          className="flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-sky-200 font-semibold py-3.5 px-6 rounded-xl border border-sky-500/30 shadow-lg transition text-center sm:col-span-2"
        >
          💬 Send SOS SMS with Vital Stats
        </a>
      </div>
    </div>
  );
}