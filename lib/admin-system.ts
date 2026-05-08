import type {
  SystemHealth,
  AdminSystemConfiguration,
  Alert,
  AdminDashboardData,
  SystemOverview,
  ExternalApiDiagnostics,
  SystemServiceStatus,
  AdminSystemErrorMonitoring,
} from '@/types'
import { api, ApiHttpError } from './api-client'
import { isConnectivityError } from './api-errors'

type BackupRecord = {
  id: string
  createdAt: string
  size: number
  status: string
  type?: string
  progress?: number
  downloadUrl?: string
}

type BackupsResponse = {
  backups: BackupRecord[]
  count: number
}

const DEFAULT_DASHBOARD: AdminDashboardData = {
  stats: {
    totalUsers: 0,
    students: 0,
    professors: 0,
    admins: 0,
    activeStudents: 0,
    searchesToday: 0,
    searchesYesterday: 0,
    searchesChange: 0,
    searchesChangePercent: 0,
    usersLast30Days: 0,
    usersPrev30Days: 0,
    usersChangePercent: 0,
  },
  resources: {
    cpu: 0,
    memory: 0,
    disk: 0,
    latency: {
      p50: 0,
      p75: 0,
      p95: 0,
      p99: 0,
    },
    pubmedUsage: {
      used: 0,
      limit: 0,
      percent: 0,
    },
  },
  systemStatus: {
    status: 'DEGRADED',
    lastCheck: new Date().toISOString(),
    uptimeMs: 0,
  },
  services: [],
  alerts: [],
  activity: {
    users: [],
    system: [],
    api: [],
  },
}

const DEFAULT_HEALTH: SystemHealth = {
  status: 'DEGRADED',
  lastCheck: new Date().toISOString(),
  cpu: 0,
  memory: 0,
  disk: 0,
  dbConnections: 0,
  cacheHitRatio: 0,
  apiLatency: {
    p50: 0,
    p75: 0,
    p95: 0,
    p99: 0,
  },
  activeUsers: 0,
  requestsPerMinute: 0,
  services: [],
  pubmedUsage: {
    used: 0,
    limit: 0,
    percent: 0,
  },
}

const DEFAULT_OVERVIEW: SystemOverview = {
  timestamp: new Date().toISOString(),
  server: {
    os: 'Unknown',
    java: 'Unknown',
    runtime: 'Unknown',
    uptimeMs: 0,
  },
  database: {
    engine: 'Unknown',
    sizeBytes: 0,
    connections: 0,
    maxConnections: 0,
  },
  redis: {
    available: false,
    usedBytes: 0,
    maxBytes: 0,
    hitRate: 0,
    keys: 0,
  },
  storage: {
    totalBytes: 0,
    freeBytes: 0,
  },
  scheduledTasks: [],
}

const DEFAULT_EXTERNAL_DIAGNOSTICS: ExternalApiDiagnostics = {
  status: 'DOWN',
  testedAt: new Date().toISOString(),
  query: 'evidence based medicine',
  summary: {
    total: 0,
    online: 0,
    warning: 0,
    offline: 0,
  },
  providers: [],
  message: 'Sin datos de diagnostico',
}

