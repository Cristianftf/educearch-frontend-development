import type {
  CaseStudy,
  CaseSubmission,
  CaseAssignableStudent,
  GuidingQuestion,
  RubricItem,
} from '@/types'
import { ApiHttpError, api } from './api-client'
import { isConnectivityError } from './api-errors'
import {
  STUDENT_FALLBACK_KEYS,
  createLocalId,
  getScopedStorageKey,
  isBackendReachable,
  readLocalStorage,
  writeLocalStorage,
} from './student-resilience'

type BackendRubricItem = {
  competency?: string
  criterion?: string
  maxScore?: number
  description?: string
}

type BackendCaseStudy = Omit<CaseStudy, 'guidingQuestions' | 'rubric' | 'startDate'> & {
  guidingQuestions?: string[]
  rubric?: BackendRubricItem[]
  startDate?: string
}

type BackendAssignableStudent = {
  id?: string
  email?: string
  username?: string
  fullName?: string
  active?: boolean
}

type BackendEvaluation = {
  id?: string
  submissionId?: string
  professorId?: string
  scores?: Record<string, unknown>
  comments?: Record<string, unknown>
  overallScore?: number
  feedback?: string
  evaluatedAt?: string
}

type BackendCaseSubmission = Omit<CaseSubmission, 'evaluation' | 'selectedArticles'> & {
  selectedArticles?: unknown
  evaluation?: BackendEvaluation | null
}

function normalizeCompetency(value: unknown): RubricItem['competency'] {
  if (value === 'access' || value === 'process' || value === 'communicate') return value
  return 'access'
}

function normalizeCaseStatus(value: unknown): CaseStudy['status'] {
  if (value === 'draft' || value === 'active' || value === 'archived') return value
  return 'draft'
}

function normalizeCaseDifficulty(value: unknown): CaseStudy['difficulty'] {
  if (value === 'novice' || value === 'intermediate' || value === 'advanced') return value
  return 'novice'
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim())
}

function normalizeDateTimeValue(value: unknown, fallback?: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback ?? new Date().toISOString()
  }
  const normalized = normalizeDateTime(value)
  return normalized ?? fallback ?? new Date().toISOString()
}

function normalizeCaseSubmissionStatus(value: unknown): CaseSubmission['status'] {
  if (value === 'pending' || value === 'reviewed' || value === 'returned') return value
  return 'pending'
}

function normalizeEvaluation(value: unknown, fallbackSubmissionId: string): CaseSubmission['evaluation'] {
  if (!value || typeof value !== 'object') return undefined
  const item = value as Record<string, unknown>
  const scoresRaw = item.scores && typeof item.scores === 'object' ? (item.scores as Record<string, unknown>) : {}
  const commentsRaw =
    item.comments && typeof item.comments === 'object' ? (item.comments as Record<string, unknown>) : {}

  const getScore = (key: 'access' | 'process' | 'communicate') => {
    const value = scoresRaw[key]
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
  }

  const getComment = (key: 'access' | 'process' | 'communicate') => {
    const value = commentsRaw[key]
    return typeof value === 'string' ? value.trim() : ''
  }

  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id : createLocalId('evaluation'),
    submissionId:
      typeof item.submissionId === 'string' && item.submissionId.trim()
        ? item.submissionId
        : fallbackSubmissionId,
    professorId:
      typeof item.professorId === 'string' && item.professorId.trim()
        ? item.professorId
        : 'unknown-professor',
    scores: {
      access: getScore('access'),
      process: getScore('process'),
      communicate: getScore('communicate'),
    },
    comments: {
      access: getComment('access'),
      process: getComment('process'),
      communicate: getComment('communicate'),
    },
    overallScore:
      typeof item.overallScore === 'number' && Number.isFinite(item.overallScore)
        ? Math.max(0, Math.min(100, item.overallScore))
        : 0,
    feedback: typeof item.feedback === 'string' ? item.feedback.trim() : '',
    evaluatedAt: normalizeDateTimeValue(item.evaluatedAt),
  }
}

