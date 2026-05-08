'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { casesApi } from '@/lib/api'
import type { CaseAssignableStudent, CaseDifficulty, CaseStatus, CaseStudy, CaseSubmission } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowLeft,
  Archive,
  Calendar,
  Edit,
  FileText,
  Loader2,
  Users,
} from 'lucide-react'

const statusConfig: Record<CaseStatus, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'bg-muted text-muted-foreground' },
  active: { label: 'Activo', color: 'bg-success/10 text-success border-success/30' },
  archived: { label: 'Archivado', color: 'bg-secondary text-secondary-foreground' },
}

const difficultyConfig: Record<CaseDifficulty, { label: string; color: string }> = {
  novice: { label: 'Novato', color: 'bg-success/10 text-success border-success/30' },
  intermediate: { label: 'Intermedio', color: 'bg-warning/10 text-warning border-warning/30' },
  advanced: { label: 'Avanzado', color: 'bg-destructive/10 text-destructive border-destructive/30' },
}

function parseCalendarDateUtc(value: string): Date {
  const datePart = value.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [year, month, day] = datePart.split('-').map((item) => parseInt(item, 10))
    return new Date(Date.UTC(year, month - 1, day))
  }
  return new Date(value)
}

const formatSubmissionDate = (value?: string) => {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Sin fecha'
    : date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function ProfessorCaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const caseId = useMemo(() => {
    const rawId = params?.id
    if (Array.isArray(rawId)) return rawId[0] ?? ''
    return rawId ? String(rawId) : ''
  }, [params])

  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null)
  const [submissions, setSubmissions] = useState<CaseSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assignableStudents, setAssignableStudents] = useState<CaseAssignableStudent[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [studentSearch, setStudentSearch] = useState('')
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)

  const loadCase = useCallback(async () => {
    if (!caseId) return
    setIsLoading(true)
    setError(null)
    try {
      const [caseResponse, submissionsResponse] = await Promise.all([
        casesApi.getById(caseId),
        casesApi.getSubmissions(caseId).catch(() => []),
      ])
      setCaseStudy(caseResponse)
      setSubmissions(submissionsResponse)
      setSelectedStudentIds(caseResponse.assignedStudents ?? [])
    } catch (loadError) {
      console.error('[professor case detail] Error loading case:', loadError)
      setError('No se pudo cargar el caso de estudio.')
    } finally {
      setIsLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    void loadCase()
  }, [loadCase])

  useEffect(() => {
    let mounted = true
    setIsLoadingStudents(true)

    casesApi
      .getAssignableStudents()
      .then((students) => {
        if (!mounted) return
        setAssignableStudents(students.filter((student) => student.active))
      })
      .catch((loadError) => {
        console.error('[professor case detail] Error loading assignable students:', loadError)
      })
      .finally(() => {
        if (!mounted) return
        setIsLoadingStudents(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase()
    if (!query) return assignableStudents
    return assignableStudents.filter((student) => {
      const haystack = `${student.fullName} ${student.email} ${student.username}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [assignableStudents, studentSearch])

  const toggleStudent = useCallback((studentId: string, checked: boolean) => {
    setSelectedStudentIds((prev) => {
      if (checked) {
        return prev.includes(studentId) ? prev : [...prev, studentId]
      }
      return prev.filter((id) => id !== studentId)
    })
  }, [])

  const handleSaveAssignments = useCallback(async () => {
    if (!caseStudy) return
    setIsAssigning(true)
    setError(null)
    try {
      const updated = await casesApi.assign(caseStudy.id, selectedStudentIds)
      setCaseStudy(updated)
    } catch (assignError) {
      console.error('[professor case detail] Error assigning students:', assignError)
      setError('No se pudo actualizar la asignación de estudiantes.')
    } finally {
      setIsAssigning(false)
    }
  }, [caseStudy, selectedStudentIds])

  const handleStatusChange = useCallback(
    async (status: CaseStatus) => {
      if (!caseStudy) return
      if (status === 'active' && selectedStudentIds.length === 0) {
        setError('No puedes activar un caso sin estudiantes asignados.')
        return
      }

      setIsUpdating(true)
      setError(null)
      try {
        const updated = await casesApi.update(caseStudy.id, { status })
        setCaseStudy(updated)
      } catch (updateError) {
        console.error('[professor case detail] Error updating case status:', updateError)
        setError('No se pudo actualizar el estado del caso.')
      } finally {
        setIsUpdating(false)
      }
    },
    [caseStudy, selectedStudentIds.length]
  )

  const handleDelete = useCallback(async () => {
    if (!caseStudy) return
    const confirmed = window.confirm(`¿Eliminar el caso "${caseStudy.title}"?`)
    if (!confirmed) return

    setIsUpdating(true)
    try {
      await casesApi.delete(caseStudy.id)
      router.push('/professor/cases')
    } catch (deleteError) {
      console.error('[professor case detail] Error deleting case:', deleteError)
      setError('No se pudo eliminar el caso.')
    } finally {
      setIsUpdating(false)
    }
  }, [caseStudy, router])

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando caso...</p>
  }

  if (!caseStudy) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost">
          <Link href="/professor/cases">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <p className="text-sm text-destructive">{error || 'Caso no encontrado.'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/professor/cases">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{caseStudy.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={difficultyConfig[caseStudy.difficulty].color}>
                {difficultyConfig[caseStudy.difficulty].label}
              </Badge>
              <Badge variant="outline" className={statusConfig[caseStudy.status].color}>
                {statusConfig[caseStudy.status].label}
              </Badge>
              {caseStudy.dueDate && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {parseCalendarDateUtc(caseStudy.dueDate).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'UTC',
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" disabled={isUpdating}>
            <Link href={`/professor/cases/${caseStudy.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
          {caseStudy.status !== 'active' && (
            <Button onClick={() => void handleStatusChange('active')} disabled={isUpdating}>
              Activar
            </Button>
          )}
          {caseStudy.status !== 'archived' && (
            <Button variant="secondary" onClick={() => void handleStatusChange('archived')} disabled={isUpdating}>
              <Archive className="mr-2 h-4 w-4" />
              Archivar
            </Button>
          )}
          <Button variant="destructive" onClick={() => void handleDelete()} disabled={isUpdating}>
            Eliminar
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Escenario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{caseStudy.scenario}</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recursos obligatorios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {caseStudy.requiredArticles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin artículos obligatorios.</p>
            ) : (
              caseStudy.requiredArticles.map((article, index) => (
                <Badge key={`${article}-${index}`} variant="secondary">
                  {article}
                </Badge>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recursos opcionales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {caseStudy.optionalArticles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin artículos opcionales.</p>
            ) : (
              caseStudy.optionalArticles.map((article, index) => (
                <Badge key={`${article}-${index}`} variant="outline">
                  {article}
                </Badge>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Estudiantes asignados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {selectedStudentIds.length} estudiante(s) asignado(s).
            </p>
            <Input
              placeholder="Buscar estudiante..."
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
            />
            <ScrollArea className="h-52 rounded-md border px-3 py-2">
              {isLoadingStudents ? (
                <p className="text-sm text-muted-foreground">Cargando estudiantes...</p>
              ) : filteredStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay estudiantes disponibles.</p>
              ) : (
                <div className="space-y-2">
                  {filteredStudents.map((student) => {
                    const isChecked = selectedStudentIds.includes(student.id)
                    return (
                      <label
                        key={student.id}
                        className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => toggleStudent(student.id, Boolean(checked))}
                        />
                        <span className="text-sm leading-tight">
                          <span className="block font-medium">{student.fullName}</span>
                          <span className="block text-xs text-muted-foreground">
                            {student.email || student.username}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
            <Button onClick={() => void handleSaveAssignments()} disabled={isAssigning}>
              {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar asignación
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Entregas del caso</CardTitle>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay entregas asociadas a este caso.</p>
            ) : (
              <div className="space-y-3">
                {submissions.map((submission) => (
                  <div key={submission.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium">Estudiante #{submission.studentId}</p>
                        <p className="text-xs text-muted-foreground">
                          Enviado: {formatSubmissionDate(submission.submittedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={submission.status === 'reviewed' ? 'secondary' : 'outline'}>
                          {submission.status === 'reviewed' ? 'Revisado' : 'Pendiente'}
                        </Badge>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/professor/evaluations/${submission.id}`}>Abrir evaluación</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preguntas guía</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {caseStudy.guidingQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin preguntas registradas.</p>
          ) : (
            caseStudy.guidingQuestions.map((question) => (
              <div key={question.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{question.question}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Competencia: {question.competency} · {question.points} pts
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rúbrica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {caseStudy.rubric.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin rúbrica definida.</p>
          ) : (
            caseStudy.rubric.map((item) => (
              <div key={item.id} className="space-y-2 rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.criteria}</Badge>
                  <Badge variant="outline">{item.competency}</Badge>
                  <span className="text-xs text-muted-foreground">{item.maxPoints} pts</span>
                </div>
                <Separator />
                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  <div>
                    <p className="font-medium text-success">Excelente</p>
                    <p>{item.levels.excellent || '-'}</p>
                  </div>
                  <div>
                    <p className="font-medium text-warning">Bueno</p>
                    <p>{item.levels.good || '-'}</p>
                  </div>
                  <div>
                    <p className="font-medium text-destructive">Necesita mejorar</p>
                    <p>{item.levels.needs_improvement || '-'}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
