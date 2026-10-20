import { evaluateMultiModalRisk } from '../engine/riskEngine/multiModalEvaluator';
import { fireAlert } from '../engine/alerting/alertService';
import { getSupabaseClient } from '../lib/supabase';

export type SymptomSeverity = 'mild' | 'moderate' | 'severe';

const severityValues: Record<SymptomSeverity, number> = {
  mild: 2,
  moderate: 3,
  severe: 5,
};

export async function submitUserSymptom(
  userId: string,
  symptomName: string,
  severity: SymptomSeverity,
): Promise<void> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error('Symptom logging is unavailable because Supabase is not configured.');
  }

  const { error } = await supabase.from('symptoms').insert({
    user_id: userId,
    name: symptomName,
    severity: severityValues[severity],
    occurred_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Unable to save symptom: ${error.message}`);
  }

  const evaluatedVerdict = evaluateMultiModalRisk({
    biometricStatus: 'STABLE',
    snapshot: {
      systolicMmhg: null,
      diastolicMmhg: null,
      spo2Pct: null,
      heartRateBpm: null,
    },
    symptoms: [{ name: symptomName, severity: severityValues[severity] }],
  });

  const isCriticalSymptom = severity === 'severe' || symptomName.toLowerCase().includes('breath');
  const verdict = isCriticalSymptom
    ? {
        ...evaluatedVerdict,
        finalStatus: 'PRIORITY' as const,
        rationale: `A severe or acute symptom was reported. ${evaluatedVerdict.rationale}`,
      }
    : evaluatedVerdict;

  if (verdict.finalStatus === 'STABLE') return;

  const title = isCriticalSymptom
    ? 'Symptom needs attention'
    : 'Health symptom alert';

  await fireAlert(verdict, { userId });

  const { error: alertError } = await supabase
    .from('active_health_alerts')
    .insert({
      user_id: userId,
      severity: verdict.finalStatus,
      title,
      message: verdict.rationale,
      status: 'ACTIVE',
    });

  if (alertError) {
    throw new Error(`Symptom was saved, but its alert could not be recorded: ${alertError.message}`);
  }
}