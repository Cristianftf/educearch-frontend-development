import type { EvidenceItem, VerificationResult } from '@/types'
import { api, ApiHttpError } from './api-client'
import { isConnectivityError } from './api-errors'
import { getCachedHealthVerification, verifyClaimWithHealthSources } from './health-sources'
import { emitExternalApiActivity } from './external-api-activity'
import {
  searchAssistantApi,
  type AssistantConversationMessage,
  type SearchAssistantResponse,
} from './search-assistant'
import {
  STUDENT_FALLBACK_KEYS,
  createLocalId,
  isBackendReachable,
  paginateItems,
  readLocalStorage,
  writeLocalStorage,
} from './student-resilience'
import {
  type RequestLoadProfile,
  normalizeRequestLoadProfile,
} from './request-load-profile'
import { validateContentSourceUrl } from './url-validation'

type VerificationHistoryResponse = {
  verifications: VerificationResult[]
  total: number
}

type VerifyClaimOptions = RequestInit & {
  activityRunId?: string
  loadProfile?: RequestLoadProfile
}

const VERIFY_ASSISTANT_PROJECT_CONTEXT =
  'Proyecto EDUSEARCH: verificacion de infodemia medica para estudiantes. ' +
  'Objetivo: evaluar consistencia de evidencia, detectar desinformacion y proponer siguientes pasos verificables. ' +
  'Responde con lenguaje clinico claro, sin inventar datos, y sugiere acciones concretas.'

const MAX_EVIDENCE_ITEMS = 8
const MAX_RECOMMENDATIONS = 8
const ASSISTANT_REPLY_MIN_LENGTH = 80
const ASSISTANT_GENERIC_REPLY_REGEX =
  /(no se pudo obtener respuesta|reintenta|fallo temporal|no pude consultar la ia|gemini)/i

type VerificationLoadConfig = {
  deadlineMs: number
  minBudgetMs: number
  backendBudgetMinMs: number
  backendBudgetMaxMs: number
  backendReserveMs: number
  waitForFinalResult: boolean
  resultPollIntervalMs: number
  resultPollMaxMs: number
  fallbackSearchResults: number
  fallbackProxyAttempts: number
  fallbackProxyTimeoutMs: number
  allowWeakResultFallback: boolean
  allowAssistantEnhancement: boolean
  assistantMinBudgetMs: number
  assistantMaxResults: number
}

const VERIFICATION_LOAD_CONFIG: Record<RequestLoadProfile, VerificationLoadConfig> = {
  light: {
    deadlineMs: 18000,
    minBudgetMs: 700,
    backendBudgetMinMs: 3400,
    backendBudgetMaxMs: 8500,
    backendReserveMs: 5200,
    waitForFinalResult: true,
    resultPollIntervalMs: 1400,
    resultPollMaxMs: 7000,
    fallbackSearchResults: 6,
    fallbackProxyAttempts: 2,
    fallbackProxyTimeoutMs: 1000,
    allowWeakResultFallback: false,
    allowAssistantEnhancement: true,
    assistantMinBudgetMs: 1200,
    assistantMaxResults: 14,
  },
  balanced: {
    deadlineMs: 30000,
    minBudgetMs: 900,
    backendBudgetMinMs: 6200,
    backendBudgetMaxMs: 14000,
    backendReserveMs: 10000,
    waitForFinalResult: true,
    resultPollIntervalMs: 1300,
    resultPollMaxMs: 14000,
    fallbackSearchResults: 12,
    fallbackProxyAttempts: 2,
    fallbackProxyTimeoutMs: 1700,
    allowWeakResultFallback: true,
    allowAssistantEnhancement: true,
    assistantMinBudgetMs: 1200,
    assistantMaxResults: 30,
  },
  deep: {
    deadlineMs: 42000,
    minBudgetMs: 1200,
    backendBudgetMinMs: 8000,
    backendBudgetMaxMs: 22000,
    backendReserveMs: 13000,
    waitForFinalResult: true,
    resultPollIntervalMs: 1200,
    resultPollMaxMs: 22000,
    fallbackSearchResults: 16,
    fallbackProxyAttempts: 2,
    fallbackProxyTimeoutMs: 2200,
    allowWeakResultFallback: true,
    allowAssistantEnhancement: true,
    assistantMinBudgetMs: 1400,
    assistantMaxResults: 40,
  },
}

const BACKEND_VERIFICATION_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function createAbortError(): Error {
  const error = new Error('Verification request aborted')
  error.name = 'AbortError'
  return error
}

