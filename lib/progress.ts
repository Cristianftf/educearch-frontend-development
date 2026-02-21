import type {
  Activity,
  Bibliography,
  CaseSubmission,
  SearchQuery,
  StudentProgress,
  VerificationResult,
} from '@/types'
import { api } from './api-client'
import {
  STUDENT_FALLBACK_KEYS,
  getScopedStorageKey,
  isBackendReachable,
  readLocalStorage,
} from './student-resilience'

function calculateLevel(score: number): 'novice' | 'intermediate' | 'advanced' {
  if (score >= 75) return 'advanced'
  if (score >= 50) return 'intermediate'
  return 'novice'
}

function toIso(value?: string): string {
  if (!value) return new Date().toISOString()
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

function buildLocalActivities(
  searches: SearchQuery[],
  verifications: VerificationResult[],
  bibliographies: Bibliography[],
  submissions: CaseSubmission[]
): Activity[] {
  const activities: Activity[] = [
    ...searches.map((search) => ({
      id: `search-${search.id}`,
      type: 'search' as const,
      description: `Busqueda ejecutada: ${search.rawQuery || 'Consulta sin titulo'}`,
      timestamp: toIso(search.createdAt),
      metadata: { resultCount: search.resultCount ?? 0 },
    })),
    ...verifications.map((verification) => ({
      id: `verification-${verification.id}`,
      type: 'verification' as const,
      description: `Verificacion realizada: ${verification.claim}`,
      timestamp: toIso(verification.verifiedAt),
      metadata: { status: verification.status, score: verification.score },
    })),
    ...bibliographies.map((bibliography) => ({
      id: `bibliography-${bibliography.id}`,
      type: 'export' as const,
      description: `Bibliografia generada: ${bibliography.name}`,
      timestamp: toIso(bibliography.createdAt),
      metadata: { format: bibliography.format, articleCount: bibliography.articleCount ?? 0 },
    })),
    ...submissions.map((submission) => ({
      id: `submission-${submission.id}`,
      type: 'case_submission' as const,
      description: `Entrega de caso: ${submission.caseId}`,
      timestamp: toIso(submission.submittedAt),
      metadata: { status: submission.status },
    })),
  ]

  return activities
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 10)
}

function buildFallbackProgress(userId = 'local-student'): StudentProgress {
  const searches = readLocalStorage<SearchQuery[]>(STUDENT_FALLBACK_KEYS.searchHistory, [])
  const verifications = readLocalStorage<VerificationResult[]>(
    STUDENT_FALLBACK_KEYS.verificationHistory,
    []
  )
  const bibliographies = readLocalStorage<Bibliography[]>(
    STUDENT_FALLBACK_KEYS.bibliographyHistory,
    []
  )
  const submissions = readLocalStorage<CaseSubmission[]>(
    getScopedStorageKey(STUDENT_FALLBACK_KEYS.caseSubmissions),
    []
  )

  const accessScore = Math.min(100, 20 + searches.length * 5)
  const processScore = Math.min(100, 20 + verifications.length * 8)
  const communicateScore = Math.min(100, 20 + bibliographies.length * 10)
  const now = new Date().toISOString()

  return {
    userId,
    competencies: {
      access: {
        type: 'access',
        score: accessScore,
        level: calculateLevel(accessScore),
        lastUpdated: now,
      },
      process: {
        type: 'process',
        score: processScore,
        level: calculateLevel(processScore),
        lastUpdated: now,
      },
      communicate: {
        type: 'communicate',
        score: communicateScore,
        level: calculateLevel(communicateScore),
        lastUpdated: now,
      },
    },
    totalSearches: searches.length,
    totalVerifications: verifications.length,
    totalBibliographies: bibliographies.length,
    recentActivities: buildLocalActivities(searches, verifications, bibliographies, submissions),
  }
}

export const progressApi = {
  getMyProgress: () =>
    api.get<StudentProgress>('/progress/me').catch(async () => {
      await isBackendReachable()
      return buildFallbackProgress()
    }),

  getStudentProgress: (studentId: string) =>
    api.get<StudentProgress>(`/progress/${studentId}`).catch(async () => {
      await isBackendReachable()
      return buildFallbackProgress(studentId)
    }),
}
