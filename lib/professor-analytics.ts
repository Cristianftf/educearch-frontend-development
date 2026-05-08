import type {
  Activity,
  CompetencyProgress,
  CompetencyType,
  ProfessorAnalyticsOverview,
  StudentProgress,
} from '@/types'
import { api } from './api-client'
import { createLocalId } from './student-resilience'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeStudentSummary(raw: unknown, index: number): NonNullable<ProfessorAnalyticsOverview['lowProgressStudents']>[number] {
  const item = asRecord(raw)
  return {
    id: asString(item.id, createLocalId(`student-summary-${index}`)),
    name: asString(item.name, `Estudiante ${index + 1}`),
    email: asString(item.email),
    avatar: typeof item.avatar === 'string' ? item.avatar : undefined,
    averageScore: Math.max(0, asNumber(item.averageScore, 0)),
  }
}

function normalizeSearchTerm(raw: unknown): { term: string; count: number } | null {
  const item = asRecord(raw)
  const term = asString(item.term)
  if (!term) return null
  return {
    term,
    count: Math.max(0, Math.trunc(asNumber(item.count, 0))),
  }
}

function normalizeStudentCompetency(raw: unknown, index: number): NonNullable<ProfessorAnalyticsOverview['studentCompetencies']>[number] {
  const item = asRecord(raw)
  const scores = asRecord(item.scores)
  return {
    studentId: asString(item.studentId, createLocalId(`student-competency-${index}`)),
    studentName: asString(item.studentName, `Estudiante ${index + 1}`),
    studentEmail: asString(item.studentEmail),
    avatar: typeof item.avatar === 'string' ? item.avatar : undefined,
    scores: {
      access: Math.max(0, asNumber(scores.access, 0)),
      process: Math.max(0, asNumber(scores.process, 0)),
      communicate: Math.max(0, asNumber(scores.communicate, 0)),
    },
    averageScore: Math.max(0, asNumber(item.averageScore, 0)),
  }
}

function normalizeOverview(raw: ProfessorAnalyticsOverview | null | undefined): ProfessorAnalyticsOverview {
  return {
    studentCount: typeof raw?.studentCount === 'number' ? Math.max(0, raw.studentCount) : 0,
    averageProgress: {
      access: typeof raw?.averageProgress?.access === 'number' ? raw.averageProgress.access : 0,
      process: typeof raw?.averageProgress?.process === 'number' ? raw.averageProgress.process : 0,
      communicate:
        typeof raw?.averageProgress?.communicate === 'number' ? raw.averageProgress.communicate : 0,
    },
    lowProgressStudents: Array.isArray(raw?.lowProgressStudents)
      ? raw.lowProgressStudents.map(normalizeStudentSummary)
      : [],
    commonSearchTerms: Array.isArray(raw?.commonSearchTerms)
      ? raw.commonSearchTerms.map(normalizeSearchTerm).filter((item): item is { term: string; count: number } => item !== null)
      : [],
    problematicTerms: Array.isArray(raw?.problematicTerms)
      ? raw.problematicTerms
          .map((item) => {
            const value = asRecord(item)
            const term = asString(value.term)
            if (!term) return null
            return {
              term,
              errorRate: Math.max(0, asNumber(value.errorRate, 0)),
            }
          })
          .filter((item): item is { term: string; errorRate: number } => item !== null)
      : [],
    studentCompetencies: Array.isArray(raw?.studentCompetencies)
      ? raw.studentCompetencies.map(normalizeStudentCompetency)
      : [],
  }
}

function normalizeCompetencyType(value: unknown): CompetencyType {
  if (value === 'access' || value === 'process' || value === 'communicate') return value
  return 'access'
}

function normalizeScore(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.max(0, value)
}