function isBackendVerificationId(value: string | undefined): boolean {
  if (!value) return false
  return BACKEND_VERIFICATION_ID_REGEX.test(value.trim())
}

const CLAIM_KEYWORD_STOPWORDS = new Set([
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
  'http',
  'https',
  'www',
  'com',
  'org',
  'net',
])

function normalizePercentScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  const normalized = value >= 0 && value <= 1 ? value * 100 : value
  return Math.max(0, Math.min(100, normalized))
}

function normalizeSimilarityScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  const normalized = value > 1 ? value / 100 : value
  return Math.max(0, Math.min(1, normalized))
}

function normalizeEvidenceItem(value: unknown, index: number, supports: boolean): EvidenceItem | null {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const title = typeof item.title === 'string' ? item.title.trim() : ''
  const snippet = typeof item.snippet === 'string' ? item.snippet.trim() : ''
  if (!title && !snippet) {
    return null
  }

  const relevanceCandidate =
    typeof item.relevanceScore === 'number' && Number.isFinite(item.relevanceScore)
      ? item.relevanceScore
      : typeof item.similarity === 'number' && Number.isFinite(item.similarity)
        ? item.similarity
        : 0
  const relevanceScore = normalizePercentScore(relevanceCandidate)

  const supportsFromStance =
    typeof item.stance === 'string'
      ? item.stance.toLowerCase().includes('support')
      : supports

  const evidenceLevel =
    typeof item.evidenceLevel === 'number' && Number.isFinite(item.evidenceLevel)
      ? Math.max(1, Math.min(10, Math.trunc(item.evidenceLevel)))
      : undefined

  const similarityCandidate =
    typeof item.similarity === 'number' && Number.isFinite(item.similarity)
      ? item.similarity
      : typeof item.relevanceScore === 'number' && Number.isFinite(item.relevanceScore)
        ? item.relevanceScore
        : undefined
  const similarityScore =
    typeof similarityCandidate === 'number'
      ? normalizeSimilarityScore(similarityCandidate)
      : undefined

  const year =
    typeof item.year === 'number' && Number.isFinite(item.year)
      ? Math.trunc(item.year)
      : typeof item.publicationYear === 'number' && Number.isFinite(item.publicationYear)
        ? Math.trunc(item.publicationYear)
        : undefined

  return {
    articleId:
      typeof item.articleId === 'string' && item.articleId
        ? item.articleId
        : typeof item.pmid === 'string' && item.pmid
          ? item.pmid
          : `evidence-${index + 1}`,
    title: title || snippet.slice(0, 120),
    snippet,
    supports: typeof item.supports === 'boolean' ? item.supports : supportsFromStance,
    relevanceScore,
    source: typeof item.source === 'string' ? item.source : undefined,
    sourceUrl: typeof item.sourceUrl === 'string' ? item.sourceUrl : undefined,
    evidenceLevel,
    similarityScore,
    year,
    studyType: typeof item.studyType === 'string' ? item.studyType : undefined,
  }
}

