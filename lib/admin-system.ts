import type { SystemHealth, SystemSettings, Alert } from '@/types'
import { api } from './api-client'

export const adminSystemApi = {
  getHealth: () => api.get<SystemHealth>('/admin/health'),

  getSettings: () => api.get<SystemSettings>('/admin/settings'),

  updateSettings: (settings: Partial<SystemSettings>) =>
    api.put<SystemSettings>('/admin/settings', settings),

  testPubmedConnection: () =>
    api.post<{ success: boolean; message: string; timestamp: string }>('/admin/test-pubmed'),

  getAlerts: () => api.get<{ alerts: Alert[]; count: number }>('/admin/alerts'),

  createAlert: (alert: Omit<Alert, 'id'>) =>
    api.post<Alert>('/admin/alerts', alert),

  updateAlert: (id: string, alert: Partial<Alert>) =>
    api.put<Alert>(`/admin/alerts/${id}`, alert),

  deleteAlert: (id: string) => api.delete<void>(`/admin/alerts/${id}`),

  createBackup: (options: { includeUsers: boolean; includeLogs: boolean }) =>
    api.post<{ backupId: string; downloadUrl?: string; status: string; message: string }>('/admin/backup', options),

  getBackups: () =>
    api.get<{ backups: Array<{ id: string; createdAt: string; size: number; status: string }>; count: number }>('/admin/backups'),

  restoreBackup: (backupId: string) =>
    api.post<{ backupId: string; status: string; message: string }>(`/admin/backups/${backupId}/restore`),
}
