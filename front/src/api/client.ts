import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
})

let isRefreshing = false
let pendingRequests: Array<(token: string | null) => void> = []

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('viajeiro_access')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refresh = localStorage.getItem('viajeiro_refresh')

      if (!refresh) {
        localStorage.removeItem('viajeiro_access')
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingRequests.push((token) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`
            }
            resolve(api(originalRequest))
          })
        })
      }

      isRefreshing = true
      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh })
        localStorage.setItem('viajeiro_access', response.data.access)
        localStorage.setItem('viajeiro_refresh', response.data.refresh ?? refresh)
        pendingRequests.forEach((resolve) => resolve(response.data.access))
        pendingRequests = []
        originalRequest.headers.Authorization = `Bearer ${response.data.access}`
        return api(originalRequest)
      } catch (refreshError) {
        localStorage.removeItem('viajeiro_access')
        localStorage.removeItem('viajeiro_refresh')
        pendingRequests.forEach((resolve) => resolve(null))
        pendingRequests = []
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)
