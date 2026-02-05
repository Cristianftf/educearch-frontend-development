import type { User } from '@/types'
import { api } from './api-client'

type LoginResponseDTO = {
  token: string
  refreshToken: string
  userId: string
  username: string
  email: string
  firstName?: string
  lastName?: string
  role: string
}

function mapRole(role: string): User['role'] {
  const normalized = role?.toLowerCase() || 'student'
  if (normalized.includes('professor')) return 'professor'
  if (normalized.includes('admin')) return 'admin'
  return 'student'
}

function mapUser(dto: LoginResponseDTO): User {
  const name = `${dto.firstName ?? ''} ${dto.lastName ?? ''}`.trim() || dto.username
  return {
    id: dto.userId,
    email: dto.email,
    name,
    role: mapRole(dto.role),
    avatar: undefined,
    createdAt: new Date().toISOString(),
    lastLogin: undefined,
    isActive: true,
  }
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponseDTO>('/auth/login', { email, password }).then((dto) => ({
      user: mapUser(dto),
      token: dto.token,
    })),

  logout: () => api.post<void>('/auth/logout'),

  me: () => api.get<User>('/auth/me'),

  refreshToken: (token?: string) =>
    api
      .post<LoginResponseDTO>(
        '/auth/refresh',
        undefined,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      )
      .then((dto) => ({
        token: dto.token,
        refreshToken: dto.refreshToken,
      })),

  requestPasswordReset: (email: string) =>
    api.post<{ message?: string; resetUrl?: string }>('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, password }),
}
