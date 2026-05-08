import type { User, UserRole } from '@/types'
import { api, ApiHttpError } from './api-client'
import { isConnectivityError } from './api-errors'

export type AdminUserPayload = {
  email: string
  role?: UserRole
  faculty?: string
  firstName?: string
  lastName?: string
  isActive?: boolean
}

type AdminUsersResponse = {
  users: User[]
  total: number
  page: number
  limit: number
  totalPages: number
  stats?: {
    totalUsers: number
    students: number
    professors: number
    admins: number
    active: number
    inactive: number
    pending: number
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function shouldFallback(error: unknown): boolean {
  if (isConnectivityError(error)) return true
  return error instanceof ApiHttpError && error.status >= 500
}

function sanitizePage(value: number): number {
  return Math.max(1, Math.min(100000, Math.trunc(value || 1)))
}

function sanitizeLimit(value: number): number {
  return Math.max(1, Math.min(200, Math.trunc(value || 50)))
}

function sanitizeRole(value?: UserRole): UserRole | undefined {
  if (value === 'student' || value === 'professor' || value === 'admin') return value
  return undefined
}

function sanitizeStatus(value?: string): 'active' | 'inactive' | undefined {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'active' || normalized === 'inactive') return normalized
  return undefined
}

function sanitizeSearch(value?: string): string | undefined {
  if (!value) return undefined
  const normalized = value.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized ? normalized.slice(0, 120) : undefined
}

function sanitizeId(value: string): string {
  const normalized = asString(value, '').trim()
  if (!normalized) {
    throw new Error('Identificador de usuario inválido.')
  }
  return normalized
}

function sanitizeUserPayload(user: AdminUserPayload): AdminUserPayload {
  const payload: AdminUserPayload = { ...user }
  if ('email' in payload && typeof payload.email === 'string') {
    payload.email = payload.email.trim().toLowerCase()
  }
  if ('role' in payload && payload.role) {
    const safeRole = sanitizeRole(payload.role)
    if (safeRole) payload.role = safeRole
    else delete payload.role
  }
  if ('faculty' in payload && typeof (payload as Record<string, unknown>).faculty === 'string') {
    ;(payload as Record<string, unknown>).faculty = asString((payload as Record<string, unknown>).faculty, '').slice(0, 120)
  }
  if ('firstName' in payload && typeof (payload as Record<string, unknown>).firstName === 'string') {
    ;(payload as Record<string, unknown>).firstName = asString((payload as Record<string, unknown>).firstName, '').slice(0, 100)
  }
  if ('lastName' in payload && typeof (payload as Record<string, unknown>).lastName === 'string') {
    ;(payload as Record<string, unknown>).lastName = asString((payload as Record<string, unknown>).lastName, '').slice(0, 120)
  }
  if ('isActive' in payload) {
    ;(payload as Record<string, unknown>).isActive = Boolean((payload as Record<string, unknown>).isActive)
  }
  return payload
}

function normalizeGetAllResponse(raw: unknown, page: number, limit: number): AdminUsersResponse {
  if (!isRecord(raw)) {
    return {
      users: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
      stats: {
        totalUsers: 0,
        students: 0,
        professors: 0,
        admins: 0,
        active: 0,
        inactive: 0,
        pending: 0,
      },
    }
  }

  const statsRaw = isRecord(raw.stats) ? raw.stats : {}
  const users = asArray<User>(raw.users).filter((user) => isRecord(user)) as User[]
  const total = Math.max(0, Math.trunc(asNumber(raw.total, users.length)))
  const totalPages = Math.max(1, Math.trunc(asNumber(raw.totalPages, Math.ceil(total / limit) || 1)))

  return {
    users,
    total,
    page: Math.max(1, Math.trunc(asNumber(raw.page, page))),
    limit: Math.max(1, Math.trunc(asNumber(raw.limit, limit))),
    totalPages,
    stats: {
      totalUsers: Math.max(0, Math.trunc(asNumber(statsRaw.totalUsers, total))),
      students: Math.max(0, Math.trunc(asNumber(statsRaw.students, 0))),
      professors: Math.max(0, Math.trunc(asNumber(statsRaw.professors, 0))),
      admins: Math.max(0, Math.trunc(asNumber(statsRaw.admins, 0))),
      active: Math.max(0, Math.trunc(asNumber(statsRaw.active, 0))),
      inactive: Math.max(0, Math.trunc(asNumber(statsRaw.inactive, 0))),
      pending: Math.max(0, Math.trunc(asNumber(statsRaw.pending, 0))),
    },
  }
}

export const adminUsersApi = {
  getAll: async (page = 1, limit = 50, filters?: { role?: UserRole; status?: string; search?: string }) => {
    const safePage = sanitizePage(page)
    const safeLimit = sanitizeLimit(limit)
    const role = sanitizeRole(filters?.role)
    const status = sanitizeStatus(filters?.status)
    const search = sanitizeSearch(filters?.search)
    const endpoint =
      `/admin/users?page=${safePage}&limit=${safeLimit}` +
      `${role ? `&role=${encodeURIComponent(role)}` : ''}` +
      `${status ? `&status=${encodeURIComponent(status)}` : ''}` +
      `${search ? `&search=${encodeURIComponent(search)}` : ''}`

    try {
      const response = await api.get<unknown>(endpoint)
      return normalizeGetAllResponse(response, safePage, safeLimit)
    } catch (error) {
      if (shouldFallback(error)) return normalizeGetAllResponse(null, safePage, safeLimit)
      throw error
    }
  },

  getById: (id: string) => api.get<User>(`/admin/users/${encodeURIComponent(sanitizeId(id))}`),

  create: (user: AdminUserPayload) => api.post<User>('/admin/users', sanitizeUserPayload(user)),

  update: (id: string, user: AdminUserPayload) =>
    api.put<User>(`/admin/users/${encodeURIComponent(sanitizeId(id))}`, sanitizeUserPayload(user)),

  delete: (id: string) => api.delete<void>(`/admin/users/${encodeURIComponent(sanitizeId(id))}`),

  changeRole: (id: string, role: UserRole) =>
    api.put<User>(`/admin/users/${encodeURIComponent(sanitizeId(id))}/role`, {
      role: sanitizeRole(role) ?? 'student',
    }),

  changeStatus: (id: string, active: boolean) =>
    api.put<void>(`/admin/users/${encodeURIComponent(sanitizeId(id))}/status`, { active: Boolean(active) }),

  bulkImport: (file: File, updateExisting = false) => {
    if (!(file instanceof File)) {
      throw new Error('Archivo de importación inválido.')
    }
    if (file.size <= 0) {
      throw new Error('El archivo CSV está vacío.')
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('El archivo CSV excede el límite de 10 MB.')
    }
    const formData = new FormData()
    formData.append('file', file)
    formData.append('updateExisting', Boolean(updateExisting).toString())
    return api.postForm<{
      imported?: number
      updated?: number
      failed?: number
      errors?: Array<{ row: number; error: string }>
    }>('/admin/users/import', formData)
  },
}
