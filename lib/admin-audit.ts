import type { AuditLog } from '@/types'
import { api } from './api-client'

export const adminAuditApi = {
  getLogs: (
    page = 1,
    limit = 100,
    filters?: { level?: string; userId?: string; search?: string; startDate?: string; endDate?: string }
  ) =>
    api.get<{ 
      logs: AuditLog[]
      total: number
      page: number
      limit: number
      totalPages: number
      hasMore: boolean
      stats?: { info: number; warn: number; error: number }
    }>(
      `/admin/audit/logs?page=${page}&limit=${limit}${filters?.level ? `&level=${filters.level}` : ''}${filters?.userId ? `&userId=${filters.userId}` : ''}${filters?.search ? `&search=${filters.search}` : ''}${filters?.startDate ? `&startDate=${filters.startDate}` : ''}${filters?.endDate ? `&endDate=${filters.endDate}` : ''}`
    ),

  exportLogs: (format: 'pdf' | 'excel' | 'json' | 'csv', filters?: { startDate?: string; endDate?: string; level?: string; userId?: string }) =>
    api.get<{ id: string; fileName: string; downloadUrl: string; size: number; format: string; createdAt: string }>(`/admin/audit/export?format=${format}${filters?.startDate ? `&startDate=${filters.startDate}` : ''}${filters?.endDate ? `&endDate=${filters.endDate}` : ''}${filters?.level ? `&level=${filters.level}` : ''}${filters?.userId ? `&userId=${filters.userId}` : ''}`),
}
