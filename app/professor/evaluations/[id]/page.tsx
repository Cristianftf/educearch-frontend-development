'use client'

import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { evaluationApi, casesApi } from '@/lib/api'
import type { CaseSubmission, CaseStudy, CompetencyType, Evaluation } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Calendar, CheckCircle2, Clock, FileText, MessageSquare, Search, ShieldCheck } from 'lucide-react'

const COMPETENCIES: CompetencyType[] = ['access', 'process', 'communicate']

const competencyConfig: Record<
  CompetencyType,
  { label: string; icon: ElementType; description: string }
> = {
  access: {
    label: 'Acceso a la información',
    icon: Search,
    description: 'Construcción de consulta, uso de operadores booleanos y términos MeSH.',
  },
  process: {
    label: 'Procesamiento',
    icon: ShieldCheck,
    description: 'Evaluación crítica de evidencia, sesgos y pertinencia clínica.',
  },
  communicate: {
    label: 'Comunicación',
    icon: FileText,
    description: 'Redacción, bibliografía y trazabilidad de la respuesta entregada.',
  },
}

const quickFeedbackTemplates: Record<CompetencyType, string[]> = {
  access: [
    'La estrategia de búsqueda está bien delimitada y usa términos clínicos pertinentes.',
    'Conviene ampliar el uso de MeSH y operadores para reducir ruido en los resultados.',
    'La selección de estudios es adecuada para el objetivo del caso.',
  ],
  process: [
    'El análisis crítico distingue bien nivel de evidencia y calidad metodológica.',
    'Faltó justificar mejor por qué una fuente es más sólida que otra.',
    'Sería útil identificar sesgos y limitaciones de los estudios utilizados.',
  ],
  communicate: [
    'La respuesta final comunica con claridad la decisión clínica sustentada.',
    'La bibliografía requiere mayor consistencia en el formato.',
    'La argumentación está ordenada y enlaza bien evidencia con conclusión.',
  ],
}

type RubricScore = {
  criteriaId: string
  score: number
  feedback: string
}

