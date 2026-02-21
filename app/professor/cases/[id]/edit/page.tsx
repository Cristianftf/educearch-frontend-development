'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { casesApi } from '@/lib/api'
import { ApiHttpError } from '@/lib/api-client'
import type { CaseDifficulty, CaseStatus, GuidingQuestion, RubricItem } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react'

const difficultyConfig: Record<CaseDifficulty, { label: string; color: string }> = {
  novice: { label: 'Novato', color: 'bg-success/10 text-success border-success/30' },
  intermediate: { label: 'Intermedio', color: 'bg-warning/10 text-warning border-warning/30' },
  advanced: { label: 'Avanzado', color: 'bg-destructive/10 text-destructive border-destructive/30' },
}

const statusLabels: Record<CaseStatus, string> = {
  draft: 'Borrador',
  active: 'Activo',
  archived: 'Archivado',
}

const toDateInput = (value?: string) => (value ? value.split('T')[0] : '')

export default function EditCasePage() {
  const params = useParams()
  const router = useRouter()
  const caseId = useMemo(() => {
    const rawId = params?.id
    if (Array.isArray(rawId)) return rawId[0] ?? ''
    return rawId ? String(rawId) : ''
  }, [params])

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [scenario, setScenario] = useState('')
  const [difficulty, setDifficulty] = useState<CaseDifficulty>('novice')
  const [status, setStatus] = useState<CaseStatus>('draft')
  const [dueDate, setDueDate] = useState('')
  const [assignedStudents, setAssignedStudents] = useState<string[]>([])

  const [requiredArticles, setRequiredArticles] = useState<string[]>([])
  const [optionalArticles, setOptionalArticles] = useState<string[]>([])
  const [newRequiredArticle, setNewRequiredArticle] = useState('')
  const [newOptionalArticle, setNewOptionalArticle] = useState('')

  const [guidingQuestions, setGuidingQuestions] = useState<GuidingQuestion[]>([])
  const [rubricItems, setRubricItems] = useState<RubricItem[]>([])

  useEffect(() => {
    if (!caseId) return
    let mounted = true
    setIsLoading(true)
    casesApi
      .getById(caseId)
      .then((data) => {
        if (!mounted) return
        setTitle(data.title)
        setScenario(data.scenario)
        setDifficulty(data.difficulty)
        setStatus(data.status)
        setDueDate(toDateInput(data.dueDate))
        setAssignedStudents(data.assignedStudents ?? [])
        setRequiredArticles(data.requiredArticles ?? [])
        setOptionalArticles(data.optionalArticles ?? [])
        setGuidingQuestions(data.guidingQuestions ?? [])
        setRubricItems(data.rubric ?? [])
      })
      .catch((err) => {
        console.error('[v0] Error loading case:', err)
        if (mounted) setError('No se pudo cargar el caso de estudio.')
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [caseId])

  const addRequiredArticle = useCallback(() => {
    const value = newRequiredArticle.trim()
    if (!value) return
    setRequiredArticles((prev) => [...prev, value])
    setNewRequiredArticle('')
  }, [newRequiredArticle])

  const addOptionalArticle = useCallback(() => {
    const value = newOptionalArticle.trim()
    if (!value) return
    setOptionalArticles((prev) => [...prev, value])
    setNewOptionalArticle('')
  }, [newOptionalArticle])

  const addQuestion = useCallback(() => {
    setGuidingQuestions((prev) => [
      ...prev,
      { id: Date.now().toString(), question: '', competency: 'access', points: 10 },
    ])
  }, [])

  const updateQuestion = useCallback((id: string, updates: Partial<GuidingQuestion>) => {
    setGuidingQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...updates } : q)))
  }, [])

  const removeQuestion = useCallback((id: string) => {
    setGuidingQuestions((prev) => prev.filter((q) => q.id !== id))
  }, [])

  const addRubricItem = useCallback(() => {
    setRubricItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        criteria: '',
        competency: 'access',
        maxPoints: 10,
        levels: {
          excellent: '',
          good: '',
          needs_improvement: '',
        },
      },
    ])
  }, [])

  const updateRubricItem = useCallback((id: string, updates: Partial<RubricItem>) => {
    setRubricItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)))
  }, [])

  const removeRubricItem = useCallback((id: string) => {
    setRubricItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const handleSave = useCallback(async () => {
    if (!caseId) return
    const trimmedTitle = title.trim()
    const trimmedScenario = scenario.trim()
    if (trimmedTitle.length < 3) {
      setError('El titulo debe tener al menos 3 caracteres.')
      return
    }
    if (trimmedScenario.length < 10) {
      setError('El escenario debe tener al menos 10 caracteres.')
      return
    }
    if (status === 'active' && assignedStudents.length === 0) {
      setError('No puedes activar un caso sin estudiantes asignados.')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      await casesApi.update(caseId, {
        title: trimmedTitle,
        scenario: trimmedScenario,
        difficulty,
        status,
        requiredArticles,
        optionalArticles,
        guidingQuestions: guidingQuestions.filter((q) => q.question.trim()),
        rubric: rubricItems,
        dueDate: dueDate || undefined,
        assignedStudents,
      })
      router.push(`/professor/cases/${caseId}`)
    } catch (err) {
      console.error('[v0] Error saving case:', err)
      if (err instanceof ApiHttpError) {
        setError(err.details || err.message)
      } else {
        setError('No se pudo guardar el caso.')
      }
    } finally {
      setIsSaving(false)
    }
  }, [
    caseId,
    title,
    scenario,
    difficulty,
    status,
    requiredArticles,
    optionalArticles,
    guidingQuestions,
    rubricItems,
    dueDate,
    assignedStudents,
    router,
  ])

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando caso...</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/professor/cases/${caseId}`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Editar caso</h1>
            <p className="text-sm text-muted-foreground">Actualiza la información del caso de estudio.</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">información general</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scenario">Escenario clínico</Label>
            <Textarea
              id="scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              className="min-h-[180px]"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Dificultad</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as CaseDifficulty)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(difficultyConfig) as CaseDifficulty[]).map((level) => (
                    <SelectItem key={level} value={level}>
                      <Badge variant="outline" className={difficultyConfig[level].color}>
                        {difficultyConfig[level].label}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CaseStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(statusLabels) as CaseStatus[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {statusLabels[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Fecha de entrega</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recursos</CardTitle>
          <CardDescription>Agrega o elimina identificadores de artículos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>artículos obligatorios</Label>
            <div className="flex gap-2">
              <Input
                placeholder="añadir PMID o ID"
                value={newRequiredArticle}
                onChange={(e) => setNewRequiredArticle(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={addRequiredArticle}>
                añadir
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {requiredArticles.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin artículos obligatorios.</p>
              ) : (
                requiredArticles.map((article, index) => (
                  <Badge key={`${article}-${index}`} variant="secondary" className="gap-2">
                    {article}
                    <button
                      type="button"
                      onClick={() =>
                        setRequiredArticles((prev) => prev.filter((item) => item !== article))
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label>artículos opcionales</Label>
            <div className="flex gap-2">
              <Input
                placeholder="añadir PMID o ID"
                value={newOptionalArticle}
                onChange={(e) => setNewOptionalArticle(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={addOptionalArticle}>
                añadir
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {optionalArticles.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin artículos opcionales.</p>
              ) : (
                optionalArticles.map((article, index) => (
                  <Badge key={`${article}-${index}`} variant="outline" className="gap-2">
                    {article}
                    <button
                      type="button"
                      onClick={() =>
                        setOptionalArticles((prev) => prev.filter((item) => item !== article))
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Preguntas guía</CardTitle>
              <CardDescription>Actualiza las preguntas para los estudiantes.</CardDescription>
            </div>
            <Button variant="outline" onClick={addQuestion}>
              <Plus className="mr-2 h-4 w-4" />
              añadir pregunta
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {guidingQuestions.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay preguntas registradas.</p>
          )}
          {guidingQuestions.map((question, index) => (
            <div key={question.id} className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{index + 1}</Badge>
                <Input
                  placeholder="Pregunta..."
                  value={question.question}
                  onChange={(e) => updateQuestion(question.id, { question: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Competencia</Label>
                  <Select
                    value={question.competency}
                    onValueChange={(v) =>
                      updateQuestion(question.id, { competency: v as GuidingQuestion['competency'] })
                    }
                  >
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="access">Acceso</SelectItem>
                      <SelectItem value="process">Procesamiento</SelectItem>
                      <SelectItem value="communicate">Comunicación</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Puntos</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    className="w-20 h-8"
                    value={question.points}
                    onChange={(e) =>
                      updateQuestion(question.id, { points: parseInt(e.target.value) || 0 })
                    }
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeQuestion(question.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">rúbrica de evaluación</CardTitle>
              <CardDescription>Define criterios y niveles de desempeño.</CardDescription>
            </div>
            <Button variant="outline" onClick={addRubricItem}>
              <Plus className="mr-2 h-4 w-4" />
              añadir criterio
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {rubricItems.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay criterios definidos.</p>
          )}
          {rubricItems.map((item) => (
            <Card key={item.id} className="border-2">
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        placeholder="Nombre del criterio"
                        value={item.criteria}
                        onChange={(e) => updateRubricItem(item.id, { criteria: e.target.value })}
                        className="font-medium"
                      />
                      <Select
                        value={item.competency}
                        onValueChange={(v) =>
                          updateRubricItem(item.id, { competency: v as RubricItem['competency'] })
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="access">Acceso</SelectItem>
                          <SelectItem value="process">Procesamiento</SelectItem>
                          <SelectItem value="communicate">Comunicación</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          className="w-20"
                          value={item.maxPoints}
                          onChange={(e) =>
                            updateRubricItem(item.id, { maxPoints: parseInt(e.target.value) || 0 })
                          }
                        />
                        <span className="text-sm text-muted-foreground">pts</span>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-success">Excelente</Label>
                        <Textarea
                          placeholder="Describe el desempeño excelente..."
                          className="min-h-[80px] text-sm"
                          value={item.levels.excellent}
                          onChange={(e) =>
                            updateRubricItem(item.id, {
                              levels: { ...item.levels, excellent: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-warning">Bueno</Label>
                        <Textarea
                          placeholder="Describe el desempeño bueno..."
                          className="min-h-[80px] text-sm"
                          value={item.levels.good}
                          onChange={(e) =>
                            updateRubricItem(item.id, {
                              levels: { ...item.levels, good: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-destructive">Necesita mejorar</Label>
                        <Textarea
                          placeholder="Describe el desempeño a mejorar..."
                          className="min-h-[80px] text-sm"
                          value={item.levels.needs_improvement}
                          onChange={(e) =>
                            updateRubricItem(item.id, {
                              levels: { ...item.levels, needs_improvement: e.target.value },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeRubricItem(item.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
