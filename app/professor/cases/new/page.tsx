'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { casesApi, searchApi } from '@/lib/api'
import type {
  CaseAssignableStudent,
  CaseDifficulty,
  GuidingQuestion,
  RubricItem,
  SearchResult,
} from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Save,
  FileText,
  BookOpen,
  HelpCircle,
  ClipboardList,
  Plus,
  Trash2,
  Search,
  Loader2,
  Users,
  Calendar,
  AlertCircle,
  GripVertical,
  ImageIcon,
  Bold,
  Italic,
  List,
  Link as LinkIcon,
} from 'lucide-react'

const difficultyConfig: Record<CaseDifficulty, { label: string; description: string; color: string }> = {
  novice: {
    label: 'Novato',
    description: 'Conceptos bÃ¡sicos, BÃºsquedas simples',
    color: 'bg-success/10 text-success border-success/30',
  },
  intermediate: {
    label: 'Intermedio',
    description: 'Operadores booleanos, filtros avanzados',
    color: 'bg-warning/10 text-warning border-warning/30',
  },
  advanced: {
    label: 'Avanzado',
    description: 'Estrategias complejas, evaluaciÃ³n crÃ­tica',
    color: 'bg-destructive/10 text-destructive border-destructive/30',
  },
}

export default function NewCasePage() {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [currentTab, setCurrentTab] = useState('scenario')

  // Form state
  const [title, setTitle] = useState('')
  const [scenario, setScenario] = useState('')
  const [difficulty, setDifficulty] = useState<CaseDifficulty>('novice')
  const [dueDate, setDueDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Articles state
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [requiredArticles, setRequiredArticles] = useState<SearchResult[]>([])
  const [optionalArticles, setOptionalArticles] = useState<SearchResult[]>([])

  // Assignment state
  const [assignableStudents, setAssignableStudents] = useState<CaseAssignableStudent[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [studentSearchTerm, setStudentSearchTerm] = useState('')
  const [isLoadingStudents, setIsLoadingStudents] = useState(false)

  // Questions state
  const [guidingQuestions, setGuidingQuestions] = useState<GuidingQuestion[]>([
    { id: '1', question: '', competency: 'access', points: 10 },
  ])

  // Rubric state
  const [rubricItems, setRubricItems] = useState<RubricItem[]>([
    {
      id: '1',
      criteria: 'Uso de TÃ©rminos MeSH',
      competency: 'access',
      maxPoints: 20,
      levels: {
        excellent: 'Utiliza TÃ©rminos MeSH precisos y relevantes',
        good: 'Utiliza algunos TÃ©rminos MeSH correctamente',
        needs_improvement: 'No utiliza TÃ©rminos MeSH o son incorrectos',
      },
    },
    {
      id: '2',
      criteria: 'evaluaciÃ³n de evidencia',
      competency: 'process',
      maxPoints: 30,
      levels: {
        excellent: 'Identifica correctamente niveles de evidencia y sesgos',
        good: 'Identifica algunos aspectos de la calidad de evidencia',
        needs_improvement: 'No evalÃºa la calidad de la evidencia',
      },
    },
    {
      id: '3',
      criteria: 'Formato de bibliografÃ­a',
      competency: 'communicate',
      maxPoints: 20,
      levels: {
        excellent: 'bibliografÃ­a perfectamente formateada segÃºn norma',
        good: 'bibliografÃ­a con errores menores de formato',
        needs_improvement: 'bibliografÃ­a mal formateada o incompleta',
      },
    },
  ])

  const searchArticles = useCallback(async () => {
    if (searchTerm.length < 2) return

    setIsSearching(true)
    try {
      const queryId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `prof-search-${Date.now()}`
      const session = await searchApi.execute({
        id: queryId,
        terms: [{ id: 'search', term: searchTerm, description: '' }],
        operators: [],
        filters: {},
        rawQuery: searchTerm,
        createdAt: new Date().toISOString(),
      })
      setSearchResults(session.results)
    } catch (err) {
      console.error('[v0] Search error:', err)
    } finally {
      setIsSearching(false)
    }
  }, [searchTerm])

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

  const filteredStudents = useMemo(() => {
    const query = studentSearchTerm.trim().toLowerCase()
    if (!query) return assignableStudents
    return assignableStudents.filter((student) => {
      const fullName = student.fullName.toLowerCase()
      const email = student.email.toLowerCase()
      const username = student.username.toLowerCase()
      return fullName.includes(query) || email.includes(query) || username.includes(query)
    })
  }, [assignableStudents, studentSearchTerm])

  const toggleStudentSelection = useCallback((studentId: string, checked: boolean) => {
    setSelectedStudents((prev) => {
      if (checked) {
        return prev.includes(studentId) ? prev : [...prev, studentId]
      }
      return prev.filter((id) => id !== studentId)
    })
  }, [])

  const addQuestion = useCallback(() => {
    setGuidingQuestions((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        question: '',
        competency: 'access',
        points: 10,
      },
    ])
  }, [])

  const updateQuestion = useCallback((id: string, updates: Partial<GuidingQuestion>) => {
    setGuidingQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
    )
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
    setRubricItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    )
  }, [])

  const removeRubricItem = useCallback((id: string) => {
    setRubricItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const handleSave = useCallback(async (asDraft: boolean = true) => {
    const trimmedTitle = title.trim()
    const trimmedScenario = scenario.trim()

    if (!trimmedTitle || trimmedTitle.length < 3) {
      setFormError('El titulo debe tener al menos 3 caracteres.')
      return
    }
    if (!trimmedScenario || trimmedScenario.length < 20) {
      setFormError('El escenario debe tener al menos 20 caracteres.')
      return
    }
    if (startDate && dueDate && startDate > dueDate) {
      setFormError('La fecha de entrega no puede ser anterior a la fecha de inicio.')
      return
    }
    if (!asDraft && selectedStudents.length === 0) {
      setFormError('Para publicar un caso debes asignarlo al menos a un estudiante.')
      return
    }

    setFormError(null)
    setIsSaving(true)
    try {
      await casesApi.create({
        title: trimmedTitle,
        scenario: trimmedScenario,
        difficulty,
        status: asDraft ? 'draft' : 'active',
        requiredArticles: requiredArticles.map((a) => a.id),
        optionalArticles: optionalArticles.map((a) => a.id),
        guidingQuestions: guidingQuestions.filter((q) => q.question.trim()),
        rubric: rubricItems,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        assignedStudents: selectedStudents,
      })
      router.push('/professor/cases')
    } catch (err) {
      console.error('[v0] Save error:', err)
      setFormError('No se pudo guardar el caso. Intentalo nuevamente.')
    } finally {
      setIsSaving(false)
    }
  }, [
    title,
    scenario,
    difficulty,
    requiredArticles,
    optionalArticles,
    guidingQuestions,
    rubricItems,
    startDate,
    dueDate,
    selectedStudents,
    router,
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/professor/cases">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Crear Caso de Estudio
            </h1>
            <p className="text-muted-foreground mt-1">
              Define el escenario, recursos y criterios de evaluaciÃ³n
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave(true)} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar borrador
          </Button>
          <Button onClick={() => handleSave(false)} disabled={isSaving}>
            Publicar caso
          </Button>
        </div>
      </div>

      {formError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {formError}
          </p>
        </div>
      )}

      {/* Main Content with Tabs */}
      <Tabs value={currentTab} onValueChange={setCurrentTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scenario" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Escenario</span>
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Recursos</span>
          </TabsTrigger>
          <TabsTrigger value="questions" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Preguntas</span>
          </TabsTrigger>
          <TabsTrigger value="rubric" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">rÃºbrica</span>
          </TabsTrigger>
        </TabsList>

        {/* Scenario Tab */}
        <TabsContent value="scenario" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">informaciÃ³n del caso</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">TÃ­tulo del caso</Label>
                    <Input
                      id="title"
                      placeholder="Ej: Manejo de diabetes en paciente geriÃ¡trico"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scenario">Escenario clÃ­nico</Label>
                    <div className="border rounded-lg">
                      {/* Simple toolbar */}
                      <div className="flex items-center gap-1 p-2 border-b bg-muted/30">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Bold className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Italic className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <List className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <LinkIcon className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <ImageIcon className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        id="scenario"
                        placeholder="Describe el escenario clÃ­nico detalladamente. Incluye datos del paciente, sÃ­ntomas, contexto y la pregunta de investigaciÃ³n que deben resolver los estudiantes..."
                        className="min-h-[250px] border-0 focus-visible:ring-0 resize-none"
                        value={scenario}
                        onChange={(e) => setScenario(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {scenario.split(/\s+/).filter(Boolean).length} palabras
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">ConfiguraciÃ³n</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nivel de dificultad</Label>
                    <Select value={difficulty} onValueChange={(v) => setDifficulty(v as CaseDifficulty)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(difficultyConfig) as CaseDifficulty[]).map((level) => (
                          <SelectItem key={level} value={level}>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={difficultyConfig[level].color}>
                                {difficultyConfig[level].label}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {difficultyConfig[difficulty].description}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="start-date">Fecha de inicio</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="due-date">Fecha de entrega</Label>
                    <Input
                      id="due-date"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    AsignaciÃ³n
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Selecciona estudiantes para dejar el caso listo para publicaciÃ³n.
                  </p>
                  <Input
                    placeholder="Buscar estudiante..."
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                  />
                  <ScrollArea className="h-44 rounded-md border px-3 py-2">
                    {isLoadingStudents ? (
                      <p className="text-sm text-muted-foreground">Cargando estudiantes...</p>
                    ) : filteredStudents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay estudiantes disponibles.</p>
                    ) : (
                      <div className="space-y-2">
                        {filteredStudents.map((student) => {
                          const isChecked = selectedStudents.includes(student.id)
                          return (
                            <label
                              key={student.id}
                              className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-muted/50"
                            >
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) =>
                                  toggleStudentSelection(student.id, Boolean(checked))
                                }
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
                  <p className="text-xs text-muted-foreground">
                    {selectedStudents.length} estudiante(s) seleccionado(s)
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Search Articles */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Buscar artÃ­culos</CardTitle>
                <CardDescription>
                  Busca y AÃ±ade artÃ­culos como recursos del caso
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar artÃ­culos..."
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchArticles()}
                    />
                  </div>
                  <Button onClick={searchArticles} disabled={isSearching}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <ScrollArea className="h-[400px] border rounded-lg">
                    <div className="p-4 space-y-2">
                      {searchResults.map((article) => {
                        const isRequired = requiredArticles.some((a) => a.id === article.id)
                        const isOptional = optionalArticles.some((a) => a.id === article.id)
                        return (
                          <div
                            key={article.id}
                            className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                          >
                            <p className="text-sm font-medium line-clamp-2">{article.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {article.authors.slice(0, 2).join(', ')} - {article.year}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <Button
                                variant={isRequired ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                  if (isRequired) {
                                    setRequiredArticles((prev) => prev.filter((a) => a.id !== article.id))
                                  } else {
                                    setRequiredArticles((prev) => [...prev, article])
                                    setOptionalArticles((prev) => prev.filter((a) => a.id !== article.id))
                                  }
                                }}
                              >
                                {isRequired ? 'Obligatorio' : 'aÃ±adir obligatorio'}
                              </Button>
                              <Button
                                variant={isOptional ? 'secondary' : 'outline'}
                                size="sm"
                                onClick={() => {
                                  if (isOptional) {
                                    setOptionalArticles((prev) => prev.filter((a) => a.id !== article.id))
                                  } else {
                                    setOptionalArticles((prev) => [...prev, article])
                                    setRequiredArticles((prev) => prev.filter((a) => a.id !== article.id))
                                  }
                                }}
                              >
                                {isOptional ? 'Opcional' : 'aÃ±adir opcional'}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Selected Articles */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-success flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    artÃ­culos obligatorios ({requiredArticles.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {requiredArticles.length > 0 ? (
                    <ScrollArea className="h-[180px]">
                      <div className="space-y-2">
                        {requiredArticles.map((article) => (
                          <div
                            key={article.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-success/5 border border-success/20"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{article.title}</p>
                              <p className="text-xs text-muted-foreground">{article.year}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRequiredArticles((prev) => prev.filter((a) => a.id !== article.id))}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Sin artÃ­culos obligatorios
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-muted-foreground flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    artÃ­culos opcionales ({optionalArticles.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {optionalArticles.length > 0 ? (
                    <ScrollArea className="h-[180px]">
                      <div className="space-y-2">
                        {optionalArticles.map((article) => (
                          <div
                            key={article.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{article.title}</p>
                              <p className="text-xs text-muted-foreground">{article.year}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setOptionalArticles((prev) => prev.filter((a) => a.id !== article.id))}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Sin artÃ­culos opcionales
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Questions Tab */}
        <TabsContent value="questions" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Preguntas guÃ­a</CardTitle>
                  <CardDescription>
                    Define las preguntas que orientarÃ¡n a los estudiantes
                  </CardDescription>
                </div>
                <Button onClick={addQuestion}>
                  <Plus className="mr-2 h-4 w-4" />
                  aÃ±adir pregunta
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {guidingQuestions.map((question, index) => (
                  <div
                    key={question.id}
                    className="flex gap-4 p-4 border rounded-lg"
                  >
                    <div className="flex items-center">
                      <GripVertical className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <Input
                          placeholder="Escribe la pregunta guÃ­a..."
                          value={question.question}
                          onChange={(e) => updateQuestion(question.id, { question: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Competencia:</Label>
                          <Select
                            value={question.competency}
                            onValueChange={(v) => updateQuestion(question.id, { competency: v as 'access' | 'process' | 'communicate' })}
                          >
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="access">Acceso</SelectItem>
                              <SelectItem value="process">Procesamiento</SelectItem>
                              <SelectItem value="communicate">ComunicaciÃ³n</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Puntos:</Label>
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            className="w-20 h-8"
                            value={question.points}
                            onChange={(e) => updateQuestion(question.id, { points: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(question.id)}
                      disabled={guidingQuestions.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">
                  Total de puntos: {guidingQuestions.reduce((sum, q) => sum + q.points, 0)}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rubric Tab */}
        <TabsContent value="rubric" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">rÃºbrica de evaluaciÃ³n</CardTitle>
                  <CardDescription>
                    Define los criterios y niveles de desempeÃ±o
                  </CardDescription>
                </div>
                <Button onClick={addRubricItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  aÃ±adir criterio
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {rubricItems.map((item) => (
                  <Card key={item.id} className="border-2">
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Nombre del criterio"
                              value={item.criteria}
                              onChange={(e) => updateRubricItem(item.id, { criteria: e.target.value })}
                              className="font-medium"
                            />
                            <Select
                              value={item.competency}
                              onValueChange={(v) => updateRubricItem(item.id, { competency: v as 'access' | 'process' | 'communicate' })}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="access">Acceso</SelectItem>
                                <SelectItem value="process">Procesamiento</SelectItem>
                                <SelectItem value="communicate">ComunicaciÃ³n</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={1}
                                max={100}
                                className="w-20"
                                value={item.maxPoints}
                                onChange={(e) => updateRubricItem(item.id, { maxPoints: parseInt(e.target.value) || 0 })}
                              />
                              <span className="text-sm text-muted-foreground">pts</span>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-success">Excelente</Label>
                              <Textarea
                                placeholder="Describe el desempeÃ±o excelente..."
                                className="min-h-[80px] text-sm"
                                value={item.levels.excellent}
                                onChange={(e) => updateRubricItem(item.id, {
                                  levels: { ...item.levels, excellent: e.target.value }
                                })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-warning">Bueno</Label>
                              <Textarea
                                placeholder="Describe el desempeÃ±o bueno..."
                                className="min-h-[80px] text-sm"
                                value={item.levels.good}
                                onChange={(e) => updateRubricItem(item.id, {
                                  levels: { ...item.levels, good: e.target.value }
                                })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-destructive">Necesita mejorar</Label>
                              <Textarea
                                placeholder="Describe el desempeÃ±o a mejorar..."
                                className="min-h-[80px] text-sm"
                                value={item.levels.needs_improvement}
                                onChange={(e) => updateRubricItem(item.id, {
                                  levels: { ...item.levels, needs_improvement: e.target.value }
                                })}
                              />
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRubricItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">
                  Total mÃ¡ximo: {rubricItems.reduce((sum, item) => sum + item.maxPoints, 0)} puntos
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

