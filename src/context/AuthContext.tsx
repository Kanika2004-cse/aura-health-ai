import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
  } from 'react'
  import type { Session, User } from '@supabase/supabase-js'
  import { getSupabaseClient } from '../lib/supabase'
  
  interface AuthContextValue {
    user: User | null
    session: Session | null
    loading: boolean
    signUp: (email: string, password: string) => Promise<{
      error: Error | null
    }>
    signIn: (email: string, password: string) => Promise<{
      error: Error | null
    }>
    signOut: () => Promise<{
      error: Error | null
    }>
  }
  
  const AuthContext = createContext<AuthContextValue | undefined>(undefined)
  
  export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)
  
    const client = getSupabaseClient()
  
    useEffect(() => {
      if (!client) {
        setLoading(false)
        return
      }
  
      client.auth.getSession().then(({ data }) => {
        const units = data.session?.user.user_metadata?.aura_measurement_system
        if (units === 'metric' || units === 'imperial') localStorage.setItem('aura-measurement-system', units)
        setSession(data.session)
        setLoading(false)
      })
  
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, nextSession) => {
      const units = nextSession?.user.user_metadata?.aura_measurement_system
      if (units === 'metric' || units === 'imperial') localStorage.setItem('aura-measurement-system', units)
        setSession(nextSession)
        setLoading(false)
      })
  
      return () => subscription.unsubscribe()
    }, [client])
  
    async function signUp(email: string, password: string) {
      if (!client) {
        return { error: new Error('Account services are unavailable right now. Please try again later.') }
      }
  
      const { error } = await client.auth.signUp({
        email,
        password,
      })
  
      return { error }
    }
  
    async function signIn(email: string, password: string) {
      if (!client) {
        return { error: new Error('Account services are unavailable right now. Please try again later.') }
      }
  
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      })
  
      return { error }
    }
  
    async function signOut() {
      if (!client) {
        return { error: new Error('Account services are unavailable right now. Please try again later.') }
      }
  
      const { error } = await client.auth.signOut()
  
      return { error }
    }
  
    return (
      <AuthContext.Provider
        value={{
          user: session?.user ?? null,
          session,
          loading,
          signUp,
          signIn,
          signOut,
        }}
      >
        {children}
      </AuthContext.Provider>
    )
  }
  
  export function useAuth() {
    const context = useContext(AuthContext)
  
    if (!context) {
      throw new Error('useAuth must be used inside AuthProvider')
    }
  
    return context
  }
