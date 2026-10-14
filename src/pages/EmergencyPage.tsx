import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, HeartPulse, Pencil, Phone, Plus, Star, Trash2, UserRound } from 'lucide-react'

import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { getSupabaseClient } from '../lib/supabase'
import type { Database } from '../types/database'

type EmergencyContact = Database['public']['Tables']['emergency_contacts']['Row']
type HealthProfile = Database['public']['Tables']['health_profiles']['Row']
type ContactForm = { name: string; relationship: string; phone: string; isPrimary: boolean }
type HealthCardForm = Pick<HealthProfile,
  'display_name' | 'date_of_birth' | 'blood_group' | 'allergies' | 'medications' | 'conditions' |
  'doctor_name' | 'doctor_phone' | 'hospital_name' | 'hospital_phone' | 'medical_notes'
>

const blankContact: ContactForm = { name: '', relationship: '', phone: '', isPrimary: false }
const blankCard: HealthCardForm = {
  display_name: '', date_of_birth: '', blood_group: '', allergies: '', medications: '',
  conditions: '', doctor_name: '', doctor_phone: '', hospital_name: '', hospital_phone: '', medical_notes: '',
}
const bloodGroups = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−']

function ageFromDate(dateOfBirth: string | null) {
  if (!dateOfBirth) return null
  const birth = new Date(`${dateOfBirth}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1
  return age >= 0 ? age : null
}

function InfoValue({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-line bg-ink/70 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-haze">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-snow">{value?.trim() || 'Not provided'}</p>
    </div>
  )
}

export function EmergencyPage() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [card, setCard] = useState<HealthCardForm>(blankCard)
  const [cardUpdatedAt, setCardUpdatedAt] = useState<string | null>(null)
  const [contactForm, setContactForm] = useState<ContactForm>(blankContact)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)
  const [showContactForm, setShowContactForm] = useState(false)
  const [showHealthCard, setShowHealthCard] = useState(false)
  const [editingHealthCard, setEditingHealthCard] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')

  useEffect(() => {
    if (!savedMessage) return
    const timer = window.setTimeout(() => setSavedMessage(''), 1500)
    return () => window.clearTimeout(timer)
  }, [savedMessage])

  useEffect(() => {
    let active = true
    async function loadEmergencyData() {
      if (!user) {
        setContacts([])
        setCard(blankCard)
        setLoading(false)
        return
      }
      const supabase = getSupabaseClient()
      if (!supabase) {
        setError('Your emergency information is unavailable right now. Please try again.')
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      const [contactsResult, profileResult] = await Promise.all([
        supabase.from('emergency_contacts').select('*').eq('user_id', user.id)
          .order('is_primary', { ascending: false }).order('name', { ascending: true }),
        supabase.from('health_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      ])
      if (!active) return
      if (contactsResult.error) {
        console.error('Unable to load emergency contacts:', contactsResult.error)
        setError('Your emergency contacts could not be loaded.')
      } else {
        setContacts((contactsResult.data ?? []) as EmergencyContact[])
      }
      if (profileResult.error) {
        console.error('Unable to load emergency health card:', profileResult.error)
        setError((current) => current || 'Your health card could not be loaded.')
      } else if (profileResult.data) {
        const profile = profileResult.data as unknown as HealthProfile
        setCard({
          display_name: profile.display_name ?? '', date_of_birth: profile.date_of_birth ?? '',
          blood_group: profile.blood_group ?? '', allergies: profile.allergies ?? '',
          medications: profile.medications ?? '', conditions: profile.conditions ?? '',
          doctor_name: profile.doctor_name ?? '', doctor_phone: profile.doctor_phone ?? '',
          hospital_name: profile.hospital_name ?? '', hospital_phone: profile.hospital_phone ?? '',
          medical_notes: profile.medical_notes ?? '',
        })
        setCardUpdatedAt(profile.updated_at)
      }
      setLoading(false)
    }
    void loadEmergencyData()
    return () => { active = false }
  }, [user])

  function beginContactEdit(contact: EmergencyContact) {
    setEditingContactId(contact.id)
    setContactForm({ name: contact.name, relationship: contact.relationship ?? '', phone: contact.phone ?? '', isPrimary: contact.is_primary })
    setShowContactForm(true)
    setError('')
    setSavedMessage('')
  }

  function resetContactForm() {
    setEditingContactId(null)
    setContactForm(blankContact)
    setShowContactForm(false)
  }

  async function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return setError('Sign in to save emergency contacts.')
    const supabase = getSupabaseClient()
    if (!supabase) return setError('Your emergency information cannot be saved right now. Please try again.')
    const name = contactForm.name.trim()
    if (!name) return setError('Enter a contact name.')
    setSaving(true)
    setError('')
    setSavedMessage('')
    try {
      const contactsTable = supabase.from('emergency_contacts') as any
      const payload = { name, relationship: contactForm.relationship.trim() || null, phone: contactForm.phone.trim() || null, is_primary: false }
      let contactId = editingContactId
      if (editingContactId) {
        const { error: updateError } = await contactsTable.update(payload).eq('id', editingContactId).eq('user_id', user.id)
        if (updateError) throw updateError
      } else {
        const { data, error: insertError } = await contactsTable.insert({ ...payload, user_id: user.id }).select('id').single()
        if (insertError) throw insertError
        contactId = data?.id ?? null
      }
      if (contactForm.isPrimary && contactId) {
        const { error: clearError } = await contactsTable.update({ is_primary: false }).eq('user_id', user.id)
        if (clearError) throw clearError
        const { error: primaryError } = await contactsTable.update({ is_primary: true }).eq('id', contactId).eq('user_id', user.id)
        if (primaryError) throw primaryError
      }
      await refreshContacts()
      resetContactForm()
      setSavedMessage('Emergency contact saved.')
    } catch (saveError) {
      console.error('Unable to save emergency contact:', saveError)
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this contact.')
    } finally {
      setSaving(false)
    }
  }

  async function refreshContacts() {
    const supabase = getSupabaseClient()
    if (!supabase || !user) return
    const { data, error: queryError } = await supabase.from('emergency_contacts').select('*').eq('user_id', user.id)
      .order('is_primary', { ascending: false }).order('name', { ascending: true })
    if (queryError) throw queryError
    setContacts((data ?? []) as EmergencyContact[])
  }

  async function deleteContact(contact: EmergencyContact) {
    if (!user || !window.confirm(`Remove ${contact.name} from your emergency contacts?`)) return
    const contactsTable = getSupabaseClient()?.from('emergency_contacts') as any
    if (!contactsTable) return
    setError('')
    const { error: deleteError } = await contactsTable.delete().eq('id', contact.id).eq('user_id', user.id)
    if (deleteError) return setError(deleteError.message)
    setContacts((current) => current.filter((item) => item.id !== contact.id))
    if (editingContactId === contact.id) resetContactForm()
  }

  async function saveHealthCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return setError('Sign in to save your health card.')
    const supabase = getSupabaseClient()
    if (!supabase) return setError('Your emergency information cannot be saved right now. Please try again.')
    setSaving(true)
    setError('')
    setSavedMessage('')
    const payload = Object.fromEntries(Object.entries(card).map(([key, value]) => [key, typeof value === 'string' ? value.trim() || null : value]))
    try {
      const profilesTable = supabase.from('health_profiles') as any
      const { data: existing, error: lookupError } = await profilesTable.select('user_id').eq('user_id', user.id).maybeSingle()
      if (lookupError) throw lookupError
      const result = existing
        ? await profilesTable.update(payload).eq('user_id', user.id)
        : await profilesTable.insert({ ...payload, user_id: user.id })
      if (result.error) throw result.error
      setCardUpdatedAt(new Date().toISOString())
      setEditingHealthCard(false)
      setSavedMessage('Emergency health card saved.')
    } catch (saveError) {
      console.error('Unable to save emergency health card:', saveError)
      const message = saveError instanceof Error ? saveError.message : 'Unable to save your health card.'
      setError(message.toLowerCase().includes('column') ? 'Run the emergency health card Supabase migration before saving these details.' : message)
    } finally {
      setSaving(false)
    }
  }

  const age = ageFromDate(card.date_of_birth)

  return (
    <>
      <PageHeader eyebrow="Safety" title="Emergency support" description="Keep your emergency contacts and essential health information ready to view." />

      {error && <div role="alert" className="mb-5 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      {savedMessage && <div role="status" className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"><CheckCircle2 className="size-4" />{savedMessage}</div>}

      <Card className="mb-6 border-alert/30 bg-gradient-to-br from-alert/10 to-ink p-6 sm:p-8">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-alert/15 text-alert"><AlertTriangle className="size-5" /></span>
            <div>
              <h2 className="font-display text-xl text-snow">Emergency Support</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-haze">If you are in immediate danger or need urgent medical help, contact emergency services directly.</p>
              <p className="mt-2 text-xs text-haze">Aura can open your phone app, but cannot dispatch help or guarantee a call connects.</p>
            </div>
          </div>
          <a href="tel:112" className="inline-flex h-14 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-alert px-7 text-base font-bold tracking-wide text-white shadow-[0_0_28px_rgb(248_113_113/0.2)] transition hover:bg-red-500 sm:w-auto"><Phone className="size-5" />Call 112</a>
        </div>
      </Card>

      <section className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-snow">Your emergency contacts</h2>
            <p className="mt-1 text-sm text-haze">Call a trusted contact directly from a supported device.</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => { setShowContactForm((show) => !show); setEditingContactId(null); setContactForm(blankContact) }}><Plus className="size-4" />Add contact</Button>
        </div>

        {showContactForm && <Card className="mb-4">
          <h3 className="mb-4 font-display text-lg text-snow">{editingContactId ? 'Edit contact' : 'New contact'}</h3>
          <form onSubmit={handleContactSubmit} className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-haze">Name</span><input required maxLength={120} value={contactForm.name} onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))} placeholder="Contact name" className="mt-2 h-12 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-snow outline-none placeholder:text-haze/60 focus:border-pulse" /></label>
            <label className="block"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-haze">Relationship</span><input maxLength={80} value={contactForm.relationship} onChange={(event) => setContactForm((current) => ({ ...current, relationship: event.target.value }))} placeholder="e.g. Mother, friend, doctor" className="mt-2 h-12 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-snow outline-none placeholder:text-haze/60 focus:border-pulse" /></label>
            <label className="block"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-haze">Phone number</span><input type="tel" maxLength={40} value={contactForm.phone} onChange={(event) => setContactForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number" className="mt-2 h-12 w-full rounded-2xl border border-line bg-ink px-4 text-sm text-snow outline-none placeholder:text-haze/60 focus:border-pulse" /></label>
            <label className="flex items-center gap-2 self-end pb-3 text-sm text-haze"><input type="checkbox" checked={contactForm.isPrimary} onChange={(event) => setContactForm((current) => ({ ...current, isPrimary: event.target.checked }))} className="size-4 accent-[#4CC9A8]" />Primary contact</label>
            <div className="flex gap-3 sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? 'Saving...' : editingContactId ? 'Save changes' : 'Save contact'}</Button><Button type="button" variant="secondary" onClick={resetContactForm}>Cancel</Button></div>
          </form>
        </Card>}

        {loading ? <Card><p className="py-8 text-center text-sm text-haze">Loading emergency contacts...</p></Card> : contacts.length === 0 ? (
          <Card><EmptyState icon={<Phone className="size-5" />} title="No contacts saved" description="Add someone you trust so their details are easy to find in an emergency." /></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {contacts.map((contact) => (
              <Card key={contact.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-pulse/10 text-pulse"><UserRound className="size-5" /></span>
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-medium text-snow">{contact.name}</h3>{contact.is_primary && <Badge tone="pulse"><Star className="size-3" />Primary</Badge>}</div><p className="mt-1 truncate text-sm text-haze">{contact.relationship || contact.phone || 'Contact details'}</p></div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {contact.phone ? <a href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`} aria-label={`Call ${contact.name}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-pulse/10 px-3 text-sm font-medium text-pulse hover:bg-pulse/20"><Phone className="size-3.5" />Call</a> : <span className="text-xs text-haze">No number</span>}
                  <button type="button" onClick={() => beginContactEdit(contact)} aria-label={`Edit ${contact.name}`} className="rounded-lg p-2 text-haze hover:bg-white/5 hover:text-snow"><Pencil className="size-4" /></button>
                  <button type="button" onClick={() => void deleteContact(contact)} aria-label={`Remove ${contact.name}`} className="rounded-lg p-2 text-haze hover:bg-alert/10 hover:text-alert"><Trash2 className="size-4" /></button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-pulse/10 text-pulse"><HeartPulse className="size-5" /></span><div><h2 className="font-display text-xl text-snow">Health information available</h2><p className="mt-1 text-sm text-haze">Only information you choose to save is shown.</p></div></div>
          <Button type="button" variant="secondary" onClick={() => { setShowHealthCard((show) => !show); setEditingHealthCard(false) }}>{showHealthCard ? 'Hide Health Card' : 'View Health Card'}</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoValue label="Blood group" value={card.blood_group} />
          <InfoValue label="Allergies" value={card.allergies} />
          <InfoValue label="Medications" value={card.medications} />
          <InfoValue label="Conditions" value={card.conditions} />
        </div>

        {showHealthCard && <div id="health-card" className="mt-5 rounded-2xl border border-line bg-ink p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-pulse">Aura Health Card</p><h3 className="mt-2 font-display text-2xl uppercase tracking-wide text-snow">{(card.display_name ?? '').trim() || 'Not provided'}</h3><p className="mt-1 text-sm text-haze">{age === null ? 'Age: Not provided' : `${age} years old`}{card.blood_group ? ` · ${card.blood_group}` : ''}</p></div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditingHealthCard((editing) => !editing)}><Pencil className="size-3.5" />{editingHealthCard ? 'Cancel editing' : 'Edit card'}</Button>
          </div>

          {editingHealthCard ? (
            <form onSubmit={saveHealthCard} className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-haze">Name</span><input value={card.display_name ?? ''} onChange={(event) => setCard((current) => ({ ...current, display_name: event.target.value }))} maxLength={120} className="mt-2 h-11 w-full rounded-xl border border-line bg-panel px-3 text-sm text-snow outline-none focus:border-pulse" /></label>
              <label className="block"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-haze">Date of birth</span><input type="date" value={card.date_of_birth ?? ''} onChange={(event) => setCard((current) => ({ ...current, date_of_birth: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-line bg-panel px-3 text-sm text-snow outline-none focus:border-pulse" /></label>
              <label className="block"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-haze">Blood group</span><select value={card.blood_group ?? ''} onChange={(event) => setCard((current) => ({ ...current, blood_group: event.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-line bg-panel px-3 text-sm text-snow outline-none focus:border-pulse"><option value="">Not recorded</option>{bloodGroups.map((group) => <option key={group} value={group}>{group}</option>)}</select></label>
              <HealthTextArea label="Allergies" value={card.allergies ?? ''} onChange={(value) => setCard((current) => ({ ...current, allergies: value }))} />
              <HealthTextArea label="Current medications" value={card.medications ?? ''} onChange={(value) => setCard((current) => ({ ...current, medications: value }))} />
              <HealthTextArea label="Known conditions" value={card.conditions ?? ''} onChange={(value) => setCard((current) => ({ ...current, conditions: value }))} />
              <label className="block"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-haze">Doctor</span><input value={card.doctor_name ?? ''} onChange={(event) => setCard((current) => ({ ...current, doctor_name: event.target.value }))} placeholder="Name" className="mt-2 h-11 w-full rounded-xl border border-line bg-panel px-3 text-sm text-snow outline-none focus:border-pulse" /></label>
              <label className="block"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-haze">Doctor phone</span><input type="tel" value={card.doctor_phone ?? ''} onChange={(event) => setCard((current) => ({ ...current, doctor_phone: event.target.value }))} placeholder="Phone number" className="mt-2 h-11 w-full rounded-xl border border-line bg-panel px-3 text-sm text-snow outline-none focus:border-pulse" /></label>
              <label className="block"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-haze">Hospital</span><input value={card.hospital_name ?? ''} onChange={(event) => setCard((current) => ({ ...current, hospital_name: event.target.value }))} placeholder="Name" className="mt-2 h-11 w-full rounded-xl border border-line bg-panel px-3 text-sm text-snow outline-none focus:border-pulse" /></label>
              <label className="block"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-haze">Hospital phone</span><input type="tel" value={card.hospital_phone ?? ''} onChange={(event) => setCard((current) => ({ ...current, hospital_phone: event.target.value }))} placeholder="Phone number" className="mt-2 h-11 w-full rounded-xl border border-line bg-panel px-3 text-sm text-snow outline-none focus:border-pulse" /></label>
              <HealthTextArea label="Important medical notes" value={card.medical_notes ?? ''} onChange={(value) => setCard((current) => ({ ...current, medical_notes: value }))} />
              {error && <p role="alert" className="sm:col-span-2 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
              <div className="sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Health Card'}</Button></div>
            </form>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoValue label="Allergies" value={card.allergies} />
                <InfoValue label="Medications" value={card.medications} />
                <InfoValue label="Medical conditions" value={card.conditions} />
                <InfoValue label="Important notes" value={card.medical_notes} />
                <InfoValue label="Doctor / clinic" value={[card.doctor_name, card.doctor_phone].filter(Boolean).join(' · ')} />
                <InfoValue label="Hospital" value={[card.hospital_name, card.hospital_phone].filter(Boolean).join(' · ')} />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-haze">
                <span>Emergency contact: {contacts.find((contact) => contact.is_primary)?.name ?? contacts[0]?.name ?? 'Not provided'}{contacts.find((contact) => contact.is_primary)?.phone ? ` · ${contacts.find((contact) => contact.is_primary)?.phone}` : ''}</span>
                <span>Last updated: {cardUpdatedAt ? new Date(cardUpdatedAt).toLocaleDateString() : 'Not provided'}</span>
              </div>
            </>
          )}
        </div>}
      </Card>
    </>
  )
}

function HealthTextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-xs font-semibold uppercase tracking-[0.14em] text-haze">{label}</span><textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-line bg-panel px-3 py-2 text-sm text-snow outline-none focus:border-pulse" /></label>
}
