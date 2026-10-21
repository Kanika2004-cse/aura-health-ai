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

const lastAlertStates = new Map<string, RiskSeverity>();
const pendingAlertStates = new Map<string, RiskSeverity>();
const ALERT_STATE_STORAGE_PREFIX = 'aura.health-alert.last-status:';
const HEALTH_NOTIFICATION_ID = 9001;

export function clearAlertDedupState() {
  lastAlertStates.clear();
  pendingAlertStates.clear();
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(ALERT_STATE_STORAGE_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Storage may be unavailable in a web or restricted browser context.
  }
}

export function shouldDispatchAlert(alertKey: string, severity: RiskSeverity): boolean {
  let lastSeverity = lastAlertStates.get(alertKey);
  try {
    const storedSeverity = localStorage.getItem(`${ALERT_STATE_STORAGE_PREFIX}${encodeURIComponent(alertKey)}`);
    if (storedSeverity === 'STABLE' || storedSeverity === 'MONITOR' || storedSeverity === 'PRIORITY') {
      lastSeverity ??= storedSeverity;
    }
  } catch {
    // Fall back to in-memory deduplication if storage is unavailable.
  }

  return lastSeverity !== severity && pendingAlertStates.get(alertKey) !== severity;
}

function rememberAlertState(alertKey: string, severity: RiskSeverity) {
  lastAlertStates.set(alertKey, severity);
  try {
    localStorage.setItem(`${ALERT_STATE_STORAGE_PREFIX}${encodeURIComponent(alertKey)}`, severity);
  } catch {
    // In-memory deduplication still prevents repeated alerts during this app session.
  }
}

export async function processAlert(payload: AlertPayload) {
  // Keep one notification for the user's current health status. A status change
  // may update it; repeated readings with the same status do not alert again.
  const alertKey = payload.userId;

  if (!shouldDispatchAlert(alertKey, payload.severity)) {
    console.log(`Repeated health alert suppressed: ${alertKey}`);
    return { status: 'suppressed', reason: 'Health status has not changed' };
  }

  pendingAlertStates.set(alertKey, payload.severity);
  const isPriority = payload.severity === 'PRIORITY';

  try {
    // Request notification permissions if not already granted.
    try {
      const permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
    } catch (e) {
      console.log('Running on web or notifications unavailable:', e);
    }

    // Schedule Capacitor Local Notification.
    await LocalNotifications.schedule({
      notifications: [
        {
          title: payload.title,
          body: payload.message,
          id: HEALTH_NOTIFICATION_ID,
          schedule: { at: new Date(Date.now() + 100) },
          sound: isPriority ? 'bell_urgent.wav' : undefined,
          autoCancel: false,
          ongoing: false,
          extra: { severity: payload.severity, userId: payload.userId },
        },
      ],
    });
    rememberAlertState(alertKey, payload.severity);
    return { status: 'sent', severity: payload.severity };
  } catch (error) {
    console.error('Failed to schedule local notification:', error);
    return { status: 'failed', severity: payload.severity };
  } finally {
    if (pendingAlertStates.get(alertKey) === payload.severity) {
      pendingAlertStates.delete(alertKey);
    }
  }
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
