'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { evaluationApi, casesApi } from '@/lib/api'
import type { CaseSubmission, CaseStudy, CompetencyType } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle2,
  Loader2,
  FileText,
  MessageSquare,
  Mic,
  MicOff,
  BookOpen,
  Search,
  ShieldCheck,
  Users,
  Calendar,
  Clock,
  Star,
} from 'lucide-react'

interface RubricScore {
  criteriaId: string
  score: number
  feedback: string
}

interface CompetencyFeedback {
  competency: CompetencyType
  score: number
  comment: string
}

const competencyConfig: Record<CompetencyType, { label: string; icon: React.ElementType; description: string }> = {
  access: {
    label: 'Acceso a la información',
    icon: Search,
    description: 'Uso de operadores booleanos, Términos MeSH y estrategias de Búsqueda',
  },
  process: {
    label: 'Procesamiento de información',
    icon: ShieldCheck,
    description: 'evaluación crítica de la evidencia, identificación de sesgos',
  },
  communicate: {
    label: 'Comunicación de información',
    icon: FileText,
    description: 'Formato de bibliografía, citación correcta, presentación',
  },
}

const quickFeedbackTemplates = {
  access: [
    'Excelente uso de operadores booleanos',
    'Considerar añadir más Términos MeSH específicos',
    'Buena estrategia de Búsqueda, podría ampliarse',
    'Falta uso de filtros por tipo de estudio',
  ],
  process: [
    'Correcta identificación de niveles de evidencia',
    'Revisar evaluación de conflictos de interés',
    'Buen análisis crítico de metodología',
    'Mejorar identificación de sesgos',
  ],
  communicate: [
    'bibliografía correctamente formateada',
    'Revisar formato de citas in-texto',
    'Excelente presentación de resultados',
    'Corregir errores en formato Vancouver',
  ],
}