function normalizeCaseSubmission(
  submission: BackendCaseSubmission,
  fallbackCaseId?: string
): CaseSubmission {
  const id =
    typeof submission.id === 'string' && submission.id.trim()
      ? submission.id
      : createLocalId('submission')
  return {
    id,
    caseId:
      typeof submission.caseId === 'string' && submission.caseId.trim()
        ? submission.caseId
        : fallbackCaseId ?? 'unknown-case',
    studentId:
      typeof submission.studentId === 'string' && submission.studentId.trim()
        ? submission.studentId
        : 'local-student',
    submittedAt: normalizeDateTimeValue(submission.submittedAt),
    content: typeof submission.content === 'string' ? submission.content : '',
    selectedArticles: normalizeStringArray(submission.selectedArticles),
    bibliography: typeof submission.bibliography === 'string' ? submission.bibliography : '',
    status: normalizeCaseSubmissionStatus(submission.status),
    evaluation: normalizeEvaluation(submission.evaluation, id),
  }
}

function parseGuidingQuestion(rawValue: unknown, index: number): GuidingQuestion {
  if (rawValue && typeof rawValue === 'object') {
    const parsed = rawValue as Record<string, unknown>
    return {
      id: String(parsed.id ?? `q-${index}`),
      question: typeof parsed.question === 'string' ? parsed.question : '',
      competency: normalizeCompetency(parsed.competency),
      points:
        typeof parsed.points === 'number' && Number.isFinite(parsed.points)
          ? Math.max(0, parsed.points)
          : 10,
    }
  }

  const raw = typeof rawValue === 'string' ? rawValue : ''
  const trimmed = raw.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed.question === 'string') {
        return {
          id: String(parsed.id ?? `q-${index}`),
          question: parsed.question,
          competency: normalizeCompetency(parsed.competency),
          points:
            typeof parsed.points === 'number' && Number.isFinite(parsed.points)
              ? Math.max(0, parsed.points)
              : 10,
        }
      }
    } catch {
      // fall through to plain string mapping
    }
  }

  return {
    id: `q-${index}`,
    question: raw,
    competency: 'access',
    points: 10,
  }
}

