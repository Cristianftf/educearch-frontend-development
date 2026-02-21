import type { EvidenceItem, SearchQuery, SearchResult, VerificationResult, VerificationStatus } from '@/types'
import { api } from './api-client'
import { createLocalId, readLocalStorage, writeLocalStorage } from './student-resilience'

const EXTERNAL_SEARCH_CACHE_KEY = 'student_fallback_health_external_search_cache_v1'
const EXTERNAL_VERIFICATION_CACHE_KEY = 'student_fallback_health_external_verification_cache_v1'
const CACHE_MAX_ENTRIES = 40
const DEFAULT_RESULTS_LIMIT = 14
const FETCH_TIMEOUT_MS = 8000
const SEARCH_CACHE_TTL_MS = 1000 * 60 * 60 * 12
const VERIFICATION_CACHE_TTL_MS = 1000 * 60 * 60 * 24
const BACKEND_PROXY_ATTEMPTS = 2

type HealthProviderName = 'PubMed' | 'Europe PMC' | 'ClinicalTrials.gov'

type SearchProviderResponse = {
  provider: HealthProviderName
  results: SearchResult[]
}

type CachedSearchEntry = {
  key: string
  rawQuery: string
  provider: string
  savedAt: string
  results: SearchResult[]
}

type CachedVerificationEntry = {
  key: string
  savedAt: string
  result: VerificationResult
}

type SearchFallbackMatch = {
  provider: string
  results: SearchResult[]
}

type ExternalSearchFilters = {
  yearFrom?: number
  yearTo?: number
  studyTypes?: string[]
  language?: string
  hasFullText?: boolean
  minSampleSize?: number
  maxResults?: number
}

type BackendProxyResponse = {
  provider?: string
  results?: Array<{
    id?: string
    pmid?: string
    title?: string
    abstractText?: string
    authors?: string[]
    journal?: string
    year?: number | string
    studyType?: string
    evidenceLevel?: number
    sampleSize?: number
    hasConflictOfInterest?: boolean
    doi?: string
    source?: string
    sourceUrl?: string
  }>
}

type BackendProxyResult = NonNullable<BackendProxyResponse['results']>[number]

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'that',
  'with',
  'from',
  'this',
  'have',
  'were',
  'por',
  'para',
  'con',
  'una',
  'unos',
  'unas',
  'como',
  'sobre',
  'entre',
  'donde',
  'desde',
  'hasta',
  'pero',
  'porque',
  'when',
  'while',
  'into',
  'than',
  'muy',
  'mucho',
  'muchos',
  'muchas',
])

const NEGATION_REGEX =
  /\b(no|not|without|lack|lacks|did not|ineffective|insufficient|fails?|failed|none)\b/i

const SUPPORT_REGEX =
  /\b(improve|improves|improved|effective|efficacy|benefit|beneficial|associated|reduces|increase|significant)\b/i

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function normalizeKey(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseYear(value?: string | number | null): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const year = Math.trunc(value)
    if (year >= 1900 && year <= 2100) return year
  }
  if (typeof value === 'string') {
    const match = value.match(/\b(19|20)\d{2}\b/)
    if (match) {
      const year = Number(match[0])
      if (Number.isFinite(year)) return year
    }
  }
  return new Date().getFullYear()
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token))
}

function computeRelevanceScore(text: string, claimTokens: string[]): number {
  if (!claimTokens.length) return 0
  const normalized = normalizeText(text)
  let overlap = 0
  for (const token of claimTokens) {
    if (normalized.includes(token)) overlap += 1
  }
  return Math.max(5, Math.min(100, Math.round((overlap / claimTokens.length) * 100)))
}

function mapEvidenceLevel(studyType?: string): number {
  const value = normalizeText(studyType || '')
  if (!value) return 4
  if (value.includes('meta') || value.includes('systematic')) return 1
  if (value.includes('randomized') || value.includes('clinical trial') || value.includes('interventional'))
    return 2
  if (value.includes('cohort') || value.includes('longitudinal')) return 3
  if (value.includes('case control')) return 4
  return 5
}

