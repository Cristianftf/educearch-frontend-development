import type { SearchQuery, SearchSession, MeshTerm } from '@/types'
import { api } from './api-client'

export const searchApi = {
  getMeshSuggestions: (term: string) =>
    api.get<MeshTerm[]>(`/mesh/suggestions?term=${encodeURIComponent(term)}`),

  execute: (query: Omit<SearchQuery, 'id' | 'createdAt'>) =>
    api.post<SearchSession>('/search/execute', query),

  getHistory: (page = 1, limit = 10) =>
    api.get<{ searches: SearchQuery[]; total: number }>(
      `/search/history?page=${page}&limit=${limit}`
    ),

  saveSearch: (searchId: string, favorite: boolean) =>
    api.put<SearchQuery>(`/search/${searchId}`, { isFavorite: favorite }),

  deleteSearch: (searchId: string) =>
    api.delete<void>(`/search/${searchId}`),

  getSession: (sessionId: string) =>
    api.get<SearchSession>(`/search/sessions/${sessionId}`),
}
