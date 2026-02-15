import type { SearchQuery, SearchSession, MeshTerm, SearchResult } from '@/types'
import { api } from './api-client'
import { isConnectivityError } from './api-errors'
import {
  STUDENT_FALLBACK_KEYS,
  createLocalId,
  isBackendReachable,
  paginateItems,
  readLocalStorage,
  writeLocalStorage,
} from './student-resilience'

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

type SearchHistoryResponse = {
  searches: SearchQuery[]
  total: number
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

function normalizeMeshTerm(value: unknown, index: number): MeshTerm {
  if (!value || typeof value !== 'object') {
    return {
      id: `term-${index}`,
      term: '',
      description: '',
    }
  }
  const item = value as Record<string, unknown>
  const term = typeof item.term === 'string' ? item.term : ''
  return {
    id: typeof item.id === 'string' && item.id ? item.id : term.toUpperCase() || `term-${index}`,
    term,
    description: typeof item.description === 'string' ? item.description : '',
  }
}

function normalizeSearchResult(value: unknown, index: number): SearchResult {
  if (!value || typeof value !== 'object') {
    const year = new Date().getFullYear()
    return {
      id: `result-${index}`,
      pmid: '',
      title: '(Sin titulo)',
      authors: [],
      journal: '',
      year,
      abstract: '',
      studyType: 'Unknown',
      evidenceLevel: 0,
      hasConflictOfInterest: false,
    }
  }
  const item = value as Record<string, unknown>
  const year =
    typeof item.year === 'number' && Number.isFinite(item.year)
      ? item.year
      : new Date().getFullYear()

  return {
    id: typeof item.id === 'string' && item.id ? item.id : `result-${index}`,
    pmid: typeof item.pmid === 'string' ? item.pmid : '',
    title: typeof item.title === 'string' && item.title ? item.title : '(Sin titulo)',
    authors: Array.isArray(item.authors)
      ? item.authors.filter((author): author is string => typeof author === 'string')
      : [],
    journal: typeof item.journal === 'string' ? item.journal : '',
    year,
    abstract: typeof item.abstract === 'string' ? item.abstract : '',
    studyType: typeof item.studyType === 'string' ? item.studyType : 'Unknown',
    evidenceLevel:
      typeof item.evidenceLevel === 'number' && Number.isFinite(item.evidenceLevel)
        ? item.evidenceLevel
        : 0,
    sampleSize:
      typeof item.sampleSize === 'number' && Number.isFinite(item.sampleSize)
        ? Math.max(0, item.sampleSize)
        : undefined,
    hasConflictOfInterest: Boolean(item.hasConflictOfInterest),
    doi: typeof item.doi === 'string' ? item.doi : undefined,
  }
}

function normalizeSearchQuery(value: unknown, fallbackId?: string): SearchQuery {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const rawFilters =
    item.filters && typeof item.filters === 'object'
      ? (item.filters as SearchQuery['filters'])
      : {}
  return {
    id: typeof item.id === 'string' && item.id ? item.id : fallbackId ?? createLocalId('query'),
    terms: Array.isArray(item.terms)
      ? item.terms.map((term, index) => normalizeMeshTerm(term, index))
      : [],
    operators: Array.isArray(item.operators)
      ? item.operators.filter((operator): operator is 'AND' | 'OR' | 'NOT' =>
          operator === 'AND' || operator === 'OR' || operator === 'NOT'
        )
      : [],
    filters: rawFilters,
    rawQuery: typeof item.rawQuery === 'string' ? item.rawQuery : '',
    createdAt:
      typeof item.createdAt === 'string' && item.createdAt
        ? item.createdAt
        : new Date().toISOString(),
    resultCount: typeof item.resultCount === 'number' ? item.resultCount : undefined,
    isFavorite: typeof item.isFavorite === 'boolean' ? item.isFavorite : false,
  }
}

function normalizeSearchSession(value: unknown, fallbackQuery?: SearchQuery): SearchSession {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const query = normalizeSearchQuery(item.query, fallbackQuery?.id)
  const results = Array.isArray(item.results)
    ? item.results.map((result, index) => normalizeSearchResult(result, index))
    : fallbackQuery
      ? buildFallbackResults(fallbackQuery)
      : []

  return {
    id: typeof item.id === 'string' && item.id ? item.id : createLocalId('search'),
    query,
    results,
    totalResults:
      typeof item.totalResults === 'number' && Number.isFinite(item.totalResults)
        ? item.totalResults
        : results.length,
    executedAt:
      typeof item.executedAt === 'string' && item.executedAt
        ? item.executedAt
        : new Date().toISOString(),
  }
}

function readSearchHistoryLocal(): SearchQuery[] {
  return readLocalStorage<SearchQuery[]>(STUDENT_FALLBACK_KEYS.searchHistory, [])
}

function writeSearchHistoryLocal(searches: SearchQuery[]): void {
  writeLocalStorage(STUDENT_FALLBACK_KEYS.searchHistory, searches)
}

function upsertSearchHistoryLocal(search: SearchQuery): void {
  const existing = readSearchHistoryLocal()
  const next = [search, ...existing.filter((item) => item.id !== search.id)]
  writeSearchHistoryLocal(next)
}

function readSearchSessionsLocal(): SearchSession[] {
  return readLocalStorage<SearchSession[]>(STUDENT_FALLBACK_KEYS.searchSessions, [])
}

function writeSearchSessionsLocal(sessions: SearchSession[]): void {
  writeLocalStorage(STUDENT_FALLBACK_KEYS.searchSessions, sessions)
}

function upsertSearchSessionLocal(session: SearchSession): void {
  const existing = readSearchSessionsLocal()
  const next = [session, ...existing.filter((item) => item.id !== session.id)]
  writeSearchSessionsLocal(next)
}

function mergeSearchHistory(primary: SearchQuery[], secondary: SearchQuery[]): SearchQuery[] {
  const seen = new Set<string>()
  const merged: SearchQuery[] = []
  for (const item of [...primary, ...secondary]) {
    if (!item.id || seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
  }
  return merged
}

function buildFallbackSuggestions(term: string): MeshTerm[] {
  const cleaned = term.trim()
  if (!cleaned) return []
  return [
    {
      id: cleaned.toUpperCase(),
      term: cleaned,
      description: 'Sugerencia local de respaldo',
    },
  ]
}

function buildFallbackResults(query: SearchQuery): SearchResult[] {
  const year = new Date().getFullYear()
  const joinedTerms = query.terms.map((t) => t.term).filter(Boolean).join(' ')
  const baseTerm = joinedTerms || query.rawQuery || 'salud'
  const safeTerm = baseTerm.trim()

  return [
    {
      id: `fallback-${Date.now()}-1`,
      pmid: '',
      title: `Resultado simulado 1 sobre ${safeTerm}`,
      authors: ['Sistema Local'],
      journal: 'Fallback Journal',
      year,
      abstract: 'Resultado de respaldo generado localmente por fallo de comunicacion con API.',
      studyType: 'Unknown',
      evidenceLevel: 0,
      sampleSize: undefined,
      hasConflictOfInterest: false,
      doi: undefined,
    },
    {
      id: `fallback-${Date.now()}-2`,
      pmid: '',
      title: `Resultado simulado 2 sobre ${safeTerm}`,
      authors: ['Sistema Local'],
      journal: 'Fallback Journal',
      year: year - 1,
      abstract: 'Usa estos datos solo como referencia temporal mientras se restablece la API.',
      studyType: 'Unknown',
      evidenceLevel: 0,
      sampleSize: undefined,
      hasConflictOfInterest: false,
      doi: undefined,
    },
  ]
}

function canUseLocalFallback(): boolean {
  return api.getUserRole() === 'student'
}

export const searchApi = {
  getMeshSuggestions: (term: string) =>
    api
      .get<MeshTerm[]>(`/search/mesh/suggestions?term=${encodeURIComponent(term)}`)
      .catch((error) => {
        if (!isConnectivityError(error)) throw error
        if (!canUseLocalFallback()) throw error
        return buildFallbackSuggestions(term)
      }),

  execute: async (query: Omit<SearchQuery, 'createdAt'> | SearchQuery) => {
    const normalizedQuery = query as SearchQuery
    const request = buildSearchRequest(normalizedQuery)
    try {
      const response = await api.post<SearchResponseDTO>('/search/execute', request)
      const session = {
        id: response.searchId ?? `search-${Date.now()}`,
        query: normalizedQuery,
        results: mapResults(response.results),
        totalResults: response.metadata?.totalResults ?? 0,
        executedAt: new Date().toISOString(),
      } as SearchSession
      upsertSearchSessionLocal(session)
      upsertSearchHistoryLocal({
        ...normalizedQuery,
        resultCount: session.totalResults,
      })
      return session
    } catch (error) {
      if (!isConnectivityError(error)) throw error
      if (!canUseLocalFallback()) throw error
      const backendReachable = await isBackendReachable()
      const fallbackResults = buildFallbackResults(normalizedQuery)
      const session = {
        id: `fallback-search-${Date.now()}`,
        query: normalizedQuery,
        results: fallbackResults.map((result) => ({
          ...result,
          abstract: backendReachable
            ? result.abstract
            : 'Respaldo local activado por perdida de conexion con backend/API.',
        })),
        totalResults: fallbackResults.length,
        executedAt: new Date().toISOString(),
      } as SearchSession
      upsertSearchSessionLocal(session)
      upsertSearchHistoryLocal({
        ...normalizedQuery,
        resultCount: session.totalResults,
      })
      return session
    }
  },

  getHistory: (page = 1, limit = 10) =>
    api
      .get<SearchHistoryResponse>(`/search/history?page=${page}&limit=${limit}`)
      .then((response) => {
        const normalized = Array.isArray(response.searches)
          ? response.searches.map((search) => normalizeSearchQuery(search))
          : []
        const merged = mergeSearchHistory(normalized, readSearchHistoryLocal())
        writeSearchHistoryLocal(merged)
        return {
          searches: normalized,
          total: typeof response.total === 'number' ? response.total : normalized.length,
        }
      })
      .catch(async (error) => {
        if (!isConnectivityError(error)) throw error
        if (!canUseLocalFallback()) throw error
        await isBackendReachable()
        const { pageItems, total } = paginateItems(readSearchHistoryLocal(), page, limit)
        return { searches: pageItems, total }
      }),

  saveSearch: (searchId: string, favorite: boolean) =>
    api
      .put<SearchQuery>(`/search/${searchId}`, { isFavorite: favorite })
      .then((response) => {
        const normalized = normalizeSearchQuery(response, searchId)
        upsertSearchHistoryLocal({
          ...normalized,
          isFavorite: favorite,
        })
        return normalized
      })
      .catch(async (error) => {
        if (!isConnectivityError(error)) throw error
        if (!canUseLocalFallback()) throw error
        await isBackendReachable()
        const history = readSearchHistoryLocal()
        const target = history.find((search) => search.id === searchId)
        const fallback = target
          ? { ...target, isFavorite: favorite }
          : normalizeSearchQuery({ id: searchId, isFavorite: favorite }, searchId)
        upsertSearchHistoryLocal(fallback)
        return fallback
      }),

  deleteSearch: async (searchId: string) => {
    try {
      await api.delete<void>(`/search/${searchId}`)
    } catch (error) {
      if (!isConnectivityError(error)) throw error
      if (!canUseLocalFallback()) throw error
      await isBackendReachable()
    }
    const history = readSearchHistoryLocal().filter((search) => search.id !== searchId)
    const sessions = readSearchSessionsLocal().filter((session) => session.id !== searchId)
    writeSearchHistoryLocal(history)
    writeSearchSessionsLocal(sessions)
  },

  getSession: (sessionId: string) =>
    api
      .get<SearchSession>(`/search/sessions/${sessionId}`)
      .then((response) => {
        const normalized = normalizeSearchSession(response)
        upsertSearchSessionLocal(normalized)
        return normalized
      })
      .catch(async (error) => {
        if (!isConnectivityError(error)) throw error
        if (!canUseLocalFallback()) throw error
        await isBackendReachable()
        const session = readSearchSessionsLocal().find((entry) => entry.id === sessionId)
        if (session) {
          return session
        }
        const fallbackQuery = normalizeSearchQuery(
          {
            id: createLocalId('query'),
            terms: [{ id: 'LOCAL', term: 'salud', description: 'Respaldo local' }],
            operators: [],
            filters: {},
            rawQuery: 'salud',
            createdAt: new Date().toISOString(),
          },
          createLocalId('query')
        )
        const fallbackSession = normalizeSearchSession(
          {
            id: sessionId,
            query: fallbackQuery,
            results: buildFallbackResults(fallbackQuery),
            totalResults: 2,
            executedAt: new Date().toISOString(),
          },
          fallbackQuery
        )
        upsertSearchSessionLocal(fallbackSession)
        return fallbackSession
      }),
}
