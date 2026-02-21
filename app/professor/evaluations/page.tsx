'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { evaluationApi } from '@/lib/api'
import { ApiHttpError } from '@/lib/api-client'
import type { CaseSubmission, CompetencyType } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  ClipboardCheck,
  Clock,
  CheckCircle2,
  RotateCcw,
  Search,
  FileText,
  MessageSquare,
  Mic,
  Save,
  Send,
  Loader2,
  ArrowLeft,
  ArrowRight,
  User,
  Calendar,
  Target,
  AlertCircle,
} from 'lucide-react'

const competencyConfig: Record<
  CompetencyType,
  { label: string; description: string }
> = {
  access: {
    label: 'Acceso a la información',
    description: 'Uso de operadores booleanos y Términos MeSH',
  },
  process: {
    label: 'Procesamiento',
    description: 'evaluación crítica de la evidencia',
  },
  communicate: {
    label: 'Comunicación',
    description: 'citación y formato de bibliografía',
  },
}

export default function ProfessorEvaluationsPage() {
  const [submissions, setSubmissions] = useState<CaseSubmission[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<CaseSubmission | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('pending')
  const [error, setError] = useState<string | null>(null)

  // Evaluation form state
  const [scores, setScores] = useState<Record<CompetencyType, number>>({
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

  const loadSubmissions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [pendingResult, reviewedResult] = await Promise.allSettled([
        evaluationApi.getPending(),
        evaluationApi.getReviewed(),
      ])
      const pending = pendingResult.status === 'fulfilled' ? pendingResult.value : []
      const reviewed = reviewedResult.status === 'fulfilled' ? reviewedResult.value : []
      setSubmissions([...pending, ...reviewed])
      if (pendingResult.status === 'rejected' || reviewedResult.status === 'rejected') {
        setError('No se pudieron cargar todas las entregas.')
      }
    } catch (err) {
      console.error('[professor evaluations] Error loading submissions:', err)
      setError('No se pudieron cargar las entregas.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSubmissions()
  }, [loadSubmissions])

  const handleSelectSubmission = useCallback((submission: CaseSubmission) => {
    setSelectedSubmission(submission)
    // Reset form
    setScores({ access: 0, process: 0, communicate: 0 })
    setComments({ access: '', process: '', communicate: '' })
    setGeneralFeedback('')
  }, [])

  const handleSubmitEvaluation = useCallback(async () => {
    if (!selectedSubmission) return

    const totalScore = Math.round(
      (scores.access + scores.process + scores.communicate) / 3
    )

    setIsSubmitting(true)
    setError(null)
    try {
      await evaluationApi.submit(selectedSubmission.id, {
        submissionId: selectedSubmission.id,
        professorId: '', // Will be set by backend
        scores,
        comments,
        overallScore: totalScore,
        feedback: generalFeedback,
      })

      await loadSubmissions()
      setSelectedSubmission(null)
    } catch (err) {
      console.error('[v0] Error submitting evaluation:', err)
      if (err instanceof ApiHttpError) {
        setError(err.details || err.message)
      } else {
        setError('No se pudo enviar la evaluacion.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedSubmission, scores, comments, generalFeedback, loadSubmissions])

  const pendingSubmissions = useMemo(
    () => submissions.filter((s) => s.status === 'pending'),
    [submissions]
  )
  const reviewedSubmissions = useMemo(
    () => submissions.filter((s) => s.status === 'reviewed'),
    [submissions]
  )

  if (isLoading) {
    return <EvaluationsSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <ClipboardCheck className="h-8 w-8 text-primary" />
          Evaluaciones
        </h1>
        <p className="text-muted-foreground mt-1">
          Revisa y evalúa las entregas de tus estudiantes
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Submissions List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Entregas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="px-6">
                <TabsList className="w-full">
                  <TabsTrigger value="pending" className="flex-1 gap-1">
                    <Clock className="h-4 w-4" />
                    Pendientes ({pendingSubmissions.length})
                  </TabsTrigger>
                  <TabsTrigger value="reviewed" className="flex-1 gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    Evaluadas
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="pending" className="mt-0">
                <ScrollArea className="h-[calc(100vh-350px)]">
                  <div className="p-4 space-y-2">
                    {pendingSubmissions.map((submission) => (
                      <button
                        key={submission.id}
                        className={`w-full text-left p-4 rounded-lg transition-colors ${
                          selectedSubmission?.id === submission.id
                            ? 'bg-primary/10 border border-primary/30'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => handleSelectSubmission(submission)}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>ES</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              Estudiante #{submission.studentId.slice(0, 6)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Caso #{submission.caseId.slice(0, 6)}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(submission.submittedAt).toLocaleDateString('es')}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}

                    {pendingSubmissions.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success" />
                        <p className="text-sm">No hay entregas pendientes</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="reviewed" className="mt-0">
                <ScrollArea className="h-[calc(100vh-350px)]">
                  <div className="p-4 space-y-2">
                    {reviewedSubmissions.map((submission) => (
                      <div
                        key={submission.id}
                        className="p-4 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>ES</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              Estudiante #{submission.studentId.slice(0, 6)}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-success border-success">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Evaluado
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {reviewedSubmissions.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No hay evaluaciones completadas</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Evaluation Panel */}
        <Card className="lg:col-span-2">
          {selectedSubmission ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Evaluar entrega</CardTitle>
                    <CardDescription>
                      Caso #{selectedSubmission.caseId.slice(0, 8)} - Estudiante #
                      {selectedSubmission.studentId.slice(0, 8)}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSubmission(null)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Cerrar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Student Submission */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Respuesta del estudiante</Label>
                      <ScrollArea className="h-[300px] mt-2 border rounded-lg">
                        <div className="p-4 text-sm whitespace-pre-wrap">
                          {selectedSubmission.content || 'Sin contenido'}
                        </div>
                      </ScrollArea>
                    </div>

                    {selectedSubmission.bibliography && (
                      <div>
                        <Label className="text-sm font-medium">bibliografía</Label>
                        <ScrollArea className="h-[100px] mt-2 border rounded-lg">
                          <pre className="p-4 text-xs font-mono">
                            {selectedSubmission.bibliography}
                          </pre>
                        </ScrollArea>
                      </div>
                    )}
                  </div>

                  {/* Evaluation Form */}
                  <div className="space-y-6">
                    {/* Competency Scores */}
                    {(Object.keys(competencyConfig) as CompetencyType[]).map(
                      (competency) => (
                        <div key={competency} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-sm font-medium">
                                {competencyConfig[competency].label}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {competencyConfig[competency].description}
                              </p>
                            </div>
                            <Badge variant="outline" className="font-mono">
                              {scores[competency]}/100
                            </Badge>
                          </div>
                          <Slider
                            value={[scores[competency]]}
                            onValueChange={([value]) =>
                              setScores((prev) => ({ ...prev, [competency]: value }))
                            }
                            max={100}
                            step={5}
                            className="w-full"
                          />
                          <Textarea
                            placeholder={`Comentarios sobre ${competencyConfig[competency].label.toLowerCase()}...`}
                            value={comments[competency]}
                            onChange={(e) =>
                              setComments((prev) => ({
                                ...prev,
                                [competency]: e.target.value,
                              }))
                            }
                            className="min-h-[60px] text-sm"
                          />
                        </div>
                      )
                    )}

                    {/* General Feedback */}
                    <div className="space-y-2 pt-4 border-t">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Retroalimentación general
                      </Label>
                      <Textarea
                        placeholder="Escribe un comentario general sobre el trabajo del estudiante..."
                        value={generalFeedback}
                        onChange={(e) => setGeneralFeedback(e.target.value)}
                        className="min-h-[100px]"
                      />
                    </div>

                    {/* Overall Score */}
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">puntuación total</span>
                        <span className="text-2xl font-bold text-primary">
                          {Math.round(
                            (scores.access + scores.process + scores.communicate) / 3
                          )}
                          /100
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <Button
                        className="flex-1"
                        onClick={handleSubmitEvaluation}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Enviar evaluación
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-col items-center justify-center min-h-[500px] text-center">
              <div className="p-4 rounded-full bg-muted mb-4">
                <ClipboardCheck className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Selecciona una entrega</h3>
              <p className="text-muted-foreground max-w-sm">
                Elige una entrega de la lista para comenzar a evaluarla
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}

function EvaluationsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="flex items-center justify-center min-h-[500px]">
            <Skeleton className="h-32 w-48" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