function normalizeVerificationResult(value: unknown, fallbackClaim?: string): VerificationResult {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const score =
    typeof item.score === 'number' && Number.isFinite(item.score)
      ? Math.max(0, Math.min(100, item.score))
      : 0

  return {
    id: typeof item.id === 'string' && item.id ? item.id : createLocalId('verification'),
    claim:
      typeof item.claim === 'string' && item.claim ? item.claim : fallbackClaim || '',
    status:
      item.status === 'verified' ||
      item.status === 'conflicting' ||
      item.status === 'misinformation' ||
      item.status === 'pending'
        ? item.status
        : 'pending',
    score,
    supportingEvidence: Array.isArray(item.supportingEvidence)
      ? item.supportingEvidence
          .map((evidence, index) => normalizeEvidenceItem(evidence, index, true))
          .filter((evidence): evidence is EvidenceItem => Boolean(evidence))
      : [],
    contradictingEvidence: Array.isArray(item.contradictingEvidence)
      ? item.contradictingEvidence
          .map((evidence, index) => normalizeEvidenceItem(evidence, index, false))
          .filter((evidence): evidence is EvidenceItem => Boolean(evidence))
      : [],
    explanation:
      typeof item.explanation === 'string' && item.explanation
        ? item.explanation
        : 'No hay explicacion disponible.',
    recommendations: Array.isArray(item.recommendations)
      ? item.recommendations
          .filter((entry): entry is string => typeof entry === 'string')
          .map((entry) => entry.trim())
          .filter(Boolean)
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

function canUseLocalFallback(): boolean {
  const role = api.getUserRole()
  return role === null || role === 'student' || role === 'professor'
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

function normalizeClaimInput(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function buildEmergencyFallbackVerification(
  claim: string,
  sourceUrl: string | undefined,
  backendReachable: boolean
): VerificationResult {
  const normalizedClaim = normalizeClaimInput(claim || sourceUrl || 'Verificacion de infodemia')
  const keywords = extractClaimKeywords(normalizedClaim, 6)
  const keywordHint = keywords.length > 0 ? ` (${keywords.join(', ')})` : ''

  const recommendations = dedupeStringList(
    [
      'Reintenta la verificacion cuando la conexion al backend y APIs externas sea estable.',
      `Ejecuta una busqueda manual en PubMed, Europe PMC y ClinicalTrials.gov${keywordHint}.`,
      sourceUrl ? `Contrasta directamente la fuente original: ${sourceUrl}` : '',
      'No tomes decisiones clinicas solo con este resultado preliminar sin evidencia recuperada.',
    ],
    MAX_RECOMMENDATIONS
  )

  return {
    id: createLocalId('verification-emergency'),
    claim: normalizedClaim,
    status: 'pending',
    score: 0,
    supportingEvidence: [],
    contradictingEvidence: [],
    explanation: backendReachable
      ? 'El motor de verificacion no devolvio evidencia util en este intento. Se genera un resultado preliminar para evitar bloqueo de la interfaz.'
      : 'No hay conectividad estable con backend ni proveedores externos. Se genera un resultado preliminar sin evidencia recuperada.',
    recommendations,
    verifiedAt: new Date().toISOString(),
  }
}

function normalizeAssistantText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function hasPlaceholderExplanation(value: string): boolean {
  const normalized = normalizeAssistantText(value).toLowerCase()
  if (!normalized) return true
  if (normalized.length < 30) return true
  return (
    normalized.includes('no hay explicacion') ||
    normalized.includes('no se pudo completar la verificacion') ||
    normalized.includes('analizando') ||
    normalized.includes('pending')
  )
}

function countEvidence(result: VerificationResult): number {
  return result.supportingEvidence.length + result.contradictingEvidence.length
}

function scoreResultQuality(result: VerificationResult): number {
  const evidenceCount = countEvidence(result)
  const statusScore = result.status === 'pending' ? 0 : 2
  const explanationScore = hasPlaceholderExplanation(result.explanation) ? 0 : 2
  const recommendationScore = result.recommendations.length > 0 ? 1 : 0
  return Math.min(10, evidenceCount + statusScore + explanationScore + recommendationScore)
}

function dedupeEvidenceItems(items: EvidenceItem[]): EvidenceItem[] {
  const seen = new Set<string>()
  const deduped: EvidenceItem[] = []
  for (const item of items) {
    const key = `${item.articleId || ''}|${(item.title || '').toLowerCase()}|${(item.snippet || '')
      .slice(0, 80)
      .toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
    if (deduped.length >= MAX_EVIDENCE_ITEMS) break
  }
  return deduped
}

function dedupeStringList(items: string[], limit = MAX_RECOMMENDATIONS): string[] {
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const item of items) {
    if (typeof item !== 'string') continue
    const normalized = item.trim()
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(normalized)
    if (deduped.length >= limit) break
  }
  return deduped
}

function choosePreferredResult(primary: VerificationResult, secondary: VerificationResult): VerificationResult {
  const primaryScore = scoreResultQuality(primary)
  const secondaryScore = scoreResultQuality(secondary)
  return secondaryScore > primaryScore ? secondary : primary
}

function mergeVerificationResults(primary: VerificationResult, secondary: VerificationResult): VerificationResult {
  const preferred = choosePreferredResult(primary, secondary)
  const alternate = preferred.id === primary.id ? secondary : primary
  const mergedSupporting = dedupeEvidenceItems(
    [...preferred.supportingEvidence, ...alternate.supportingEvidence].sort(
      (left, right) => right.relevanceScore - left.relevanceScore
    )
  )
  const mergedContradicting = dedupeEvidenceItems(
    [...preferred.contradictingEvidence, ...alternate.contradictingEvidence].sort(
      (left, right) => right.relevanceScore - left.relevanceScore
    )
  )

  const preferredExplanationIsGood = !hasPlaceholderExplanation(preferred.explanation)
  const alternateExplanationIsGood = !hasPlaceholderExplanation(alternate.explanation)
  const explanation = preferredExplanationIsGood
    ? preferred.explanation
    : alternateExplanationIsGood
      ? alternate.explanation
      : preferred.explanation || alternate.explanation

  return {
    ...preferred,
    supportingEvidence: mergedSupporting,
    contradictingEvidence: mergedContradicting,
    explanation,
    recommendations: dedupeStringList([...preferred.recommendations, ...alternate.recommendations]),
  }
}

function safeDecodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function buildClaimFromSourceUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const pathTokens = parsed.pathname
      .split(/[\/\-_]+/)
      .map((item) => safeDecodeUriComponent(item))
      .map((item) => item.replace(/[^a-zA-Z0-9]/g, ' ').trim().toLowerCase())
      .filter((item) => item.length >= 3 && !item.includes('.'))

    if (pathTokens.length > 0) {
      return pathTokens.slice(0, 12).join(' ')
    }

    const hostTokens = parsed.hostname
      .split('.')
      .map((item) => item.toLowerCase())
      .filter((item) => item.length >= 3 && !CLAIM_KEYWORD_STOPWORDS.has(item))
    if (hostTokens.length > 0) {
      return hostTokens.slice(0, 4).join(' ')
    }
    return parsed.hostname
  } catch {
    return url
  }
}

function buildAnalysisClaim(claim: string, normalizedUrl?: string): string {
  if (claim) return claim
  if (normalizedUrl) return buildClaimFromSourceUrl(normalizedUrl)
  return ''
}

function extractClaimKeywords(value: string, limit = 8): string[] {
  if (!value) return []
  const tokens = value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !CLAIM_KEYWORD_STOPWORDS.has(token))

  const unique = new Set<string>()
  for (const token of tokens) {
    unique.add(token)
    if (unique.size >= limit) break
  }
  return Array.from(unique)
}

function buildEvidenceSummary(result: VerificationResult): string {
  const support = result.supportingEvidence
    .slice(0, 3)
    .map((item) => `${item.title} (relevancia ${Math.round(item.relevanceScore)}%)`)
    .join('; ')
  const contradict = result.contradictingEvidence
    .slice(0, 3)
    .map((item) => `${item.title} (relevancia ${Math.round(item.relevanceScore)}%)`)
    .join('; ')
  return `A favor: ${support || 'sin evidencia clara'} | En contra: ${contradict || 'sin evidencia clara'}`
}

function buildAssistantPrompt(result: VerificationResult, claim: string, sourceUrl?: string): string {
  const scope = sourceUrl ? `URL analizada: ${sourceUrl}.` : 'Claim de texto.'
  const evidenceSummary = buildEvidenceSummary(result)
  return (
    `Revisa este resultado de verificacion de infodemia y ofrece una explicacion clinica breve, precisa y accionable. ` +
    `Mantente fiel a la evidencia disponible.\n` +
    `Claim: ${claim}\n` +
    `${scope}\n` +
    `Estado calculado: ${result.status}\n` +
    `Score: ${result.score}\n` +
    `${evidenceSummary}\n` +
    `Devuelve recomendaciones especificas para validar o refutar el claim con mejores fuentes.`
  )
}

function buildAssistantRecommendations(response: SearchAssistantResponse): string[] {
  const fromTips = Array.isArray(response.tips) ? response.tips : []
  const fromTerms = Array.isArray(response.suggestedTerms)
    ? response.suggestedTerms.map((term) => `Buscar evidencia con termino MeSH: ${term.term}`)
    : []

  const filterParts: string[] = []
  if (response.suggestedFilters) {
    const { suggestedFilters } = response
    if (
      typeof suggestedFilters.yearFrom === 'number' &&
      typeof suggestedFilters.yearTo === 'number'
    ) {
      filterParts.push(`rango ${suggestedFilters.yearFrom}-${suggestedFilters.yearTo}`)
    }
    if (Array.isArray(suggestedFilters.studyTypes) && suggestedFilters.studyTypes.length > 0) {
      filterParts.push(`tipos ${suggestedFilters.studyTypes.slice(0, 3).join(', ')}`)
    }
    if (suggestedFilters.hasFullText === true) {
      filterParts.push('full text')
    }
  }
  const fromFilters =
    filterParts.length > 0
      ? [`Refinar criterios de busqueda para verificacion: ${filterParts.join(' | ')}`]
      : []

  return dedupeStringList([...fromTips, ...fromTerms, ...fromFilters])
}

function collectEvidenceTerms(result: VerificationResult, limit = 8): string[] {
  const terms = new Set<string>()
  const tokens = [...result.supportingEvidence, ...result.contradictingEvidence]
    .flatMap((item) => [item.title, item.snippet])
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !CLAIM_KEYWORD_STOPWORDS.has(token))

  for (const token of tokens) {
    terms.add(token)
    if (terms.size >= limit) break
  }
  return Array.from(terms)
}

function buildAssistantConversationHistory(
  result: VerificationResult,
  usedFallback: boolean
): AssistantConversationMessage[] {
  const supportCount = result.supportingEvidence.length
  const contradictCount = result.contradictingEvidence.length
  const totalEvidence = supportCount + contradictCount
  return [
    {
      role: 'user',
      content: `Evaluacion automatica previa: estado=${result.status}; score=${result.score}; evidencia_total=${totalEvidence}; soporte=${supportCount}; contradiccion=${contradictCount}; fallback=${usedFallback ? 'si' : 'no'}.`,
    },
    {
      role: 'assistant',
      content: `Resumen evidencia: ${buildEvidenceSummary(result)}`,
    },
  ]
}

function shouldRequestAssistantReview(
  result: VerificationResult,
  claim: string,
  sourceUrl: string | undefined,
  usedFallback: boolean
): boolean {
  if (!claim.trim()) return false
  if (usedFallback) return true
  if (sourceUrl) return true
  if (countEvidence(result) < 3) return true
  if (result.recommendations.length < 2) return true
  return hasPlaceholderExplanation(result.explanation)
}

async function maybeEnhanceWithAssistant(
  result: VerificationResult,
  claim: string,
  sourceUrl: string | undefined,
  usedFallback: boolean,
  assistantMaxResults: number
): Promise<VerificationResult> {
  if (!shouldRequestAssistantReview(result, claim, sourceUrl, usedFallback)) {
    return result
  }

  try {
    const currentYear = new Date().getFullYear()
    const evidenceTerms = collectEvidenceTerms(result, 8)
    const claimTerms = extractClaimKeywords(claim, 8)
    const selectedTerms = dedupeStringList([...claimTerms, ...evidenceTerms], 8)
    const response = await searchAssistantApi.ask({
      message: buildAssistantPrompt(result, claim, sourceUrl),
      selectedTerms,
      operators: ['AND'],
      recentTerms: evidenceTerms,
      projectContext: VERIFY_ASSISTANT_PROJECT_CONTEXT,
      conversationHistory: buildAssistantConversationHistory(result, usedFallback),
      filters: {
        yearFrom: Math.max(2000, currentYear - 10),
        yearTo: currentYear,
        studyTypes: ['systematic_review', 'meta_analysis', 'rct'],
        hasFullText: true,
        language: 'eng',
        maxResults: assistantMaxResults,
      },
    })

    const aiReply = normalizeAssistantText(response.reply || '')
    const aiReplyIsUseful =
      aiReply.length >= ASSISTANT_REPLY_MIN_LENGTH && !ASSISTANT_GENERIC_REPLY_REGEX.test(aiReply)
    const explanationShouldBeReplaced = hasPlaceholderExplanation(result.explanation)
    const nextExplanation =
      explanationShouldBeReplaced && aiReplyIsUseful ? aiReply : result.explanation

    const aiRecommendations = buildAssistantRecommendations(response)
    const nextRecommendations = dedupeStringList([...result.recommendations, ...aiRecommendations])

    return {
      ...result,
      explanation: nextExplanation,
      recommendations: nextRecommendations,
    }
  } catch {
    return result
  }
}

function shouldRecoverWithFallback(result: VerificationResult): boolean {
  const evidenceCount = countEvidence(result)
  if (evidenceCount === 0) return true
  if (result.status === 'pending') return true
  if (result.status === 'conflicting' && evidenceCount < 3 && result.score >= 45 && result.score <= 55) {
    return true
  }
  return scoreResultQuality(result) <= 4
}

function shouldPollForFinalVerification(result: VerificationResult): boolean {
  if (!isBackendVerificationId(result.id)) return false
  if (result.status === 'pending') return true
  return hasPlaceholderExplanation(result.explanation)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new Error('Timeout budget exhausted'))
  }
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    promise
      .then((value) => {
        clearTimeout(timeoutId)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}

function createVerificationActivityRunId(requestedRunId?: string): string {
  if (typeof requestedRunId === 'string' && requestedRunId.trim().length > 0) {
    return requestedRunId
  }
  return `verify-run-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function emitVerificationActivity(
  runId: string,
  provider: string,
  status: 'info' | 'success' | 'warning' | 'error',
  message: string,
  latencyMs?: number,
  resultCount?: number
): void {
  emitExternalApiActivity({
    runId,
    provider,
    status,
    message,
    latencyMs,
    resultCount,
  })
}

async function resolveFallbackVerification(
  analysisClaim: string,
  normalizedUrl?: string,
  options?: {
    activityRunId?: string
    maxResults?: number
    backendProxyAttempts?: number
    backendProxyTimeoutMs?: number
  }
): Promise<VerificationResult | null> {
  const live = await verifyClaimWithHealthSources(analysisClaim, normalizedUrl, {
    activityRunId: options?.activityRunId,
    maxResults: options?.maxResults,
    backendProxyAttempts: options?.backendProxyAttempts,
    backendProxyTimeoutMs: options?.backendProxyTimeoutMs,
  }).catch(() => null)
  if (live) return live

  const cached = getCachedHealthVerification(analysisClaim)
  if (!cached) return null

  return normalizeVerificationResult(
    {
      ...cached,
      id: createLocalId('verification'),
      verifiedAt: new Date().toISOString(),
      explanation: cached.explanation
        ? `${cached.explanation} [Resultado recuperado desde cache local de verificaciones.]`
        : 'Resultado recuperado desde cache local de verificaciones.',
    },
    analysisClaim
  )
}

async function resolveBackendVerificationResult(
  verificationId: string,
  fallbackClaim: string,
  options: {
    requestSignal?: AbortSignal
    pollIntervalMs: number
    maxWaitMs: number
  }
): Promise<VerificationResult | null> {
  const startedAt = Date.now()
  let latestResult: VerificationResult | null = null

  while (Date.now() - startedAt < options.maxWaitMs) {
    if (options.requestSignal?.aborted) {
      throw createAbortError()
    }

    try {
      const response = await api.get<VerificationResult>(`/verify/result/${verificationId}`)
      const normalized = normalizeVerificationResult(response, fallbackClaim)
      latestResult = latestResult ? mergeVerificationResults(latestResult, normalized) : normalized
      if (normalized.status !== 'pending' && !hasPlaceholderExplanation(normalized.explanation)) {
        return normalized
      }
    } catch {
      // Ignore transient polling failures and continue while budget exists.
    }

    const remaining = options.maxWaitMs - (Date.now() - startedAt)
    if (remaining <= 0) {
      break
    }
    await sleep(Math.min(options.pollIntervalMs, remaining))
  }

  return latestResult
}

export const verifyApi = {
  verifyClaim: async (claim: string, url?: string, options?: VerifyClaimOptions) => {
    const {
      activityRunId: requestedRunId,
      loadProfile: requestedLoadProfile,
      ...requestOptions
    } = options ?? {}
    const loadProfile = normalizeRequestLoadProfile(requestedLoadProfile)
    const loadConfig = VERIFICATION_LOAD_CONFIG[loadProfile]
    const activityRunId = createVerificationActivityRunId(requestedRunId)

    emitVerificationActivity(
      activityRunId,
      'Verificación clínica',
      'info',
      'Iniciando análisis de verificación.'
    )

    const startedAt = Date.now()
    const getRemainingBudget = (reserveMs = 0): number =>
      Math.max(0, loadConfig.deadlineMs - (Date.now() - startedAt) - reserveMs)
    const canRunWithBudget = (minimumMs = loadConfig.minBudgetMs): boolean =>
      getRemainingBudget() >= minimumMs

    try {
      const normalizedClaim = typeof claim === 'string' ? normalizeClaimInput(claim) : ''
      if (normalizedClaim.length > 1000) {
        throw new Error('La afirmacion supera el maximo permitido de 1000 caracteres.')
      }

      let normalizedUrl: string | undefined
      if (typeof url === 'string' && url.trim()) {
        emitVerificationActivity(
          activityRunId,
          'Validador de URL',
          'info',
          'Validando URL de origen.'
        )
        const urlValidation = validateContentSourceUrl(url)
        if (!urlValidation.normalizedUrl || urlValidation.error) {
          throw new Error(urlValidation.error || 'La URL no es valida para verificacion')
        }
        normalizedUrl = urlValidation.normalizedUrl
        if (normalizedUrl.length > 2048) {
          throw new Error('La URL supera la longitud maxima permitida para verificacion.')
        }
      }

      if (!normalizedClaim && !normalizedUrl) {
        throw new Error('Debes enviar un claim o una URL valida para verificar.')
      }

      const isUrlOnlyMode = Boolean(normalizedUrl && !normalizedClaim)
      const fallbackClaim = buildAnalysisClaim(normalizedClaim, normalizedUrl)
      const resolveFallbackWithinBudget = async (force = false): Promise<VerificationResult | null> => {
        if (!canUseLocalFallback()) return null
        if (!force && !canRunWithBudget()) return null
        const budget = force
          ? Math.max(1200, getRemainingBudget(80))
          : Math.max(loadConfig.minBudgetMs, getRemainingBudget(180))
        if (budget <= 0) return null
        return withTimeout(
          resolveFallbackVerification(fallbackClaim, normalizedUrl, {
            activityRunId,
            maxResults: loadConfig.fallbackSearchResults,
            backendProxyAttempts: loadConfig.fallbackProxyAttempts,
            backendProxyTimeoutMs: loadConfig.fallbackProxyTimeoutMs,
          }),
          budget
        ).catch(() => null)
      }

      let result: VerificationResult | null = null
      let usedFallback = false

      try {
        const payload: { claimText?: string; sourceUrl?: string } = {}
        if (normalizedClaim) payload.claimText = normalizedClaim
        if (normalizedUrl) payload.sourceUrl = normalizedUrl

        emitVerificationActivity(
          activityRunId,
          'Verification Backend API',
          'info',
          'Consultando motor principal de verificación.'
        )

        const backendBudget = Math.max(
          loadConfig.backendBudgetMinMs,
          Math.min(loadConfig.backendBudgetMaxMs, getRemainingBudget(loadConfig.backendReserveMs))
        )
        const backendController = new AbortController()
        const backendTimeoutId = setTimeout(() => backendController.abort(), backendBudget)
        const parentSignal = requestOptions.signal
        const forwardAbort = () => backendController.abort()
        if (parentSignal) {
          if (parentSignal.aborted) {
            backendController.abort()
          } else {
            parentSignal.addEventListener('abort', forwardAbort, { once: true })
          }
        }

        const backendStartedAt = Date.now()
        let backendResult: VerificationResult
        try {
          backendResult = await api.post<VerificationResult>('/verify/claim', payload, {
            ...requestOptions,
            signal: backendController.signal,
          })
        } finally {
          clearTimeout(backendTimeoutId)
          if (parentSignal) {
            parentSignal.removeEventListener('abort', forwardAbort)
          }
        }

        if (parentSignal?.aborted) {
          const aborted = new Error('Verification request aborted')
          aborted.name = 'AbortError'
          throw aborted
        }

        result = normalizeVerificationResult(
          backendResult,
          normalizedClaim || normalizedUrl || fallbackClaim
        )
        emitVerificationActivity(
          activityRunId,
          'Verification Backend API',
          'success',
          'Respuesta del backend recibida.',
          Date.now() - backendStartedAt,
          countEvidence(result)
        )

        if (
          result &&
          loadConfig.waitForFinalResult &&
          shouldPollForFinalVerification(result) &&
          canRunWithBudget(loadConfig.minBudgetMs)
        ) {
          const requestSignal = requestOptions.signal ?? undefined
          const pollBudget = Math.min(
            loadConfig.resultPollMaxMs,
            Math.max(loadConfig.minBudgetMs, getRemainingBudget(220))
          )
          if (pollBudget > 0) {
            emitVerificationActivity(
              activityRunId,
              'Verification Backend API',
              'info',
              'Esperando analisis final de IA y consolidacion de evidencia.'
            )
            const polled = await withTimeout(
              resolveBackendVerificationResult(result.id, normalizedClaim || normalizedUrl || fallbackClaim, {
                requestSignal,
                pollIntervalMs: loadConfig.resultPollIntervalMs,
                maxWaitMs: pollBudget,
              }),
              pollBudget
            ).catch(() => null)
            if (polled) {
              result = mergeVerificationResults(result, polled)
              emitVerificationActivity(
                activityRunId,
                'Verification Backend API',
                result.status === 'pending' ? 'warning' : 'success',
                result.status === 'pending'
                  ? 'Analisis parcial recibido. Se mostrara el mejor resultado disponible.'
                  : 'Analisis final de IA recibido.'
              )
            }
          }
        }

        if (
          loadConfig.allowWeakResultFallback &&
          !isUrlOnlyMode &&
          shouldRecoverWithFallback(result) &&
          canUseLocalFallback()
        ) {
          emitVerificationActivity(
            activityRunId,
            'Fallback de evidencia',
            'warning',
            'Resultado preliminar débil. Buscando respaldo externo.'
          )
          const fallbackResult = await resolveFallbackWithinBudget()
          if (fallbackResult) {
            result = mergeVerificationResults(result, fallbackResult)
            usedFallback = true
            emitVerificationActivity(
              activityRunId,
              'Fallback de evidencia',
              'success',
              'Evidencia externa fusionada con el resultado principal.',
              undefined,
              countEvidence(result)
            )
          }
        }
      } catch (error) {
        if (isAbortError(error) && requestOptions.signal?.aborted) {
          throw error
        }

        emitVerificationActivity(
          activityRunId,
          'Verification Backend API',
          'warning',
          'Fallo del backend. Activando contingencia externa.'
        )
        if (!canUseFallback(error) || !canUseLocalFallback()) {
          throw error
        }

        let fallbackResult = await resolveFallbackWithinBudget()
        if (!fallbackResult) {
          fallbackResult = await resolveFallbackWithinBudget(true)
        }
        if (!fallbackResult) {
          const backendReachable = await isBackendReachable()
          fallbackResult = buildEmergencyFallbackVerification(
            normalizedClaim || fallbackClaim,
            normalizedUrl,
            backendReachable
          )
          emitVerificationActivity(
            activityRunId,
            'Fallback de emergencia',
            'warning',
            isUrlOnlyMode
              ? 'No se pudo analizar la URL con fuentes externas en vivo. Se genera un resultado preliminar local.'
              : 'Sin conectividad estable para recuperar evidencia en vivo. Se genera un resultado preliminar local.'
          )
        }
        result = fallbackResult
        usedFallback = true
        emitVerificationActivity(
          activityRunId,
          'Fallback de evidencia',
          'success',
          'Contingencia externa completada.',
          undefined,
          countEvidence(fallbackResult)
        )
      }

      if (!result) {
        const backendReachable = await isBackendReachable()
        result = buildEmergencyFallbackVerification(
          normalizedClaim || fallbackClaim,
          normalizedUrl,
          backendReachable
        )
        usedFallback = true
        emitVerificationActivity(
          activityRunId,
          'Fallback de emergencia',
          'warning',
          'Resultado preliminar generado para evitar interrupcion del flujo de verificacion.'
        )
      }

      let enhancedResult = result
      if (loadConfig.allowAssistantEnhancement && canRunWithBudget(loadConfig.assistantMinBudgetMs)) {
        emitVerificationActivity(
          activityRunId,
          'Asistente IA',
          'info',
          'Generando explicación y recomendaciones de apoyo.'
        )
        const baselineExplanation = result.explanation
        const baselineRecommendations = result.recommendations.length
          enhancedResult = await withTimeout(
            maybeEnhanceWithAssistant(
              result,
              normalizedClaim || result.claim || fallbackClaim,
              normalizedUrl,
              usedFallback,
              loadConfig.assistantMaxResults
          ),
          Math.max(1200, getRemainingBudget(120))
        ).catch(() => result)

        const enhancedInsights =
          enhancedResult.explanation !== baselineExplanation ||
          enhancedResult.recommendations.length > baselineRecommendations
        emitVerificationActivity(
          activityRunId,
          'Asistente IA',
          enhancedInsights ? 'success' : 'warning',
          enhancedInsights
            ? 'Explicación enriquecida con recomendaciones adicionales.'
            : 'Sin cambios relevantes tras la revisión asistida.'
        )
      } else {
        emitVerificationActivity(
          activityRunId,
          'Asistente IA',
          'warning',
          loadConfig.allowAssistantEnhancement
            ? 'Presupuesto de tiempo agotado. Se omite enriquecimiento asistido.'
            : 'Perfil ligero activo. Se omite enriquecimiento asistido para reducir carga.'
        )
      }

      const normalizedFinal = normalizeVerificationResult(
        enhancedResult,
        normalizedClaim || normalizedUrl || fallbackClaim
      )
      addVerificationHistoryLocal(normalizedFinal)

      emitVerificationActivity(
        activityRunId,
        'Verificación clínica',
        'success',
        'Verificación completada.',
        Date.now() - startedAt,
        countEvidence(normalizedFinal)
      )

      return normalizedFinal
    } catch (error) {
      if (isAbortError(error)) {
        emitVerificationActivity(
          activityRunId,
          'Verificación clínica',
          'warning',
          'Verificación cancelada por timeout o por una nueva solicitud.'
        )
        throw error
      }
      const message = error instanceof Error ? error.message : 'Error inesperado en verificación.'
      emitVerificationActivity(activityRunId, 'Verificación clínica', 'error', message)
      throw error
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
      .catch(async (error) => {
        if (!canUseLocalFallback()) throw error
        if (!canUseFallback(error)) throw error
        await isBackendReachable()
        const { pageItems, total } = paginateItems(readVerificationHistoryLocal(), page, limit)
        return {
          verifications: pageItems,
          total,
        }
      }),
}
