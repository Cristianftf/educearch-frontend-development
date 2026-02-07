import type { Bibliography, BibliographyFormat, SearchResult } from '@/types'
import { api } from './api-client'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

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
        })),
      })
      .then(mapBibliography),

  getFormats: () => api.get<{ formats: BibliographyFormat[] }>('/formats/available'),

  getHistory: () =>
    api
      .get<BibliographyResponseDTO[]>('/bibliography/history')
      .then((items) => items.map(mapBibliography)),

  download: (id: string, format: 'docx' | 'txt') =>
    api.getBlob(`/bibliography/${id}/download?format=${format}`),
}
