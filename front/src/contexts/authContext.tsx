/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, ReactNode } from 'react'
import { persistAuth, type AuthPayload, type AuthUser } from '@/lib/auth'

interface AuthContextValue {
  token: string
  user: AuthUser | null
  isAuthenticated: boolean
  setAuth: (payload: AuthPayload) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string>(() => {
    return localStorage.getItem('viajero.access_token') ?? ''
  })

  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('viajero.user')
    return raw ? JSON.parse(raw) : null
  })

  const isAuthenticated = !!token

  function setAuth(payload: AuthPayload) {
    persistAuth(payload)
    setToken(payload.access)
    setUser(payload.user)
  }

  function logout() {
    localStorage.removeItem('viajero.access_token')
    localStorage.removeItem('viajero.refresh_token')
    localStorage.removeItem('viajero.user')
    setToken('')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}