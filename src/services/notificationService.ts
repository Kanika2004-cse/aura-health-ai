import { fireAlert } from '../engine/alerting/alertService';
import type { RiskSeverity } from '../engine/riskEngine/decision';

export async function sendSmartHealthAlert(supabase: any, userId: string, title: string, recommendation: string, severity: string = 'high') {
  try {
    // 1. Save to Supabase so it appears in the In-App Notification Center
    if (supabase && userId) {
      await supabase.from('health_alerts').insert({
        user_id: userId,
        title: title,
        message: recommendation,
        severity: severity,
      });
    }

    // Route through the shared alert path so repeated syncs update the same
    // persistent notification instead of creating another popup each time.
    const alertSeverity: RiskSeverity = severity.toLowerCase() === 'high' ? 'PRIORITY' : 'MONITOR';
    await fireAlert(
      { finalStatus: alertSeverity, rationale: `${recommendation} Tap to view recommendations.` },
      { userId, title, symptomName: 'wearable-sync' },
    );
  } catch (err) {
    console.error('Notification error:', err);
  }
}