function normalizeStudyTypeValue(value?: string): string {
  const normalized = normalizeText(value || '').replace(/[\s-]+/g, '_')
  if (normalized.includes('systematic')) return 'systematic_review'
  if (normalized.includes('meta')) return 'meta_analysis'
  if (
    normalized.includes('randomized') ||
    normalized.includes('interventional') ||
    normalized.includes('clinical_trial')
  ) {
    return 'rct'
  }
  if (normalized.includes('cohort')) return 'cohort'
  if (normalized.includes('case_control')) return 'case_control'
  if (normalized.includes('case_report')) return 'case_report'
  return normalized || 'unknown'
}

function normalizeExternalFilters(query: SearchQuery, limit: number): ExternalSearchFilters {
  const filters = query.filters || {}
  const yearRange = Array.isArray(filters.yearRange) && filters.yearRange.length === 2
    ? filters.yearRange
    : undefined
  const yearFrom = typeof yearRange?.[0] === 'number' ? Math.trunc(yearRange[0]) : undefined
  const yearTo = typeof yearRange?.[1] === 'number' ? Math.trunc(yearRange[1]) : undefined
  const studyTypes = Array.isArray(filters.studyTypes)
    ? [...new Set(filters.studyTypes.map((item) => normalizeStudyTypeValue(item)).filter(Boolean))]
    : undefined
  const language = Array.isArray(filters.languages) && filters.languages.length > 0
    ? normalizeText(filters.languages[0]).slice(0, 3)
    : undefined
  const minSampleSize =
    typeof filters.minSampleSize === 'number' && Number.isFinite(filters.minSampleSize) && filters.minSampleSize > 0
      ? Math.max(0, Math.trunc(filters.minSampleSize))
      : undefined
  const maxResults =
    typeof filters.maxResults === 'number' && Number.isFinite(filters.maxResults)
      ? Math.max(4, Math.min(30, Math.trunc(filters.maxResults)))
      : Math.max(4, Math.min(30, Math.trunc(limit)))

  return {
    yearFrom,
    yearTo,
    studyTypes,
    language,
    hasFullText: filters.hasFullText === true,
    minSampleSize,
    maxResults,
  }
}

function buildFiltersCacheKey(filters: ExternalSearchFilters): string {
  const years = `${filters.yearFrom ?? "-"}:${filters.yearTo ?? "-"}`
  const studies = Array.isArray(filters.studyTypes) && filters.studyTypes.length > 0
    ? filters.studyTypes.join(",")
    : "-"
  const language = filters.language ?? "-"
  const fullText = filters.hasFullText ? "1" : "0"
  const sample = filters.minSampleSize ?? "-"
  const max = filters.maxResults ?? "-"
  return `${years}|${studies}|${language}|${fullText}|${sample}|${max}`
}

function buildSearchCacheKey(queryText: string, filters: ExternalSearchFilters): string {
  return `${normalizeKey(queryText)}|${buildFiltersCacheKey(filters)}`
}

function applyFiltersToResults(results: SearchResult[], filters: ExternalSearchFilters): SearchResult[] {
  return results.filter((result) => {
    if (typeof filters.yearFrom === 'number' && result.year < filters.yearFrom) return false
    if (typeof filters.yearTo === 'number' && result.year > filters.yearTo) return false
    if (Array.isArray(filters.studyTypes) && filters.studyTypes.length > 0) {
      if (!filters.studyTypes.includes(normalizeStudyTypeValue(result.studyType))) return false
    }
    if (typeof filters.minSampleSize === 'number' && filters.minSampleSize > 0) {
      const sample = typeof result.sampleSize === 'number' ? result.sampleSize : 0
      if (sample < filters.minSampleSize) return false
    }
    if (filters.hasFullText) {
      const hasDirectAccess = Boolean(result.sourceUrl) || Boolean(result.doi)
      if (!hasDirectAccess) return false
    }
    return true
  })
}

function buildQueryText(query: SearchQuery): string {
  const fromRaw = query.rawQuery?.trim()
  if (fromRaw) return fromRaw
  const joined = query.terms.map((term) => term.term).filter(Boolean).join(' ')
  return joined || 'health evidence'
}

