import type { AuditLog } from '@/types'
import { api, ApiHttpError } from './api-client'
import { isConnectivityError } from './api-errors'

type AuditLogApi = {
  id?: string
  timestamp?: string
  level?: string
  userId?: string
  userIdentifier?: string
  userDisplayName?: string
  userRole?: string
  userEmail?: string
  ipAddress?: string
  userAgent?: string
  action?: string
  endpoint?: string
  responseTime?: number
  responseStatus?: number
  errorMessage?: string
}

type AuditLogsResponse = {
  logs: AuditLog[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasMore: boolean
  stats: { info: number; warn: number; error: number }
}

type AuditExportResponse = {
  id: string
  fileName: string
  downloadUrl: string
  size: number
  format: 'pdf' | 'excel' | 'json' | 'csv'
  createdAt: string
}

const DEFAULT_STATS = { info: 0, warn: 0, error: 0 }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function shouldFallback(error: unknown): boolean {
  if (isConnectivityError(error)) return true
  return error instanceof ApiHttpError && error.status >= 500
}

function sanitizeText(value?: string, maxLength = 160): string | undefined {
  if (!value) return undefined
  const normalized = value
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized ? normalized.slice(0, maxLength) : undefined
}

function sanitizePage(value: number): number {
  return Math.max(1, Math.min(100000, Math.trunc(value || 1)))
}

function sanitizeLimit(value: number): number {
  return Math.max(1, Math.min(500, Math.trunc(value || 100)))
}

function sanitizeLevel(value?: string): AuditLog['level'] | undefined {
  if (!value) return undefined
  const normalized = value.trim().toUpperCase()
  if (normalized === 'INFO' || normalized === 'WARN' || normalized === 'ERROR') return normalized
  return undefined
}

function sanitizeDate(value?: string): string | undefined {
  if (!value) return undefined
  const normalized = value.trim()
  if (!normalized) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(normalized)) return normalized
  return undefined
}

function normalizeLevel(value: unknown): AuditLog['level'] {
  const normalized = asString(value, 'INFO').toUpperCase()
  if (normalized === 'WARN' || normalized === 'ERROR') return normalized
  return 'INFO'
}

function toAuditLog(value: unknown, index: number): AuditLog {
  const item = isRecord(value) ? (value as AuditLogApi) : {}
  const endpoint = asString(item.endpoint, '')
  const status = typeof item.responseStatus === 'number' ? ` [${item.responseStatus}]` : ''
  const details = asString(item.errorMessage, `${endpoint}${status}`)
  return {
    id: asString(item.id, `log-${Date.now()}-${index + 1}`),
    timestamp: asString(item.timestamp, new Date().toISOString()),
    user: asString(item.userDisplayName, asString(item.userIdentifier, asString(item.userId, 'Sistema'))),
    userId: sanitizeText(item.userId, 120),
    userIdentifier: sanitizeText(item.userIdentifier, 160),
    userDisplayName: sanitizeText(item.userDisplayName, 160),
    userEmail: sanitizeText(item.userEmail, 160),
    action: asString(item.action, 'UNKNOWN'),
    details: details || 'Sin detalles',
    resource: sanitizeText(endpoint, 240),
    ip: asString(item.ipAddress, 'N/A'),
    userAgent: asString(item.userAgent, 'N/A'),
    level: normalizeLevel(item.level),
  }
}

function normalizeStats(value: unknown): { info: number; warn: number; error: number } {
  const stats = isRecord(value) ? value : {}
  return {
    info: Math.max(0, Math.trunc(asNumber(stats.info, 0))),
    warn: Math.max(0, Math.trunc(asNumber(stats.warn, 0))),
    error: Math.max(0, Math.trunc(asNumber(stats.error, 0))),
  }
}

function normalizeLogsResponse(raw: unknown, page: number, limit: number): AuditLogsResponse {
  if (!isRecord(raw)) {
    return {
      logs: [],
      total: 0,
      page,
      limit,
      totalPages: 1,
      hasMore: false,
      stats: DEFAULT_STATS,
    }
  }

  const logsRaw = asArray<unknown>(raw.logs)
  const logs = logsRaw.map((item, index) => toAuditLog(item, index))
  const total = Math.max(0, Math.trunc(asNumber(raw.total, logs.length)))
  const totalPages = Math.max(1, Math.trunc(asNumber(raw.totalPages, Math.ceil(total / limit) || 1)))
  const safePage = Math.max(1, Math.trunc(asNumber(raw.page, page)))

  return {
    logs,
    total,
    page: safePage,
    limit: Math.max(1, Math.trunc(asNumber(raw.limit, limit))),
    totalPages,
    hasMore: asBoolean(raw.hasMore, safePage < totalPages),
    stats: normalizeStats(raw.stats),
  }
}

function sanitizeExportFormat(value: unknown): AuditExportResponse['format'] {
  const normalized = asString(value, 'json').toLowerCase()
  if (normalized === 'pdf' || normalized === 'excel' || normalized === 'csv') return normalized
  return 'json'
}

function normalizeExportResponse(raw: unknown, format: AuditExportResponse['format']): AuditExportResponse {
  const source = isRecord(raw) ? raw : {}
  return {
    id: asString(source.id, `export-${Date.now()}`),
    fileName: asString(source.fileName, `audit_logs_${Date.now()}.${format}`),
    downloadUrl: asString(source.downloadUrl, ''),
    size: Math.max(0, Math.trunc(asNumber(source.size, 0))),
    format: sanitizeExportFormat(source.format ?? format),
    createdAt: asString(source.createdAt, new Date().toISOString()),
  }
}

export const adminAuditApi = {
  getLogs: async (
    page = 1,
    limit = 100,
    filters?: { level?: string; userQuery?: string; userId?: string; search?: string; startDate?: string; endDate?: string }
  ) => {
    const safePage = sanitizePage(page)
    const safeLimit = sanitizeLimit(limit)
    const params = new URLSearchParams({
      page: String(safePage),
      limit: String(safeLimit),
    })

    const level = sanitizeLevel(filters?.level)
    const userQuery = sanitizeText(filters?.userQuery ?? filters?.userId, 160)
    const search = sanitizeText(filters?.search, 200)
    const startDate = sanitizeDate(filters?.startDate)
    const endDate = sanitizeDate(filters?.endDate)

    if (level) params.set('level', level)
    if (userQuery) params.set('userQuery', userQuery)
    if (search) params.set('search', search)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)

    try {
      const response = await api.get<unknown>(`/admin/audit/logs?${params.toString()}`)
      return normalizeLogsResponse(response, safePage, safeLimit)
    } catch (error) {
      if (shouldFallback(error)) {
        return normalizeLogsResponse(null, safePage, safeLimit)
      }
      throw error
    }
  },

  exportLogs: async (
    format: 'pdf' | 'excel' | 'json' | 'csv',
    filters?: { startDate?: string; endDate?: string; level?: string; userQuery?: string; userId?: string }
  ) => {
    const safeFormat = sanitizeExportFormat(format)
    const params = new URLSearchParams({ format: safeFormat })
    const startDate = sanitizeDate(filters?.startDate)
    const endDate = sanitizeDate(filters?.endDate)
    const level = sanitizeLevel(filters?.level)
    const userQuery = sanitizeText(filters?.userQuery ?? filters?.userId, 160)

    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (level) params.set('level', level)
    if (userQuery) params.set('userQuery', userQuery)

    const response = await api.get<unknown>(`/admin/audit/export?${params.toString()}`)
    return normalizeExportResponse(response, safeFormat)
  },
}
