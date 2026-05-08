import type { SearchQuery, SearchSession, MeshTerm, SearchResult } from '@/types'
import { api, ApiHttpError } from './api-client'
import { isConnectivityError } from './api-errors'
import { getCachedHealthSearchResults, searchHealthSources } from './health-sources'
import { emitExternalApiActivity } from './external-api-activity'
import {
  type RequestLoadProfile,
  normalizeRequestLoadProfile,
  SEARCH_FALLBACK_LIMIT_BY_PROFILE,
  SEARCH_MAX_RESULTS_BY_PROFILE,
} from './request-load-profile'
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
    source?: string
    sourceUrl?: string
    fullTextUrl?: string
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

type EvidencePyramidStudy = {
  id: string
  pmid?: string
  title: string
  year?: number
  sampleSize?: number
  evidenceLevel?: number
  hasConflictOfInterest?: boolean
  authors?: string[]
  journal?: string
  studyType?: string
  doi?: string
  sourceUrl?: string
}

type EvidencePyramidLevel = {
  level: number
  label: string
  count: number
  percentage: number
  studies: EvidencePyramidStudy[]
}

type EvidencePyramidResponse = {
  searchId: string
  source: string
  generatedAt: string
  query?: {
    terms?: string[]
    raw?: string
    filters?: Record<string, unknown> | null
  }
  totalStudies: number
  strength?: {
    code: string
    description: string
    score: number
  }
  levels: EvidencePyramidLevel[]
}

type SearchExecuteOptions = {
  activityRunId?: string
  loadProfile?: RequestLoadProfile
  signal?: AbortSignal
}

const MAX_LOCAL_SEARCH_HISTORY = 200
const MAX_LOCAL_SEARCH_SESSIONS = 120
const MIN_SEARCH_TERM_LENGTH = 2
const MAX_SEARCH_TERM_LENGTH = 160

function sanitizeString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim()
  return normalized || fallback
}