function splitAuthorList(authorsRaw?: string): string[] {
  if (!authorsRaw) return []
  return authorsRaw
    .split(/[,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 6)
}

function safeSnippet(text?: string): string {
  if (!text) return 'No abstract available in this provider.'
  const trimmed = text.replace(/\s+/g, ' ').trim()
  return trimmed.length <= 220 ? trimmed : `${trimmed.slice(0, 217)}...`
}

function toDoi(value?: string): string | undefined {
  if (!value) return undefined
  const cleaned = value.replace(/^https?:\/\/doi\.org\//i, '').trim()
  return cleaned || undefined
}

function withSource(result: SearchResult, source: string): SearchResult {
  return {
    ...result,
    source,
  }
}

function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>()
  const deduped: SearchResult[] = []
  for (const result of results) {
    const key = normalizeKey(result.pmid || result.doi || result.id || result.title)
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(result)
  }
  return deduped
}

function isRecentTimestamp(value: string, ttlMs: number): boolean {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return false
  return Date.now() - timestamp <= ttlMs
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeBackendResult(value: BackendProxyResult, index: number): SearchResult {
  const year = parseYear(value?.year ?? null)
  const doi = toDoi(value?.doi)
  const source = value?.source && value.source.trim() ? value.source.trim() : 'Backend proxy'
  return {
    id: typeof value?.id === 'string' && value.id ? value.id : createLocalId(`proxy-${index}`),
    pmid: typeof value?.pmid === 'string' ? value.pmid : '',
    title:
      typeof value?.title === 'string' && value.title
        ? value.title
        : 'Untitled health source record',
    authors: Array.isArray(value?.authors)
      ? value.authors.filter((author): author is string => typeof author === 'string' && author.trim().length > 0)
      : [],
    journal: typeof value?.journal === 'string' ? value.journal : source,
    year,
    abstract:
      typeof value?.abstractText === 'string' && value.abstractText
        ? safeSnippet(value.abstractText)
        : 'No abstract available from backend proxy source.',
    studyType: typeof value?.studyType === 'string' && value.studyType ? value.studyType : 'Unknown',
    evidenceLevel:
      typeof value?.evidenceLevel === 'number' && Number.isFinite(value.evidenceLevel)
        ? value.evidenceLevel
        : mapEvidenceLevel(value?.studyType),
    sampleSize:
      typeof value?.sampleSize === 'number' && Number.isFinite(value.sampleSize)
        ? Math.max(0, value.sampleSize)
        : undefined,
    hasConflictOfInterest: Boolean(value?.hasConflictOfInterest),
    doi,
    source,
    sourceUrl:
      typeof value?.sourceUrl === 'string' && value.sourceUrl
        ? value.sourceUrl
        : doi
          ? `https://doi.org/${doi}`
          : undefined,
  }
}

async function fetchJsonWithTimeout<T>(url: string): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) {
      throw new Error(`External provider error: ${response.status}`)
    }
    return (await response.json()) as T
  } finally {
    clearTimeout(timeoutId)
  }
}

