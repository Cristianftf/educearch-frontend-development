import type { CaseStudy, CaseSubmission, GuidingQuestion, RubricItem } from '@/types'
import { api } from './api-client'

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

function parseGuidingQuestion(raw: string, index: number): GuidingQuestion {
  const trimmed = raw.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed.question === 'string') {
        return {
          id: String(parsed.id ?? `q-${index}`),
          question: parsed.question,
          competency: parsed.competency ?? 'access',
          points: Number(parsed.points ?? 10),
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
  const guidingQuestions = (caseStudy.guidingQuestions ?? []).map(parseGuidingQuestion)
  const rubric = (caseStudy.rubric ?? [])
    .filter(Boolean)
    .map((item, index) => ({
      id: `r-${index}`,
      criteria: item.criterion ?? '',
      competency: (item.competency ?? 'access') as RubricItem['competency'],
      maxPoints: item.maxScore ?? 0,
      levels: parseRubricLevels(item.description),
    }))

  return {
    ...caseStudy,
    guidingQuestions,
    rubric,
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
  const guidingQuestions = (caseStudy.guidingQuestions ?? []).map((q) =>
    typeof q === 'string' ? q : serializeGuidingQuestion(q)
  )
  const rubric = (caseStudy.rubric ?? []).map((item) =>
    'criteria' in item ? serializeRubricItem(item as RubricItem) : (item as BackendRubricItem)
  )

  const { startDate, ...rest } = caseStudy

  return {
    ...rest,
    guidingQuestions,
    rubric,
  } as BackendCaseStudy
}

export const casesApi = {
  // Professor endpoints
  getAll: (status?: string) =>
    api
      .get<BackendCaseStudy[]>(`/cases${status ? `?status=${status}` : ''}`)
      .then((items) => items.map(normalizeCaseStudy)),

  getById: (id: string) =>
    api.get<BackendCaseStudy>(`/cases/${id}`).then(normalizeCaseStudy),

  create: (caseData: Omit<CaseStudy, 'id' | 'createdAt' | 'createdBy'>) =>
    api.post<BackendCaseStudy>('/cases', serializeCaseStudy(caseData)).then(normalizeCaseStudy),

  update: (id: string, caseData: Partial<CaseStudy>) =>
    api.put<BackendCaseStudy>(`/cases/${id}`, serializeCaseStudy(caseData)).then(normalizeCaseStudy),

  delete: (id: string) => api.delete<void>(`/cases/${id}`),

  assign: (id: string, studentIds: string[]) =>
    api
      .post<BackendCaseStudy>(`/cases/${id}/assign`, { studentIds })
      .then(normalizeCaseStudy),

  getSubmissions: (caseId: string) =>
    api.get<CaseSubmission[]>(`/cases/${caseId}/submissions`),

  // Student endpoints
  getAssigned: () =>
    api.get<BackendCaseStudy[]>('/cases/assigned').then((items) => items.map(normalizeCaseStudy)),

  submit: (caseId: string, submission: Omit<CaseSubmission, 'id' | 'submittedAt' | 'status'>) =>
    api.post<CaseSubmission>(`/cases/${caseId}/submit`, submission),

  getMySubmission: (caseId: string) =>
    api.get<CaseSubmission>(`/cases/${caseId}/submission`),
}
