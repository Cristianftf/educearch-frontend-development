import type { User, UserRole } from '@/types'
import { api } from './api-client'

export const adminUsersApi = {
  getAll: (page = 1, limit = 50, filters?: { role?: UserRole; status?: string; search?: string }) =>
    api.get<{
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
    }>(
      `/admin/users?page=${page}&limit=${limit}${filters?.role ? `&role=${filters.role}` : ''}${filters?.status ? `&status=${filters.status}` : ''}${filters?.search ? `&search=${encodeURIComponent(filters.search)}` : ''}`
    ),

  getById: (id: string) => api.get<User>(`/admin/users/${id}`),

  create: (user: Omit<User, 'id' | 'createdAt'>) =>
    api.post<User>('/admin/users', user),

  update: (id: string, user: Partial<User>) =>
    api.put<User>(`/admin/users/${id}`, user),

  delete: (id: string) => api.delete<void>(`/admin/users/${id}`),

  changeRole: (id: string, role: UserRole) =>
    api.put<User>(`/admin/users/${id}/role`, { role }),

  changeStatus: (id: string, active: boolean) =>
    api.put<void>(`/admin/users/${id}/status`, { active }),

  bulkImport: (file: File, updateExisting = false) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('updateExisting', updateExisting.toString())
    return api.postForm<{ imported?: number; updated?: number; failed?: number; errors?: Array<{ row: number; error: string }> }>(
      '/admin/users/import',
      formData
    )
  },
}