async function searchHealthSourcesViaBackend(
  query: SearchQuery,
  limit: number,
  filters: ExternalSearchFilters
): Promise<SearchFallbackMatch | null> {
  const queryText = buildQueryText(query).trim()
  if (!queryText) return null

  const payload = {
    queryText,
    terms: query.terms.map((term) => term.term).filter(Boolean),
    yearFrom: filters.yearFrom,
    yearTo: filters.yearTo,
    studyTypes: filters.studyTypes,
    language: filters.language,
    hasFullText: filters.hasFullText,
    minSampleSize: filters.minSampleSize,
    maxResults: filters.maxResults ?? limit,
  }

  for (let attempt = 1; attempt <= BACKEND_PROXY_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2500)
    try {
      const response = await api.post<BackendProxyResponse>(
        '/search/external-fallback',
        payload,
        { signal: controller.signal }
      )
      const results = Array.isArray(response.results)
        ? response.results.map((entry, index) => normalizeBackendResult(entry, index))
        : []
      const filtered = applyFiltersToResults(results, filters)
      const deduped = dedupeResults(filtered).slice(0, limit)
      if (!deduped.length) {
        return null
      }
      const provider =
        typeof response.provider === 'string' && response.provider.trim().length > 0
          ? response.provider
          : 'Backend proxy'
      return {
        provider,
        results: deduped,
      }
    } catch {
      if (attempt >= BACKEND_PROXY_ATTEMPTS) break
      await sleep(140 * attempt)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  return null
}

function mapStudyTypeToPubMedFilter(studyType: string): string {
  switch (normalizeStudyTypeValue(studyType)) {
    case 'systematic_review':
      return '"systematic review"[Publication Type]'
    case 'meta_analysis':
      return '"meta-analysis"[Publication Type]'
    case 'rct':
      return '"randomized controlled trial"[Publication Type]'
    case 'cohort':
      return '"cohort studies"[MeSH]'
    case 'case_control':
      return '"case-control studies"[MeSH]'
    case 'case_report':
      return '"case reports"[Publication Type]'
    default:
      return `"${studyType}"[Publication Type]`
  }
}

function buildPubMedQuery(queryText: string, filters: ExternalSearchFilters): string {
  let query = `(${queryText})`
  if (typeof filters.yearFrom === 'number' || typeof filters.yearTo === 'number') {
    const from = typeof filters.yearFrom === 'number' ? filters.yearFrom : 1900
    const to = typeof filters.yearTo === 'number' ? filters.yearTo : 3000
    query += ` AND ${from}:${to}[PDAT]`
  }
  if (filters.language) {
    query += ` AND ${filters.language}[lang]`
  }
  if (filters.hasFullText) {
    query += ' AND free full text[filter]'
  }
  if (Array.isArray(filters.studyTypes) && filters.studyTypes.length > 0) {
    const clause = filters.studyTypes.map(mapStudyTypeToPubMedFilter).join(' OR ')
    query += ` AND (${clause})`
  }
  return query
}

function mapStudyTypeToEuropePmcFilter(studyType: string): string {
  switch (normalizeStudyTypeValue(studyType)) {
    case 'systematic_review':
      return 'PUB_TYPE:"systematic review"'
    case 'meta_analysis':
      return 'PUB_TYPE:"meta analysis"'
    case 'rct':
      return 'PUB_TYPE:"randomized controlled trial"'
    case 'cohort':
      return 'PUB_TYPE:"cohort study"'
    case 'case_control':
      return 'PUB_TYPE:"case-control study"'
    case 'case_report':
      return 'PUB_TYPE:"case report"'
    default:
      return `PUB_TYPE:"${studyType.replace(/_/g, ' ')}"`
  }
}

function buildEuropePmcQuery(queryText: string, filters: ExternalSearchFilters): string {
  let query = queryText
  if (typeof filters.yearFrom === 'number' || typeof filters.yearTo === 'number') {
    const from = typeof filters.yearFrom === 'number' ? filters.yearFrom : 1900
    const to = typeof filters.yearTo === 'number' ? filters.yearTo : new Date().getFullYear()
    query += ` AND PUB_YEAR:[${from} TO ${to}]`
  }
  if (filters.language) {
    query += ` AND LANG:${filters.language}`
  }
  if (filters.hasFullText) {
    query += ' AND HAS_FREE_FULLTEXT:y'
  }
  if (Array.isArray(filters.studyTypes) && filters.studyTypes.length > 0) {
    const clause = filters.studyTypes.map(mapStudyTypeToEuropePmcFilter).join(' OR ')
    query += ` AND (${clause})`
  }
  return query
}

function buildClinicalTrialsQuery(queryText: string, filters: ExternalSearchFilters): string {
  if (!Array.isArray(filters.studyTypes) || filters.studyTypes.length === 0) return queryText
  const keywords = filters.studyTypes
    .map((studyType) => normalizeStudyTypeValue(studyType))
    .map((studyType) => {
      switch (studyType) {
        case 'systematic_review':
          return '"systematic review"'
        case 'meta_analysis':
          return '"meta analysis"'
        case 'rct':
          return '"randomized"'
        case 'cohort':
          return '"cohort"'
        case 'case_control':
          return '"case-control"'
        case 'case_report':
          return '"case report"'
        default:
          return studyType.replace(/_/g, ' ')
      }
    })
    .filter(Boolean)
  if (!keywords.length) return queryText
  return `${queryText} ${keywords.join(' ')}`
}

type PubMedSearchResponse = {
  esearchresult?: {
    idlist?: string[]
  }
}

type PubMedSummaryRecord = {
  uid?: string
  title?: string
  source?: string
  pubdate?: string
  fulljournalname?: string
  authors?: Array<{ name?: string }>
  pubtype?: string[]
  articleids?: Array<{ idtype?: string; value?: string }>
}

type PubMedSummaryResponse = {
  result?: {
    uids?: string[]
    [uid: string]: PubMedSummaryRecord | string[] | undefined
  }
}

async function searchPubMed(
  queryText: string,
  limit: number,
  filters: ExternalSearchFilters
): Promise<SearchProviderResponse> {
  const effectiveQuery = buildPubMedQuery(queryText, filters)
  const searchUrl =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi` +
    `?db=pubmed&retmode=json&retmax=${limit}&sort=relevance&term=${encodeURIComponent(effectiveQuery)}`
  const searchResponse = await fetchJsonWithTimeout<PubMedSearchResponse>(searchUrl)
  const ids = searchResponse.esearchresult?.idlist?.filter(Boolean) ?? []
  if (!ids.length) {
    return { provider: 'PubMed', results: [] }
  }

  const summaryUrl =
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi` +
    `?db=pubmed&retmode=json&id=${encodeURIComponent(ids.join(','))}`
  const summaryResponse = await fetchJsonWithTimeout<PubMedSummaryResponse>(summaryUrl)
  const resultContainer = summaryResponse.result
  const uids = resultContainer?.uids ?? ids

  const results: SearchResult[] = uids
    .map((uid) => {
      const item = resultContainer?.[uid]
      if (!item || Array.isArray(item) || typeof item !== 'object') return null
      const record = item as PubMedSummaryRecord
      const doi = toDoi(
        record.articleids?.find((entry) => normalizeText(entry.idtype || '') === 'doi')?.value
      )
      const authors = Array.isArray(record.authors)
        ? record.authors
            .map((author) => author.name?.trim())
            .filter((author): author is string => Boolean(author))
        : []
      const pmid = record.uid || uid
      const studyType = Array.isArray(record.pubtype) ? record.pubtype[0] || 'Journal Article' : 'Journal Article'
      return withSource(
        {
          id: pmid || createLocalId('pmid'),
          pmid: pmid || '',
          title: record.title || 'Untitled PubMed record',
          authors,
          journal: record.fulljournalname || record.source || 'PubMed',
          year: parseYear(record.pubdate),
          abstract: 'Abstract available in PubMed detail page.',
          studyType,
          evidenceLevel: mapEvidenceLevel(studyType),
          sampleSize: undefined,
          hasConflictOfInterest: false,
          doi,
          sourceUrl: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : undefined,
        },
        'PubMed'
      )
    })
    .filter((entry): entry is SearchResult => Boolean(entry))

  return { provider: 'PubMed', results: applyFiltersToResults(results, filters) }
}

type EuropePmcResult = {
  id?: string
  source?: string
  pmid?: string
  title?: string
  authorString?: string
  journalTitle?: string
  pubYear?: string
  abstractText?: string
  doi?: string
  pubType?: string
}

type EuropePmcResponse = {
  resultList?: {
    result?: EuropePmcResult[]
  }
}

async function searchEuropePmc(
  queryText: string,
  limit: number,
  filters: ExternalSearchFilters
): Promise<SearchProviderResponse> {
  const effectiveQuery = buildEuropePmcQuery(queryText, filters)
  const url =
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search` +
    `?query=${encodeURIComponent(effectiveQuery)}&format=json&pageSize=${limit}&resultType=core`
  const response = await fetchJsonWithTimeout<EuropePmcResponse>(url)
  const items = response.resultList?.result ?? []
  const results = items.map((item, index) => {
    const pmid = item.pmid || ''
    const doi = toDoi(item.doi)
    const sourceRecordId = item.id || pmid || doi || `${Date.now()}-${index}`
    const studyType = item.pubType || 'Journal Article'
    const sourceUrl = pmid
      ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
      : doi
        ? `https://doi.org/${doi}`
        : item.source && item.id
          ? `https://europepmc.org/article/${item.source}/${item.id}`
          : undefined
    return withSource(
      {
        id: sourceRecordId,
        pmid,
        title: item.title || 'Untitled Europe PMC record',
        authors: splitAuthorList(item.authorString),
        journal: item.journalTitle || 'Europe PMC',
        year: parseYear(item.pubYear),
        abstract: safeSnippet(item.abstractText),
        studyType,
        evidenceLevel: mapEvidenceLevel(studyType),
        sampleSize: undefined,
        hasConflictOfInterest: false,
        doi,
        sourceUrl,
      },
      'Europe PMC'
    )
  })
  return { provider: 'Europe PMC', results: applyFiltersToResults(results, filters) }
}

