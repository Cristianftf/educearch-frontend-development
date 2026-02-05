import type { SearchHedge } from '@/types'
import { api } from './api-client'

export const hedgesApi = {
  getAll: (category?: string) =>
    api.get<SearchHedge[]>(`/hedges${category ? `?category=${category}` : ''}`),

  getCategories: () => api.get<string[]>('/hedges/categories'),

  create: (hedge: Omit<SearchHedge, 'id' | 'createdAt' | 'createdBy'>) =>
    api.post<SearchHedge>('/hedges', hedge),

  update: (id: string, hedge: Partial<SearchHedge>) =>
    api.put<SearchHedge>(`/hedges/${id}`, hedge),

  delete: (id: string) => api.delete<void>(`/hedges/${id}`),

  test: (query: string) =>
    api.post<{ count: number; preview: string[] }>('/hedges/test', { query }),
}
