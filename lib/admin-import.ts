import { api } from './api-client'

export const adminImportApi = {
  importCsvUsers: (users: any[]) =>
    api.post<{
      created: number
      updated: number
      failed: number
      errors: Array<{ row: number; error: string }>
      warnings: Array<string>
    }>('/admin/users/import-csv', { users }),

  // Alias para mantener compatibilidad
  bulkImport: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.postForm<{ imported?: number; updated?: number; failed?: number; errors?: Array<{ row: number; error: string }> }>(
      '/admin/users/import',
      formData
    )
  },
}
