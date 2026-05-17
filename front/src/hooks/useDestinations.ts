import { useState, useEffect } from 'react'
import { getDestinations, type Destination } from '@/lib/destinations'

interface UseDestinationsReturn {
  destinations: Destination[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useDestinations(token: string): UseDestinationsReturn {
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(() => !!token)
  const [error, setError] = useState<string | null>(null)
  const [trigger, setTrigger] = useState(0)

  useEffect(() => {
    if (!token) return

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const response = await getDestinations(token)
        if (!cancelled) setDestinations(response.data)
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

  return { destinations, loading, error, refetch }
}