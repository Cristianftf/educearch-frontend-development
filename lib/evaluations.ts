import type { CaseSubmission, Evaluation } from '@/types'
import { ApiHttpError, api } from './api-client'
import {
  STUDENT_FALLBACK_KEYS,
  createLocalId,
  getScopedStorageKey,
  readLocalStorage,
  writeLocalStorage,
} from './student-resilience'

type EvaluationsResponse = {
  evaluations?: Array<Record<string, unknown>>
  count?: number
}

type SubmissionResponse = {
  submission?: Record<string, unknown>
}

type EvaluationResponse = {
  evaluation?: Record<string, unknown>
}

type SubmissionPayload = SubmissionResponse | Record<string, unknown>
type EvaluationPayload = EvaluationResponse | Record<string, unknown>

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function normalizeEvaluation(raw: Record<string, unknown> | null | undefined, fallback: Partial<Evaluation> = {}): Evaluation {
  const scores = asRecord(raw?.scores)
  const comments = asRecord(raw?.comments)
  return {
    id: asString(raw?.id, fallback.id ?? createLocalId('evaluation')),
    submissionId: asString(raw?.submissionId, fallback.submissionId ?? ''),
    professorId: asString(raw?.professorId, fallback.professorId ?? ''),
    scores: {
      access: asNumber(scores.access, fallback.scores?.access ?? 0),
      process: asNumber(scores.process, fallback.scores?.process ?? 0),
      communicate: asNumber(scores.communicate, fallback.scores?.communicate ?? 0),
    },
    comments: {
      access: typeof comments.access === 'string' ? comments.access : fallback.comments?.access ?? '',
      process: typeof comments.process === 'string' ? comments.process : fallback.comments?.process ?? '',
      communicate:
        typeof comments.communicate === 'string'
          ? comments.communicate
          : fallback.comments?.communicate ?? '',
    },
    overallScore:
      typeof raw?.overallScore === 'number' || typeof raw?.overallScore === 'string'
        ? asNumber(raw.overallScore, 0)
        : fallback.overallScore ??
          Math.round(
            ((asNumber(scores.access, 0)) +
              (asNumber(scores.process, 0)) +
              (asNumber(scores.communicate, 0))) /
              3
          ),
    feedback: asString(raw?.feedback, fallback.feedback ?? ''),
    evaluatedAt: asString(raw?.evaluatedAt, fallback.evaluatedAt ?? new Date().toISOString()),
  }
}

function normalizeStatus(status: unknown): CaseSubmission['status'] {
  if (typeof status !== 'string') return 'pending'
  const normalized = status.toLowerCase()
  if (normalized === 'evaluated') return 'reviewed'
  if (normalized === 'reviewed' || normalized === 'pending' || normalized === 'returned') {
    return normalized as CaseSubmission['status']
  }
  return 'pending'
}

function normalizeSubmission(raw: Record<string, unknown>): CaseSubmission {
  const id = asString(raw.id, asString(raw.submissionId))
  return {
    id,
    caseId: asString(raw.caseId),
    studentId: asString(raw.studentId),
    submittedAt: asString(raw.submittedAt),
    content: asString(raw.content),
    selectedArticles: asStringArray(raw.selectedArticles),
    bibliography: asString(raw.bibliography),
    status: normalizeStatus(raw.status),
    evaluation: raw.evaluation ? normalizeEvaluation(asRecord(raw.evaluation)) : undefined,
  }
}

function extractSubmissionRecord(payload: SubmissionPayload | undefined): Record<string, unknown> {
  const record = asRecord(payload)
  if (record.submission && typeof record.submission === 'object') {
    return asRecord(record.submission)
  }
  return record
}

function extractEvaluationRecord(payload: EvaluationPayload | undefined): Record<string, unknown> {
  const record = asRecord(payload)
  if (record.evaluation && typeof record.evaluation === 'object') {
    return asRecord(record.evaluation)
  }
  return record
}

function readSubmissionsLocal(): CaseSubmission[] {
  return readLocalStorage<CaseSubmission[]>(
    getScopedStorageKey(STUDENT_FALLBACK_KEYS.caseSubmissions),
    []
  )
}

function writeSubmissionsLocal(submissions: CaseSubmission[]): void {
  writeLocalStorage(getScopedStorageKey(STUDENT_FALLBACK_KEYS.caseSubmissions), submissions)
}

function upsertSubmissionLocal(submission: CaseSubmission): void {
  const existing = readSubmissionsLocal()
  const next = [submission, ...existing.filter((item) => item.id !== submission.id)]
  writeSubmissionsLocal(next)
}

export const evaluationApi = {
  getPending: async () => {
    const res = await api.get<EvaluationsResponse>('/evaluations/pending')
    const items = (res?.evaluations ?? []).map(normalizeSubmission)
    items.forEach(upsertSubmissionLocal)
    return items
  },

  getReviewed: async () => {
    const res = await api.get<EvaluationsResponse>('/evaluations/reviewed')
    const items = (res?.evaluations ?? []).map(normalizeSubmission)
    items.forEach(upsertSubmissionLocal)
    return items
  },

  getAll: async () => {
    const [pending, reviewed] = await Promise.all([evaluationApi.getPending(), evaluationApi.getReviewed()])
    return { pending, reviewed, all: [...pending, ...reviewed] }
  },

  submit: async (submissionId: string, evaluation: Omit<Evaluation, 'id' | 'evaluatedAt'>) => {
    const res = await api.post<{ evaluation?: Evaluation } | Record<string, unknown>>(
      `/evaluations/${submissionId}`,
      evaluation
    )
    const normalized = normalizeEvaluation(extractEvaluationRecord(res), {
      ...evaluation,
      submissionId,
    })
    const existing = readSubmissionsLocal().find((item) => item.id === submissionId)
    if (existing) {
      upsertSubmissionLocal({
        ...existing,
        status: 'reviewed',
        evaluation: normalized,
      })
    }
    return normalized
  },

  getBySubmission: async (submissionId: string) => {
    const res = await api.get<EvaluationPayload>(`/evaluations/submission/${submissionId}`)
    const record = extractEvaluationRecord(res)
    if (!record.id && !record.submissionId) {
      throw new Error('Evaluation not found')
    }
    const evaluation = normalizeEvaluation(record, { submissionId })
    const existing = readSubmissionsLocal().find((item) => item.id === submissionId)
    if (existing) {
      upsertSubmissionLocal({ ...existing, evaluation, status: 'reviewed' })
    }
    return evaluation
  },

  getSubmission: async (submissionId: string) => {
    try {
      const res = await api.get<SubmissionPayload>(`/submissions/${submissionId}`)
      const submission = normalizeSubmission(extractSubmissionRecord(res))
      if (!submission.id) {
        throw new Error('Submission not found')
      }
      upsertSubmissionLocal(submission)
      return submission
    } catch (error) {
      if (error instanceof ApiHttpError && error.status === 404) {
        throw new Error('Submission not found')
      }
      const cached = readSubmissionsLocal().find((item) => item.id === submissionId)
      if (cached) {
        return cached
      }
      throw error
    }
  },
}
