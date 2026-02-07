import type { SearchQuery, SearchSession, MeshTerm, SearchResult } from '@/types'
import { api } from './api-client'

type SearchResponseDTO = {
  searchId?: string
  results?: Array<{
    id: string
    pmid: string
    title: string
    abstractText?: string
    authors?: string[]
    journal?: string
    year?: number
    studyType?: string
    evidenceLevel?: number
    sampleSize?: number
    hasConflictOfInterest?: boolean
    doi?: string
  }>
  metadata?: {
    totalResults?: number
    searchTime?: string
  }
}

function mapResults(results: SearchResponseDTO['results'] = []): SearchResult[] {
  return results.map((item, index) => {
    const id = item.id ?? item.pmid ?? `result-${index}`
    const pmid = item.pmid ?? ''
    const title = item.title ?? '(Sin titulo)'
    const authors = Array.isArray(item.authors)
      ? item.authors.filter((author): author is string => typeof author === 'string' && author.trim().length > 0)
      : []
    const year = typeof item.year === 'number' && Number.isFinite(item.year)
      ? item.year
      : new Date().getFullYear()
    const evidenceLevel = typeof item.evidenceLevel === 'number' && Number.isFinite(item.evidenceLevel)
      ? item.evidenceLevel
      : 0
    const sampleSize = typeof item.sampleSize === 'number' && Number.isFinite(item.sampleSize)
      ? Math.max(0, item.sampleSize)
      : undefined

    return {
      id,
      pmid,
      title,
      authors,
      journal: item.journal ?? '',
      year,
      abstract: item.abstractText ?? '',
      studyType: item.studyType ?? 'Unknown',
      evidenceLevel,
      sampleSize,
      hasConflictOfInterest: item.hasConflictOfInterest ?? false,
      doi: item.doi,
    }
  })
}

function buildSearchRequest(query: SearchQuery) {
  const terms = query.terms.map((t) => t.term)
  const filters = query.filters || {}

  return {
    query: {
      terms,
      operators: query.operators,
      meshTerms: query.terms.map((t) => t.id).filter(Boolean),
    },
    filters: {
      yearFrom: filters.yearRange?.[0],
      yearTo: filters.yearRange?.[1],
      studyTypes: filters.studyTypes,
      minSampleSize: filters.minSampleSize,
      language: filters.languages?.[0],
    },
    context: {
      sessionId: query.id,
    },
  }
}

export const searchApi = {
  getMeshSuggestions: (term: string) =>
    api.get<MeshTerm[]>(`/search/mesh/suggestions?term=${encodeURIComponent(term)}`),

  execute: async (query: Omit<SearchQuery, 'createdAt'> | SearchQuery) => {
    const request = buildSearchRequest(query as SearchQuery)
    const response = await api.post<SearchResponseDTO>('/search/execute', request)
    return {
      id: response.searchId ?? `search-${Date.now()}`,
      query: query as SearchQuery,
      results: mapResults(response.results),
      totalResults: response.metadata?.totalResults ?? 0,
      executedAt: new Date().toISOString(),
    } as SearchSession
  },

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
