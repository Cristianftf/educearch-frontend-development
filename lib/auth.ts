import type { User } from '@/types'
import { api } from './api-client'

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: User; token: string }>('/auth/login', { email, password }),

  logout: () => api.post<void>('/auth/logout'),

  me: () => api.get<User>('/auth/me'),

  refreshToken: () => api.post<{ token: string }>('/auth/refresh'),
}
