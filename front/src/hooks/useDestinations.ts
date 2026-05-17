import { useState, useEffect } from 'react'
import { getDestinations, getDestination, type Destination } from '@/lib/destinations'

interface UseDestinationsReturn {
  destinations: Destination[]
  destination: Destination | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useDestinations(token: string, slug?: string): UseDestinationsReturn {
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [destination, setDestination] = useState<Destination | null>(null)
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
        if (slug) {
          const response = await getDestination(token, slug)
          if (!cancelled) setDestination(response.data)
        } else {
          const response = await getDestinations(token)
          if (!cancelled) setDestinations(response.data.results)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [token, slug, trigger])

  const refetch = () => setTrigger(t => t + 1)

  return { destinations, destination, loading, error, refetch }
}