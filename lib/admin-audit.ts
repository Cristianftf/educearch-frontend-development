import type { AuditLog } from '@/types'
import { api } from './api-client'

type AuditLogApi = {
  id?: string
  timestamp?: string
  level?: string
  userId?: string
  userRole?: string
  ipAddress?: string
  userAgent?: string
  action?: string
  endpoint?: string
  responseTime?: number
  responseStatus?: number
  errorMessage?: string
}

const toAuditLog = (item: AuditLogApi): AuditLog => {
  const endpoint = item.endpoint ?? ''
  const status = typeof item.responseStatus === 'number' ? ` [${item.responseStatus}]` : ''

  return {
    id: String(item.id ?? `log-${Date.now()}`),
    timestamp: item.timestamp ?? new Date().toISOString(),
    user: item.userId || 'Sistema',
    userId: item.userId,
    action: item.action || 'UNKNOWN',
    details: item.errorMessage || `${endpoint}${status}` || 'Sin detalles',
    resource: endpoint || undefined,
    ip: item.ipAddress || 'N/A',
    userAgent: item.userAgent || 'N/A',
    level: (item.level as AuditLog['level']) || 'INFO',
  }
}

export const adminAuditApi = {
  getLogs: (
    page = 1,
    limit = 100,
    filters?: { level?: string; userId?: string; search?: string; startDate?: string; endDate?: string }
  ) =>
    api.get<{ 
      logs: AuditLogApi[]
      total: number
      page: number
      limit: number
      totalPages: number
      hasMore: boolean
      stats?: { info: number; warn: number; error: number }
    }>(
      `/admin/audit/logs?page=${page}&limit=${limit}${filters?.level ? `&level=${encodeURIComponent(filters.level)}` : ''}${filters?.userId ? `&userId=${encodeURIComponent(filters.userId)}` : ''}${filters?.search ? `&search=${encodeURIComponent(filters.search)}` : ''}${filters?.startDate ? `&startDate=${encodeURIComponent(filters.startDate)}` : ''}${filters?.endDate ? `&endDate=${encodeURIComponent(filters.endDate)}` : ''}`
    ).then((response) => ({
      ...response,
      logs: response.logs.map(toAuditLog),
      stats: {
        info: Number(response.stats?.info ?? 0),
        warn: Number(response.stats?.warn ?? 0),
        error: Number(response.stats?.error ?? 0),
      },
    })),

  exportLogs: (format: 'pdf' | 'excel' | 'json' | 'csv', filters?: { startDate?: string; endDate?: string; level?: string; userId?: string }) =>
    api.get<{ id: string; fileName: string; downloadUrl: string; size: number; format: string; createdAt: string }>(`/admin/audit/export?format=${format}${filters?.startDate ? `&startDate=${filters.startDate}` : ''}${filters?.endDate ? `&endDate=${filters.endDate}` : ''}${filters?.level ? `&level=${filters.level}` : ''}${filters?.userId ? `&userId=${filters.userId}` : ''}`),
}
