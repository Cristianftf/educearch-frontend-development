import { api } from './api-client'

type ReportFormat = 'pdf' | 'excel' | 'json' | 'csv'

type AuditReportResult = {
  id: string
  fileName: string
  downloadUrl: string
  size: number
  format: ReportFormat
  createdAt: string
  status?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function asOptionalString(value: unknown): string | undefined {
  const normalized = asString(value, '').trim()
  return normalized ? normalized : undefined
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function sanitizeFormat(value: unknown): ReportFormat {
  const normalized = asString(value, 'json').toLowerCase()
  if (normalized === 'pdf' || normalized === 'excel' || normalized === 'csv') return normalized
  return 'json'
}

function sanitizeDate(value?: string): string | undefined {
  if (!value) return undefined
  const normalized = value.trim()
  if (!normalized) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(normalized)) return normalized
  return undefined
}

function sanitizeUser(value?: string): string | undefined {
  if (!value) return undefined
  const normalized = value
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return normalized || undefined
}

function normalizeAuditReport(raw: unknown, fallbackFormat: ReportFormat): AuditReportResult {
  const source = isRecord(raw) ? raw : {}
  const format = sanitizeFormat(source.format ?? fallbackFormat)
  return {
    id: asString(source.id, `report-${Date.now()}`),
    fileName: asString(source.fileName, `audit-report-${Date.now()}.${format}`),
    downloadUrl: asString(source.downloadUrl, ''),
    size: Math.max(0, Math.trunc(asNumber(source.size, 0))),
    format,
    createdAt: asString(source.createdAt, new Date().toISOString()),
    status: asOptionalString(source.status),
  }
}

export const adminReportApi = {
  exportAuditReport: async (config: {
    format: ReportFormat
    startDate?: string
    endDate?: string
    level?: string
    user?: string
  }) => {
    const payload: Record<string, unknown> = {
      format: sanitizeFormat(config.format),
    }
    const startDate = sanitizeDate(config.startDate)
    const endDate = sanitizeDate(config.endDate)
    const user = sanitizeUser(config.user)
    const level = typeof config.level === 'string' ? config.level.trim().toUpperCase() : undefined

    if (startDate) payload.startDate = startDate
    if (endDate) payload.endDate = endDate
    if (level === 'INFO' || level === 'WARN' || level === 'ERROR') payload.level = level
    if (user) payload.userQuery = user

    const response = await api.post<unknown>('/admin/audit/export', payload)
    return normalizeAuditReport(response, sanitizeFormat(config.format))
  },

  getAuditExport: async (format: ReportFormat, startDate?: string, endDate?: string) => {
    const safeFormat = sanitizeFormat(format)
    const params = new URLSearchParams({ format: safeFormat })
    const safeStartDate = sanitizeDate(startDate)
    const safeEndDate = sanitizeDate(endDate)
    if (safeStartDate) params.set('startDate', safeStartDate)
    if (safeEndDate) params.set('endDate', safeEndDate)
    const response = await api.get<unknown>(`/admin/audit/export?${params.toString()}`)
    return normalizeAuditReport(response, safeFormat)
  },
}
