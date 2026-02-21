import type { VerificationResult } from '@/types'
import { api, ApiHttpError } from './api-client'
import { isConnectivityError } from './api-errors'
import { getCachedHealthVerification, verifyClaimWithHealthSources } from './health-sources'
import {
  STUDENT_FALLBACK_KEYS,
  createLocalId,
  isBackendReachable,
  paginateItems,
  readLocalStorage,
  writeLocalStorage,
} from './student-resilience'
import { validateContentSourceUrl } from './url-validation'

type VerificationHistoryResponse = {
  verifications: VerificationResult[]
  total: number
}

function normalizeEvidenceItem(value: unknown, index: number, supports: boolean) {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const articleId =
    typeof item.articleId === 'string' && item.articleId ? item.articleId : `evidence-${index}`

  return {
    articleId,
    title: typeof item.title === 'string' ? item.title : 'Evidencia local',
    snippet: typeof item.snippet === 'string' ? item.snippet : '',
    supports: typeof item.supports === 'boolean' ? item.supports : supports,
    relevanceScore:
      typeof item.relevanceScore === 'number' && Number.isFinite(item.relevanceScore)
        ? item.relevanceScore
        : 50,
    source: typeof item.source === 'string' ? item.source : undefined,
    sourceUrl: typeof item.sourceUrl === 'string' ? item.sourceUrl : undefined,
  }
}

function normalizeVerificationResult(value: unknown, fallbackClaim?: string): VerificationResult {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const score =
    typeof item.score === 'number' && Number.isFinite(item.score)
      ? Math.max(0, Math.min(100, item.score))
      : 50

  return {
    id: typeof item.id === 'string' && item.id ? item.id : createLocalId('verification'),
    claim:
      typeof item.claim === 'string' && item.claim ? item.claim : fallbackClaim || 'Claim no disponible',
    status:
      item.status === 'verified' ||
      item.status === 'conflicting' ||
      item.status === 'misinformation' ||
      item.status === 'pending'
        ? item.status
        : 'pending',
    score,
    supportingEvidence: Array.isArray(item.supportingEvidence)
      ? item.supportingEvidence.map((evidence, index) => normalizeEvidenceItem(evidence, index, true))
      : [],
    contradictingEvidence: Array.isArray(item.contradictingEvidence)
      ? item.contradictingEvidence.map((evidence, index) => normalizeEvidenceItem(evidence, index, false))
      : [],
    explanation:
      typeof item.explanation === 'string' && item.explanation
        ? item.explanation
        : 'Resultado sin explicacion disponible.',
    recommendations: Array.isArray(item.recommendations)
      ? item.recommendations.filter((entry): entry is string => typeof entry === 'string')
      : [],
    verifiedAt:
      typeof item.verifiedAt === 'string' && item.verifiedAt
        ? item.verifiedAt
        : new Date().toISOString(),
  }
}

function readVerificationHistoryLocal(): VerificationResult[] {
  return readLocalStorage<VerificationResult[]>(STUDENT_FALLBACK_KEYS.verificationHistory, [])
}

function writeVerificationHistoryLocal(items: VerificationResult[]): void {
  writeLocalStorage(STUDENT_FALLBACK_KEYS.verificationHistory, items)
}

function addVerificationHistoryLocal(result: VerificationResult): void {
  const existing = readVerificationHistoryLocal()
  const next = [result, ...existing.filter((item) => item.id !== result.id)].slice(0, 100)
  writeVerificationHistoryLocal(next)
}

function canUseFallback(error: unknown): boolean {
  if (error instanceof ApiHttpError) {
    return error.status >= 500
  }
  return isConnectivityError(error)
}

function buildUnavailableVerificationError(backendReachable: boolean, isUrlMode: boolean): Error {
  if (isUrlMode) {
    return new Error(
      backendReachable
        ? 'No fue posible verificar la URL con datos confiables en este momento. Intenta nuevamente.'
        : 'La verificacion por URL requiere conexion al backend para extraer contenido real.'
    )
  }

  return new Error(
    backendReachable
      ? 'No fue posible completar la verificacion con evidencia real en este momento. Intenta nuevamente.'
      : 'No hay conectividad para verificar el claim con fuentes reales.'
  )
}

export const verifyApi = {
  verifyClaim: async (claim: string, url?: string, options?: RequestInit) => {
    const normalizedClaim = typeof claim === 'string' ? claim.trim() : ''

    let normalizedUrl: string | undefined
    if (typeof url === 'string' && url.trim()) {
      const urlValidation = validateContentSourceUrl(url)
      if (!urlValidation.normalizedUrl || urlValidation.error) {
        throw new Error(urlValidation.error || 'La URL no es valida para verificacion')
      }
      normalizedUrl = urlValidation.normalizedUrl
    }

    if (!normalizedClaim && !normalizedUrl) {
      throw new Error('Debes enviar un claim o una URL valida para verificar.')
    }

    try {
      const payload: { claimText?: string; sourceUrl?: string } = {}
      if (normalizedClaim) payload.claimText = normalizedClaim
      if (normalizedUrl) payload.sourceUrl = normalizedUrl

      const result = await api.post<VerificationResult>('/verify/claim', payload, options)
      const normalized = normalizeVerificationResult(result, normalizedClaim || normalizedUrl)
      addVerificationHistoryLocal(normalized)
      return normalized
    } catch (error) {
      if (!canUseFallback(error)) {
        throw error
      }

      const backendReachable = await isBackendReachable()

      if (normalizedClaim) {
        const externalVerification = await verifyClaimWithHealthSources(normalizedClaim, normalizedUrl).catch(
          () => null
        )
        if (externalVerification) {
          addVerificationHistoryLocal(externalVerification)
          return externalVerification
        }

        const cachedVerification = getCachedHealthVerification(normalizedClaim)
        if (cachedVerification) {
          const normalizedCached = normalizeVerificationResult(cachedVerification, normalizedClaim)
          addVerificationHistoryLocal(normalizedCached)
          return normalizedCached
        }
      }

      if (normalizedUrl && !normalizedClaim) {
        const cachedByUrl = getCachedHealthVerification(normalizedUrl)
        if (cachedByUrl) {
          const normalizedCached = normalizeVerificationResult(cachedByUrl, normalizedUrl)
          addVerificationHistoryLocal(normalizedCached)
          return normalizedCached
        }
      }

      throw buildUnavailableVerificationError(backendReachable, Boolean(normalizedUrl && !normalizedClaim))
    }
  },

  getHistory: (page = 1, limit = 10) =>
    api
      .get<VerificationHistoryResponse>(`/verify/history?page=${page}&limit=${limit}`)
      .then((response) => {
        const normalized = Array.isArray(response.verifications)
          ? response.verifications.map((verification) => normalizeVerificationResult(verification))
          : []
        writeVerificationHistoryLocal(normalized)
        return {
          verifications: normalized,
          total: typeof response.total === 'number' ? response.total : normalized.length,
        }
      })
      .catch(async () => {
        await isBackendReachable()
        const history = readVerificationHistoryLocal()
        const { pageItems, total } = paginateItems(history, page, limit)
        return {
          verifications: pageItems,
          total,
        }
      }),
}