const formatDate = (value?: string) => {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Sin fecha'
    : date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

const safeIdentifier = (value?: string) => {
  if (typeof value !== 'string') return 'N/A'
  const normalized = value.trim()
  return normalized ? normalized : 'N/A'
}

export default function EvaluationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const submissionId = Array.isArray(params.id) ? params.id[0] : String(params.id ?? '')

  const [submission, setSubmission] = useState<CaseSubmission | null>(null)
  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [rubricScores, setRubricScores] = useState<RubricScore[]>([])
  const [competencyScores, setCompetencyScores] = useState<Record<CompetencyType, number>>({
    access: 0,
    process: 0,
    communicate: 0,
  })
  const [comments, setComments] = useState<Record<CompetencyType, string>>({
    access: '',
    process: '',
    communicate: '',
  })
  const [generalFeedback, setGeneralFeedback] = useState('')

  const applyEvaluationToForm = useCallback((evaluation?: Evaluation) => {
    setCompetencyScores({
      access: evaluation?.scores?.access ?? 0,
      process: evaluation?.scores?.process ?? 0,
      communicate: evaluation?.scores?.communicate ?? 0,
    })
    setComments({
      access: evaluation?.comments?.access ?? '',
      process: evaluation?.comments?.process ?? '',
      communicate: evaluation?.comments?.communicate ?? '',
    })
    setGeneralFeedback(evaluation?.feedback ?? '')
  }, [])

  useEffect(() => {
    if (!submissionId) return

    let mounted = true
    setIsLoading(true)
    setError(null)

    const load = async () => {
      try {
        const submissionResponse = await evaluationApi.getSubmission(submissionId)
        if (!mounted) return
        setSubmission(submissionResponse)

        const caseResponse = submissionResponse.caseId ? await casesApi.getById(submissionResponse.caseId) : null
        if (!mounted) return
        setCaseStudy(caseResponse)
        applyEvaluationToForm(submissionResponse.evaluation)

        const existingEvaluation =
          submissionResponse.status === 'reviewed'
            ? await evaluationApi.getBySubmission(submissionId).catch(() => submissionResponse.evaluation)
            : submissionResponse.evaluation

        if (!mounted) return
        applyEvaluationToForm(existingEvaluation)

        const rubricFromCase = caseResponse?.rubric ?? []
        setRubricScores(
          rubricFromCase.map((item) => ({
            criteriaId: item.id,
            score: existingEvaluation?.scores?.[item.competency] ?? 0,
            feedback: existingEvaluation?.comments?.[item.competency] ?? '',
          }))
        )
      } catch (loadError) {
        console.error('[professor evaluation detail] Error loading data:', loadError)
        if (mounted) setError('No se pudo cargar la entrega seleccionada.')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [applyEvaluationToForm, submissionId])

  const rubricById = useMemo(
    () => new Map((caseStudy?.rubric ?? []).map((item) => [item.id, item])),
    [caseStudy]
  )

  const totalMaxPoints = useMemo(
    () => (caseStudy?.rubric ?? []).reduce((sum, item) => sum + item.maxPoints, 0),
    [caseStudy]
  )

  const rubricEarnedPoints = useMemo(
    () =>
      rubricScores.reduce((sum, item) => {
        const rubricItem = rubricById.get(item.criteriaId)
        if (!rubricItem) return sum
        return sum + (item.score / 100) * rubricItem.maxPoints
      }, 0),
    [rubricById, rubricScores]
  )

  const overallScore = useMemo(() => {
    if (totalMaxPoints > 0) {
      return Math.round((rubricEarnedPoints / totalMaxPoints) * 100)
    }
    return Math.round(
      (competencyScores.access + competencyScores.process + competencyScores.communicate) / 3
    )
  }, [competencyScores, rubricEarnedPoints, totalMaxPoints])

  const updateRubricScore = useCallback((criteriaId: string, updates: Partial<RubricScore>) => {
    setRubricScores((prev) =>
      prev.map((item) => (item.criteriaId === criteriaId ? { ...item, ...updates } : item))
    )
  }, [])

  const appendQuickComment = useCallback((competency: CompetencyType, template: string) => {
    setComments((prev) => ({
      ...prev,
      [competency]: prev[competency] ? `${prev[competency]}\n${template}` : template,
    }))
  }, [])

  const handleSave = useCallback(async () => {
    if (!submission) return
    setIsSaving(true)
    setError(null)

    try {
      await evaluationApi.submit(submission.id, {
        submissionId: submission.id,
        professorId: '',
        scores: competencyScores,
        comments,
        overallScore,
        feedback: generalFeedback,
      })
      router.push('/professor/evaluations')
    } catch (saveError) {
      console.error('[professor evaluation detail] Error saving evaluation:', saveError)
      setError('No se pudo guardar la evaluación.')
    } finally {
      setIsSaving(false)
    }
  }, [comments, competencyScores, generalFeedback, overallScore, router, submission])

  if (isLoading) {
    return <EvaluationSkeleton />
  }

  if (!submission || !caseStudy) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
        <p className="text-muted-foreground">{error || 'Entrega no encontrada.'}</p>
        <Button asChild className="mt-4">
          <Link href="/professor/evaluations">Volver a evaluaciones</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/professor/evaluations">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Evaluar entrega</h1>
            <p className="mt-1 text-muted-foreground">{caseStudy.title}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {isSaving ? 'Guardando...' : 'Guardar evaluación'}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium">Estudiante #{safeIdentifier(submission.studentId)}</p>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Enviado: {formatDate(submission.submittedAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Estado: {submission.status === 'reviewed' ? 'Revisado' : 'Pendiente'}
                </span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm text-muted-foreground">Puntuación global</p>
              <p className="text-3xl font-bold">{overallScore}%</p>
              <p className="text-xs text-muted-foreground">
                {Math.round(rubricEarnedPoints)} de {totalMaxPoints || 100} pts
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Entrega del estudiante</CardTitle>
            <CardDescription>Contenido, bibliografía y artículos declarados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-sm font-medium">Respuesta</Label>
              <ScrollArea className="mt-2 h-[260px] rounded-lg border p-4">
                <div className="whitespace-pre-wrap text-sm">
                  {submission.content || 'El estudiante no agregó contenido escrito.'}
                </div>
              </ScrollArea>
            </div>

            <div>
              <Label className="text-sm font-medium">Bibliografía</Label>
              <ScrollArea className="mt-2 h-[140px] rounded-lg border p-4">
                <div className="whitespace-pre-wrap text-sm">
                  {submission.bibliography || 'No se incluyó bibliografía.'}
                </div>
              </ScrollArea>
            </div>

            <div>
              <Label className="text-sm font-medium">Artículos seleccionados</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {submission.selectedArticles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay artículos asociados a la entrega.</p>
                ) : (
                  submission.selectedArticles.map((articleId) => (
                    <Badge key={articleId} variant="outline">
                      {articleId}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rúbrica del caso</CardTitle>
            <CardDescription>Valora cada criterio y añade observaciones específicas.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[560px] pr-4">
              <div className="space-y-5">
                {(caseStudy.rubric ?? []).map((rubricItem) => {
                  const rubricScore = rubricScores.find((item) => item.criteriaId === rubricItem.id)
                  const points = Math.round(((rubricScore?.score ?? 0) / 100) * rubricItem.maxPoints)
                  return (
                    <div key={rubricItem.id} className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium">{rubricItem.criteria}</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <Badge variant="secondary">{rubricItem.competency}</Badge>
                            <Badge variant="outline">{rubricItem.maxPoints} pts</Badge>
                          </div>
                        </div>
                        <span className="text-lg font-bold">{points}</span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Necesita mejorar</span>
                          <span>{rubricScore?.score ?? 0}%</span>
                          <span>Excelente</span>
                        </div>
                        <Slider
                          value={[rubricScore?.score ?? 0]}
                          onValueChange={([value]) => updateRubricScore(rubricItem.id, { score: value })}
                          max={100}
                          step={5}
                        />
                      </div>

                      <Textarea
                        placeholder="Retroalimentación puntual sobre este criterio..."
                        value={rubricScore?.feedback ?? ''}
                        onChange={(event) =>
                          updateRubricScore(rubricItem.id, { feedback: event.target.value })
                        }
                        className="min-h-[84px]"
                      />
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Retroalimentación por competencia</CardTitle>
          <CardDescription>Comentarios consolidados por área de evaluación.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-3">
            {COMPETENCIES.map((competency) => {
              const Icon = competencyConfig[competency].icon
              return (
                <Card key={competency}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="h-5 w-5" />
                      {competencyConfig[competency].label}
                    </CardTitle>
                    <CardDescription>{competencyConfig[competency].description}</CardDescription>
                    <Badge variant="outline" className="w-fit">
                      {competencyScores[competency]}%
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      placeholder="Escribe observaciones para esta competencia..."
                      value={comments[competency]}
                      onChange={(event) =>
                        setComments((prev) => ({ ...prev, [competency]: event.target.value }))
                      }
                      className="min-h-[120px]"
                    />
                    <div className="flex flex-wrap gap-2">
                      {quickFeedbackTemplates[competency].map((template) => (
                        <Button
                          key={template}
                          variant="outline"
                          size="sm"
                          className="h-auto whitespace-normal py-1.5 text-xs"
                          onClick={() => appendQuickComment(competency, template)}
                        >
                          {template}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Retroalimentación general
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Escribe una síntesis final para el estudiante..."
            value={generalFeedback}
            onChange={(event) => setGeneralFeedback(event.target.value)}
            className="min-h-[140px]"
          />
        </CardContent>
      </Card>
    </div>
  )
}

function EvaluationSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-48" />
        </div>
      </div>

      <Skeleton className="h-28 w-full" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[580px]" />
        <Skeleton className="h-[580px]" />
      </div>
    </div>
  )
}
