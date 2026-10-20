export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      health_profiles: {
        Row: {
          id: string
          user_id: string
          display_name: string | null
          date_of_birth: string | null
          biological_sex: string | null
          height_cm: number | null
          weight_kg: number | null
          timezone: string | null
          blood_group: string | null
          allergies: string | null
          medications: string | null
          conditions: string | null
          doctor_name: string | null
          doctor_phone: string | null
          hospital_name: string | null
          hospital_phone: string | null
          medical_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['health_profiles']['Row']> & {
          user_id: string
        }
        Update: Partial<Database['public']['Tables']['health_profiles']['Row']>
        Relationships: []
      }
      health_measurements: {
        Row: {
          id: string
          user_id: string
          recorded_at: string
          source: string
          source_record_id: string | null
          heart_rate_bpm: number | null
          resting_heart_rate_bpm: number | null
          spo2_pct: number | null
          systolic_mmhg: number | null
          diastolic_mmhg: number | null
          temperature_c: number | null
          steps: number | null
          sleep_minutes: number | null
          notes: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['health_measurements']['Row']> & {
          user_id: string
          recorded_at: string
        }
        Update: Partial<Database['public']['Tables']['health_measurements']['Row']>
        Relationships: []
      }
      activity_context: {
        Row: {
          id: string
          user_id: string
          occurred_at: string
          activity_type: string
          duration_minutes: number | null
          intensity: string | null
          notes: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['activity_context']['Row']> & {
          user_id: string
          occurred_at: string
          activity_type: string
        }
        Update: Partial<Database['public']['Tables']['activity_context']['Row']>
        Relationships: []
      }
      symptoms: {
        Row: {
          id: string
          user_id: string
          occurred_at: string
          name: string
          severity: number | null
          notes: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['symptoms']['Row']> & {
          user_id: string
          occurred_at: string
          name: string
        }
        Update: Partial<Database['public']['Tables']['symptoms']['Row']>
        Relationships: []
      }
      active_health_alerts: {
        Row: {
          id: string
          user_id: string
          severity: 'MONITOR' | 'PRIORITY'
          title: string
          message: string
          status: 'ACTIVE' | 'ACKNOWLEDGED'
          acknowledged_at: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['active_health_alerts']['Row']> & {
          user_id: string
          severity: 'MONITOR' | 'PRIORITY'
          title: string
          message: string
        }
        Update: Partial<Database['public']['Tables']['active_health_alerts']['Row']>
        Relationships: []
      }
      personal_baselines: {
        Row: {
          id: string
          user_id: string
          metric: string
          window_start: string | null
          window_end: string | null
          baseline_value: number | null
          unit: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['personal_baselines']['Row']> & {
          user_id: string
          metric: string
        }
        Update: Partial<Database['public']['Tables']['personal_baselines']['Row']>
        Relationships: []
      }
      health_events: {
        Row: {
          id: string
          user_id: string
          occurred_at: string
          event_type: string
          title: string
          description: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['health_events']['Row']> & {
          user_id: string
          occurred_at: string
          event_type: string
          title: string
        }
        Update: Partial<Database['public']['Tables']['health_events']['Row']>
        Relationships: []
      }
      health_insights: {
        Row: {
          id: string
          user_id: string
          generated_at: string
          title: string
          body: string
          status: string
          source: string
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['health_insights']['Row']> & {
          user_id: string
          title: string
          body: string
        }
        Update: Partial<Database['public']['Tables']['health_insights']['Row']>
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          id: string
          user_id: string
          name: string
          relationship: string | null
          phone: string | null
          is_primary: boolean
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['emergency_contacts']['Row']> & {
          user_id: string
          name: string
        }
        Update: Partial<Database['public']['Tables']['emergency_contacts']['Row']>
        Relationships: []
      }
      connected_devices: {
        Row: {
          id: string
          user_id: string
          name: string
          device_type: string | null
          status: string
          last_synced_at: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['connected_devices']['Row']> & {
          user_id: string
          name: string
        }
        Update: Partial<Database['public']['Tables']['connected_devices']['Row']>
        Relationships: []
      }
      analysis_results: {
        Row: {
          id: string
          user_id: string
          analyzed_at: string
          analysis_type: string
          payload: Json
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['analysis_results']['Row']> & {
          user_id: string
          analysis_type: string
        }
        Update: Partial<Database['public']['Tables']['analysis_results']['Row']>
        Relationships: []
      }
      model_predictions: {
        Row: {
          id: string
          user_id: string
          predicted_at: string
          model_version_id: string | null
          source_measurement_id: string | null
          payload: Json
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['model_predictions']['Row']> & {
          user_id: string
        }
        Update: Partial<Database['public']['Tables']['model_predictions']['Row']>
        Relationships: []
      }
      model_versions: {
        Row: {
          id: string
          name: string
          version: string
          notes: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['model_versions']['Row']> & {
          name: string
          version: string
        }
        Update: Partial<Database['public']['Tables']['model_versions']['Row']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
