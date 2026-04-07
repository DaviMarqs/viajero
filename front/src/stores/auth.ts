import { defineStore } from 'pinia'

import { api } from '@/api/client'
import type { CurrentUserPayload, Tokens, User } from '@/types'

interface AuthState {
  user: User | null
  currentUser: CurrentUserPayload | null
  loading: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    currentUser: null,
    loading: false,
  }),
  getters: {
    isAuthenticated: () => Boolean(localStorage.getItem('viajeiro_access')),
    isAdmin: (state) => ['admin', 'superadmin'].includes(state.user?.role ?? ''),
  },
  actions: {
    applyTokens(tokens: Tokens) {
      localStorage.setItem('viajeiro_access', tokens.access)
      localStorage.setItem('viajeiro_refresh', tokens.refresh)
    },
    clearSession() {
      localStorage.removeItem('viajeiro_access')
      localStorage.removeItem('viajeiro_refresh')
      this.user = null
      this.currentUser = null
    },
    async login(payload: { email: string; password: string }) {
      const { data } = await api.post('/auth/login/', payload)
      this.applyTokens(data.tokens)
      this.user = data.user
      await this.fetchCurrentUser()
    },
    async register(payload: Record<string, unknown>) {
      const { data } = await api.post('/auth/register/', payload)
      this.applyTokens(data.tokens)
      this.user = data.user
      await this.fetchCurrentUser()
    },
    async fetchCurrentUser() {
      if (!localStorage.getItem('viajeiro_access')) return
      this.loading = true
      try {
        const { data } = await api.get<CurrentUserPayload>('/me/')
        this.currentUser = data
        this.user = data.user
      } finally {
        this.loading = false
      }
    },
    async logout() {
      const refresh = localStorage.getItem('viajeiro_refresh')
      try {
        if (refresh) {
          await api.post('/auth/logout/', { refresh })
        }
      } finally {
        this.clearSession()
      }
    },
  },
})
