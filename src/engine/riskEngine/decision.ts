export type RiskSeverity = 'STABLE' | 'MONITOR' | 'PRIORITY';

interface BiometricReading {
  metric: string;
  value: number;
  baselineZScore?: number;
}

interface SymptomLog {
  name: string;
  severity: 'mild' | 'moderate' | 'severe';
  occurred_at: string; // ISO timestamp
}

export function evaluateRiskVerdict(
  reading: BiometricReading,
  nearbySymptoms: SymptomLog[]
): { severity: RiskSeverity; reason: string } {
  
  // 1. Critical Override: Acute symptoms present (e.g. shortness of breath, severe pain)
  const hasCriticalSymptom = nearbySymptoms.some(
    s => s.name.toLowerCase().includes('breath') || s.severity === 'severe'
  );

  if (hasCriticalSymptom) {
    return {
      severity: 'PRIORITY',
      reason: 'Critical symptom override triggered within ±30 min window.'
    };
  }

  // 2. Moderate Symptoms / Moderate Anomaly Check
  if (nearbySymptoms.length > 0 || (reading.baselineZScore && Math.abs(reading.baselineZScore) > 2.0)) {
    return {
      severity: 'MONITOR',
      reason: nearbySymptoms.length > 0 
        ? 'Active symptoms recorded near timestamp.' 
        : 'Biometric Z-score anomaly detected.'
    };
  }

  // 3. Default Stable State
  return {
    severity: 'STABLE',
    reason: 'Vitals within baseline and no active acute symptoms.'
  };
}