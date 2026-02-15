'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { casesApi } from '@/lib/api'
import type { CaseAssignableStudent, CaseStudy, CaseDifficulty, CaseStatus } from '@/types'
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

export default function ProfessorCaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const caseId = useMemo(() => {
    const rawId = params?.id
    if (Array.isArray(rawId)) return rawId[0] ?? ''
    return rawId ? String(rawId) : ''
  }, [params])

  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assignableStudents, setAssignableStudents] = useState<CaseAssignableStudent[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [studentSearch, setStudentSearch] = useState('')
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)

  useEffect(() => {
    if (!caseId) return
    let mounted = true
    setIsLoading(true)
    casesApi
      .getById(caseId)
      .then((data) => {
        if (mounted) {
          setCaseStudy(data)
          setError(null)
        }
      })
      .catch((err) => {
        console.error('[v0] Error loading case:', err)
        if (mounted) {
          setError('No se pudo cargar el caso de estudio.')
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [caseId])

  useEffect(() => {
    let mounted = true
    setIsLoadingStudents(true)
    casesApi
      .getAssignableStudents()
      .then((students) => {
        if (!mounted) return
        setAssignableStudents(students.filter((student) => student.active))
      })
      .catch((err) => {
        console.error('[v0] Error loading assignable students:', err)
      })
      .finally(() => {
        if (!mounted) return
        setIsLoadingStudents(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!caseStudy) return
    setSelectedStudentIds(caseStudy.assignedStudents ?? [])
  }, [caseStudy])

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase()
    if (!query) return assignableStudents
    return assignableStudents.filter((student) => {
      const fullName = student.fullName.toLowerCase()
      const email = student.email.toLowerCase()
      const username = student.username.toLowerCase()
      return fullName.includes(query) || email.includes(query) || username.includes(query)
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
    } catch (err) {
      console.error('[v0] Error assigning students:', err)
      setError('No se pudo actualizar la asignacion de estudiantes.')
    } finally {
      setIsAssigning(false)
    }
  }, [caseStudy, selectedStudentIds])

  const handleStatusChange = async (status: CaseStatus) => {
    if (!caseStudy) return
    setIsUpdating(true)
    try {
      const updated = await casesApi.update(caseStudy.id, { status })
      setCaseStudy(updated)
    } catch (err) {
      console.error('[v0] Error updating case status:', err)
      setError('No se pudo actualizar el estado del caso.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!caseStudy) return
    const confirmed = window.confirm(`Eliminar el caso "${caseStudy.title}"?`)
    if (!confirmed) return
    setIsUpdating(true)
    try {
      await casesApi.delete(caseStudy.id)
      router.push('/professor/cases')
    } catch (err) {
      console.error('[v0] Error deleting case:', err)
      setError('No se pudo eliminar el caso.')
    } finally {
      setIsUpdating(false)
    }
  }

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
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline" className={difficultyConfig[caseStudy.difficulty].color}>
                {difficultyConfig[caseStudy.difficulty].label}
              </Badge>
              <Badge variant="outline" className={statusConfig[caseStudy.status].color}>
                {statusConfig[caseStudy.status].label}
              </Badge>
              {caseStudy.dueDate && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(caseStudy.dueDate).toLocaleDateString('es', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
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
            <Button onClick={() => handleStatusChange('active')} disabled={isUpdating}>
              Activar
            </Button>
          )}
          {caseStudy.status !== 'archived' && (
            <Button variant="secondary" onClick={() => handleStatusChange('archived')} disabled={isUpdating}>
              <Archive className="mr-2 h-4 w-4" />
              Archivar
            </Button>
          )}
          <Button variant="destructive" onClick={handleDelete} disabled={isUpdating}>
            Eliminar
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Escenario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{caseStudy.scenario}</p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recursos obligatorios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {caseStudy.requiredArticles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin articulos obligatorios.</p>
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
              <p className="text-sm text-muted-foreground">Sin articulos opcionales.</p>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
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
            onChange={(e) => setStudentSearch(e.target.value)}
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
          <Button onClick={handleSaveAssignments} disabled={isAssigning}>
            {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar asignacion
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preguntas guia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {caseStudy.guidingQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin preguntas registradas.</p>
          ) : (
            caseStudy.guidingQuestions.map((question) => (
              <div key={question.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{question.question}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Competencia: {question.competency} - {question.points} pts
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rubrica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {caseStudy.rubric.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin rubrica definida.</p>
          ) : (
            caseStudy.rubric.map((item) => (
              <div key={item.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{item.criteria}</Badge>
                  <Badge variant="outline">{item.competency}</Badge>
                  <span className="text-xs text-muted-foreground">{item.maxPoints} pts</span>
                </div>
                <Separator />
                <div className="grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground">
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

