import type {
  SystemHealth,
  AdminSystemConfiguration,
  Alert,
  AdminDashboardData,
  SystemOverview,
  ExternalApiDiagnostics,
} from '@/types'
import { api } from './api-client'

export const adminSystemApi = {
  getHealth: () => api.get<SystemHealth>('/admin/health'),

  getDashboard: () => api.get<AdminDashboardData>('/admin/dashboard'),

  getSystemOverview: () => api.get<SystemOverview>('/admin/system/overview'),

  getSettings: () => api.get<AdminSystemConfiguration>('/admin/settings'),

  updateSettings: (settings: AdminSystemConfiguration) =>
    api.put<void>('/admin/settings', settings),

  testPubmedConnection: () =>
    api.post<{ success: boolean; message: string; timestamp: string }>('/admin/test-pubmed'),

  checkExternalApis: (queryText?: string) =>
    api.post<ExternalApiDiagnostics>('/admin/external-apis/check', {
      queryText,
    }),

  getAlerts: () => api.get<{ alerts: Alert[]; count: number }>('/admin/alerts'),

  createAlert: (alert: Omit<Alert, 'id'>) =>
    api.post<Alert>('/admin/alerts', alert),

  updateAlert: (id: string, alert: Partial<Alert>) =>
    api.put<Alert>(`/admin/alerts/${id}`, alert),

  deleteAlert: (id: string) => api.delete<void>(`/admin/alerts/${id}`),

  createBackup: (options: { includeUsers: boolean; includeLogs: boolean }) =>
    api.post<{ backupId: string; downloadUrl?: string; status: string; message: string }>('/admin/backup', options),

  getBackups: () =>
    api.get<{ backups: Array<{ id: string; createdAt: string; size: number; status: string; type?: string; progress?: number; downloadUrl?: string }>; count: number }>('/admin/backups'),

  restoreBackup: (backupId: string) =>
    api.post<{ backupId: string; status: string; message: string }>(`/admin/backups/${backupId}/restore`),

  deleteBackup: (backupId: string) =>
    api.delete<void>(`/admin/backups/${backupId}`),

  clearCache: (cacheNames: string[] = ['all']) =>
    api.post<{ status: string; cleared: string[]; timestamp: string }>('/admin/cache/clear', { cacheNames }),

  optimizeDatabase: () =>
    api.post<{ status: string; message: string; timestamp: string }>('/admin/db/optimize'),

  cleanupLogs: (olderThanDays = 30) =>
    api.post<{ status: string; deleted: number; olderThanDays: number; timestamp: string }>(
      '/admin/logs/cleanup',
      { olderThanDays }
    ),

  rebuildSearchIndexes: () =>
    api.post<{ status: string; message: string; timestamp: string }>('/admin/search/reindex'),
}
