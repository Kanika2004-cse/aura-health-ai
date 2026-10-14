import type {
    HealthMetricKey,
    HealthStatus,
  } from './healthAnalysis'
  
  export type MetricDecisionEvidence = {
    metric: HealthMetricKey
    current: number | null
    baseline: number | null
    deviationPercent: number | null
    historyCount: number
  
    /**
     * Number of recent previous readings that moved
     * in the same direction as the current deviation.
     */
    persistentReadings: number
  
    /**
     * Number of recent readings available for evaluating
     * persistence.
     */
    persistenceWindow: number
  
    /**
     * Whether the current deviation is meaningfully
     * different from the available personal pattern.
     */
    hasMeaningfulDeviation: boolean
  }
  
  export type DecisionEvidence = {
    metric: HealthMetricKey
    current: number | null
    baseline: number | null
    deviationPercent: number | null
    historyCount: number
    persistentReadings: number
    persistenceWindow: number
    hasMeaningfulDeviation: boolean
  }
  
  function getDeviationDirection(
    deviationPercent: number | null,
  ): 'UP' | 'DOWN' | 'NONE' {
    if (
      deviationPercent === null ||
      !Number.isFinite(deviationPercent) ||
      deviationPercent === 0
    ) {
      return 'NONE'
    }
  
    return deviationPercent > 0 ? 'UP' : 'DOWN'
  }
  
  /**
   * Converts the current metric evidence into a status.
   *
   * Important:
   * This is a temporary Phase-1/Phase-2 decision foundation.
   * It is NOT a clinical rule and does not diagnose disease.
   *
   * The important architectural change is that deviation alone
   * is no longer enough to create a Priority state.
   */
  export function decideMetricStatus(
    evidence: MetricDecisionEvidence,
  ): HealthStatus {
    if (
      evidence.current === null ||
      evidence.baseline === null ||
      evidence.deviationPercent === null
    ) {
      return 'STABLE'
    }
  
    if (!evidence.hasMeaningfulDeviation) {
      return 'STABLE'
    }
  
    /**
     * We require more than a single isolated deviation
     * before creating a Priority state.
     *
     * A meaningful deviation with limited history becomes
     * Monitor while Aura gathers more evidence.
     */
    const hasRepeatedEvidence =
      evidence.persistentReadings >= 2
  
    const hasStrongPersistence =
      evidence.persistenceWindow >= 3 &&
      evidence.persistentReadings >= 3
  
    /**
     * Direction is retained explicitly because later context
     * and metric-specific logic can use it.
     *
     * For now we do not treat "up" or "down" itself as
     * clinically good or bad.
     */
    const direction = getDeviationDirection(
      evidence.deviationPercent,
    )
  
    if (direction === 'NONE') {
      return 'STABLE'
    }
  
    if (hasStrongPersistence) {
      return 'PRIORITY'
    }
  
    if (hasRepeatedEvidence) {
      return 'MONITOR'
    }
  
    return 'MONITOR'
  }
  
  /**
   * Combines metric-level decisions.
   *
   * Multiple Monitor signals can increase the importance
   * of the overall state, but Priority still requires
   * meaningful repeated evidence from at least one metric.
   */
  export function combineDecisionStatuses(
    analyses: Array<{
      status: HealthStatus
      current: number | null
    }>,
  ): HealthStatus {
    const validAnalyses = analyses.filter(
      (analysis) => analysis.current !== null,
    )
  
    if (validAnalyses.length === 0) {
      return 'STABLE'
    }
  
    if (
      validAnalyses.some(
        (analysis) => analysis.status === 'PRIORITY',
      )
    ) {
      return 'PRIORITY'
    }
  
    if (
      validAnalyses.some(
        (analysis) => analysis.status === 'MONITOR',
      )
    ) {
      return 'MONITOR'
    }
  
    return 'STABLE'
  }