type ClinicalTrialsStudy = {
  protocolSection?: {
    identificationModule?: {
      nctId?: string
      briefTitle?: string
      officialTitle?: string
    }
    descriptionModule?: {
      briefSummary?: string
    }
    sponsorCollaboratorsModule?: {
      leadSponsor?: {
        name?: string
      }
    }
    statusModule?: {
      startDateStruct?: {
        date?: string
      }
      completionDateStruct?: {
        date?: string
      }
    }
    designModule?: {
      studyType?: string
      enrollmentInfo?: {
        count?: number | string
      }
    }
  }
}

type ClinicalTrialsResponse = {
  studies?: ClinicalTrialsStudy[]
}

async function searchClinicalTrials(
  queryText: string,
  limit: number,
  filters: ExternalSearchFilters
): Promise<SearchProviderResponse> {
  const effectiveQuery = buildClinicalTrialsQuery(queryText, filters)
  const url =
    `https://clinicaltrials.gov/api/v2/studies` +
    `?query.term=${encodeURIComponent(effectiveQuery)}&pageSize=${limit}`
  const response = await fetchJsonWithTimeout<ClinicalTrialsResponse>(url)
  const studies = response.studies ?? []
  const results = studies
    .map((study, index) => {
      const identification = study.protocolSection?.identificationModule
      const statusModule = study.protocolSection?.statusModule
      const designModule = study.protocolSection?.designModule
      const nctId = identification?.nctId
      if (!nctId) return null
      const sponsor = study.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name
      const title = identification.briefTitle || identification.officialTitle || `Clinical trial ${index + 1}`
      const summary = study.protocolSection?.descriptionModule?.briefSummary
      const studyType = designModule?.studyType || 'Clinical Trial'
      const rawSampleSize = designModule?.enrollmentInfo?.count
      const sampleSize =
        typeof rawSampleSize === 'number'
          ? rawSampleSize
          : typeof rawSampleSize === 'string'
            ? Number.parseInt(rawSampleSize, 10)
            : undefined
      return withSource(
        {
          id: nctId,
          pmid: '',
          title,
          authors: sponsor ? [sponsor] : ['ClinicalTrials.gov'],
          journal: 'ClinicalTrials.gov',
          year: parseYear(statusModule?.startDateStruct?.date || statusModule?.completionDateStruct?.date),
          abstract: safeSnippet(summary),
          studyType,
          evidenceLevel: mapEvidenceLevel(studyType),
          sampleSize:
            typeof sampleSize === 'number' && Number.isFinite(sampleSize)
              ? sampleSize
              : undefined,
          hasConflictOfInterest: false,
          sourceUrl: `https://clinicaltrials.gov/study/${nctId}`,
        },
        'ClinicalTrials.gov'
      )
    })
    .filter((entry): entry is SearchResult => Boolean(entry))

  return { provider: 'ClinicalTrials.gov', results: applyFiltersToResults(results, filters) }
}

