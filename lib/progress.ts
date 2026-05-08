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

function normalizeIsoTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString()
}

function normalizeCompetencyType(value: unknown): 'access' | 'process' | 'communicate' {
  if (value === 'access' || value === 'process' || value === 'communicate') return value
  return 'access'
}

function normalizeCompetencyProgress(
  value: unknown,
  fallbackType: 'access' | 'process' | 'communicate'
): StudentProgress['competencies'][keyof StudentProgress['competencies']] {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const rawScore =
    typeof item.score === 'number' && Number.isFinite(item.score) ? item.score : 0
  const score = Math.max(0, Math.min(100, rawScore))
  return {
    type: normalizeCompetencyType(item.type) || fallbackType,
    score,
    level:
      item.level === 'novice' || item.level === 'intermediate' || item.level === 'advanced'
        ? item.level
        : calculateLevel(score),
    lastUpdated: normalizeIsoTimestamp(item.lastUpdated, new Date().toISOString()),
  }
}

function normalizeActivity(value: unknown, index: number): Activity {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const fallbackTimestamp = new Date().toISOString()
  const type: Activity['type'] =
    item.type === 'search' ||
    item.type === 'verification' ||
    item.type === 'export' ||
    item.type === 'case_submission' ||
    item.type === 'login'
      ? item.type
      : 'login'
  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : `activity-${index + 1}`,
    type,
    description:
      typeof item.description === 'string' && item.description.trim()
        ? item.description.trim()
        : 'Actividad reciente',
    timestamp: normalizeIsoTimestamp(item.timestamp, fallbackTimestamp),
    metadata:
      item.metadata && typeof item.metadata === 'object'
        ? (item.metadata as Record<string, unknown>)
        : undefined,
  }
}

function normalizeStudentProgress(value: unknown, fallbackUserId = 'local-student'): StudentProgress {
  const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const fallbackTimestamp = new Date().toISOString()
  const competencies =
    item.competencies && typeof item.competencies === 'object'
      ? (item.competencies as Record<string, unknown>)
      : {}

  const recentActivities = Array.isArray(item.recentActivities)
    ? item.recentActivities.map((activity, index) => normalizeActivity(activity, index))
    : []

  const recommendations = Array.isArray(item.recommendations)
    ? item.recommendations.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : undefined

  const activityStats =
    item.activityStats && typeof item.activityStats === 'object'
      ? (Object.fromEntries(
          Object.entries(item.activityStats as Record<string, unknown>).filter(
            ([, value]) => typeof value === 'number' && Number.isFinite(value)
          )
        ) as Record<string, number>)
      : undefined

  return {
    userId:
      typeof item.userId === 'string' && item.userId.trim()
        ? item.userId
        : typeof item.studentId === 'string' && item.studentId.trim()
          ? item.studentId
          : fallbackUserId,
    competencies: {
      access: normalizeCompetencyProgress(competencies.access, 'access'),
      process: normalizeCompetencyProgress(competencies.process, 'process'),
      communicate: normalizeCompetencyProgress(competencies.communicate, 'communicate'),
    },
    casesCompleted:
      typeof item.casesCompleted === 'number' && Number.isFinite(item.casesCompleted)
        ? Math.max(0, item.casesCompleted)
        : undefined,
    totalCases:
      typeof item.totalCases === 'number' && Number.isFinite(item.totalCases)
        ? Math.max(0, item.totalCases)
        : undefined,
    averageGrade:
      typeof item.averageGrade === 'number' && Number.isFinite(item.averageGrade)
        ? Math.max(0, Math.min(100, item.averageGrade))
        : undefined,
    hoursSpent:
      typeof item.hoursSpent === 'number' && Number.isFinite(item.hoursSpent)
        ? Math.max(0, item.hoursSpent)
        : undefined,
    activityStats,
    recommendations,
    totalSearches:
      typeof item.totalSearches === 'number' && Number.isFinite(item.totalSearches)
        ? Math.max(0, item.totalSearches)
        : 0,
    totalVerifications:
      typeof item.totalVerifications === 'number' && Number.isFinite(item.totalVerifications)
        ? Math.max(0, item.totalVerifications)
        : 0,
    totalBibliographies:
      typeof item.totalBibliographies === 'number' && Number.isFinite(item.totalBibliographies)
        ? Math.max(0, item.totalBibliographies)
        : 0,
    recentActivities:
      recentActivities.length > 0 ? recentActivities : [],
  }
}

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
    api
      .get<StudentProgress>('/progress/me')
      .then((response) => normalizeStudentProgress(response))
      .catch(async () => {
        await isBackendReachable()
        return buildFallbackProgress()
      }),

  getStudentProgress: (studentId: string) =>
    api
      .get<StudentProgress>(`/progress/${studentId}`)
      .then((response) => normalizeStudentProgress(response, studentId))
      .catch(async () => {
        await isBackendReachable()
        return buildFallbackProgress(studentId)
      }),
}