function parseRubricLevels(description?: string): RubricItem['levels'] {
  if (description) {
    const trimmed = description.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed?.levels) {
          return {
            excellent: parsed.levels.excellent ?? '',
            good: parsed.levels.good ?? '',
            needs_improvement: parsed.levels.needs_improvement ?? '',
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  return {
    excellent: '',
    good: '',
    needs_improvement: '',
  }
}

function normalizeCaseStudy(caseStudy: BackendCaseStudy): CaseStudy {
  const guidingQuestions = (Array.isArray(caseStudy.guidingQuestions) ? caseStudy.guidingQuestions : [])
    .map(parseGuidingQuestion)
    .map((question, index) => ({
      ...question,
      id: question.id || `q-${index}`,
      question: question.question ?? '',
    }))
  const rubric = (caseStudy.rubric ?? [])
    .filter(Boolean)
    .map((item, index) => ({
      id: `r-${index}`,
      criteria: item.criterion ?? '',
      competency: normalizeCompetency(item.competency),
      maxPoints: item.maxScore ?? 0,
      levels: parseRubricLevels(item.description),
    }))

  return {
    id: caseStudy.id || createLocalId('case'),
    title: typeof caseStudy.title === 'string' ? caseStudy.title : 'Caso sin titulo',
    scenario: typeof caseStudy.scenario === 'string' ? caseStudy.scenario : '',
    difficulty: normalizeCaseDifficulty(caseStudy.difficulty),
    status: normalizeCaseStatus(caseStudy.status),
    createdBy: typeof caseStudy.createdBy === 'string' ? caseStudy.createdBy : 'unknown',
    createdAt:
      typeof caseStudy.createdAt === 'string' && caseStudy.createdAt
        ? caseStudy.createdAt
        : new Date().toISOString(),
    dueDate: normalizeDateTime(caseStudy.dueDate),
    startDate: normalizeDateTime(caseStudy.startDate),
    requiredArticles: normalizeStringArray(caseStudy.requiredArticles),
    optionalArticles: normalizeStringArray(caseStudy.optionalArticles),
    assignedStudents: normalizeStringArray(caseStudy.assignedStudents),
    guidingQuestions,
    rubric,
  }
}

function normalizeAssignableStudent(raw: BackendAssignableStudent, index: number): CaseAssignableStudent {
  const id = typeof raw.id === 'string' && raw.id ? raw.id : createLocalId(`student-${index}`)
  const email = typeof raw.email === 'string' ? raw.email : ''
  const username = typeof raw.username === 'string' ? raw.username : ''
  const fallbackName = email || username || `Estudiante ${index + 1}`
  return {
    id,
    email,
    username,
    fullName:
      typeof raw.fullName === 'string' && raw.fullName.trim()
        ? raw.fullName.trim()
        : fallbackName,
    active: raw.active !== false,
  }
}

function serializeGuidingQuestion(question: GuidingQuestion): string {
  return JSON.stringify({
    id: question.id,
    question: question.question,
    competency: question.competency,
    points: question.points,
  })
}

function serializeRubricItem(item: RubricItem): BackendRubricItem {
  const hasLevels =
    item.levels.excellent ||
    item.levels.good ||
    item.levels.needs_improvement

  return {
    competency: item.competency,
    criterion: item.criteria,
    maxScore: item.maxPoints,
    description: hasLevels ? JSON.stringify({ levels: item.levels }) : '',
  }
}

function serializeCaseStudy(caseStudy: Partial<CaseStudy>): BackendCaseStudy {
  const hasGuidingQuestions = typeof caseStudy.guidingQuestions !== 'undefined'
  const hasRubric = typeof caseStudy.rubric !== 'undefined'
  const guidingQuestions = hasGuidingQuestions
    ? (caseStudy.guidingQuestions ?? []).map((q) =>
        typeof q === 'string' ? q : serializeGuidingQuestion(q)
      )
    : undefined
  const rubric = hasRubric
    ? (caseStudy.rubric ?? []).map((item) =>
        'criteria' in item ? serializeRubricItem(item as RubricItem) : (item as BackendRubricItem)
      )
    : undefined

  const { startDate, ...rest } = caseStudy
  const normalizedStartDate = normalizeDateTime(startDate)
  const dueDate = normalizeDateTime(caseStudy.dueDate)
  const assignedStudents = caseStudy.assignedStudents

  const payload: BackendCaseStudy = {
    ...rest,
  } as BackendCaseStudy

  if (guidingQuestions) {
    payload.guidingQuestions = guidingQuestions
  }
  if (rubric) {
    payload.rubric = rubric
  }
  if (normalizedStartDate) {
    payload.startDate = normalizedStartDate
  }
  if (dueDate) {
    payload.dueDate = dueDate
  }
  if (assignedStudents) {
    payload.assignedStudents = assignedStudents
  }

  return payload
}

function normalizeDateTime(value?: string): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00Z`
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00Z`
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}Z`
  }

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    // Backend expects UTC without milliseconds: yyyy-MM-ddTHH:mm:ssZ
    return parsed.toISOString().replace(/\.\d{3}Z$/, 'Z')
  }

  return trimmed
}

function buildLocalGuidingQuestions(): GuidingQuestion[] {
  return [
    {
      id: 'q-1',
      question: 'Identifica la pregunta clinica principal del caso.',
      competency: 'access',
      points: 10,
    },
    {
      id: 'q-2',
      question: 'Contrasta la evidencia disponible y argumenta tu decision.',
      competency: 'process',
      points: 10,
    },
  ]
}

function buildLocalRubric(): RubricItem[] {
  return [
    {
      id: 'r-1',
      criteria: 'Uso de evidencia de alta calidad',
      competency: 'access',
      maxPoints: 10,
      levels: {
        excellent: 'Selecciona y justifica evidencia robusta',
        good: 'Selecciona evidencia suficiente',
        needs_improvement: 'Evidencia limitada o no justificada',
      },
    },
    {
      id: 'r-2',
      criteria: 'Analisis critico del caso',
      competency: 'process',
      maxPoints: 10,
      levels: {
        excellent: 'Analiza con criterio y consistencia',
        good: 'Analisis correcto con algunos vacios',
        needs_improvement: 'Analisis superficial',
      },
    },
  ]
}

function buildDefaultLocalCases(): CaseStudy[] {
  const now = new Date()
  const dueDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString()
  const archivedDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  return [
    {
      id: 'local-case-active-1',
      title: 'Hipertension resistente en adulto mayor',
      scenario:
        'Paciente de 68 anos con hipertension persistente pese a triple terapia. Debes priorizar evidencia para ajuste terapeutico.',
      difficulty: 'intermediate',
      status: 'active',
      requiredArticles: ['PMID:123456', 'PMID:234567'],
      optionalArticles: ['PMID:345678'],
      guidingQuestions: buildLocalGuidingQuestions(),
      rubric: buildLocalRubric(),
      createdBy: 'local-professor',
      createdAt: now.toISOString(),
      dueDate,
      assignedStudents: ['local-student'],
    },
    {
      id: 'local-case-archived-1',
      title: 'Uso de antibioticos en infeccion respiratoria leve',
      scenario:
        'Analiza si el uso empirico de antibioticos mejora desenlaces en infecciones respiratorias leves en adultos.',
      difficulty: 'novice',
      status: 'archived',
      requiredArticles: ['PMID:456789'],
      optionalArticles: [],
      guidingQuestions: buildLocalGuidingQuestions(),
      rubric: buildLocalRubric(),
      createdBy: 'local-professor',
      createdAt: archivedDate,
      dueDate: archivedDate,
      assignedStudents: ['local-student'],
    },
  ]
}

function getCaseStudiesStorageKey(): string {
  return getScopedStorageKey(STUDENT_FALLBACK_KEYS.caseStudies)
}

function getCaseSubmissionsStorageKey(): string {
  return getScopedStorageKey(STUDENT_FALLBACK_KEYS.caseSubmissions)
}

function readCasesLocal(): CaseStudy[] {
  return readLocalStorage<CaseStudy[]>(getCaseStudiesStorageKey(), [])
}

function writeCasesLocal(cases: CaseStudy[]): void {
  writeLocalStorage(getCaseStudiesStorageKey(), cases)
}

function readSubmissionsLocal(): CaseSubmission[] {
  return readLocalStorage<CaseSubmission[]>(getCaseSubmissionsStorageKey(), [])
}

function writeSubmissionsLocal(submissions: CaseSubmission[]): void {
  writeLocalStorage(getCaseSubmissionsStorageKey(), submissions)
}

function upsertCaseLocal(caseStudy: CaseStudy): void {
  const existing = readCasesLocal()
  const next = [caseStudy, ...existing.filter((item) => item.id !== caseStudy.id)]
  writeCasesLocal(next)
}

function upsertSubmissionLocal(submission: CaseSubmission): void {
  const existing = readSubmissionsLocal()
  const next = [submission, ...existing.filter((item) => item.id !== submission.id)]
  writeSubmissionsLocal(next)
}

function buildFallbackSubmission(
  caseId: string,
  submission: Omit<CaseSubmission, 'id' | 'submittedAt' | 'status'>
): CaseSubmission {
  return {
    id: createLocalId('submission'),
    caseId,
    studentId: submission.studentId || 'local-student',
    submittedAt: new Date().toISOString(),
    content: submission.content,
    selectedArticles: submission.selectedArticles ?? [],
    bibliography: submission.bibliography ?? '',
    status: 'pending',
    evaluation: undefined,
  }
}

function markCaseAsArchived(caseId: string): void {
  const cases = readCasesLocal().map((caseStudy) =>
    caseStudy.id === caseId ? { ...caseStudy, status: 'archived' as const } : caseStudy
  )
  writeCasesLocal(cases)
}

function canUseLocalFallback(): boolean {
  return api.getUserRole() === 'student'
}

export const casesApi = {
  // Professor endpoints
  getAll: (status?: string) =>
    api
      .get<BackendCaseStudy[]>(`/cases${status ? `?status=${status}` : ''}`)
      .then((items) => items.map(normalizeCaseStudy))
      .then((cases) => {
        cases.forEach(upsertCaseLocal)
        return cases
      })
      .catch(async (error) => {
        if (error instanceof Error && /500/.test(error.message)) {
          try {
            const fallback = await api.get<BackendCaseStudy[]>('/professor/cases')
            const normalized = fallback.map(normalizeCaseStudy)
            const filtered = status ? normalized.filter((item) => item.status === status) : normalized
            filtered.forEach(upsertCaseLocal)
            return filtered
          } catch {
            // Continue with existing error handling.
          }
        }
        throw error
      })
      .catch(async (error) => {
        if (!isConnectivityError(error)) throw error
        if (!canUseLocalFallback()) throw error
        await isBackendReachable()
        const local = readCasesLocal()
        return status ? local.filter((caseStudy) => caseStudy.status === status) : local
      }),

  getById: (id: string) =>
    api
      .get<BackendCaseStudy>(`/cases/${id}`)
      .then(normalizeCaseStudy)
      .then((caseStudy) => {
        upsertCaseLocal(caseStudy)
        return caseStudy
      })
      .catch(async (error) => {
        if (!isConnectivityError(error)) throw error
        if (!canUseLocalFallback()) throw error
        await isBackendReachable()
        const local = readCasesLocal().find((caseStudy) => caseStudy.id === id)
        if (local) return local
        throw new Error('Case not found')
      }),

  create: (caseData: Omit<CaseStudy, 'id' | 'createdAt' | 'createdBy'>) =>
    api
      .post<BackendCaseStudy>('/cases', serializeCaseStudy(caseData))
      .then(normalizeCaseStudy)
      .then((caseStudy) => {
        upsertCaseLocal(caseStudy)
        return caseStudy
      })
      .catch(async (error) => {
        if (!isConnectivityError(error)) throw error
        if (!canUseLocalFallback()) throw error
        await isBackendReachable()
        const fallbackCase: CaseStudy = {
          id: createLocalId('case'),
          title: caseData.title,
          scenario: caseData.scenario,
          difficulty: caseData.difficulty,
          status: caseData.status ?? 'draft',
          requiredArticles: caseData.requiredArticles ?? [],
          optionalArticles: caseData.optionalArticles ?? [],
          assignedStudents: caseData.assignedStudents ?? [],
          guidingQuestions: caseData.guidingQuestions ?? [],
          rubric: caseData.rubric ?? [],
          createdBy: 'local-professor',
          createdAt: new Date().toISOString(),
          dueDate: caseData.dueDate,
          startDate: caseData.startDate,
        }
        upsertCaseLocal(fallbackCase)
        return fallbackCase
      }),

  update: (id: string, caseData: Partial<CaseStudy>) =>
    api
      .put<BackendCaseStudy>(`/cases/${id}`, serializeCaseStudy(caseData))
      .then(normalizeCaseStudy)
      .then((caseStudy) => {
        upsertCaseLocal(caseStudy)
        return caseStudy
      })
      .catch(async (error) => {
        if (!isConnectivityError(error)) throw error
        if (!canUseLocalFallback()) throw error
        await isBackendReachable()
        const existing = readCasesLocal().find((item) => item.id === id)
        if (!existing) throw new Error('Case not found')
        const updated: CaseStudy = {
          ...existing,
          ...caseData,
          id,
        }
        upsertCaseLocal(updated)
        return updated
      }),

  delete: async (id: string) => {
    try {
      await api.delete<void>(`/cases/${id}`)
    } catch (error) {
      if (!isConnectivityError(error)) throw error
      if (!canUseLocalFallback()) throw error
      await isBackendReachable()
    }

    writeCasesLocal(readCasesLocal().filter((caseStudy) => caseStudy.id !== id))
    writeSubmissionsLocal(readSubmissionsLocal().filter((submission) => submission.caseId !== id))
  },

  assign: (id: string, studentIds: string[]) =>
    api
      .post<BackendCaseStudy>(`/cases/${id}/assign`, { studentIds })
      .then(normalizeCaseStudy)
      .then((caseStudy) => {
        upsertCaseLocal(caseStudy)
        return caseStudy
      })
      .catch(async (error) => {
        if (!isConnectivityError(error)) throw error
        if (!canUseLocalFallback()) throw error
        await isBackendReachable()
        const existing = readCasesLocal().find((item) => item.id === id)
        if (!existing) throw new Error('Case not found')
        const updated = {
          ...existing,
          assignedStudents: studentIds,
          status: 'active' as const,
        }
        upsertCaseLocal(updated)
        return updated
      }),

  getSubmissions: (caseId: string) =>
    api
      .get<BackendCaseSubmission[]>(`/cases/${caseId}/submissions`)
      .then((submissions) => submissions.map((submission) => normalizeCaseSubmission(submission, caseId)))
      .then((submissions) => {
        const existing = readSubmissionsLocal().filter((item) => item.caseId !== caseId)
        writeSubmissionsLocal([...submissions, ...existing])
        return submissions
      })
      .catch(async (error) => {
        if (!isConnectivityError(error)) throw error
        if (!canUseLocalFallback()) throw error
        await isBackendReachable()
        return readSubmissionsLocal().filter((submission) => submission.caseId === caseId)
      }),

  getAssignableStudents: () =>
    api
      .get<BackendAssignableStudent[]>('/cases/students')
      .then((students) => students.map(normalizeAssignableStudent))
      .catch(async (error) => {
        if (!isConnectivityError(error)) throw error
        await isBackendReachable()
        return []
      }),

  // Student endpoints
  getAssigned: () =>
    api
      .get<BackendCaseStudy[]>('/cases/assigned')
      .then((items) => items.map(normalizeCaseStudy))
      .then((cases) => {
        cases.forEach(upsertCaseLocal)
        return cases
      })
      .catch(async (error) => {
        if (!isConnectivityError(error)) throw error
        await isBackendReachable()
        return readCasesLocal().filter((caseStudy) => caseStudy.status !== 'draft')
      }),

  submit: (caseId: string, submission: Omit<CaseSubmission, 'id' | 'submittedAt' | 'status'>) =>
    api
      .post<BackendCaseSubmission>(`/cases/${caseId}/submit`, submission)
      .then((response) => {
        const normalized = normalizeCaseSubmission(response, caseId)
        upsertSubmissionLocal(normalized)
        return normalized
      })
      .catch(async (error) => {
        if (!isConnectivityError(error)) throw error
        await isBackendReachable()
        const fallbackSubmission = buildFallbackSubmission(caseId, submission)
        upsertSubmissionLocal(fallbackSubmission)
        markCaseAsArchived(caseId)
        return fallbackSubmission
      }),

  getMySubmission: async (caseId: string) => {
    try {
      const response = await api.get<BackendCaseSubmission | undefined>(`/cases/${caseId}/submission`)
      if (!response) return null
      const normalized = normalizeCaseSubmission(response, caseId)
      upsertSubmissionLocal(normalized)
      return normalized
    } catch (error) {
      if (error instanceof ApiHttpError && error.status === 404) {
        return null
      }
      if (!isConnectivityError(error)) throw error
      await isBackendReachable()
      const local = readSubmissionsLocal().find((submission) => submission.caseId === caseId)
      return local ?? null
    }
  },
}
