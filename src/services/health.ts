import { getSupabaseClient } from '../lib/supabase'

export async function fetchOwnMeasurements() {
  const client = getSupabaseClient()
  if (!client) return []

  const { data, error } = await client
    .from('health_measurements')
    .select('*')
    .order('recorded_at', { ascending: false })

  if (error) throw error
  return data ?? []
}
