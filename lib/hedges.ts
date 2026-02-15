import type { SearchHedge } from '@/types'
import { api } from './api-client'

export const hedgesApi = {
  getAll: (category?: string) =>
    api
      .get<SearchHedge[]>(`/hedges${category ? `?category=${category}` : ''}`)
      .then((hedges) => (category ? hedges.filter((hedge) => hedge.category === category) : hedges)),

  getCategories: () => api.get<string[]>('/hedges/categories'),

  create: (hedge: Omit<SearchHedge, 'id' | 'createdAt' | 'createdBy'>) =>
    api.post<SearchHedge>('/hedges', hedge),

  update: (id: string, hedge: Partial<SearchHedge>) =>
    api.put<SearchHedge>(`/hedges/${id}`, hedge),

  delete: (id: string) => api.delete<void>(`/hedges/${id}`),

  test: (query: string) =>
    api.post<{
      query?: string
      resultCount?: number
      estimatedPrecision?: number
      estimatedRecall?: number
      status?: string
      message?: string
    }>('/hedges/test', { query }),
}