function readSearchCache(): CachedSearchEntry[] {
  const cached = readLocalStorage<CachedSearchEntry[]>(EXTERNAL_SEARCH_CACHE_KEY, [])
  const filtered = cached.filter(
    (entry) =>
      Boolean(entry?.key) &&
      Array.isArray(entry?.results) &&
      entry.results.length > 0 &&
      typeof entry.savedAt === 'string' &&
      isRecentTimestamp(entry.savedAt, SEARCH_CACHE_TTL_MS)
  )
  if (filtered.length !== cached.length) {
    writeLocalStorage(EXTERNAL_SEARCH_CACHE_KEY, filtered)
  }
  return filtered
}

function writeSearchCache(entries: CachedSearchEntry[]): void {
  writeLocalStorage(EXTERNAL_SEARCH_CACHE_KEY, entries)
}

function writeSearchCacheEntry(
  queryText: string,
  filters: ExternalSearchFilters,
  provider: string,
  results: SearchResult[]
): void {
  const key = buildSearchCacheKey(queryText, filters)
  if (!key || !results.length) return
  const cache = readSearchCache()
  const entry: CachedSearchEntry = {
    key,
    rawQuery: queryText,
    provider,
    savedAt: new Date().toISOString(),
    results,
  }
  const next = [entry, ...cache.filter((item) => item.key !== key)].slice(0, CACHE_MAX_ENTRIES)
  writeSearchCache(next)
}

