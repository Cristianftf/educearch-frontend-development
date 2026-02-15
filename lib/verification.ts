import type { VerificationResult } from '@/types'
import { api } from './api-client'
import {
  STUDENT_FALLBACK_KEYS,
  createLocalId,
  isBackendReachable,
  paginateItems,
  readLocalStorage,
  writeLocalStorage,
} from './student-resilience'

type VerificationHistoryResponse = {
  verifications: VerificationResult[]
  total: number
}

function normalizeEvidenceItem(value: unknown, index: number, supports: boolean) {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const articleId =
    typeof item.articleId === 'string' && item.articleId
      ? item.articleId
      : `evidence-${index}`
  return {
    articleId,
    title: typeof item.title === 'string' ? item.title : 'Evidencia local',
    snippet: typeof item.snippet === 'string' ? item.snippet : '',
    supports: typeof item.supports === 'boolean' ? item.supports : supports,
    relevanceScore:
      typeof item.relevanceScore === 'number' && Number.isFinite(item.relevanceScore)
        ? item.relevanceScore
        : 50,
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
      typeof item.claim === 'string' && item.claim
        ? item.claim
        : fallbackClaim || 'Claim no disponible',
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
      ? item.contradictingEvidence.map((evidence, index) =>
          normalizeEvidenceItem(evidence, index, false)
        )
      : [],
    explanation:
      typeof item.explanation === 'string' && item.explanation
        ? item.explanation
        : 'Resultado de respaldo local.',
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

function buildFallbackVerification(claim: string, sourceUrl?: string, backendReachable?: boolean): VerificationResult {
  const analyzedClaim = claim || sourceUrl || 'Claim no disponible'
  return {
    id: createLocalId('verification'),
    claim: analyzedClaim,
    status: 'pending',
    score: 50,
    supportingEvidence: [],
    contradictingEvidence: [],
    explanation: backendReachable
      ? 'No fue posible completar la verificacion con el servicio actual. Se activo modo local.'
      : 'Backend/API no disponible. Se activo modo local con datos de respaldo.',
    recommendations: [
      'Reintenta en unos minutos para ejecutar la verificacion completa.',
      'Valida el claim con terminos MeSH especificos en el modulo de busqueda.',
      'Contrasta la afirmacion con revisiones sistematicas recientes.',
    ],
    verifiedAt: new Date().toISOString(),
  }
}

export const verifyApi = {
  verifyClaim: (claim: string, url?: string, options?: RequestInit) =>
    api
      .post<VerificationResult>(
        '/verify/claim',
        { claimText: claim, sourceUrl: url },
        options
      )
      .then((result) => {
        const normalized = normalizeVerificationResult(result, claim || url)
        addVerificationHistoryLocal(normalized)
        return normalized
      })
      .catch(async () => {
        const backendReachable = await isBackendReachable()
        const fallback = buildFallbackVerification(claim, url, backendReachable)
        addVerificationHistoryLocal(fallback)
        return fallback
      }),

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
