/**
 * engine/alerting/types.ts
 *
 * Type definitions for the alert service layer.
 */

import type { RiskVerdict } from '../riskEngine/types'

// ---------------------------------------------------------------------------
// Alert severity
// ---------------------------------------------------------------------------

/**
 * Maps to notification UX priority:
 *   info     → STABLE confirmation or first-reading acknowledgment
 *   warning  → MONITOR — informational, no immediate action needed
 *   critical → PRIORITY — prominent alert with action CTA
 */
export type AlertSeverity = 'info' | 'warning' | 'critical'

// ---------------------------------------------------------------------------
// Alert channels
// ---------------------------------------------------------------------------

/**
 * The channel through which an alert is delivered.
 *   local_notification  — Capacitor LocalNotification (native iOS/Android)
 *   web_notification    — browser Notification API
 *   in_app              — in-app toast / banner (future)
 */
export type AlertChannel = 'local_notification' | 'web_notification' | 'in_app'

// ---------------------------------------------------------------------------
// Alert payload
// ---------------------------------------------------------------------------

export type AlertPayload = {
  /** Stable unique ID for deduplication; derived from verdict + day. */
  id: string

  severity: AlertSeverity

  /** Short title for notification banners. */
  title: string

  /** Body text shown in the notification / toast. */
  body: string

  /**
   * In-app route to navigate to when the user taps the notification.
   * Undefined means no action link.
   */
  actionRoute?: string

  /** The full verdict that produced this alert. */
  verdict: RiskVerdict

  /** ISO-8601 timestamp when the alert was composed. */
  firedAt: string
}

// ---------------------------------------------------------------------------
// Deduplication state (stored in localStorage)
// ---------------------------------------------------------------------------

export type AlertDedupState = {
  lastFiredAt: string     // ISO-8601
  lastStatus: string      // 'STABLE' | 'MONITOR' | 'PRIORITY'
}