export default function EvaluationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const submissionId = params.id as string

  const [submission, setSubmission] = useState<CaseSubmission | null>(null)
  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRecording, setIsRecording] = useState(false)

  // Evaluation state
  const [rubricScores, setRubricScores] = useState<RubricScore[]>([])
  const [competencyFeedback, setCompetencyFeedback] = useState<CompetencyFeedback[]>([
    { competency: 'access', score: 0, comment: '' },
    { competency: 'process', score: 0, comment: '' },
    { competency: 'communicate', score: 0, comment: '' },
  ])
  const [generalFeedback, setGeneralFeedback] = useState('')
  const [totalScore, setTotalScore] = useState(0)

  useEffect(() => {
    async function loadData() {
      try {
        const submissionData = await evaluationApi.getSubmission(submissionId)
        setSubmission(submissionData)

        if (submissionData.caseId) {
          const caseData = await casesApi.getById(submissionData.caseId)
          setCaseStudy(caseData)

          // Initialize rubric scores from case rubric
          if (caseData.rubric) {
            setRubricScores(
              caseData.rubric.map((item) => ({
                criteriaId: item.id,
                score: 0,
                feedback: '',
              }))
            )
          }
        }
      } catch (err) {
        console.error('[v0] Error loading submission:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [submissionId])

  // Calculate total score whenever rubric scores change
  useEffect(() => {
    if (!caseStudy?.rubric) return

    const total = rubricScores.reduce((sum, rubricScore) => {
      const rubricItem = caseStudy.rubric?.find((r) => r.id === rubricScore.criteriaId)
      if (!rubricItem) return sum
      return sum + (rubricScore.score / 100) * rubricItem.maxPoints
    }, 0)

    setTotalScore(Math.round(total))
  }, [rubricScores, caseStudy])

  const updateRubricScore = useCallback((criteriaId: string, updates: Partial<RubricScore>) => {
    setRubricScores((prev) =>
      prev.map((score) =>
        score.criteriaId === criteriaId ? { ...score, ...updates } : score
      )
    )
  }, [])

  const updateCompetencyFeedback = useCallback(
    (competency: CompetencyType, updates: Partial<CompetencyFeedback>) => {
      setCompetencyFeedback((prev) =>
        prev.map((fb) => (fb.competency === competency ? { ...fb, ...updates } : fb))
      )
    },
    []
  )

  const addQuickFeedback = useCallback((competency: CompetencyType, template: string) => {
    setCompetencyFeedback((prev) =>
      prev.map((fb) =>
        fb.competency === competency
          ? { ...fb, comment: fb.comment ? `${fb.comment}\n${template}` : template }
          : fb
      )
    )
  }, [])

  const handleSave = useCallback(async () => {
    if (!submission) return

    setIsSaving(true)
    try {
      const scores = competencyFeedback.reduce(
        (acc, item) => {
          acc[item.competency] = item.score
          return acc
        },
        { access: 0, process: 0, communicate: 0 } as Record<CompetencyType, number>
      )

      const comments = competencyFeedback.reduce(
        (acc, item) => {
          acc[item.competency] = item.comment
          return acc
        },
        { access: '', process: '', communicate: '' } as Record<CompetencyType, string>
      )

      await evaluationApi.submit(submissionId, {
        submissionId,
        professorId: '',
        scores,
        comments,
        overallScore: totalScore,
        feedback: generalFeedback,
      })
      router.push('/professor/evaluations')
    } catch (err) {
      console.error('[v0] Save error:', err)
    } finally {
      setIsSaving(false)
    }
  }, [submission, submissionId, rubricScores, competencyFeedback, generalFeedback, totalScore, router])

  const toggleRecording = useCallback(() => {
    setIsRecording((prev) => !prev)
    // In a real app, this would start/stop audio recording
  }, [])

  if (isLoading) {
    return <EvaluationSkeleton />
  }

  if (!submission || !caseStudy) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Entrega no encontrada</p>
        <Button asChild className="mt-4">
          <Link href="/professor/evaluations">Volver a evaluaciones</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/professor/evaluations">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Evaluar entrega
            </h1>
            <p className="text-muted-foreground mt-1">{caseStudy.title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar borrador
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Finalizar evaluación
          </Button>
        </div>
      </div>

      {/* Student info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback>ES</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">Estudiante #{submission.studentId}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Enviado: {new Date(submission.submittedAt).toLocaleDateString('es')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {new Date(submission.submittedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">puntuación total</p>
              <p className="text-3xl font-bold">{totalScore}</p>
              <p className="text-xs text-muted-foreground">
                de {caseStudy.rubric?.reduce((sum, r) => sum + r.maxPoints, 0) || 100} pts
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Split View: Submission + Rubric */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Student Submission */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Entrega del estudiante</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="content">
              <TabsList className="mb-4">
                <TabsTrigger value="content">Contenido</TabsTrigger>
                <TabsTrigger value="bibliography">bibliografía</TabsTrigger>
                <TabsTrigger value="searches">Búsquedas</TabsTrigger>
              </TabsList>

              <TabsContent value="content">
                <ScrollArea className="h-[500px] border rounded-lg p-4">
                  <div className="prose prose-sm max-w-none">
                    {submission.content || (
                      <p className="text-muted-foreground italic">
                        El estudiante no ha incluido contenido escrito en su entrega.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="bibliography">
                <ScrollArea className="h-[500px] border rounded-lg p-4">
                  {submission.bibliography ? (
                    <pre className="text-sm font-mono whitespace-pre-wrap">
                      {submission.bibliography}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground italic">
                      No se incluy? bibliografía
                    </p>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="searches">
                <ScrollArea className="h-[500px] border rounded-lg p-4">
                  {submission.searchQueries && submission.searchQueries.length > 0 ? (
                    <div className="space-y-3">
                      {submission.searchQueries.map((query, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-muted">
                          <p className="font-mono text-sm">{query}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">
                      No se registraron Búsquedas
                    </p>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Right: Evaluation Rubric */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">rúbrica de evaluación</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[540px] pr-4">
              <div className="space-y-6">
                {caseStudy.rubric?.map((rubricItem) => {
                  const scoreData = rubricScores.find((s) => s.criteriaId === rubricItem.id)
                  return (
                    <div key={rubricItem.id} className="space-y-3 pb-4 border-b last:border-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{rubricItem.criteria}</h4>
                          <Badge variant="outline" className="mt-1">
                            {competencyConfig[rubricItem.competency].label}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">
                            {Math.round((scoreData?.score || 0) / 100 * rubricItem.maxPoints)}
                          </p>
                          <p className="text-xs text-muted-foreground">/ {rubricItem.maxPoints} pts</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">puntuación</span>
                          <span>{scoreData?.score || 0}%</span>
                        </div>
                        <Slider
                          value={[scoreData?.score || 0]}
                          onValueChange={([value]) =>
                            updateRubricScore(rubricItem.id, { score: value })
                          }
                          max={100}
                          step={5}
                          className="py-2"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Necesita mejorar</span>
                          <span>Excelente</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Retroalimentación</Label>
                        <Textarea
                          placeholder="Añade comentarios específicos..."
                          className="min-h-[60px] text-sm"
                          value={scoreData?.feedback || ''}
                          onChange={(e) =>
                            updateRubricScore(rubricItem.id, { feedback: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Competency Feedback */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Retroalimentación por competencia</CardTitle>
          <CardDescription>
            Proporciona comentarios específicos para cada ?rea de competencia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-3">
            {(Object.keys(competencyConfig) as CompetencyType[]).map((comp) => {
              const Icon = competencyConfig[comp].icon
              const feedback = competencyFeedback.find((fb) => fb.competency === comp)

              return (
                <Card key={comp}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon className="h-5 w-5" />
                      {competencyConfig[comp].label}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {competencyConfig[comp].description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="Escribe tu Retroalimentación..."
                      className="min-h-[100px] text-sm"
                      value={feedback?.comment || ''}
                      onChange={(e) =>
                        updateCompetencyFeedback(comp, { comment: e.target.value })
                      }
                    />

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Comentarios frecuentes</Label>
                      <div className="flex flex-wrap gap-1">
                        {quickFeedbackTemplates[comp].map((template, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            className="text-xs h-auto py-1 px-2 bg-transparent"
                            onClick={() => addQuickFeedback(comp, template)}
                          >
                            {template}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* General Feedback and Audio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Retroalimentación general
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Escribe comentarios generales sobre la entrega del estudiante..."
            className="min-h-[120px]"
            value={generalFeedback}
            onChange={(e) => setGeneralFeedback(e.target.value)}
          />

          <div className="flex items-center gap-4">
            <Button
              variant={isRecording ? 'destructive' : 'outline'}
              onClick={toggleRecording}
              className="gap-2"
            >
              {isRecording ? (
                <>
                  <MicOff className="h-4 w-4" />
                  Detener grabación
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Grabar audio
                </>
              )}
            </Button>
            {isRecording && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                Grabando...
              </div>
            )}
          </div>
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
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
      </div>

      <Skeleton className="h-24 w-full" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[600px]" />
        <Skeleton className="h-[600px]" />
      </div>
    </div>
  )
}
