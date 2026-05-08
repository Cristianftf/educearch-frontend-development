'use client'

import { useState, useEffect, useCallback } from 'react'
import { casesApi } from '@/lib/api'
import { ApiHttpError } from '@/lib/api-client'
import type { CaseStudy, CaseSubmission, CaseDifficulty } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  FolderOpen,
  Clock,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  FileText,
  Calendar,
  Send,
  Loader2,
  Eye,
  ChevronRight,
  GraduationCap,
  Target,
  MessageSquare,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'

const difficultyConfig: Record<
  CaseDifficulty,
  { label: string; color: string; bgColor: string }
> = {
  novice: {
    label: 'Novato',
    color: 'text-success',
    bgColor: 'bg-success/10 border-success/30',
  },
  intermediate: {
    label: 'Intermedio',
    color: 'text-warning',
    bgColor: 'bg-warning/10 border-warning/30',
  },
  advanced: {
    label: 'Avanzado',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10 border-destructive/30',
  },
}

function formatDate(dateString: string): string {
  const date = parseCalendarDateUtc(dateString)
  return date.toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return date.toLocaleString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getDaysRemaining(dueDate: string): number {
  const due = parseCalendarDateUtc(dueDate)
  if (Number.isNaN(due.getTime())) return 0
  const now = new Date()
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const diff = due.getTime() - todayUtc
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function parseCalendarDateUtc(value: string): Date {
  const datePart = value.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [year, month, day] = datePart.split('-').map((item) => parseInt(item, 10))
    return new Date(Date.UTC(year, month - 1, day))
  }
  return new Date(value)
}

function getSafeCaseLabel(caseStudy: Pick<CaseStudy, 'id' | 'title'>): string {
  const title = typeof caseStudy.title === 'string' ? caseStudy.title.trim() : ''
  if (title) return title
  const fallbackId = typeof caseStudy.id === 'string' ? caseStudy.id.trim() : ''
  return fallbackId ? `Caso ${fallbackId.slice(0, 8)}` : 'Caso sin titulo'
}

function getQuestionText(question: CaseStudy['guidingQuestions'][number] | string): string {
  if (typeof question === 'string') {
    const trimmed = question.trim()
    if (!trimmed.startsWith('{')) return trimmed
    try {
      const parsed = JSON.parse(trimmed) as { question?: unknown }
      return typeof parsed.question === 'string' ? parsed.question.trim() : trimmed
    } catch {
      return trimmed
    }
  }
  return typeof question.question === 'string' ? question.question.trim() : ''
}

function getRubricPoints(item: CaseStudy['rubric'][number]): number {
  const candidate = (item as { maxPoints?: unknown; maxScore?: unknown }).maxPoints
  const fallback = (item as { maxScore?: unknown }).maxScore
  const value = typeof candidate === 'number' ? candidate : typeof fallback === 'number' ? fallback : 0
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function getRubricCriteria(item: CaseStudy['rubric'][number]): string {
  const criteria = (item as { criteria?: unknown; criterion?: unknown }).criteria
  const fallback = (item as { criterion?: unknown }).criterion
  if (typeof criteria === 'string' && criteria.trim()) return criteria.trim()
  if (typeof fallback === 'string' && fallback.trim()) return fallback.trim()
  return 'Sin criterio definido'
}

export default function CasesPage() {
  const { user } = useAuth()
  const [cases, setCases] = useState<CaseStudy[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCase, setSelectedCase] = useState<CaseStudy | null>(null)
  const [submissionContent, setSubmissionContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('pending')
  const [selectedSubmission, setSelectedSubmission] = useState<CaseSubmission | null>(null)
  const [submissionsByCaseId, setSubmissionsByCaseId] = useState<Record<string, CaseSubmission>>({})
  const [isLoadingSubmission, setIsLoadingSubmission] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [evaluationNotifications, setEvaluationNotifications] = useState<
    Array<{ submissionId: string; caseId: string; title: string; score: number }>
  >([])

  const evaluatedSeenStorageKey = `student-evaluated-seen:${user?.id ?? 'anonymous'}`

  const loadCasesAndSubmissions = useCallback(async () => {
    const assignedCases = await casesApi.getAssigned()
    setCases(assignedCases)

    const pairs = await Promise.all(
      assignedCases.map(async (caseStudy) => {
        try {
          const submission = await casesApi.getMySubmission(caseStudy.id)
          if (!submission) return null
          return [caseStudy.id, submission] as const
        } catch (err) {
          if (err instanceof ApiHttpError && err.status === 404) {
            return null
          }
          console.error('[v0] Error loading case submission:', err)
          return null
        }
      })
    )

    const nextMap: Record<string, CaseSubmission> = {}
    pairs.forEach((entry) => {
      if (!entry) return
      const [caseId, submission] = entry
      nextMap[caseId] = submission
    })
    setSubmissionsByCaseId(nextMap)
  }, [])

  useEffect(() => {
    async function loadCases() {
      try {
        await loadCasesAndSubmissions()
      } catch (err) {
        setError('No se pudieron cargar los casos asignados')
        console.error('[v0] Error loading cases:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadCases()
  }, [loadCasesAndSubmissions])

  useEffect(() => {
    let isMounted = true

    if (!selectedCase) {
      setSelectedSubmission(null)
      setSubmissionError(null)
      setIsLoadingSubmission(false)
      return () => {
        isMounted = false
      }
    }

    const cachedSubmission = submissionsByCaseId[selectedCase.id]
    if (cachedSubmission) {
      setSelectedSubmission(cachedSubmission)
      setSubmissionError(null)
      setIsLoadingSubmission(false)
      return () => {
        isMounted = false
      }
    }

    setIsLoadingSubmission(true)
    setSubmissionError(null)

    casesApi
      .getMySubmission(selectedCase.id)
      .then((submission) => {
        if (!isMounted) return
        if (!submission) {
          setSelectedSubmission(null)
          return
        }
        setSelectedSubmission(submission)
        setSubmissionsByCaseId((prev) => ({ ...prev, [selectedCase.id]: submission }))
      })
      .catch((err) => {
        if (!isMounted) return
        if (err instanceof ApiHttpError && err.status === 404) {
          setSelectedSubmission(null)
          return
        }
        console.error('[v0] Error loading submission:', err)
        setSubmissionError('No se pudo cargar tu entrega')
      })
      .finally(() => {
        if (!isMounted) return
        setIsLoadingSubmission(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedCase, submissionsByCaseId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(evaluatedSeenStorageKey)
    let parsed: string[] = []
    if (raw) {
      try {
        const candidate = JSON.parse(raw)
        if (Array.isArray(candidate)) {
          parsed = candidate.filter((value): value is string => typeof value === 'string')
        }
      } catch {
        parsed = []
      }
    }
    const seenSubmissionIds = new Set<string>(parsed)

    const newNotifications: Array<{ submissionId: string; caseId: string; title: string; score: number }> = []
    for (const [caseId, submission] of Object.entries(submissionsByCaseId)) {
      if (!submission?.evaluation) continue
      if (seenSubmissionIds.has(submission.id)) continue
      const caseTitle =
        getSafeCaseLabel(cases.find((entry) => entry.id === caseId) ?? { id: caseId, title: '' })
      newNotifications.push({
        submissionId: submission.id,
        caseId,
        title: caseTitle,
        score: submission.evaluation.overallScore,
      })
      seenSubmissionIds.add(submission.id)
    }

    if (newNotifications.length === 0) return
    setEvaluationNotifications((prev) => {
      const merged = [...newNotifications, ...prev]
      const byId = new Map<string, { submissionId: string; caseId: string; title: string; score: number }>()
      merged.forEach((item) => byId.set(item.submissionId, item))
      return Array.from(byId.values())
    })
    window.localStorage.setItem(
      evaluatedSeenStorageKey,
      JSON.stringify(Array.from(seenSubmissionIds))
    )
  }, [cases, submissionsByCaseId, evaluatedSeenStorageKey])

  const handleSubmit = useCallback(async () => {
    if (!selectedCase || !submissionContent.trim()) return

    setIsSubmitting(true)
    try {
      const submission: Omit<CaseSubmission, 'id' | 'submittedAt' | 'status'> = {
        caseId: selectedCase.id,
        content: submissionContent,
        selectedArticles: [],
        bibliography: '',
        studentId: user?.id ?? '',
      }
      const createdSubmission = await casesApi.submit(selectedCase.id, submission)
      setSubmissionsByCaseId((prev) => ({ ...prev, [selectedCase.id]: createdSubmission }))
      setSelectedSubmission(createdSubmission)
      await loadCasesAndSubmissions()
      setSelectedCase(null)
      setSubmissionContent('')
    } catch (err) {
      console.error('[v0] Submission error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedCase, submissionContent, user, loadCasesAndSubmissions])

  const pendingCases = cases.filter((c) => !submissionsByCaseId[c.id])
  const completedCases = cases.filter((c) => Boolean(submissionsByCaseId[c.id]))
  const evaluatedCases = completedCases.filter((c) => Boolean(submissionsByCaseId[c.id]?.evaluation))
  const selectedCaseSubmission = selectedCase
    ? submissionsByCaseId[selectedCase.id] ?? selectedSubmission
    : selectedSubmission

  if (isLoading) {
    return <CasesSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold mb-2">Error al cargar</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>Reintentar</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <FolderOpen className="h-8 w-8 text-primary" />
          Casos de Estudio
        </h1>
        <p className="text-muted-foreground mt-1">
          Casos asignados por tus profesores para practicar competencias
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-warning/10">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCases.length}</p>
                <p className="text-sm text-muted-foreground">Casos pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-success/10">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedCases.length}</p>
                <p className="text-sm text-muted-foreground">Casos completados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {cases.length > 0
                    ? Math.round((completedCases.length / cases.length) * 100)
                    : 0}
                  %
                </p>
                <p className="text-sm text-muted-foreground">
                  Progreso total ({evaluatedCases.length} evaluado{evaluatedCases.length === 1 ? '' : 's'})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {evaluationNotifications.length > 0 && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-success">
                  Tienes {evaluationNotifications.length} evaluacion{evaluationNotifications.length > 1 ? 'es' : ''} nueva{evaluationNotifications.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  Tu profesor ya califico una o mas entregas de casos de estudio.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEvaluationNotifications([])}
                className="bg-transparent"
              >
                Entendido
              </Button>
            </div>
            <div className="space-y-2">
              {evaluationNotifications.slice(0, 3).map((notification) => (
                <div key={notification.submissionId} className="rounded-md border border-success/30 bg-background px-3 py-2 text-sm">
                  <span className="font-medium">{notification.title}</span>
                  <span className="text-muted-foreground"> - Nota: {notification.score}/100</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cases List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pendientes ({pendingCases.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Completados ({completedCases.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          {pendingCases.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {pendingCases.map((caseStudy) => {
                const daysRemaining = caseStudy.dueDate
                  ? getDaysRemaining(caseStudy.dueDate)
                  : null
                const isUrgent = daysRemaining !== null && daysRemaining <= 3

                return (
                  <Card
                    key={caseStudy.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isUrgent ? 'border-warning' : ''
                    }`}
                    onClick={() => setSelectedCase(caseStudy)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg line-clamp-2">
                          {caseStudy.title}
                        </CardTitle>
                        <Badge
                          variant="outline"
                          className={difficultyConfig[caseStudy.difficulty].bgColor}
                        >
                          {difficultyConfig[caseStudy.difficulty].label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {caseStudy.scenario}
                      </p>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4 text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-4 w-4" />
                            {caseStudy.requiredArticles.length} artículos
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="h-4 w-4" />
                            {caseStudy.guidingQuestions.length} preguntas
                          </span>
                        </div>

                        {daysRemaining !== null && (
                          <Badge
                            variant={isUrgent ? 'destructive' : 'secondary'}
                            className="gap-1"
                          >
                            <Calendar className="h-3 w-3" />
                            {daysRemaining > 0
                              ? `${daysRemaining} días`
                              : daysRemaining === 0
                                ? 'Hoy'
                                : 'Vencido'}
                          </Badge>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        className="w-full mt-4 justify-between"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedCase(caseStudy)
                        }}
                      >
                        Ver caso completo
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-success" />
                <h3 className="text-lg font-medium mb-2">No hay casos pendientes</h3>
                <p className="text-muted-foreground">
                  Has completado todos tus casos asignados. ¡Excelente trabajo!
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {completedCases.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {completedCases.map((caseStudy) => {
                const submission = submissionsByCaseId[caseStudy.id]
                return (
                  <Card
                    key={caseStudy.id}
                    className="cursor-pointer transition-all hover:shadow-md opacity-80"
                    onClick={() => setSelectedCase(caseStudy)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg line-clamp-2">
                          {caseStudy.title}
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="outline" className="bg-success/10 border-success/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Completado
                          </Badge>
                          {submission?.evaluation && (
                            <Badge variant="outline" className="bg-primary/10 border-primary/30">
                              Evaluado: {submission.evaluation.overallScore}/100
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {caseStudy.scenario}
                      </p>

                      <Button
                      variant="ghost"
                      className="w-full mt-4 justify-between"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedCase(caseStudy)
                      }}
                    >
                      Ver mi entrega
                      <Eye className="h-4 w-4" />
                    </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No hay casos completados</h3>
                <p className="text-muted-foreground">
                  Completa tus casos pendientes para verlos aquí
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Case Detail Dialog */}
      <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedCase && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl">{selectedCase.title}</DialogTitle>
                    <DialogDescription className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className={difficultyConfig[selectedCase.difficulty].bgColor}
                      >
                        {difficultyConfig[selectedCase.difficulty].label}
                      </Badge>
                      {selectedCase.dueDate && (
                        <span className="text-sm">
                          Entrega: {formatDate(selectedCase.dueDate)}
                        </span>
                      )}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Scenario */}
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Escenario clínico
                  </h4>
                  <div className="p-4 rounded-lg bg-muted text-sm leading-relaxed">
                    {selectedCase.scenario}
                  </div>
                </div>

                {/* Required Articles */}
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Artículos requeridos ({selectedCase.requiredArticles.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedCase.requiredArticles.map((articleId, idx) => (
                      <div
                        key={articleId}
                        className="p-3 rounded-lg border flex items-center gap-3"
                      >
                        <span className="text-sm font-medium text-muted-foreground">
                          {idx + 1}.
                        </span>
                        <span className="text-sm">Artículo ID: {articleId}</span>
                        <Button variant="outline" size="sm" className="ml-auto bg-transparent" asChild>
                          <a
                            href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(
                              articleId
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Ver artículo
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Guiding Questions */}
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Preguntas guía
                  </h4>
                          <ol className="space-y-2 list-decimal list-inside">
                    {selectedCase.guidingQuestions.map((question, idx) => {
                      const isString = typeof (question as unknown) === 'string'
                      const questionText = getQuestionText(question as CaseStudy['guidingQuestions'][number] | string)
                      const key =
                        isString
                          ? `${idx}-${questionText}`
                          : question.id
                      return (
                        <li key={key} className="text-sm text-muted-foreground pl-2">
                          {questionText}
                        </li>
                      )
                    })}
                  </ol>
                </div>

                {/* Rubric */}
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Criterios de evaluación
                  </h4>
                  <div className="space-y-2">
                    {selectedCase.rubric.map((item, idx) => (
                        <div key={item.id || idx} className="p-3 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">
                            {item.competency}
                          </span>
                          <Badge variant="outline">
                            {getRubricPoints(item)} pts
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {getRubricCriteria(item)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Submission Form (only for active cases) */}
                {!selectedCaseSubmission && selectedCase.status === 'active' && (
                  <div className="border-t pt-6">
                    <h4 className="font-medium mb-3">Tu entrega</h4>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="submission">Respuesta</Label>
                        <Textarea
                          id="submission"
                          placeholder="Escribe tu análisis del caso, respondiendo las preguntas guía..."
                          className="min-h-[200px] mt-2"
                          value={submissionContent}
                          onChange={(e) => setSubmissionContent(e.target.value)}
                        />
                      </div>

                      <Button
                        className="w-full"
                        size="lg"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !submissionContent.trim()}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Enviar entrega
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {!selectedCaseSubmission && selectedCase.status !== 'active' && (
                  <div className="border-t pt-6">
                    <p className="text-sm text-muted-foreground">
                      Este caso esta en estado <span className="font-medium">{selectedCase.status}</span> y no
                      admite nuevas entregas.
                    </p>
                  </div>
                )}

                {/* Submission Detail (completed cases) */}
                {selectedCaseSubmission && (
                  <div className="border-t pt-6">
                    <h4 className="font-medium mb-3">Tu entrega</h4>
                    {isLoadingSubmission && (
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-20 w-full" />
                      </div>
                    )}
                    {!isLoadingSubmission && submissionError && (
                      <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
                        <AlertCircle className="h-4 w-4" />
                        {submissionError}
                      </div>
                    )}
                    {!isLoadingSubmission && !submissionError && selectedCaseSubmission && (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="capitalize">
                            {selectedCaseSubmission.status}
                          </Badge>
                          {selectedCaseSubmission.submittedAt && (
                            <span>Enviado: {formatDateTime(selectedCaseSubmission.submittedAt)}</span>
                          )}
                        </div>

                        <div className="p-4 rounded-lg bg-muted text-sm leading-relaxed whitespace-pre-wrap">
                          {selectedCaseSubmission.content}
                        </div>

                        {selectedCaseSubmission.evaluation && (
                          <div className="space-y-3">
                            <h5 className="font-medium">Evaluación del profesor</h5>
                            <div className="grid gap-3 sm:grid-cols-3 text-sm">
                              <div className="p-3 rounded-lg border">
                                <p className="text-xs text-muted-foreground">Acceso</p>
                                <p className="text-lg font-semibold">
                                  {selectedCaseSubmission.evaluation.scores.access}
                                </p>
                                {selectedCaseSubmission.evaluation.comments.access && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {selectedCaseSubmission.evaluation.comments.access}
                                  </p>
                                )}
                              </div>
                              <div className="p-3 rounded-lg border">
                                <p className="text-xs text-muted-foreground">Procesamiento</p>
                                <p className="text-lg font-semibold">
                                  {selectedCaseSubmission.evaluation.scores.process}
                                </p>
                                {selectedCaseSubmission.evaluation.comments.process && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {selectedCaseSubmission.evaluation.comments.process}
                                  </p>
                                )}
                              </div>
                              <div className="p-3 rounded-lg border">
                                <p className="text-xs text-muted-foreground">Comunicación</p>
                                <p className="text-lg font-semibold">
                                  {selectedCaseSubmission.evaluation.scores.communicate}
                                </p>
                                {selectedCaseSubmission.evaluation.comments.communicate && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {selectedCaseSubmission.evaluation.comments.communicate}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="p-4 rounded-lg bg-muted/50 text-sm">
                              <p className="text-xs text-muted-foreground">Puntuación global</p>
                              <p className="text-lg font-semibold">
                                {selectedCaseSubmission.evaluation.overallScore}
                              </p>
                              {selectedCaseSubmission.evaluation.feedback && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  {selectedCaseSubmission.evaluation.feedback}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {!isLoadingSubmission && !submissionError && !selectedCaseSubmission && (
                      <p className="text-sm text-muted-foreground">
                        No hay entrega registrada para este caso.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CasesSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div>
                  <Skeleton className="h-8 w-12" />
                  <Skeleton className="h-4 w-24 mt-1" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-10 w-full mt-4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}


