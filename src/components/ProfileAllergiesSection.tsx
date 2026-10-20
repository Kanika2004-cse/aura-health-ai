import { useState, useEffect } from 'react'
import { Card } from '../components/ui/Card'
import { useAuth } from '../context/AuthContext'
import { getSupabaseClient } from '../lib/supabase'
import { AlertCircle, Check, ShieldAlert } from 'lucide-react'

export function ProfileAllergiesSection() {
  const { user } = useAuth()
  const [allergies, setAllergies] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    async function loadProfile() {
      if (!user) return
      const supabase = getSupabaseClient()
      if (!supabase) return

      setLoading(true)
      const { data, error } = await (supabase.from('profiles' as any) as any)
        .select('allergies')
        .eq('id', user.id)
        .single()

      if (!error && data && typeof data === 'object' && 'allergies' in data) {
        setAllergies((data as any).allergies || '')
      }
      setLoading(false)
    }

    void loadProfile()
  }, [user])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const supabase = getSupabaseClient()
    if (!supabase) return

    setSaving(true)
    setMessage({ type: '', text: '' })

    const { error } = await (supabase.from('profiles' as any) as any)
      .update({ allergies, updated_at: new Date().toISOString() } as any)
      .eq('id', user.id)

    if (error) {
      setMessage({ type: 'error', text: 'Failed to update allergies. Please try again.' })
    } else {
      setMessage({ type: 'success', text: 'Allergies updated successfully!' })
    }
    setSaving(false)
  }

  if (loading) {
    return <Card className="p-6 text-sm text-haze">Loading clinical profile...</Card>
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex size-10 items-center justify-center rounded-xl bg-pulse/10 text-pulse">
          <ShieldAlert className="size-5" />
        </div>
        <div>
          <h2 className="font-display text-lg text-snow">Clinical Allergies</h2>
          <p className="text-sm text-haze">Specify any food, drug, or environmental allergies.</p>
        </div>
      </div>

      {message.text && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${message.type === 'error' ? 'bg-red-400/10 text-red-200 border border-red-400/30' : 'bg-emerald-400/10 text-emerald-200 border border-emerald-400/30'}`}>
          {message.type === 'error' ? <AlertCircle className="size-4 shrink-0" /> : <Check className="size-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <textarea
            rows={3}
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="e.g., Penicillin, Peanuts..."
            className="w-full rounded-xl border border-line bg-surface/50 px-4 py-3 text-sm text-snow placeholder:text-haze/50 focus:border-pulse focus:outline-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-xl bg-pulse px-5 py-2.5 text-sm font-semibold text-snow hover:bg-pulse/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Allergies'}
          </button>
        </div>
      </form>
    </Card>
  )
}