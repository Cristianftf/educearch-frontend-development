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

type UserResponseDTO = {
  id: string
  email: string
  name?: string
  firstName?: string
  lastName?: string
  role: string
  avatar?: string
  active?: boolean
  isActive?: boolean
  createdAt?: string | null
  lastLogin?: string | null
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

function mapCurrentUser(dto: UserResponseDTO): User {
  const name =
    dto.name?.trim() ||
    `${dto.firstName ?? ''} ${dto.lastName ?? ''}`.trim() ||
    dto.email

  return {
    id: dto.id,
    email: dto.email,
    name,
    role: mapRole(dto.role),
    avatar: dto.avatar,
    createdAt: dto.createdAt ?? new Date().toISOString(),
    lastLogin: dto.lastLogin ?? undefined,
    isActive: dto.isActive ?? dto.active ?? true,
  }
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponseDTO>('/auth/login', { email, password }).then((dto) => ({
      user: mapUser(dto),
      token: dto.token,
    })),

  logout: () => api.post<void>('/auth/logout'),

  me: () => api.get<UserResponseDTO>('/auth/me').then(mapCurrentUser),

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
