/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, ReactNode } from 'react'
import { getStoredUser, persistAuth, type AuthPayload, type AuthUser } from '@/lib/auth'

interface AuthContextValue {
  token: string
  user: AuthUser | null
  isAuthenticated: boolean
  isGuest: boolean
  setAuth: (payload: AuthPayload) => void
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

  const isAuthenticated = !!token
  const isGuest = !token

  function setAuth(payload: AuthPayload) {
    persistAuth(payload)
    setToken(payload.access)
    setUser(payload.user)
  }

  function refreshUser() {
    setUser(getStoredUser())
  }

  function logout() {
    localStorage.removeItem('viajero.access_token')
    localStorage.removeItem('viajero.refresh_token')
    setToken('')
    setUser(getStoredUser())
  }

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated, isGuest, setAuth, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
