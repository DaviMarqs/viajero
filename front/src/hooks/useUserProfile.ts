import { useState, useEffect } from 'react'
import { apiRequest } from '@/lib/api'
import type { AuthUser } from '@/lib/auth'

interface UseUserProfileReturn {
  user: AuthUser | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useUserProfile(token: string): UseUserProfileReturn {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(() => !!token) // ← false se não tem token
  const [error, setError] = useState<string | null>(null)
  const [trigger, setTrigger] = useState(0)

  useEffect(() => {
    if (!token) return // sem setState aqui

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const response = await apiRequest<AuthUser>('/api/users/me/', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!cancelled) setUser(response.data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [token, trigger])

  const refetch = () => setTrigger(t => t + 1)

  return { user, loading, error, refetch }
}