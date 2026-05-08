import type { Bibliography, BibliographyFormat, SearchResult } from '@/types'
import { api, ApiHttpError } from './api-client'
import { isConnectivityError } from './api-errors'
import {
  STUDENT_FALLBACK_KEYS,
  createLocalId,
  isBackendReachable,
  readLocalStorage,
  writeLocalStorage,
} from './student-resilience'

type BibliographyResponseDTO = {
  id: string
  name: string
  format: string
  content: string
  createdAt: string | null
  articleCount?: number | null
  articles?: Array<{
    id: string
    pmid: string
    title: string
    authors?: string[]
    journal?: string
    year?: number
    abstractText?: string
    studyType?: string
    evidenceLevel?: number
    sampleSize?: number
    hasConflictOfInterest?: boolean
    doi?: string
    source?: string
    sourceUrl?: string
  }>
}

const AVAILABLE_FORMATS: BibliographyFormat[] = ['apa', 'vancouver', 'bibtex', 'xml']

function sanitizeString(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim()
  return normalized || fallback
}

function normalizeBibliographyFormat(value: unknown): BibliographyFormat {
  return AVAILABLE_FORMATS.includes(value as BibliographyFormat) ? (value as BibliographyFormat) : 'apa'
}

function normalizeSourceUrl(value: unknown): string | undefined {
  const normalized = sanitizeString(value)
  return /^https?:\/\//i.test(normalized) ? normalized : undefined
}

function mapArticle(article: NonNullable<BibliographyResponseDTO['articles']>[number], index: number): SearchResult {
  const currentYear = new Date().getFullYear()
  const rawYear =
    typeof article.year === 'number' && Number.isFinite(article.year)
      ? article.year
      : Number.parseInt(String(article.year ?? ''), 10)
  const year =
    Number.isFinite(rawYear) && rawYear >= 1900 && rawYear <= currentYear + 1
      ? rawYear
      : currentYear

  return {
    id: sanitizeString(article.id, `article-${index + 1}`),
    pmid: sanitizeString(article.pmid),
    title: sanitizeString(article.title, '(Sin titulo)'),
    authors: Array.isArray(article.authors)
      ? article.authors
          .map((author) => sanitizeString(author))
          .filter((author) => author.length > 0)
      : [],
    journal: sanitizeString(article.journal),
    year,
    abstract: sanitizeString(article.abstractText),
    studyType: sanitizeString(article.studyType, 'unknown'),
    evidenceLevel:
      typeof article.evidenceLevel === 'number' && Number.isFinite(article.evidenceLevel)
        ? Math.max(0, Math.min(10, article.evidenceLevel))
        : 0,
    sampleSize:
      typeof article.sampleSize === 'number' && Number.isFinite(article.sampleSize)
        ? Math.max(0, article.sampleSize)
        : undefined,
    hasConflictOfInterest: article.hasConflictOfInterest === true,
    doi: sanitizeString(article.doi) || undefined,
    source: sanitizeString(article.source) || undefined,
    sourceUrl: normalizeSourceUrl(article.sourceUrl),
  }
}

function mapBibliography(dto: BibliographyResponseDTO): Bibliography {
  const createdAt = sanitizeString(dto.createdAt) || new Date().toISOString()
  const normalizedArticles = Array.isArray(dto.articles)
    ? dto.articles.map(mapArticle)
    : []

  return {
    id: sanitizeString(dto.id, createLocalId('bibliography')),
    name: sanitizeString(dto.name, 'Bibliografia sin nombre'),
    format: normalizeBibliographyFormat(dto.format),
    content: sanitizeString(dto.content, 'No hay contenido disponible.'),
    createdAt,
    articleCount:
      typeof dto.articleCount === 'number' && Number.isFinite(dto.articleCount)
        ? Math.max(0, dto.articleCount)
        : normalizedArticles.length,
    articles: normalizedArticles,
  }
}

function normalizeLocalBibliography(item: unknown, index: number): Bibliography | null {
  if (!item || typeof item !== 'object') return null
  const value = item as Record<string, unknown>
  const articles = Array.isArray(value.articles)
    ? value.articles.map((article, articleIndex) =>
        mapArticle((article ?? {}) as NonNullable<BibliographyResponseDTO['articles']>[number], articleIndex)
      )
    : []

  return {
    id: sanitizeString(value.id, `local-bibliography-${index + 1}`),
    name: sanitizeString(value.name, 'Bibliografia sin nombre'),
    format: normalizeBibliographyFormat(value.format),
    content: sanitizeString(value.content, 'No hay contenido disponible.'),
    createdAt: sanitizeString(value.createdAt, new Date().toISOString()),
    articleCount:
      typeof value.articleCount === 'number' && Number.isFinite(value.articleCount)
        ? Math.max(0, value.articleCount)
        : articles.length,
    articles,
  }
}

function readBibliographyHistoryLocal(): Bibliography[] {
  const stored = readLocalStorage<unknown[]>(STUDENT_FALLBACK_KEYS.bibliographyHistory, [])
  if (!Array.isArray(stored)) return []
  return stored
    .map((item, index) => normalizeLocalBibliography(item, index))
    .filter((item): item is Bibliography => Boolean(item))
}

