import type { Bibliography, BibliographyFormat, SearchResult } from '@/types'
import { api } from './api-client'
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

const mapArticle = (article: NonNullable<BibliographyResponseDTO['articles']>[number]): SearchResult => ({
  id: article.id,
  pmid: article.pmid,
  title: article.title,
  authors: article.authors ?? [],
  journal: article.journal ?? '',
  year: article.year ?? new Date().getFullYear(),
  abstract: article.abstractText ?? '',
  studyType: article.studyType ?? 'unknown',
  evidenceLevel: article.evidenceLevel ?? 0,
  sampleSize: article.sampleSize,
  hasConflictOfInterest: article.hasConflictOfInterest ?? false,
  doi: article.doi,
  source: article.source,
  sourceUrl: article.sourceUrl,
})

const mapBibliography = (dto: BibliographyResponseDTO): Bibliography => ({
  id: dto.id,
  name: dto.name,
  format: dto.format as BibliographyFormat,
  content: dto.content,
  createdAt: dto.createdAt ?? new Date().toISOString(),
  articleCount: dto.articleCount ?? dto.articles?.length ?? 0,
  articles: dto.articles ? dto.articles.map(mapArticle) : [],
})

const AVAILABLE_FORMATS: BibliographyFormat[] = ['apa', 'vancouver', 'bibtex', 'xml']

function readBibliographyHistoryLocal(): Bibliography[] {
  return readLocalStorage<Bibliography[]>(STUDENT_FALLBACK_KEYS.bibliographyHistory, [])
}

function writeBibliographyHistoryLocal(items: Bibliography[]): void {
  writeLocalStorage(STUDENT_FALLBACK_KEYS.bibliographyHistory, items)
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
      .catch(async () => {
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
