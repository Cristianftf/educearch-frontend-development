import { api } from './api-client'

export const adminReportApi = {
  exportAuditReport: (config: {
    format: 'pdf' | 'excel' | 'json' | 'csv'
    startDate?: string
    endDate?: string
    level?: string
    user?: string
  }) =>
    api.post<{
      id: string
      fileName: string
      downloadUrl: string
      size: number
      format: string
      createdAt: string
      status: string
    }>('/admin/audit/export', config),

  // Alias para compatibilidad con los componentes
  getAuditExport: (format: 'pdf' | 'excel' | 'json' | 'csv', startDate?: string, endDate?: string) =>
    api.get<{
      id: string
      fileName: string
      downloadUrl: string
      size: number
      format: string
      createdAt: string
    }>(`/admin/audit/export?format=${format}${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`),
}
