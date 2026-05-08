import type { AuditLog } from '@/types'
import { adminAuditApi } from './admin-audit'
import { adminReportApi } from './admin-report'

type AuditExportFormat = 'pdf' | 'excel' | 'json' | 'csv'

type AuditExportOptions = {
  format: AuditExportFormat
  startDate?: string
  endDate?: string
  level?: string
  userQuery?: string
  userId?: string
  fileNamePrefix?: string
}

type AuditExportResult = {
  id: string
  fileName: string
  downloadUrl: string
  size: number
  format: AuditExportFormat
  createdAt: string
  source: 'backend' | 'client-fallback'
}

function sanitizeFormat(value: unknown): AuditExportFormat {
  const normalized = typeof value === 'string' ? value.toLowerCase() : 'json'
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

function sanitizeLevel(value?: string): 'INFO' | 'WARN' | 'ERROR' | undefined {
  if (!value) return undefined
  const normalized = value.trim().toUpperCase()
  if (normalized === 'INFO' || normalized === 'WARN' || normalized === 'ERROR') return normalized
  return undefined
}

function sanitizeText(value?: string, maxLength = 120): string | undefined {
  if (!value) return undefined
  const normalized = value
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
  return normalized || undefined
}

function sanitizeFileNamePrefix(value?: string): string {
  if (!value) return 'audit-report'
  const normalized = value
    .replace(/[\u0000-\u001f]+/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return normalized || 'audit-report'
}

function buildDownloadUrl(downloadUrl: string): string {
  if (/^https?:\/\//i.test(downloadUrl)) return downloadUrl
  if (downloadUrl.startsWith('/')) return downloadUrl
  return `/${downloadUrl.replace(/^\/+/, '')}`
}

function triggerRemoteDownload(downloadUrl: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const href = buildDownloadUrl(downloadUrl)
  const link = document.createElement('a')
  link.href = href
  link.target = '_blank'
  link.rel = 'noreferrer'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const escapeCsv = (value: unknown): string => {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const toCsv = (logs: AuditLog[]): string => {
  const headers = ['timestamp', 'level', 'user', 'action', 'details', 'resource', 'ip', 'userAgent']
  const rows = logs.map((log) =>
    [log.timestamp, log.level, log.user, log.action, log.details, log.resource ?? '', log.ip, log.userAgent]
      .map(escapeCsv)
      .join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

const toJson = (logs: AuditLog[]) => JSON.stringify(logs, null, 2)

const toSimplePdfBytes = (logs: AuditLog[]) => {
  const encoder = new TextEncoder()
  const toAscii = (text: string) =>
    text
      .replace(/[^\x20-\x7E]/g, '?')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')

  const lines = [
    `Audit report generated: ${new Date().toISOString()}`,
    `Total events: ${logs.length}`,
    '------------------------------------------------------------',
    ...logs.slice(0, 220).map((log) => {
      const details = log.details.length > 80 ? `${log.details.slice(0, 77)}...` : log.details
      return `${log.timestamp} | ${log.level} | ${log.user} | ${log.action} | ${details}`
    }),
  ]

  const content = ['BT', '/F1 9 Tf', '50 800 Td', '11 TL', ...lines.map((line) => `(${toAscii(line)}) Tj\nT*`), 'ET'].join(
    '\n'
  )

  const contentBytes = encoder.encode(content)
  const objects: string[] = []
  objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n')
  objects.push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n')
  objects.push(
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n'
  )
  objects.push('4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n')
  objects.push(`5 0 obj << /Length ${contentBytes.length} >> stream\n${content}\nendstream\nendobj\n`)

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = [0]
  for (const obj of objects) {
    offsets.push(encoder.encode(pdf).length)
    pdf += obj
  }
  const xrefStart = encoder.encode(pdf).length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${offsets[index].toString().padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return encoder.encode(pdf)
}

function mimeForFormat(format: AuditExportFormat): string {
  switch (format) {
    case 'json':
      return 'application/json;charset=utf-8'
    case 'csv':
      return 'text/csv;charset=utf-8'
    case 'excel':
      return 'application/vnd.ms-excel;charset=utf-8'
    case 'pdf':
      return 'application/pdf'
  }
}

function extensionForFormat(format: AuditExportFormat): string {
  return format === 'excel' ? 'csv' : format
}

function triggerBlobDownload(blob: Blob, fileName: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('La exportación está disponible solo en el navegador.')
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
  return url
}

async function fetchAllAuditLogs(options: AuditExportOptions): Promise<AuditLog[]> {
  const all: AuditLog[] = []
  let page = 1
  let hasMore = true
  while (hasMore && page <= 50) {
    const response = await adminAuditApi.getLogs(page, 500, {
      level: sanitizeLevel(options.level),
      userQuery: sanitizeText(options.userQuery ?? options.userId, 160),
      startDate: sanitizeDate(options.startDate),
      endDate: sanitizeDate(options.endDate),
    })
    all.push(...response.logs)
    hasMore = Boolean(response.hasMore) && page < response.totalPages
    page += 1
  }
  return all
}

async function exportWithClientFallback(options: AuditExportOptions): Promise<AuditExportResult> {
  const safeFormat = sanitizeFormat(options.format)
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const extension = extensionForFormat(safeFormat)
  const fileName = `${sanitizeFileNamePrefix(options.fileNamePrefix)}-${timestamp}.${extension}`
  const logs = await fetchAllAuditLogs(options)

  let blob: Blob
  if (safeFormat === 'json') {
    blob = new Blob([toJson(logs)], { type: mimeForFormat(safeFormat) })
  } else if (safeFormat === 'pdf') {
    blob = new Blob([toSimplePdfBytes(logs)], { type: mimeForFormat(safeFormat) })
  } else {
    blob = new Blob([toCsv(logs)], { type: mimeForFormat(safeFormat) })
  }

  const downloadUrl = triggerBlobDownload(blob, fileName)
  return {
    id: `export-${Date.now()}`,
    fileName,
    downloadUrl,
    size: blob.size,
    format: safeFormat,
    createdAt: new Date().toISOString(),
    source: 'client-fallback',
  }
}

export const exportAuditLogsClient = async (options: AuditExportOptions): Promise<AuditExportResult> => {
  const safeOptions: AuditExportOptions = {
    format: sanitizeFormat(options.format),
    startDate: sanitizeDate(options.startDate),
    endDate: sanitizeDate(options.endDate),
    level: sanitizeLevel(options.level),
    userQuery: sanitizeText(options.userQuery ?? options.userId, 160),
    fileNamePrefix: sanitizeFileNamePrefix(options.fileNamePrefix),
  }

  try {
    const backend = await adminReportApi.exportAuditReport({
      format: safeOptions.format,
      startDate: safeOptions.startDate,
      endDate: safeOptions.endDate,
      level: safeOptions.level,
      user: safeOptions.userQuery,
    })
    if (backend.downloadUrl) {
      triggerRemoteDownload(backend.downloadUrl)
      return {
        id: backend.id,
        fileName: backend.fileName,
        downloadUrl: buildDownloadUrl(backend.downloadUrl),
        size: backend.size,
        format: backend.format,
        createdAt: backend.createdAt,
        source: 'backend',
      }
    }
  } catch {
    // Fall through to client-generated export when backend export is unavailable.
  }

  return exportWithClientFallback(safeOptions)
}
