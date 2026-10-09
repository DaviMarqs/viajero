/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import { SESSION_EXPIRED_EVENT } from '@/lib/api'
import { getStoredUser, persistAuth, persistUser, type AuthPayload, type AuthUser } from '@/lib/auth'

interface AuthContextValue {
  token: string
  user: AuthUser | null
  isAuthenticated: boolean
  isGuest: boolean
  /** true quando a sessão terminou por 401; o login mostra o aviso. */
  sessionExpired: boolean
  setAuth: (payload: AuthPayload) => void
  updateUser: (user: AuthUser) => void
  logout: () => void
  refreshUser: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string>(() => {
    return localStorage.getItem('viajero.access_token') ?? ''
  })

  const [user, setUser] = useState<AuthUser | null>(() => {
    return getStoredUser()
  })

  const [sessionExpired, setSessionExpired] = useState(false)

  const isAuthenticated = !!token
  const isGuest = !token

  const logout = useCallback(() => {
    localStorage.removeItem('viajero.access_token')
    localStorage.removeItem('viajero.refresh_token')
    setToken('')
    setUser(getStoredUser())
  }, [])

  useEffect(() => {
    function handleSessionExpired() {
      logout()
      setSessionExpired(true)
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [logout])

  function setAuth(payload: AuthPayload) {
    persistAuth(payload)
    setToken(payload.access)
    setUser(payload.user)
    setSessionExpired(false)
  }

  function updateUser(nextUser: AuthUser) {
    persistUser(nextUser)
    setUser(nextUser)
  }

  function refreshUser() {
    setUser(getStoredUser())
  }

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated, isGuest, sessionExpired, setAuth, updateUser, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
