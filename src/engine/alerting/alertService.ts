import { LocalNotifications } from '@capacitor/local-notifications';
import type { RiskSeverity } from '../riskEngine/decision';

export interface AlertPayload {
  userId: string;
  severity: RiskSeverity;
  title: string;
  message: string;
  symptomName?: string;
}

export type FireAlertOptions = {
  userId: string;
  title?: string;
  symptomName?: string;
};

const lastAlertTimestamps: Record<string, number> = {};
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown

export function clearAlertDedupState() {
  Object.keys(lastAlertTimestamps).forEach(key => delete lastAlertTimestamps[key]);
}

export function shouldDispatchAlert(alertKey: string): boolean {
  const now = Date.now();
  const lastTriggered = lastAlertTimestamps[alertKey] || 0;

  if (now - lastTriggered < COOLDOWN_MS) {
    return false;
  }

  lastAlertTimestamps[alertKey] = now;
  return true;
}

export async function processAlert(payload: AlertPayload) {
  const alertKey = `${payload.userId}-${payload.severity}-${payload.symptomName || 'general'}`;

  if (payload.severity !== 'PRIORITY' && !shouldDispatchAlert(alertKey)) {
    console.log(`Alert suppressed due to 1-hour cooldown: ${alertKey}`);
    return { status: 'suppressed', reason: 'Cooldown active' };
  }

  const isPriority = payload.severity === 'PRIORITY';

  // Request notification permissions if not already granted
  try {
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
  } catch (e) {
    console.log('Running on web or notifications unavailable:', e);
  }

  // Schedule Capacitor Local Notification
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          title: payload.title,
          body: payload.message,
          id: Math.floor(Date.now() / 1000),
          schedule: { at: new Date(Date.now() + 100) },
          sound: isPriority ? 'bell_urgent.wav' : undefined,
          extra: { severity: payload.severity, userId: payload.userId },
        },
      ],
    });
  } catch (error) {
    console.error('Failed to schedule local notification:', error);
  }

  return { status: 'sent', severity: payload.severity };
}

export async function fireAlert(
  verdictOrSeverity: { finalStatus: RiskSeverity; rationale: string } | RiskSeverity,
  options?: FireAlertOptions
) {
  const severity = typeof verdictOrSeverity === 'string' ? verdictOrSeverity : verdictOrSeverity.finalStatus;
  const message = typeof verdictOrSeverity === 'string' ? 'Health status updated.' : verdictOrSeverity.rationale;
  const title = options?.title || (severity === 'PRIORITY' ? 'Critical Health Alert' : 'Health Monitoring Notice');
  const userId = options?.userId || 'default-user';

  return await processAlert({
    userId,
    severity,
    title,
    message,
    symptomName: options?.symptomName,
  });
}