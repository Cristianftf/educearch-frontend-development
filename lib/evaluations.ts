import type { CaseSubmission, Evaluation } from '@/types'
import { api } from './api-client'
import {
  STUDENT_FALLBACK_KEYS,
  createLocalId,
  readLocalStorage,
  writeLocalStorage,
} from './student-resilience'

type EvaluationsResponse = {
  evaluations?: Array<Record<string, any>>
  count?: number
}

type SubmissionResponse = {
  submission?: Record<string, any>
}

type EvaluationResponse = {
  evaluation?: Record<string, any>
}

function normalizeEvaluation(raw: Record<string, any> | null | undefined, fallback: Partial<Evaluation> = {}): Evaluation {
  return {
    id: raw?.id ?? fallback.id ?? createLocalId('evaluation'),
    submissionId: raw?.submissionId ?? fallback.submissionId ?? '',
    professorId: raw?.professorId ?? fallback.professorId ?? '',
    scores: {
      access: typeof raw?.scores?.access === 'number' ? raw.scores.access : fallback.scores?.access ?? 0,
      process: typeof raw?.scores?.process === 'number' ? raw.scores.process : fallback.scores?.process ?? 0,
      communicate:
        typeof raw?.scores?.communicate === 'number'
          ? raw.scores.communicate
          : fallback.scores?.communicate ?? 0,
    },
    comments: {
      access:
        typeof raw?.comments?.access === 'string' ? raw.comments.access : fallback.comments?.access ?? '',
      process:
        typeof raw?.comments?.process === 'string' ? raw.comments.process : fallback.comments?.process ?? '',
      communicate:
        typeof raw?.comments?.communicate === 'string'
          ? raw.comments.communicate
          : fallback.comments?.communicate ?? '',
    },
    overallScore:
      typeof raw?.overallScore === 'number'
        ? raw.overallScore
        : fallback.overallScore ??
          Math.round(
            ((typeof raw?.scores?.access === 'number' ? raw.scores.access : 0) +
              (typeof raw?.scores?.process === 'number' ? raw.scores.process : 0) +
              (typeof raw?.scores?.communicate === 'number' ? raw.scores.communicate : 0)) /
              3
          ),
    feedback: typeof raw?.feedback === 'string' ? raw.feedback : fallback.feedback ?? '',
    evaluatedAt: raw?.evaluatedAt ?? fallback.evaluatedAt ?? new Date().toISOString(),
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

function normalizeSubmission(raw: Record<string, any>): CaseSubmission {
  const id = raw.id ?? raw.submissionId ?? ''
  return {
    id,
    caseId: raw.caseId ?? '',
    studentId: raw.studentId ?? '',
    submittedAt: raw.submittedAt ?? '',
    content: raw.content ?? '',
    selectedArticles: raw.selectedArticles ?? [],
    bibliography: raw.bibliography ?? '',
    status: normalizeStatus(raw.status),
    evaluation: raw.evaluation,
  }
}

function readSubmissionsLocal(): CaseSubmission[] {
  return readLocalStorage<CaseSubmission[]>(STUDENT_FALLBACK_KEYS.caseSubmissions, [])
}

function writeSubmissionsLocal(submissions: CaseSubmission[]): void {
  writeLocalStorage(STUDENT_FALLBACK_KEYS.caseSubmissions, submissions)
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

  submit: async (submissionId: string, evaluation: Omit<Evaluation, 'id' | 'evaluatedAt'>) => {
    const res = await api.post<{ evaluation?: Evaluation }>(`/evaluations/${submissionId}`, evaluation)
    const normalized = normalizeEvaluation(res?.evaluation as Record<string, any> | undefined, {
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
    const res = await api.get<EvaluationResponse>(`/evaluations/submission/${submissionId}`)
    if (!res?.evaluation) {
      throw new Error('Evaluation not found')
    }
    const evaluation = normalizeEvaluation(res.evaluation, { submissionId })
    const existing = readSubmissionsLocal().find((item) => item.id === submissionId)
    if (existing) {
      upsertSubmissionLocal({ ...existing, evaluation, status: 'reviewed' })
    }
    return evaluation
  },

  getSubmission: async (submissionId: string) => {
    const res = await api.get<SubmissionResponse>(`/submissions/${submissionId}`)
    const submission = normalizeSubmission(res?.submission ?? {})
    if (submission.id) {
      upsertSubmissionLocal(submission)
    }
    return submission
  },
}
