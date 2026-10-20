/**
 * engine/riskEngine/symptomCorrelator.ts
 *
 * Maps manually-logged acute symptoms (from the `symptoms` Supabase table or
 * the nearbySymptoms[] array produced by personalAnomalyModel.ts) to a
 * SymptomEscalation floor that prevents the risk engine from falsely
 * classifying a session as STABLE when the user has reported acute symptoms.
 *
 * Escalation logic (applied in multiModalEvaluator.ts):
 *
 *   HIGH symptoms (shortness of breath, chest discomfort):
 *     • If any biometric signal is STABLE   → raise floor to MONITOR
 *     • If any biometric signal is MONITOR  → raise floor to PRIORITY
 *
 *   MEDIUM symptoms (dizziness, weakness, palpitations, nausea):
 *     • If any biometric signal is STABLE   → raise floor to MONITOR
 *     • If any biometric signal is MONITOR  → remain MONITOR (no PRIORITY)
 *
 *   LOW symptoms (headache, fatigue, "Other"):
 *     • No automatic floor — recorded for context but no status change
 *
 * Severity multiplier:
 *   A logged severity of 4 or 5 (out of 5) upgrades a MEDIUM symptom to HIGH.
 */

import type { SymptomEscalation, SymptomWeight } from './types'

// ---------------------------------------------------------------------------
// Symptom catalogue
// ---------------------------------------------------------------------------

type SymptomEntry = {
  /** Pattern to match against the symptom name (case-insensitive). */
  pattern: RegExp
  baseWeight: SymptomWeight
}

const SYMPTOM_CATALOGUE: SymptomEntry[] = [
  // HIGH baseline — acute cardiorespiratory
  {
    pattern: /shortness.of.breath|dyspnea|breathless/i,
    baseWeight: 'HIGH',
  },
  {
    pattern: /chest.discomfort|chest.pain|chest.tightness|angina/i,
    baseWeight: 'HIGH',
  },
  // MEDIUM baseline — neurological / systemic
  {
    pattern: /dizziness|dizzy|lightheaded|vertigo/i,
    baseWeight: 'MEDIUM',
  },
  {
    pattern: /weakness|fatigue.severe|lethargy/i,
    baseWeight: 'MEDIUM',
  },
  {
    pattern: /palpitation|heart.flutter|irregular.heartbeat/i,
    baseWeight: 'MEDIUM',
  },
  {
    pattern: /nausea|vomit/i,
    baseWeight: 'MEDIUM',
  },
  // LOW baseline — common / non-specific
  {
    pattern: /headache|migraine/i,
    baseWeight: 'LOW',
  },
  {
    pattern: /fatigue|tired|exhausted/i,
    baseWeight: 'LOW',
  },
  {
    pattern: /other/i,
    baseWeight: 'LOW',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEIGHT_RANK: Record<SymptomWeight, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
}

function maxWeight(a: SymptomWeight, b: SymptomWeight): SymptomWeight {
  return WEIGHT_RANK[a] >= WEIGHT_RANK[b] ? a : b
}

/**
 * Resolves the effective weight for a single symptom string,
 * optionally boosted by its logged severity.
 */
function resolveWeight(
  symptomName: string,
  severity: number | null | undefined,
): SymptomWeight {
  const entry = SYMPTOM_CATALOGUE.find((e) => e.pattern.test(symptomName))
  if (!entry) return 'LOW' // Unknown symptoms get LOW rather than NONE

  let weight = entry.baseWeight

  // Severity boost: 4–5 out of 5 upgrades MEDIUM → HIGH
  if (
    weight === 'MEDIUM' &&
    severity !== null &&
    severity !== undefined &&
    severity >= 4
  ) {
    weight = 'HIGH'
  }

  return weight
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SymptomInput = {
  name: string
  /** Severity 1–5, or null if not logged. */
  severity?: number | null
}

export type SymptomCorrelationResult = {
  /** Worst weight across all input symptoms. */
  worstWeight: SymptomWeight

  /** Names of symptoms that were classified as HIGH or MEDIUM. */
  escalatingSymptoms: string[]

  /**
   * The escalation floor derived from symptoms *alone* — before combining
   * with biometric signals. The multiModalEvaluator applies the cross-signal
   * escalation logic.
   */
  symptomFloor: SymptomEscalation
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Accepts an array of symptom name strings (as stored in the `symptoms` table
 * or as returned by personalAnomalyModel's nearbySymptoms[]) and produces a
 * SymptomCorrelationResult.
 *
 * @param symptoms - Array of symptom name strings or SymptomInput objects.
 *                   Plain strings are treated as having null severity.
 */
export function correlateSymptoms(
  symptoms: Array<string | SymptomInput>,
): SymptomCorrelationResult {
  if (symptoms.length === 0) {
    return {
      worstWeight: 'NONE',
      escalatingSymptoms: [],
      symptomFloor: 'NONE',
    }
  }

  let worstWeight: SymptomWeight = 'NONE'
  const escalatingSymptoms: string[] = []

  for (const input of symptoms) {
    const name = typeof input === 'string' ? input : input.name
    const severity =
      typeof input === 'string' ? null : (input.severity ?? null)

    const weight = resolveWeight(name, severity)
    worstWeight = maxWeight(worstWeight, weight)

    if (weight === 'HIGH' || weight === 'MEDIUM') {
      escalatingSymptoms.push(name)
    }
  }

  // Derive an initial floor from symptoms only.
  // The multiModalEvaluator will further escalate based on biometric context.
  let symptomFloor: SymptomEscalation = 'NONE'
  if (worstWeight === 'HIGH') {
    symptomFloor = 'MONITOR_FLOOR'
  } else if (worstWeight === 'MEDIUM') {
    symptomFloor = 'MONITOR_FLOOR'
  }
  // LOW → NONE (no floor from symptoms alone)

  return { worstWeight, escalatingSymptoms, symptomFloor }
}
