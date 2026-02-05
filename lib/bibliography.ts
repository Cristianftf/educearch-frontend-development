import type { Bibliography, BibliographyFormat } from '@/types'
import { api } from './api-client'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

export const bibliographyApi = {
  generate: (articleIds: string[], format: BibliographyFormat, name: string) =>
    api.post<Bibliography>('/export/bibliography', { articleIds, format, name }),

  getFormats: () => api.get<{ formats: BibliographyFormat[] }>('/formats/available'),

  getHistory: () => api.get<Bibliography[]>('/bibliography/history'),

  download: (id: string, format: 'docx' | 'txt') =>
    api.getBlob(`/bibliography/${id}/download?format=${format}`),
}