const DEFAULT_ERROR_MONITORING: AdminSystemErrorMonitoring = {
  generatedAt: new Date().toISOString(),
  summary: {
    windowMinutes: 120,
    totalErrors: 0,
    totalWarnings: 0,
    trackedInsights: 0,
    criticalInsights: 0,
  },
  analysisStatus: {
    lastRun: undefined,
    lastProcessedErrors: 0,
    lastUpdatedInsights: 0,
  },
  insights: [],
  recentErrors: [],
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function asOptionalString(value: unknown): string | undefined {
  const normalized = asString(value, '').trim()
  return normalized.length > 0 ? normalized : undefined
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function asOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function shouldFallback(error: unknown): boolean {
  if (isConnectivityError(error)) return true
  return error instanceof ApiHttpError && error.status >= 500
}

function sanitizeQueryText(queryText?: string): string {
  const cleaned = asString(queryText, '')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return 'evidence based medicine'
  return cleaned.slice(0, 180)
}

function sanitizeCacheNames(cacheNames: string[]): string[] {
  const normalized = cacheNames
    .map((name) => asString(name, '').toLowerCase().trim())
    .filter(Boolean)
    .map((name) => name.replace(/[^a-z0-9._-]/g, ''))
    .filter(Boolean)
  return normalized.length > 0 ? Array.from(new Set(normalized)).slice(0, 12) : ['all']
}

function sanitizeAlertPayload(alert: Partial<Alert>): Partial<Alert> {
  const condition = asString(alert.condition, 'SYSTEM_ALERT').slice(0, 240)
  const action = asString(alert.action, 'NOTIFY').slice(0, 120)
  const severity: Alert['severity'] = alert.severity === 'critical' ? 'critical' : 'warning'
  return {
    ...alert,
    condition,
    action,
    severity,
    isActive: alert.isActive !== false,
    lastTriggered: asOptionalString(alert.lastTriggered),
  }
}

function normalizeSystemHealth(value: unknown): SystemHealth {
  if (!isRecord(value)) return DEFAULT_HEALTH
  const apiLatency = isRecord(value.apiLatency) ? value.apiLatency : {}
  const pubmedUsage = isRecord(value.pubmedUsage) ? value.pubmedUsage : {}
  const servicesRaw = asArray<Record<string, unknown>>(value.services)
  const services: SystemServiceStatus[] = servicesRaw.map((service, index) => {
    const name = asString(service?.name, `Service ${index + 1}`)
    const statusRaw = asString(service?.status, 'warning').toLowerCase()
    const status: SystemServiceStatus['status'] =
      statusRaw === 'online' || statusRaw === 'warning' || statusRaw === 'offline'
        ? statusRaw
        : 'warning'
    return {
      name,
      status,
      latency: asOptionalNumber(service?.latency),
      uptime: asOptionalString(service?.uptime),
      lastCheck: asOptionalString(service?.lastCheck),
    }
  })

  return {
    status: asString(value.status, DEFAULT_HEALTH.status),
    lastCheck: asString(value.lastCheck, new Date().toISOString()),
    cpu: clamp(asNumber(value.cpu, 0), 0, 100),
    memory: clamp(asNumber(value.memory, 0), 0, 100),
    disk: clamp(asNumber(value.disk, 0), 0, 100),
    dbConnections: Math.max(0, Math.trunc(asNumber(value.dbConnections, 0))),
    cacheHitRatio: clamp(asNumber(value.cacheHitRatio, 0), 0, 100),
    apiLatency: {
      p50: Math.max(0, asNumber(apiLatency.p50, 0)),
      p75: Math.max(0, asNumber(apiLatency.p75, 0)),
      p95: Math.max(0, asNumber(apiLatency.p95, 0)),
      p99: Math.max(0, asNumber(apiLatency.p99, 0)),
    },
    activeUsers: Math.max(0, Math.trunc(asNumber(value.activeUsers, 0))),
    requestsPerMinute: Math.max(0, Math.trunc(asNumber(value.requestsPerMinute, 0))),
    services,
    pubmedUsage: {
      used: Math.max(0, Math.trunc(asNumber(pubmedUsage.used, 0))),
      limit: Math.max(0, Math.trunc(asNumber(pubmedUsage.limit, 0))),
      percent: clamp(asNumber(pubmedUsage.percent, 0), 0, 100),
    },
  }
}

function normalizeDashboard(value: unknown): AdminDashboardData {
  if (!isRecord(value)) return DEFAULT_DASHBOARD
  const stats = isRecord(value.stats) ? value.stats : {}
  const resources = isRecord(value.resources) ? value.resources : {}
  const latency = isRecord(resources.latency) ? resources.latency : {}
  const pubmedUsage = isRecord(resources.pubmedUsage) ? resources.pubmedUsage : {}
  const systemStatus = isRecord(value.systemStatus) ? value.systemStatus : {}
  const activity = isRecord(value.activity) ? value.activity : {}

  return {
    stats: {
      totalUsers: Math.max(0, Math.trunc(asNumber(stats.totalUsers, 0))),
      students: Math.max(0, Math.trunc(asNumber(stats.students, 0))),
      professors: Math.max(0, Math.trunc(asNumber(stats.professors, 0))),
      admins: Math.max(0, Math.trunc(asNumber(stats.admins, 0))),
      activeStudents: Math.max(0, Math.trunc(asNumber(stats.activeStudents, 0))),
      searchesToday: Math.max(0, Math.trunc(asNumber(stats.searchesToday, 0))),
      searchesYesterday: Math.max(0, Math.trunc(asNumber(stats.searchesYesterday, 0))),
      searchesChange: Math.trunc(asNumber(stats.searchesChange, 0)),
      searchesChangePercent: asNumber(stats.searchesChangePercent, 0),
      usersLast30Days: Math.max(0, Math.trunc(asNumber(stats.usersLast30Days, 0))),
      usersPrev30Days: Math.max(0, Math.trunc(asNumber(stats.usersPrev30Days, 0))),
      usersChangePercent: asNumber(stats.usersChangePercent, 0),
    },
    resources: {
      cpu: clamp(asNumber(resources.cpu, 0), 0, 100),
      memory: clamp(asNumber(resources.memory, 0), 0, 100),
      disk: clamp(asNumber(resources.disk, 0), 0, 100),
      latency: {
        p50: Math.max(0, asNumber(latency.p50, 0)),
        p75: Math.max(0, asNumber(latency.p75, 0)),
        p95: Math.max(0, asNumber(latency.p95, 0)),
        p99: Math.max(0, asNumber(latency.p99, 0)),
      },
      pubmedUsage: {
        used: Math.max(0, Math.trunc(asNumber(pubmedUsage.used, 0))),
        limit: Math.max(0, Math.trunc(asNumber(pubmedUsage.limit, 0))),
        percent: clamp(asNumber(pubmedUsage.percent, 0), 0, 100),
      },
    },
    systemStatus: {
      status: asString(systemStatus.status, 'DEGRADED'),
      lastCheck: asString(systemStatus.lastCheck, new Date().toISOString()),
      uptimeMs: Math.max(0, Math.trunc(asNumber(systemStatus.uptimeMs, 0))),
    },
    services: asArray<Record<string, unknown>>(value.services).map((item) => {
      const statusRaw = asString(item.status, 'warning').toLowerCase()
      const status: SystemServiceStatus['status'] =
        statusRaw === 'online' || statusRaw === 'warning' || statusRaw === 'offline'
          ? statusRaw
          : 'warning'
      return {
        name: asString(item.name, 'Service'),
        status,
        latency: asOptionalNumber(item.latency),
        uptime: asOptionalString(item.uptime),
        lastCheck: asOptionalString(item.lastCheck),
      }
    }),
    alerts: asArray<Record<string, unknown>>(value.alerts).map((alert, index) => ({
      id: asString(alert.id, `alert-${index + 1}`),
      type:
        alert.type === 'info' || alert.type === 'warning' || alert.type === 'success' || alert.type === 'error'
          ? alert.type
          : 'info',
      message: asString(alert.message, 'Alerta del sistema'),
      timestamp: asString(alert.timestamp, new Date().toISOString()),
    })),
    activity: {
      users: asArray<Record<string, unknown>>(activity.users).map((item, index) => ({
        id: asString(item.id, `user-activity-${index + 1}`),
        action: asString(item.action, 'Sin accion'),
        user: asOptionalString(item.user),
        timestamp: asString(item.timestamp, new Date().toISOString()),
      })),
      system: asArray<Record<string, unknown>>(activity.system).map((item, index) => ({
        id: asString(item.id, `system-activity-${index + 1}`),
        action: asString(item.action, 'Sin accion'),
        user: asOptionalString(item.user),
        timestamp: asString(item.timestamp, new Date().toISOString()),
      })),
      api: asArray<Record<string, unknown>>(activity.api).map((item) => ({
        endpoint: asString(item.endpoint, '/unknown'),
        calls: Math.max(0, Math.trunc(asNumber(item.calls, 0))),
        status: asString(item.status, 'UNKNOWN'),
      })),
    },
  }
}

function normalizeSystemOverview(value: unknown): SystemOverview {
  if (!isRecord(value)) return DEFAULT_OVERVIEW
  const server = isRecord(value.server) ? value.server : {}
  const database = isRecord(value.database) ? value.database : {}
  const redis = isRecord(value.redis) ? value.redis : {}
  const storage = isRecord(value.storage) ? value.storage : {}
  const tasks = asArray<Record<string, unknown>>(value.scheduledTasks)
  return {
    timestamp: asString(value.timestamp, new Date().toISOString()),
    server: {
      os: asString(server.os, 'Unknown'),
      java: asString(server.java, 'Unknown'),
      runtime: asString(server.runtime, 'Unknown'),
      uptimeMs: Math.max(0, Math.trunc(asNumber(server.uptimeMs, 0))),
    },
    database: {
      engine: asString(database.engine, 'Unknown'),
      sizeBytes: Math.max(0, Math.trunc(asNumber(database.sizeBytes, 0))),
      connections: Math.max(0, Math.trunc(asNumber(database.connections, 0))),
      maxConnections: Math.max(0, Math.trunc(asNumber(database.maxConnections, 0))),
    },
    redis: {
      available: asBoolean(redis.available, false),
      usedBytes: Math.max(0, Math.trunc(asNumber(redis.usedBytes, 0))),
      maxBytes: Math.max(0, Math.trunc(asNumber(redis.maxBytes, 0))),
      hitRate: clamp(asNumber(redis.hitRate, 0), 0, 100),
      keys: Math.max(0, Math.trunc(asNumber(redis.keys, 0))),
    },
    storage: {
      totalBytes: Math.max(0, Math.trunc(asNumber(storage.totalBytes, 0))),
      freeBytes: Math.max(0, Math.trunc(asNumber(storage.freeBytes, 0))),
    },
    scheduledTasks: tasks.map((task, index) => ({
      name: asString(task.name, `Task ${index + 1}`),
      schedule: asString(task.schedule, 'N/A'),
      status: asString(task.status, 'UNKNOWN'),
    })),
  }
}

function normalizeExternalApiDiagnostics(value: unknown): ExternalApiDiagnostics {
  if (!isRecord(value)) return DEFAULT_EXTERNAL_DIAGNOSTICS
  const summary = isRecord(value.summary) ? value.summary : {}
  const providers = asArray<Record<string, unknown>>(value.providers).map((provider, index) => {
    const statusRaw = asString(provider.status, 'offline').toLowerCase()
    const status: SystemServiceStatus['status'] =
      statusRaw === 'online' || statusRaw === 'warning' || statusRaw === 'offline'
        ? statusRaw
        : 'offline'
    return {
      id: asString(provider.id, `provider-${index + 1}`),
      name: asString(provider.name, `Provider ${index + 1}`),
      description: asOptionalString(provider.description),
      status,
      httpStatus: Math.max(0, Math.trunc(asNumber(provider.httpStatus, 0))),
      latencyMs: Math.max(0, Math.trunc(asNumber(provider.latencyMs, 0))),
      resultCount: Math.max(0, Math.trunc(asNumber(provider.resultCount, 0))),
      message: asOptionalString(provider.message),
      error: typeof provider.error === 'string' ? provider.error : null,
      docsUrl: asOptionalString(provider.docsUrl),
      requestUrl: asOptionalString(provider.requestUrl),
      lastCheck: asOptionalString(provider.lastCheck),
    }
  })
  return {
    status:
      value.status === 'UP' || value.status === 'DEGRADED' || value.status === 'DOWN'
        ? value.status
        : 'DOWN',
    testedAt: asString(value.testedAt, new Date().toISOString()),
    query: asString(value.query, 'evidence based medicine'),
    summary: {
      total: Math.max(0, Math.trunc(asNumber(summary.total, providers.length))),
      online: Math.max(0, Math.trunc(asNumber(summary.online, 0))),
      warning: Math.max(0, Math.trunc(asNumber(summary.warning, 0))),
      offline: Math.max(0, Math.trunc(asNumber(summary.offline, 0))),
    },
    providers,
    message: asOptionalString(value.message),
  }
}

function normalizeBackupsResponse(value: unknown): BackupsResponse {
  if (!isRecord(value)) {
    return { backups: [], count: 0 }
  }
  const backups = asArray<Record<string, unknown>>(value.backups).map((backup, index) => ({
    id: asString(backup.id, `backup-${index + 1}`),
    createdAt: asString(backup.createdAt, new Date().toISOString()),
    size: Math.max(0, Math.trunc(asNumber(backup.size, 0))),
    status: asString(backup.status, 'UNKNOWN'),
    type: asOptionalString(backup.type),
    progress: Math.max(0, Math.min(100, Math.trunc(asNumber(backup.progress, 0)))),
    downloadUrl: asOptionalString(backup.downloadUrl),
  }))
  return {
    backups,
    count: Math.max(0, Math.trunc(asNumber(value.count, backups.length))),
  }
}

function normalizeInsightSeverity(value: unknown): 'critical' | 'high' | 'medium' | 'low' {
  const normalized = asString(value, 'medium').toLowerCase()
  if (normalized === 'critical' || normalized === 'high' || normalized === 'low') return normalized
  return 'medium'
}

function normalizeErrorMonitoringResponse(value: unknown): AdminSystemErrorMonitoring {
  if (!isRecord(value)) return DEFAULT_ERROR_MONITORING
  const summary = isRecord(value.summary) ? value.summary : {}
  const analysisStatus = isRecord(value.analysisStatus) ? value.analysisStatus : {}
  const insightsRaw = asArray<Record<string, unknown>>(value.insights)
  const recentRaw = asArray<Record<string, unknown>>(value.recentErrors)

  return {
    generatedAt: asString(value.generatedAt, new Date().toISOString()),
    summary: {
      windowMinutes: Math.max(1, Math.trunc(asNumber(summary.windowMinutes, 120))),
      totalErrors: Math.max(0, Math.trunc(asNumber(summary.totalErrors, 0))),
      totalWarnings: Math.max(0, Math.trunc(asNumber(summary.totalWarnings, 0))),
      trackedInsights: Math.max(0, Math.trunc(asNumber(summary.trackedInsights, 0))),
      criticalInsights: Math.max(0, Math.trunc(asNumber(summary.criticalInsights, 0))),
    },
    analysisStatus: {
      lastRun: asOptionalString(analysisStatus.lastRun),
      lastProcessedErrors: Math.max(0, Math.trunc(asNumber(analysisStatus.lastProcessedErrors, 0))),
      lastUpdatedInsights: Math.max(0, Math.trunc(asNumber(analysisStatus.lastUpdatedInsights, 0))),
    },
    insights: insightsRaw.map((item, index) => ({
      id: asString(item.id, `insight-${index + 1}`),
      fingerprint: asString(item.fingerprint, ''),
      endpoint: asOptionalString(item.endpoint),
      httpStatus: asOptionalNumber(item.httpStatus),
      severity: normalizeInsightSeverity(item.severity),
      errorType: asOptionalString(item.errorType),
      errorMessage: asOptionalString(item.errorMessage),
      occurrences: Math.max(1, Math.trunc(asNumber(item.occurrences, 1))),
      firstSeen: asOptionalString(item.firstSeen),
      lastSeen: asOptionalString(item.lastSeen),
      lastAnalyzedAt: asOptionalString(item.lastAnalyzedAt),
      aiDiagnosis: asOptionalString(item.aiDiagnosis),
      aiConfidence: asOptionalNumber(item.aiConfidence),
      recommendations: asArray<unknown>(item.recommendations)
        .map((rec) => asString(rec, ''))
        .filter(Boolean)
        .slice(0, 10),
    })),
    recentErrors: recentRaw.map((item, index) => ({
      id: asString(item.id, `recent-error-${index + 1}`),
      timestamp: asOptionalString(item.timestamp),
      endpoint: asOptionalString(item.endpoint),
      httpStatus: asOptionalNumber(item.httpStatus),
      responseTime: asOptionalNumber(item.responseTime),
      userId: asOptionalString(item.userId),
      errorMessage: asOptionalString(item.errorMessage),
      correlationId: asOptionalString(item.correlationId),
    })),
  }
}

function normalizeAlertsResponse(value: unknown): { alerts: Alert[]; count: number } {
  if (!isRecord(value)) return { alerts: [], count: 0 }
  const alerts = asArray<Record<string, unknown>>(value.alerts).map((alert, index) => ({
    id: asString(alert.id, `alert-${index + 1}`),
    condition: asString(alert.condition, ''),
    action: asString(alert.action, ''),
    severity: (alert.severity === 'critical' ? 'critical' : 'warning') as Alert['severity'],
    isActive: asBoolean(alert.isActive, true),
    lastTriggered: asOptionalString(alert.lastTriggered),
  }))
  return {
    alerts,
    count: Math.max(0, Math.trunc(asNumber(value.count, alerts.length))),
  }
}

export const adminSystemApi = {
  getHealth: async () => {
    try {
      const response = await api.get<unknown>('/admin/health')
      return normalizeSystemHealth(response)
    } catch (error) {
      if (shouldFallback(error)) return DEFAULT_HEALTH
      throw error
    }
  },

  getDashboard: async () => {
    try {
      const response = await api.get<unknown>('/admin/dashboard')
      return normalizeDashboard(response)
    } catch (error) {
      if (shouldFallback(error)) return DEFAULT_DASHBOARD
      throw error
    }
  },

  getSystemOverview: async () => {
    try {
      const response = await api.get<unknown>('/admin/system/overview')
      return normalizeSystemOverview(response)
    } catch (error) {
      if (shouldFallback(error)) return DEFAULT_OVERVIEW
      throw error
    }
  },

  getSettings: async () => {
    const response = await api.get<AdminSystemConfiguration>('/admin/settings')
    return isRecord(response) ? response : {}
  },

  updateSettings: (settings: AdminSystemConfiguration) =>
    api.put<void>('/admin/settings', isRecord(settings) ? settings : {}),

  testPubmedConnection: async () => {
    try {
      const response = await api.post<unknown>('/admin/test-pubmed')
      if (!isRecord(response)) {
        return { success: false, message: 'Respuesta invalida del servidor', timestamp: new Date().toISOString() }
      }
      return {
        success: asBoolean(response.success, false),
        message: asString(response.message, 'Sin mensaje'),
        timestamp: asString(response.timestamp, new Date().toISOString()),
      }
    } catch (error) {
      if (shouldFallback(error)) {
        return {
          success: false,
          message: 'No fue posible validar la conexion con PubMed en este momento.',
          timestamp: new Date().toISOString(),
        }
      }
      throw error
    }
  },

  checkExternalApis: async (queryText?: string) => {
    try {
      const response = await api.post<unknown>('/admin/external-apis/check', {
        queryText: sanitizeQueryText(queryText),
      })
      return normalizeExternalApiDiagnostics(response)
    } catch (error) {
      if (shouldFallback(error)) return DEFAULT_EXTERNAL_DIAGNOSTICS
      throw error
    }
  },

  getAlerts: async () => {
    try {
      const response = await api.get<unknown>('/admin/alerts')
      return normalizeAlertsResponse(response)
    } catch (error) {
      if (shouldFallback(error)) return { alerts: [], count: 0 }
      throw error
    }
  },

  createAlert: (alert: Omit<Alert, 'id'>) =>
    api.post<Alert>('/admin/alerts', sanitizeAlertPayload(alert)),

  updateAlert: (id: string, alert: Partial<Alert>) =>
    api.put<Alert>(`/admin/alerts/${encodeURIComponent(id)}`, sanitizeAlertPayload(alert)),

  deleteAlert: (id: string) => api.delete<void>(`/admin/alerts/${encodeURIComponent(id)}`),

  createBackup: (options: { includeUsers: boolean; includeLogs: boolean }) =>
    api.post<{ backupId: string; downloadUrl?: string; status: string; message: string }>('/admin/backup', {
      includeUsers: options?.includeUsers === true,
      includeLogs: options?.includeLogs === true,
    }),

  getBackups: async () => {
    try {
      const response = await api.get<unknown>('/admin/backups')
      return normalizeBackupsResponse(response)
    } catch (error) {
      if (shouldFallback(error)) return { backups: [], count: 0 }
      throw error
    }
  },

  restoreBackup: (backupId: string) =>
    api.post<{ backupId: string; status: string; message: string }>(
      `/admin/backups/${encodeURIComponent(asString(backupId, '').trim())}/restore`
    ),

  deleteBackup: (backupId: string) =>
    api.delete<void>(`/admin/backups/${encodeURIComponent(asString(backupId, '').trim())}`),

  clearCache: (cacheNames: string[] = ['all']) =>
    api.post<{ status: string; cleared: string[]; timestamp: string }>('/admin/cache/clear', {
      cacheNames: sanitizeCacheNames(cacheNames),
    }),

  optimizeDatabase: () =>
    api.post<{ status: string; message: string; timestamp: string }>('/admin/db/optimize'),

  cleanupLogs: (olderThanDays = 30) =>
    api.post<{ status: string; deleted: number; olderThanDays: number; timestamp: string }>(
      '/admin/logs/cleanup',
      { olderThanDays: Math.max(1, Math.min(3650, Math.trunc(olderThanDays))) }
    ),

  rebuildSearchIndexes: () =>
    api.post<{ status: string; message: string; timestamp: string }>('/admin/search/reindex'),

  getErrorMonitoring: async (windowMinutes = 120, limit = 25, refreshAnalysis = false) => {
    const safeWindow = Math.max(5, Math.min(1440, Math.trunc(windowMinutes || 120)))
    const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit || 25)))
    const params = new URLSearchParams({
      windowMinutes: String(safeWindow),
      limit: String(safeLimit),
      refreshAnalysis: String(Boolean(refreshAnalysis)),
    })

    try {
      const response = await api.get<unknown>(`/admin/monitoring/errors?${params.toString()}`)
      return normalizeErrorMonitoringResponse(response)
    } catch (error) {
      if (shouldFallback(error)) return DEFAULT_ERROR_MONITORING
      throw error
    }
  },

  analyzeErrorsNow: async (windowMinutes = 120, limit = 40) => {
    const safeWindow = Math.max(5, Math.min(1440, Math.trunc(windowMinutes || 120)))
    const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit || 40)))
    const response = await api.post<unknown>('/admin/monitoring/errors/analyze', {
      windowMinutes: safeWindow,
      limit: safeLimit,
    })
    return isRecord(response) ? response : {}
  },
}