export function getCachedHealthSearchResults(query: SearchQuery): SearchFallbackMatch | null {
  const queryText = buildQueryText(query)
  const key = buildSearchCacheKey(queryText, normalizeExternalFilters(query, DEFAULT_RESULTS_LIMIT))
  if (!key) return null
  const cache = readSearchCache()
  const direct = cache.find((entry) => entry.key === key)
  if (direct) {
    return {
      provider: direct.provider,
      results: direct.results,
    }
  }
  return null
}

export async function searchHealthSources(
  query: SearchQuery,
  limit = DEFAULT_RESULTS_LIMIT
): Promise<SearchFallbackMatch | null> {
  const queryText = buildQueryText(query)
  const safeLimit = Math.max(4, Math.min(30, Math.trunc(limit)))
  const normalizedFilters = normalizeExternalFilters(query, safeLimit)
  const effectiveLimit = normalizedFilters.maxResults ?? safeLimit

  const backendProxyMatch = await searchHealthSourcesViaBackend(query, effectiveLimit, normalizedFilters)
  if (backendProxyMatch?.results?.length) {
    writeSearchCacheEntry(queryText, normalizedFilters, backendProxyMatch.provider, backendProxyMatch.results)
    return backendProxyMatch
  }

  const providers: Array<() => Promise<SearchProviderResponse>> = [
    () => searchPubMed(queryText, effectiveLimit, normalizedFilters),
    () => searchEuropePmc(queryText, effectiveLimit, normalizedFilters),
    () => searchClinicalTrials(queryText, Math.max(5, Math.min(20, effectiveLimit)), normalizedFilters),
  ]

  const settledResponses = await Promise.allSettled(providers.map((runProvider) => runProvider()))

  const aggregated: SearchResult[] = []
  const usedProviders: string[] = []

  for (const response of settledResponses) {
    if (response.status !== 'fulfilled') continue
    if (!response.value.results.length) continue
    aggregated.push(...response.value.results)
    usedProviders.push(response.value.provider)
  }

  const deduped = dedupeResults(aggregated).slice(0, effectiveLimit)
  if (!deduped.length) return null

  const providerLabel = usedProviders.join(' + ')
  writeSearchCacheEntry(queryText, normalizedFilters, providerLabel, deduped)
  return {
    provider: providerLabel,
    results: deduped,
  }
}

function readVerificationCache(): CachedVerificationEntry[] {
  const cached = readLocalStorage<CachedVerificationEntry[]>(EXTERNAL_VERIFICATION_CACHE_KEY, [])
  const filtered = cached.filter(
    (entry) =>
      Boolean(entry?.key) &&
      entry?.result != null &&
      typeof entry.savedAt === 'string' &&
      isRecentTimestamp(entry.savedAt, VERIFICATION_CACHE_TTL_MS)
  )
  if (filtered.length !== cached.length) {
    writeLocalStorage(EXTERNAL_VERIFICATION_CACHE_KEY, filtered)
  }
  return filtered
}

function writeVerificationCache(entries: CachedVerificationEntry[]): void {
  writeLocalStorage(EXTERNAL_VERIFICATION_CACHE_KEY, entries)
}

function writeVerificationCacheEntry(claim: string, result: VerificationResult): void {
  const key = normalizeKey(claim)
  if (!key) return
  const cache = readVerificationCache()
  const entry: CachedVerificationEntry = {
    key,
    savedAt: new Date().toISOString(),
    result,
  }
  const next = [entry, ...cache.filter((item) => item.key !== key)].slice(0, CACHE_MAX_ENTRIES)
  writeVerificationCache(next)
}

export function getCachedHealthVerification(claim: string): VerificationResult | null {
  const key = normalizeKey(claim)
  if (!key) return null
  const cache = readVerificationCache()
  const direct = cache.find((entry) => entry.key === key)
  if (direct) return direct.result
  const similar = cache.find((entry) => entry.key.includes(key) || key.includes(entry.key))
  return similar?.result ?? null
}