function toSafeUrl(value: unknown): string | undefined {
  const raw = sanitizeString(value)
  if (!raw) return undefined
  if (/^https?:\/\//i.test(raw)) return raw
  return undefined
}

function mapResults(results: SearchResponseDTO['results'] = []): SearchResult[] {
  return results.map((item, index) => {
    const entry = item && typeof item === 'object' ? item : {}
    const id = sanitizeString((entry as { id?: unknown }).id) || sanitizeString((entry as { pmid?: unknown }).pmid) || `result-${index}`
    const pmid = sanitizeString((entry as { pmid?: unknown }).pmid)
    const title = sanitizeString((entry as { title?: unknown }).title, '(Sin titulo)')
    const entryAuthors = (entry as { authors?: unknown[] }).authors
    const authorsRaw: unknown[] = Array.isArray(entryAuthors) ? entryAuthors : []
    const authors = authorsRaw
      .map((author) => sanitizeString(author))
      .filter((author) => author.length > 0)
      .slice(0, 15)
    const currentYear = new Date().getFullYear()
    const rawYear = (entry as { year?: unknown }).year
    const year = typeof rawYear === 'number' && Number.isFinite(rawYear)
      ? rawYear
      : Number.parseInt(String(rawYear ?? ''), 10)
    const boundedYear = Number.isFinite(year) && year >= 1900 && year <= currentYear + 1
      ? year
      : currentYear
    const rawEvidenceLevel = (entry as { evidenceLevel?: unknown }).evidenceLevel
    const evidenceLevel = typeof rawEvidenceLevel === 'number' && Number.isFinite(rawEvidenceLevel)
      ? Math.max(0, Math.min(10, rawEvidenceLevel))
      : 0
    const rawSampleSize = (entry as { sampleSize?: unknown }).sampleSize
    const sampleSize = typeof rawSampleSize === 'number' && Number.isFinite(rawSampleSize)
      ? Math.max(0, rawSampleSize)
      : undefined
    const doiRaw = sanitizeString((entry as { doi?: unknown }).doi)
    const doi = doiRaw ? doiRaw.replace(/^https?:\/\/doi\.org\//i, '').trim() : undefined
    const source = sanitizeString((entry as { source?: unknown }).source) || (pmid ? 'PubMed' : undefined)
    const sourceUrl =
      toSafeUrl((entry as { sourceUrl?: unknown }).sourceUrl) ??
      toSafeUrl((entry as { fullTextUrl?: unknown }).fullTextUrl) ??
      (doi ? `https://doi.org/${doi}` : pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : undefined)

    return {
      id,
      pmid,
      title,
      authors,
      journal: sanitizeString((entry as { journal?: unknown }).journal),
      year: boundedYear,
      abstract: sanitizeString((entry as { abstractText?: unknown }).abstractText),
      studyType: sanitizeString((entry as { studyType?: unknown }).studyType, 'Unknown'),
      evidenceLevel,
      sampleSize,
      hasConflictOfInterest: Boolean((entry as { hasConflictOfInterest?: unknown }).hasConflictOfInterest),
      doi,
      source,
      sourceUrl,
    }
  })
}

function resolvePreferredResultLimit(query: SearchQuery): number {
  const rawLimit = query.filters?.maxResults
  if (typeof rawLimit === 'number' && Number.isFinite(rawLimit)) {
    return Math.max(5, Math.min(200, Math.trunc(rawLimit)))
  }
  return 30
}

function buildResultKey(result: SearchResult): string {
  const base = result.pmid || result.doi || result.id || result.title
  return sanitizeString(base).toLowerCase()
}

function mergeSearchResults(primary: SearchResult[], secondary: SearchResult[], limit: number): SearchResult[] {
  const seen = new Set<string>()
  const merged: SearchResult[] = []
  const safeLimit = Math.max(5, Math.min(200, Math.trunc(limit)))

  for (const result of [...primary, ...secondary]) {
    const key = buildResultKey(result)
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(result)
    if (merged.length >= safeLimit) break
  }

  return merged
}

function shouldAugmentWithExternal(results: SearchResult[], preferredLimit: number): boolean {
  if (results.length === 0) return true
  const threshold = Math.min(Math.max(4, Math.floor(preferredLimit / 2)), 8)
  return results.length < threshold
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function isRetryableSearchStatus(error: unknown): boolean {
  if (!(error instanceof ApiHttpError)) return false
  return error.status === 429 || error.status === 503 || error.status === 504
}

function canUseSearchFallback(error: unknown): boolean {
  if (isConnectivityError(error)) return true
  if (error instanceof ApiHttpError) {
    return error.status >= 500
  }
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildSearchRequest(query: SearchQuery) {
  const terms = query.terms
    .map((term) => sanitizeString(term.term))
    .filter((term) => term.length >= MIN_SEARCH_TERM_LENGTH)
    .slice(0, 12)
  const filters = query.filters || {}
  const operators = Array.isArray(query.operators)
    ? query.operators
        .filter((operator): operator is 'AND' | 'OR' | 'NOT' =>
          operator === 'AND' || operator === 'OR' || operator === 'NOT'
        )
        .slice(0, Math.max(0, terms.length - 1))
    : []
  while (operators.length < Math.max(0, terms.length - 1)) {
    operators.push('AND')
  }
  const meshTerms = query.terms
    .map((term) => sanitizeString(term.id))
    .filter((termId) => termId.length > 0)
    .slice(0, terms.length)
  const maxResults =
    typeof filters.maxResults === 'number' && Number.isFinite(filters.maxResults)
      ? Math.max(5, Math.min(200, Math.trunc(filters.maxResults)))
      : undefined

  return {
    query: {
      terms,
      operators,
      meshTerms,
    },
    filters: {
      yearFrom: filters.yearRange?.[0],
      yearTo: filters.yearRange?.[1],
      studyTypes: filters.studyTypes,
      minSampleSize: filters.minSampleSize,
      language: filters.languages?.[0],
      hasFullText: filters.hasFullText,
      maxResults,
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
  const term = sanitizeString(item.term).slice(0, MAX_SEARCH_TERM_LENGTH)
  return {
    id: sanitizeString(item.id) || term.toUpperCase() || `term-${index}`,
    term,
    description: sanitizeString(item.description),
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
    source: typeof item.source === 'string' ? item.source : undefined,
    sourceUrl:
      toSafeUrl(item.sourceUrl) ??
      toSafeUrl(item.fullTextUrl) ??
      undefined,
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

function normalizeEvidencePyramidStudy(value: unknown, fallbackLevel: number): EvidencePyramidStudy {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const rawYear =
    typeof item.year === 'number' && Number.isFinite(item.year)
      ? item.year
      : Number.parseInt(String(item.year ?? ''), 10)
  const year = Number.isFinite(rawYear) ? rawYear : undefined
  const rawSampleSize =
    typeof item.sampleSize === 'number' && Number.isFinite(item.sampleSize)
      ? item.sampleSize
      : Number.parseInt(String(item.sampleSize ?? ''), 10)
  const sampleSize = Number.isFinite(rawSampleSize) ? Math.max(0, rawSampleSize) : undefined
  const rawEvidenceLevel =
    typeof item.evidenceLevel === 'number' && Number.isFinite(item.evidenceLevel)
      ? item.evidenceLevel
      : fallbackLevel

  return {
    id: sanitizeString(item.id) || sanitizeString(item.pmid) || createLocalId('pyramid-study'),
    pmid: sanitizeString(item.pmid) || undefined,
    title: sanitizeString(item.title, '(Sin titulo)'),
    year,
    sampleSize,
    evidenceLevel: Math.max(1, Math.min(6, Math.trunc(rawEvidenceLevel))),
    hasConflictOfInterest: Boolean(item.hasConflictOfInterest),
    authors: Array.isArray(item.authors)
      ? item.authors.map((author) => sanitizeString(author)).filter(Boolean)
      : [],
    journal: sanitizeString(item.journal) || undefined,
    studyType: sanitizeString(item.studyType) || undefined,
    doi: sanitizeString(item.doi) || undefined,
    sourceUrl: toSafeUrl(item.sourceUrl),
  }
}

function normalizeEvidencePyramidResponse(value: unknown, searchId: string): EvidencePyramidResponse {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const levelsRaw = Array.isArray(item.levels) ? item.levels : []
  const levels = levelsRaw
    .map((entry) => {
      const levelEntry = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {}
      const level =
        typeof levelEntry.level === 'number' && Number.isFinite(levelEntry.level)
          ? Math.max(1, Math.min(6, Math.trunc(levelEntry.level)))
          : 6
      const studiesRaw = Array.isArray(levelEntry.studies) ? levelEntry.studies : []
      return {
        level,
        label: sanitizeString(levelEntry.label, `Nivel ${level}`),
        count:
          typeof levelEntry.count === 'number' && Number.isFinite(levelEntry.count)
            ? Math.max(0, Math.trunc(levelEntry.count))
            : studiesRaw.length,
        percentage:
          typeof levelEntry.percentage === 'number' && Number.isFinite(levelEntry.percentage)
            ? levelEntry.percentage
            : 0,
        studies: studiesRaw.map((study) => normalizeEvidencePyramidStudy(study, level)),
      } satisfies EvidencePyramidLevel
    })
    .sort((left, right) => left.level - right.level)

  return {
    searchId: sanitizeString(item.searchId, searchId),
    source: sanitizeString(item.source, 'unknown'),
    generatedAt: sanitizeString(item.generatedAt, new Date().toISOString()),
    query:
      item.query && typeof item.query === 'object'
        ? {
            terms: Array.isArray((item.query as Record<string, unknown>).terms)
              ? ((item.query as Record<string, unknown>).terms as unknown[])
                  .map((term) => sanitizeString(term))
                  .filter(Boolean)
              : [],
            raw: sanitizeString((item.query as Record<string, unknown>).raw),
            filters:
              (item.query as Record<string, unknown>).filters &&
              typeof (item.query as Record<string, unknown>).filters === 'object'
                ? ((item.query as Record<string, unknown>).filters as Record<string, unknown>)
                : null,
          }
        : undefined,
    totalStudies:
      typeof item.totalStudies === 'number' && Number.isFinite(item.totalStudies)
        ? Math.max(0, Math.trunc(item.totalStudies))
        : levels.reduce((total, level) => total + level.studies.length, 0),
    strength:
      item.strength && typeof item.strength === 'object'
        ? {
            code: sanitizeString((item.strength as Record<string, unknown>).code, 'UNKNOWN'),
            description: sanitizeString(
              (item.strength as Record<string, unknown>).description,
              'Fuerza de evidencia no disponible.'
            ),
            score:
              typeof (item.strength as Record<string, unknown>).score === 'number' &&
              Number.isFinite((item.strength as Record<string, unknown>).score)
                ? ((item.strength as Record<string, unknown>).score as number)
                : 0,
          }
        : undefined,
    levels,
  }
}

function readSearchHistoryLocal(): SearchQuery[] {
  const stored = readLocalStorage<unknown[]>(STUDENT_FALLBACK_KEYS.searchHistory, [])
  if (!Array.isArray(stored)) return []
  const normalized = stored.map((item, index) => normalizeSearchQuery(item, `local-query-${index + 1}`))
  return mergeSearchHistory(normalized, []).slice(0, MAX_LOCAL_SEARCH_HISTORY)
}

function writeSearchHistoryLocal(searches: SearchQuery[]): void {
  const normalized = searches
    .map((search, index) => normalizeSearchQuery(search, `local-query-${index + 1}`))
    .slice(0, MAX_LOCAL_SEARCH_HISTORY)
  writeLocalStorage(STUDENT_FALLBACK_KEYS.searchHistory, normalized)
}

function upsertSearchHistoryLocal(search: SearchQuery): void {
  const existing = readSearchHistoryLocal()
  const next = [search, ...existing.filter((item) => item.id !== search.id)].slice(
    0,
    MAX_LOCAL_SEARCH_HISTORY
  )
  writeSearchHistoryLocal(next)
}

function readSearchSessionsLocal(): SearchSession[] {
  const stored = readLocalStorage<unknown[]>(STUDENT_FALLBACK_KEYS.searchSessions, [])
  if (!Array.isArray(stored)) return []
  const seen = new Set<string>()
  const normalized: SearchSession[] = []
  for (const item of stored) {
    const session = normalizeSearchSession(item)
    if (!session.id || seen.has(session.id)) continue
    seen.add(session.id)
    normalized.push(session)
    if (normalized.length >= MAX_LOCAL_SEARCH_SESSIONS) break
  }
  return normalized
}

function writeSearchSessionsLocal(sessions: SearchSession[]): void {
  const normalized = sessions
    .map((session, index) => normalizeSearchSession(session, normalizeSearchQuery({}, `local-query-${index + 1}`)))
    .slice(0, MAX_LOCAL_SEARCH_SESSIONS)
  writeLocalStorage(STUDENT_FALLBACK_KEYS.searchSessions, normalized)
}

function upsertSearchSessionLocal(session: SearchSession): void {
  const existing = readSearchSessionsLocal()
  const next = [session, ...existing.filter((item) => item.id !== session.id)].slice(
    0,
    MAX_LOCAL_SEARCH_SESSIONS
  )
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

function buildUnavailableSearchError(backendReachable: boolean): Error {
  return new Error(
    backendReachable
      ? 'No fue posible obtener resultados verificables en este momento. Intenta nuevamente.'
      : 'No hay conectividad para recuperar resultados reales.'
  )
}

function canUseLocalFallback(): boolean {
  return api.getUserRole() === 'student'
}

function emitSearchActivity(
  runId: string | undefined,
  provider: string,
  status: 'info' | 'success' | 'warning' | 'error',
  message: string,
  latencyMs?: number,
  resultCount?: number
): void {
  if (!runId) return
  emitExternalApiActivity({
    runId,
    provider,
    status,
    message,
    latencyMs,
    resultCount,
  })
}

export const searchApi = {
  getMeshSuggestions: (term: string) => {
    const normalizedTerm = sanitizeString(term).slice(0, MAX_SEARCH_TERM_LENGTH)
    if (normalizedTerm.length < MIN_SEARCH_TERM_LENGTH) {
      return Promise.resolve([])
    }
    return api
      .get<MeshTerm[]>(`/search/mesh/suggestions?term=${encodeURIComponent(normalizedTerm)}`)
      .then((response) => {
        if (!Array.isArray(response)) return []
        return response
          .map((item, index) => normalizeMeshTerm(item, index))
          .filter((item) => item.term.trim().length >= MIN_SEARCH_TERM_LENGTH)
      })
      .catch((error) => {
        if (!isConnectivityError(error)) throw error
        if (!canUseLocalFallback()) throw error
        return []
      })
  },

  execute: async (query: Omit<SearchQuery, 'createdAt'> | SearchQuery, options?: SearchExecuteOptions) => {
    const fallbackQueryId =
      typeof query === 'object' &&
      query !== null &&
      'id' in query &&
      typeof (query as { id?: unknown }).id === 'string'
        ? ((query as { id?: string }).id ?? undefined)
        : undefined
    const normalizedQuery = normalizeSearchQuery(query, fallbackQueryId)
    const normalizedTerms = normalizedQuery.terms
      .map((term, index) => ({
        id: sanitizeString(term.id, `term-${index + 1}`),
        term: sanitizeString(term.term).slice(0, MAX_SEARCH_TERM_LENGTH),
        description: sanitizeString(term.description),
      }))
      .filter((term) => term.term.length >= MIN_SEARCH_TERM_LENGTH)
    if (normalizedTerms.length === 0) {
      throw new Error('Debes incluir al menos un término válido para buscar.')
    }
    const normalizedOperators = normalizedQuery.operators
      .filter((operator): operator is 'AND' | 'OR' | 'NOT' =>
        operator === 'AND' || operator === 'OR' || operator === 'NOT'
      )
      .slice(0, Math.max(0, normalizedTerms.length - 1))
    while (normalizedOperators.length < Math.max(0, normalizedTerms.length - 1)) {
      normalizedOperators.push('AND')
    }
    const loadProfile = normalizeRequestLoadProfile(options?.loadProfile)
    const preferredResultLimit = Math.min(
      resolvePreferredResultLimit(normalizedQuery),
      SEARCH_MAX_RESULTS_BY_PROFILE[loadProfile]
    )
    const fallbackResultLimit = Math.min(
      preferredResultLimit,
      SEARCH_FALLBACK_LIMIT_BY_PROFILE[loadProfile]
    )
    const effectiveQuery: SearchQuery = {
      ...normalizedQuery,
      terms: normalizedTerms,
      operators: normalizedOperators,
      filters: {
        ...(normalizedQuery.filters || {}),
        maxResults: preferredResultLimit,
      },
    }
    const request = buildSearchRequest(effectiveQuery)
    const activityRunId =
      typeof options?.activityRunId === 'string' && options.activityRunId.trim().length > 0
        ? options.activityRunId
        : `search-run-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    const parentSignal = options?.signal

    if (parentSignal?.aborted) {
      const aborted = new Error('Search request aborted')
      aborted.name = 'AbortError'
      throw aborted
    }

    const postBackendWithRetry = async (): Promise<SearchResponseDTO> => {
      const maxAttempts = 2
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          return await api.post<SearchResponseDTO>('/search/execute', request, {
            signal: parentSignal,
          })
        } catch (error) {
          if (isAbortError(error) || parentSignal?.aborted) throw error
          if (!isRetryableSearchStatus(error) || attempt >= maxAttempts) throw error

          emitSearchActivity(
            activityRunId,
            'Search Backend API',
            'warning',
            `Backend temporalmente saturado. Reintentando (${attempt}/${maxAttempts - 1}).`
          )
          await sleep(200 * attempt)
        }
      }
      throw new Error('No se pudo completar la busqueda tras reintentos.')
    }

    try {
      emitSearchActivity(
        activityRunId,
        'Search Backend API',
        'info',
        'Enviando consulta estructurada al backend.'
      )
      const startedAt = Date.now()
      const response = await postBackendWithRetry()
      const backendLatencyMs = Date.now() - startedAt
      const mappedResults = mapResults(response.results)
      let consolidatedResults = mappedResults.slice(0, preferredResultLimit)
      emitSearchActivity(
        activityRunId,
        'Search Backend API',
        'success',
        'Respuesta recibida desde backend.',
        backendLatencyMs,
        consolidatedResults.length
      )

      if (shouldAugmentWithExternal(consolidatedResults, preferredResultLimit)) {
        emitSearchActivity(
          activityRunId,
          'Fallback externo',
          'warning',
          'Resultados insuficientes desde backend. Intentando ampliar con fuentes externas.'
        )
        const fallbackStartedAt = Date.now()
        const externalFallback = await searchHealthSources(effectiveQuery, fallbackResultLimit, {
          activityRunId,
        }).catch(() => null)

        if (externalFallback?.results?.length) {
          consolidatedResults = mergeSearchResults(
            consolidatedResults,
            externalFallback.results,
            preferredResultLimit
          )
          emitSearchActivity(
            activityRunId,
            externalFallback.provider || 'Fallback externo',
            'success',
            mappedResults.length > 0
              ? 'Fuentes externas fusionadas con resultados del backend.'
              : 'Contingencia externa completada con resultados reales.',
            Date.now() - fallbackStartedAt,
            consolidatedResults.length
          )
        } else {
          const cachedExternal = getCachedHealthSearchResults(effectiveQuery)
          if (cachedExternal?.results?.length) {
            consolidatedResults = mergeSearchResults(
              consolidatedResults,
              cachedExternal.results,
              preferredResultLimit
            )
            emitSearchActivity(
              activityRunId,
              cachedExternal.provider || 'Cache local',
              'warning',
              'Sin respuesta externa en vivo. Usando cache local de evidencia.',
              undefined,
              consolidatedResults.length
            )
          }
        }
      }

      const sourceCount = new Map<string, number>()
      for (const result of consolidatedResults) {
        const source =
          typeof result.source === 'string' && result.source.trim().length > 0
            ? result.source.trim()
            : ''
        if (!source) continue
        sourceCount.set(source, (sourceCount.get(source) ?? 0) + 1)
      }
      for (const [source, count] of sourceCount.entries()) {
        emitSearchActivity(
          activityRunId,
          source,
          'success',
          `Resultados externos incorporados desde ${source}.`,
          undefined,
          count
        )
      }

      const session = {
        id: response.searchId ?? `search-${Date.now()}`,
        query: effectiveQuery,
        results: consolidatedResults,
        totalResults:
          typeof response.metadata?.totalResults === 'number' && Number.isFinite(response.metadata.totalResults)
            ? Math.max(response.metadata.totalResults, consolidatedResults.length)
            : consolidatedResults.length,
        executedAt: new Date().toISOString(),
      } as SearchSession
      upsertSearchSessionLocal(session)
      upsertSearchHistoryLocal({
        ...effectiveQuery,
        resultCount: session.totalResults,
      })
      return session
    } catch (error) {
      if (isAbortError(error) || parentSignal?.aborted) {
        emitSearchActivity(
          activityRunId,
          'Search Backend API',
          'warning',
          'Busqueda cancelada por timeout o por una nueva solicitud.'
        )
        throw error
      }

      emitSearchActivity(
        activityRunId,
        'Search Backend API',
        'error',
        'Fallo en backend. Evaluando estrategia de contingencia.'
      )
      if (!canUseSearchFallback(error)) throw error
      if (!canUseLocalFallback()) throw error
      const backendReachable = await isBackendReachable()
      emitSearchActivity(
        activityRunId,
        'Fallback externo',
        'warning',
        'Activando busqueda en proveedores externos.'
      )
      const fallbackStartedAt = Date.now()
      const externalFallback = await searchHealthSources(effectiveQuery, fallbackResultLimit, {
        activityRunId,
      }).catch(() => null)

      if (externalFallback?.results?.length) {
        const mergedResults = mergeSearchResults([], externalFallback.results, preferredResultLimit)
        emitSearchActivity(
          activityRunId,
          externalFallback.provider || 'Fallback externo',
          'success',
          'Busqueda externa completada.',
          Date.now() - fallbackStartedAt,
          mergedResults.length
        )
        const session = {
          id: `external-search-${Date.now()}`,
          query: effectiveQuery,
          results: mergedResults,
          totalResults: mergedResults.length,
          executedAt: new Date().toISOString(),
        } as SearchSession
        upsertSearchSessionLocal(session)
        upsertSearchHistoryLocal({
          ...effectiveQuery,
          resultCount: session.totalResults,
        })
        return session
      }

      const cachedExternal = getCachedHealthSearchResults(effectiveQuery)
      if (cachedExternal?.results?.length) {
        const mergedResults = mergeSearchResults([], cachedExternal.results, preferredResultLimit)
        emitSearchActivity(
          activityRunId,
          cachedExternal.provider || 'Cache local',
          'warning',
          'Sin respuesta en vivo. Usando cache local de proveedores externos.',
          undefined,
          mergedResults.length
        )
        const session = {
          id: `cached-search-${Date.now()}`,
          query: effectiveQuery,
          results: mergedResults.map((result) => ({
            ...result,
            abstract: `${result.abstract}\n\n[Datos recuperados desde cache local de ${cachedExternal.provider}]`,
          })),
          totalResults: mergedResults.length,
          executedAt: new Date().toISOString(),
        } as SearchSession
        upsertSearchSessionLocal(session)
        upsertSearchHistoryLocal({
          ...effectiveQuery,
          resultCount: session.totalResults,
        })
        return session
      }

      emitSearchActivity(
        activityRunId,
        'Busqueda externa',
        'error',
        'No fue posible obtener resultados reales en este intento.'
      )
      throw buildUnavailableSearchError(backendReachable)
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
        if (!canUseSearchFallback(error)) throw error
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
        if (!canUseSearchFallback(error)) throw error
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
      if (!canUseSearchFallback(error)) throw error
      if (!canUseLocalFallback()) throw error
      await isBackendReachable()
    }
    const history = readSearchHistoryLocal().filter((search) => search.id !== searchId)
    const sessions = readSearchSessionsLocal().filter(
      (session) => session.id !== searchId && session.query.id !== searchId
    )
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
        if (!canUseSearchFallback(error)) throw error
        if (!canUseLocalFallback()) throw error
        const backendReachable = await isBackendReachable()
        const session = readSearchSessionsLocal().find((entry) => entry.id === sessionId)
        if (session) {
          return session
        }
        throw buildUnavailableSearchError(backendReachable)
      }),

  getEvidencePyramid: (searchId: string) =>
    api
      .get<EvidencePyramidResponse>(`/search/results/${searchId}/evidence-pyramid`)
      .then((response) => normalizeEvidencePyramidResponse(response, searchId)),
}
