import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sql = readFileSync(
  join(root, 'supabase/migrations/20260918100000_phase1_health_foundation.sql'),
  'utf8',
)

describe('phase 1 migration', () => {
  it('enables RLS on user-owned tables', () => {
    const tables = [
      'health_profiles',
      'health_measurements',
      'activity_context',
      'symptoms',
      'personal_baselines',
      'health_events',
      'health_insights',
      'emergency_contacts',
      'connected_devices',
      'analysis_results',
      'model_predictions',
      'model_versions',
    ]
    for (const table of tables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it('does not embed service credentials', () => {
    expect(sql.toLowerCase()).not.toContain('service_role')
    expect(sql).not.toMatch(/eyJ[a-zA-Z0-9_-]+/)
  })
})