function buildEvidenceItem(
  result: SearchResult,
  claimTokens: string[],
  claimHasNegation: boolean
): EvidenceItem {
  const text = `${result.title} ${result.abstract}`.trim()
  const relevanceScore = computeRelevanceScore(text, claimTokens)
  const hasNegation = NEGATION_REGEX.test(text)
  const hasSupportLexicon = SUPPORT_REGEX.test(text)
  let supports = true
  if (!claimHasNegation && hasNegation) {
    supports = false
  } else if (claimHasNegation && hasSupportLexicon && !hasNegation) {
    supports = false
  } else if (!hasSupportLexicon && !hasNegation) {
    supports = relevanceScore >= 45
  }

  return {
    articleId: result.id,
    title: result.title,
    snippet: safeSnippet(result.abstract || result.title),
    supports,
    relevanceScore,
    source: result.source,
    sourceUrl: result.sourceUrl || (result.doi ? `https://doi.org/${result.doi}` : undefined),
  }
}

function computeStatusAndScore(
  supportingEvidence: EvidenceItem[],
  contradictingEvidence: EvidenceItem[]
): { status: VerificationStatus; score: number } {
  if (!supportingEvidence.length && !contradictingEvidence.length) {
    return { status: 'pending', score: 50 }
  }

  const supportWeight = supportingEvidence.reduce((sum, item) => sum + item.relevanceScore, 0)
  const contradictionWeight = contradictingEvidence.reduce((sum, item) => sum + item.relevanceScore, 0)
  const total = Math.max(1, supportWeight + contradictionWeight)
  const score = Math.max(5, Math.min(95, Math.round((supportWeight / total) * 100)))

  if (supportWeight === 0 && contradictionWeight > 0) {
    return { status: 'misinformation', score }
  }
  if (supportWeight > 0 && contradictionWeight === 0) {
    return { status: 'verified', score }
  }
  return { status: 'conflicting', score }
}

function buildClaimQuery(claim: string): SearchQuery {
  const terms = tokenize(claim)
    .slice(0, 4)
    .map((term, index) => ({
      id: `claim-${index + 1}`,
      term,
      description: 'Claim keyword',
    }))

  return {
    id: createLocalId('claim-query'),
    terms,
    operators: terms.slice(1).map(() => 'AND'),
    filters: {},
    rawQuery: claim,
    createdAt: new Date().toISOString(),
  }
}

export async function verifyClaimWithHealthSources(
  claim: string,
  _sourceUrl?: string
): Promise<VerificationResult | null> {
  const targetClaim = claim.trim()
  if (!targetClaim) return null

  const query = buildClaimQuery(targetClaim)
  const response = (await searchHealthSources(query, 10)) ?? getCachedHealthSearchResults(query)
  if (!response || !response.results.length) {
    return null
  }

  const claimTokens = tokenize(targetClaim)
  const claimHasNegation = NEGATION_REGEX.test(targetClaim)
  const evidence = response.results.map((result) => buildEvidenceItem(result, claimTokens, claimHasNegation))
  const sortedEvidence = evidence.sort((a, b) => b.relevanceScore - a.relevanceScore)
  const supportingEvidence = sortedEvidence.filter((item) => item.supports).slice(0, 4)
  const contradictingEvidence = sortedEvidence.filter((item) => !item.supports).slice(0, 4)
  const { status, score } = computeStatusAndScore(supportingEvidence, contradictingEvidence)

  const result: VerificationResult = {
    id: createLocalId('verification'),
    claim: targetClaim,
    status,
    score,
    supportingEvidence,
    contradictingEvidence,
    explanation:
      `Verificacion preliminar generada con ${response.provider}. ` +
      `El resultado es automatico y debe complementarse con revision experta.`,
    recommendations: [
      'Lee los articulos con mayor relevancia antes de tomar decisiones clinicas.',
      'Prioriza revisiones sistematicas y ensayos aleatorizados recientes.',
      'Si hay conflicto de evidencia, revisa metodos, tamano de muestra y sesgos.',
    ],
    verifiedAt: new Date().toISOString(),
  }

  writeVerificationCacheEntry(targetClaim, result)
  return result
}