function normalizeStudentProgress(raw: unknown): StudentProgress {
  const now = new Date().toISOString()
  const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const rawCompetencies =
    item.competencies && typeof item.competencies === 'object'
      ? (item.competencies as Record<string, unknown>)
      : {}

  const readCompetency = (key: CompetencyType): CompetencyProgress => {
    const source =
      rawCompetencies[key] && typeof rawCompetencies[key] === 'object'
        ? (rawCompetencies[key] as Record<string, unknown>)
        : {}
    const score = normalizeScore(source.score)
    const normalizedType = normalizeCompetencyType(source.type)
    const level: CompetencyProgress['level'] =
      source.level === 'advanced' || source.level === 'intermediate' || source.level === 'novice'
        ? source.level
        : score >= 80
          ? 'advanced'
          : score >= 60
            ? 'intermediate'
            : 'novice'

    return {
      type: normalizedType,
      score,
      level,
      lastUpdated: typeof source.lastUpdated === 'string' && source.lastUpdated ? source.lastUpdated : now,
    }
  }

  const recentActivities: Activity[] = Array.isArray(item.recentActivities)
    ? item.recentActivities
        .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
        .map((entry, index) => {
          const activityType: Activity['type'] =
            entry.type === 'search' ||
            entry.type === 'verification' ||
            entry.type === 'export' ||
            entry.type === 'case_submission' ||
            entry.type === 'login'
              ? entry.type
              : 'search'

          return {
            id: typeof entry.id === 'string' && entry.id ? entry.id : createLocalId(`activity-${index}`),
            type: activityType,
            description:
              typeof entry.description === 'string' && entry.description
                ? entry.description
                : 'Actividad registrada',
            timestamp:
              typeof entry.timestamp === 'string' && entry.timestamp ? entry.timestamp : new Date().toISOString(),
            metadata:
              entry.metadata && typeof entry.metadata === 'object'
                ? (entry.metadata as Record<string, unknown>)
                : undefined,
          }
        })
    : []

  return {
    userId:
      (typeof item.userId === 'string' && item.userId) ||
      (typeof item.studentId === 'string' && item.studentId) ||
      '',
    competencies: {
      access: readCompetency('access'),
      process: readCompetency('process'),
      communicate: readCompetency('communicate'),
    },
    totalSearches: typeof item.totalSearches === 'number' ? Math.max(0, item.totalSearches) : 0,
    totalVerifications: typeof item.totalVerifications === 'number' ? Math.max(0, item.totalVerifications) : 0,
    totalBibliographies:
      typeof item.totalBibliographies === 'number' ? Math.max(0, item.totalBibliographies) : 0,
    casesCompleted: typeof item.casesCompleted === 'number' ? Math.max(0, item.casesCompleted) : 0,
    totalCases: typeof item.totalCases === 'number' ? Math.max(0, item.totalCases) : 0,
    averageGrade: typeof item.averageGrade === 'number' ? Math.max(0, item.averageGrade) : 0,
    hoursSpent: typeof item.hoursSpent === 'number' ? Math.max(0, item.hoursSpent) : 0,
    activityStats:
      item.activityStats && typeof item.activityStats === 'object'
        ? (item.activityStats as Record<string, number>)
        : undefined,
    recommendations: Array.isArray(item.recommendations)
      ? item.recommendations.filter((entry): entry is string => typeof entry === 'string')
      : undefined,
    recentActivities,
  }
}

function buildFallbackStudentProgress(studentId: string): StudentProgress {
  return {
    userId: studentId,
    competencies: {
      access: {
        type: 'access',
        score: 0,
        level: 'novice',
        lastUpdated: new Date().toISOString(),
      },
      process: {
        type: 'process',
        score: 0,
        level: 'novice',
        lastUpdated: new Date().toISOString(),
      },
      communicate: {
        type: 'communicate',
        score: 0,
        level: 'novice',
        lastUpdated: new Date().toISOString(),
      },
    },
    totalSearches: 0,
    totalVerifications: 0,
    totalBibliographies: 0,
    recentActivities: [],
  }
}

function normalizeClassPerformance(value: unknown) {
  const item = asRecord(value)
  const competencyDistribution = asRecord(item.competencyDistribution)
  const topStudentsRaw = Array.isArray(item.topStudents) ? item.topStudents : []

  return {
    averageScore: Math.max(0, asNumber(item.averageScore, 0)),
    completionRate: Math.max(0, asNumber(item.completionRate, 0)),
    studentCount: Math.max(0, Math.trunc(asNumber(item.studentCount, 0))),
    completedCount: Math.max(0, Math.trunc(asNumber(item.completedCount, 0))),
    competencyDistribution: {
      access: Math.max(0, asNumber(competencyDistribution.access, 0)),
      process: Math.max(0, asNumber(competencyDistribution.process, 0)),
      communicate: Math.max(0, asNumber(competencyDistribution.communicate, 0)),
    },
    topStudents: topStudentsRaw
      .map((entry, index) => {
        const student = asRecord(entry)
        return {
          id: asString(student.id, createLocalId(`top-student-${index}`)),
          name: asString(student.name, `Estudiante ${index + 1}`),
          score: Math.max(0, asNumber(student.score, 0)),
        }
      })
      .filter((entry) => entry.id.length > 0),
  }
}

export const professorAnalyticsApi = {
  getClassOverview: async () => {
    const overview = await api.get<ProfessorAnalyticsOverview>('/professor/analytics/overview')
    return normalizeOverview(overview)
  },

  getStudentDetails: async (studentId: string) => {
    const data = await api.get<StudentProgress>(`/professor/analytics/student/${studentId}`)
    const normalized = normalizeStudentProgress(data)
    return normalized.userId ? normalized : buildFallbackStudentProgress(studentId)
  },

  getStudentsProgress: async () => {
    const students = await api.get<unknown[]>('/professor/students')
    return Array.isArray(students) ? students.map(normalizeStudentProgress) : []
  },

  getClassPerformance: async () => {
    const performance = await api.get<unknown>('/professor/analytics/class-performance')
    return normalizeClassPerformance(performance)
  },
}