function writeBibliographyHistoryLocal(items: Bibliography[]): void {
  const normalized = items
    .map((item, index) => normalizeLocalBibliography(item, index))
    .filter((item): item is Bibliography => Boolean(item))
  writeLocalStorage(STUDENT_FALLBACK_KEYS.bibliographyHistory, normalized)
}

function upsertBibliographyLocal(item: Bibliography): void {
  const existing = readBibliographyHistoryLocal()
  const next = [item, ...existing.filter((entry) => entry.id !== item.id)]
  writeBibliographyHistoryLocal(next)
}

function formatAuthors(authors: string[]): string {
  if (!authors.length) return 'Autor desconocido'
  if (authors.length === 1) return authors[0]
  return `${authors[0]} et al.`
}

function buildCitationLine(article: SearchResult, format: BibliographyFormat, index: number): string {
  const authors = formatAuthors(article.authors)
  const year = article.year || new Date().getFullYear()
  const title = article.title || 'Sin titulo'
  const journal = article.journal || 'Sin revista'
  const doi = article.doi ? ` doi:${article.doi}` : ''

  switch (format) {
    case 'vancouver':
      return `${index}. ${authors}. ${title}. ${journal}. ${year}.${doi}`
    case 'bibtex':
      return `@article{ref${index}, title={${title}}, author={${authors}}, journal={${journal}}, year={${year}}${article.doi ? `, doi={${article.doi}}` : ''}}`
    case 'xml':
      return `<reference><authors>${authors}</authors><title>${title}</title><journal>${journal}</journal><year>${year}</year>${article.doi ? `<doi>${article.doi}</doi>` : ''}</reference>`
    case 'apa':
    default:
      return `${authors} (${year}). ${title}. ${journal}.${doi}`
  }
}

function buildFallbackBibliographyContent(articles: SearchResult[], format: BibliographyFormat): string {
  if (!articles.length) {
    return 'No hay articulos para generar la bibliografia.'
  }
  return articles
    .map((article, index) => buildCitationLine(article, format, index + 1))
    .join('\n\n')
}

export const bibliographyApi = {
  generate: (
    articleIds: string[],
    format: BibliographyFormat,
    name: string,
    articles?: SearchResult[]
  ) =>
    api
      .post<BibliographyResponseDTO>('/export/bibliography', {
        articleIds,
        format,
        name,
        articles: articles?.map((article) => ({
          id: article.id,
          pmid: article.pmid,
          title: article.title,
          authors: article.authors,
          journal: article.journal,
          year: article.year,
          doi: article.doi,
          source: article.source,
          sourceUrl: article.sourceUrl,
        })),
      })
      .then(mapBibliography)
      .then((bibliography) => {
        upsertBibliographyLocal(bibliography)
        return bibliography
      })
      .catch(async (error) => {
        const shouldFallback =
          isConnectivityError(error) || (error instanceof ApiHttpError && error.status >= 500)
        if (!shouldFallback) throw error

        const backendReachable = await isBackendReachable()
        const fallback: Bibliography = {
          id: createLocalId('bibliography'),
          name,
          format,
          content: buildFallbackBibliographyContent(articles ?? [], format),
          createdAt: new Date().toISOString(),
          articleCount: articleIds.length,
          articles: articles ?? [],
        }
        if (!backendReachable) {
          fallback.content = `${fallback.content}\n\n[Respaldo local por perdida de conexion con backend/API]`
        }
        upsertBibliographyLocal(fallback)
        return fallback
      }),

  getFormats: () =>
    api
      .get<{ formats: BibliographyFormat[] }>('/formats/available')
      .then((response) => {
        const formats = Array.isArray(response.formats)
          ? response.formats.filter((format) => AVAILABLE_FORMATS.includes(format))
          : []
        return {
          formats: formats.length ? formats : AVAILABLE_FORMATS,
        }
      })
      .catch(async () => {
        await isBackendReachable()
        return { formats: AVAILABLE_FORMATS }
      }),

  getHistory: () =>
    api
      .get<BibliographyResponseDTO[]>('/bibliography/history')
      .then((items) => {
        const normalized = items.map(mapBibliography)
        writeBibliographyHistoryLocal(normalized)
        return normalized
      })
      .catch(async () => {
        await isBackendReachable()
        return readBibliographyHistoryLocal()
      }),

  download: (id: string, format: 'docx' | 'txt') =>
    api
      .getBlob(`/bibliography/${id}/download?format=${format}`)
      .catch(async () => {
        await isBackendReachable()
        const bibliography = readBibliographyHistoryLocal().find((item) => item.id === id)
        const fallbackText = bibliography?.content || 'No hay contenido disponible para descargar.'
        const blobContent =
          format === 'docx'
            ? `Bibliografia (respaldo local)\n\n${fallbackText}`
            : fallbackText
        return new Blob([blobContent], {
          type: format === 'docx' ? 'application/octet-stream' : 'text/plain;charset=utf-8',
        })
      }),
}
