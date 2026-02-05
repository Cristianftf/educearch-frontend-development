'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { searchApi } from '@/lib/api'
import type { MeshTerm, SearchQuery, SearchSession, SearchFilters, SearchResult } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Search,
  Plus,
  X,
  Sparkles,
  History,
  Star,
  StarOff,
  Loader2,
  AlertCircle,
  BookOpen,
  Users,
  Calendar,
  ExternalLink,
  GripVertical,
  Palette,
  Settings,
} from 'lucide-react'
import QueryBuilder from '@/components/query-builder'
import { useStudent } from '@/contexts/student-context'
import { useStudentSearch } from '@/hooks/use-student-search'

const BOOLEAN_OPERATORS = ['AND', 'OR', 'NOT'] as const
type BooleanOperator = (typeof BOOLEAN_OPERATORS)[number]

const STUDY_TYPES = [
  { id: 'systematic_review', label: 'Revisión Sistemática' },
  { id: 'meta_analysis', label: 'Metaanálisis' },
  { id: 'rct', label: 'Ensayo Clínico Aleatorizado' },
  { id: 'cohort', label: 'Estudio de Cohorte' },
  { id: 'case_control', label: 'Caso-Control' },
  { id: 'case_report', label: 'Reporte de Caso' },
]

interface QueryBlock {
  id: string
  type: 'term' | 'operator' | 'group'
  value: MeshTerm | BooleanOperator | QueryBlock[]
}

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [suggestions, setSuggestions] = useState<MeshTerm[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [selectedTerms, setSelectedTerms] = useState<MeshTerm[]>([])
  const [operators, setOperators] = useState<BooleanOperator[]>([])
  const [queryMode, setQueryMode] = useState<'visual' | 'advanced'>('visual')
  const [visualQuery, setVisualQuery] = useState<{
    rawQuery: string
    terms: MeshTerm[]
    operators: BooleanOperator[]
  } | null>(null)
  const DEFAULT_FILTERS: SearchFilters = {
    yearRange: [2018, 2026],
    studyTypes: [],
    minSampleSize: 0,
  }

  const normalizeFilters = useCallback(
    (filters?: SearchFilters): SearchFilters => ({
      yearRange: filters?.yearRange ?? DEFAULT_FILTERS.yearRange,
      studyTypes: filters?.studyTypes ?? DEFAULT_FILTERS.studyTypes,
      minSampleSize: filters?.minSampleSize ?? DEFAULT_FILTERS.minSampleSize,
    }),
    []
  )

  const [filters, setFilters] = useState<SearchFilters>(() => normalizeFilters())
  const { searchHistory, loadHistory, executeSearch: executeSearchHook } = useStudentSearch()
  const [currentSession, setCurrentSession] = useState<SearchSession | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<SearchResult | null>(null)
  const [selectedResults, setSelectedResults] = useState<SearchResult[]>([])
  const { addActivity, addSavedSearch, setSavedSearches, toggleSearchFavorite } = useStudent()
  const router = useRouter()

  // Debounced MeSH suggestions
  useEffect(() => {
    if (searchTerm.length < 2) {
      setSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      setIsLoadingSuggestions(true)
      try {
        const results = await searchApi.getMeshSuggestions(searchTerm)
        setSuggestions(results)
      } catch (err) {
        console.error('[v0] Error fetching MeSH suggestions:', err)
      } finally {
        setIsLoadingSuggestions(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  const addTerm = useCallback((term: MeshTerm) => {
    setSelectedTerms((prev) => {
      if (prev.some((t) => t.id === term.id)) return prev
      return [...prev, term]
    })
    setSearchTerm('')
    setSuggestions([])
  }, [])

  const removeTerm = useCallback((termId: string) => {
    setSelectedTerms((prev) => {
      const index = prev.findIndex((t) => t.id === termId)
      if (index === -1) return prev
      setOperators((prevOps) => {
        if (prev.length <= 1) return []
        const nextOps = [...prevOps]
        const removeAt = Math.max(0, index - 1)
        if (nextOps.length > 0) {
          nextOps.splice(removeAt, 1)
        }
        return nextOps
      })
      return prev.filter((t) => t.id !== termId)
    })
  }, [])

  const addOperator = useCallback((operator: BooleanOperator) => {
    setOperators((prev) => [...prev, operator])
  }, [])

  const buildQueryString = useCallback((): string => {
    if (selectedTerms.length === 0) return ''

    let query = `[${selectedTerms[0].term}]`
    for (let i = 1; i < selectedTerms.length; i++) {
      const op = operators[i - 1] || 'AND'
      query += ` ${op} [${selectedTerms[i].term}]`
    }

    if (filters.yearRange) {
      query += ` AND [${filters.yearRange[0]}:${filters.yearRange[1]}]`
    }

    return query
  }, [selectedTerms, operators, filters])

  const executeSearch = useCallback(async () => {
    const activeTerms = queryMode === 'visual' ? (visualQuery?.terms ?? []) : selectedTerms
    const activeOperators = queryMode === 'visual' ? (visualQuery?.operators ?? []) : operators
    const activeRawQuery =
      queryMode === 'visual' ? (visualQuery?.rawQuery ?? '') : buildQueryString()
    if (activeTerms.length === 0) {
      setError('Añade al menos un término MeSH para buscar')
      return
    }

    setIsSearching(true)
    setError(null)

    try {
      const query: SearchQuery = {
        id: `query-${Date.now()}`,
        terms: activeTerms,
        operators: activeOperators,
        filters,
        rawQuery: activeRawQuery,
        createdAt: new Date().toISOString(),
      }

      const session = await executeSearchHook(query)
      if (session) {
        setCurrentSession(session)
        setSelectedResults([])
      }
      await loadHistory(1, 10)
    } catch (err) {
      setError('Error al ejecutar la búsqueda. Intenta de nuevo.')
      console.error('[v0] Search error:', err)
    } finally {
      setIsSearching(false)
    }
  }, [selectedTerms, operators, filters, buildQueryString, queryMode, visualQuery, executeSearchHook, loadHistory])

  const toggleResultSelection = useCallback((result: SearchResult) => {
    setSelectedResults((prev) => {
      const exists = prev.some((item) => item.id === result.id)
      if (exists) {
        return prev.filter((item) => item.id !== result.id)
      }
      return [...prev, result]
    })
  }, [])

  const exportSelection = useCallback(() => {
    if (selectedResults.length === 0) {
      setError('Selecciona al menos un artÃ­culo para exportar.')
      return
    }
    try {
      localStorage.setItem('search_selection', JSON.stringify(selectedResults))
      router.push('/student/bibliography?source=search')
    } catch (err) {
      console.error('[v0] Error exporting selection:', err)
    }
  }, [selectedResults, router])

  const toggleFavorite = useCallback(async (searchId: string, currentFavorite: boolean) => {
    try {
      await searchApi.saveSearch(searchId, !currentFavorite)
      toggleSearchFavorite(searchId)
      await loadHistory(1, 10)
    } catch (err) {
      console.error('[v0] Error toggling favorite:', err)
    }
  }, [toggleSearchFavorite, loadHistory])

  const reuseSearch = useCallback(
    (query: SearchQuery) => {
      setSelectedTerms(query.terms)
      setOperators(query.operators)
      setFilters(normalizeFilters(query.filters))
    },
    [normalizeFilters]
  )

  const yearRangeValue = useMemo(
    () => filters.yearRange ?? DEFAULT_FILTERS.yearRange,
    [filters.yearRange]
  )
  const minSampleValue = useMemo(
    () => [filters.minSampleSize ?? DEFAULT_FILTERS.minSampleSize],
    [filters.minSampleSize]
  )

  const [yearRangeDraft, setYearRangeDraft] = useState<[number, number]>(yearRangeValue)
  const [minSampleDraft, setMinSampleDraft] = useState<number[]>(minSampleValue)

  useEffect(() => {
    if (
      yearRangeDraft[0] !== yearRangeValue[0] ||
      yearRangeDraft[1] !== yearRangeValue[1]
    ) {
      setYearRangeDraft(yearRangeValue)
    }
  }, [yearRangeDraft, yearRangeValue])

  useEffect(() => {
    if (minSampleDraft[0] !== minSampleValue[0]) {
      setMinSampleDraft(minSampleValue)
    }
  }, [minSampleDraft, minSampleValue])

  const updateYearRange = useCallback((value: [number, number]) => {
    setFilters((prev) => {
      const current = prev.yearRange ?? DEFAULT_FILTERS.yearRange
      if (current[0] === value[0] && current[1] === value[1]) {
        return prev
      }
      return { ...prev, yearRange: value }
    })
  }, [])

  const updateMinSampleSize = useCallback((value: number) => {
    setFilters((prev) => {
      const current = prev.minSampleSize ?? DEFAULT_FILTERS.minSampleSize
      if (current === value) {
        return prev
      }
      return { ...prev, minSampleSize: value }
    })
  }, [])

  const displayQuery =
    queryMode === 'visual' ? (visualQuery?.rawQuery || '') : buildQueryString()
  const canSearch =
    queryMode === 'visual'
      ? (visualQuery?.terms?.length || 0) > 0
      : selectedTerms.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Búsqueda Avanzada</h1>
        <p className="text-muted-foreground mt-1">
          Construye queries con términos MeSH y operadores booleanos
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Query Builder */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={queryMode} onValueChange={(value) => setQueryMode(value as 'visual' | 'advanced')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="visual" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Constructor Visual
              </TabsTrigger>
              <TabsTrigger value="advanced" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Modo Avanzado
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visual" className="space-y-6">
              <QueryBuilder
                availableTerms={suggestions}
                onQueryChange={(data) => {
                  setVisualQuery(data)
                }}
              />
            </TabsContent>

            <TabsContent value="advanced" className="space-y-6">
              {/* Term Search */}
              <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                Términos MeSH
              </CardTitle>
              <CardDescription>
                Busca y añade términos del vocabulario controlado MeSH
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar términos MeSH (ej: diabetes, hypertension)..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {isLoadingSuggestions && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                )}
              </div>

              {/* Suggestions dropdown */}
              {suggestions.length > 0 && (
                <Card className="absolute z-10 w-full mt-1 max-h-64 overflow-auto shadow-lg">
                  <CardContent className="p-2">
                    {suggestions.map((term) => (
                      <button
                        key={term.id}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors"
                        onClick={() => addTerm(term)}
                      >
                        <p className="font-medium">{term.term}</p>
                        {term.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {term.description}
                          </p>
                        )}
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Selected terms */}
              {selectedTerms.length > 0 && (
                <div className="space-y-3">
                  <Label>Términos seleccionados</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedTerms.map((term, index) => (
                      <div key={term.id} className="flex items-center gap-1">
                        {index > 0 && (
                          <select
                            className="h-8 px-2 rounded border bg-background text-sm font-mono"
                            value={operators[index - 1] || 'AND'}
                            onChange={(e) => {
                              const newOps = [...operators]
                              newOps[index - 1] = e.target.value as BooleanOperator
                              setOperators(newOps)
                            }}
                          >
                            {BOOLEAN_OPERATORS.map((op) => (
                              <option key={op} value={op}>
                                {op}
                              </option>
                            ))}
                          </select>
                        )}
                        <Badge variant="secondary" className="px-3 py-1.5 gap-2">
                          <GripVertical className="h-3 w-3 text-muted-foreground" />
                          {term.term}
                          <button
                            onClick={() => removeTerm(term.id)}
                            className="hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick add operators */}
              <div className="flex gap-2">
                {BOOLEAN_OPERATORS.map((op) => (
                  <Button
                    key={op}
                    variant="outline"
                    size="sm"
                    onClick={() => addOperator(op)}
                    className="font-mono"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {op}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Results */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Vista previa del query</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-muted font-mono text-sm overflow-x-auto">
                {displayQuery || (
                  <span className="text-muted-foreground">
                    Añade términos para construir tu query...
                  </span>
                )}
              </div>

              {error && (
                <div className="mt-4 flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <Button
                className="w-full mt-4"
                size="lg"
                onClick={executeSearch}
                disabled={isSearching || !canSearch}
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Ejecutar búsqueda
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          {currentSession && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Resultados</CardTitle>
                    <CardDescription>
                      {currentSession.totalResults} artículos encontrados
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportSelection}>
                    Exportar selección
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {currentSession.results.map((result) => {
                      const isSelected = selectedResults.some((item) => item.id === result.id)
                      return (
                      <Card
                        key={result.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedArticle(result)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <Checkbox
                              id={`select-${result.id}`}
                              checked={isSelected}
                              onCheckedChange={() => toggleResultSelection(result)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="font-medium leading-snug line-clamp-2">
                                  {result.title}
                                </h3>
                                <Badge
                                  variant="outline"
                                  className={
                                    result.evidenceLevel <= 2
                                      ? 'border-success text-success'
                                      : result.evidenceLevel <= 4
                                        ? 'border-warning text-warning'
                                        : ''
                                  }
                                >
                                  Nivel {result.evidenceLevel}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {result.authors.slice(0, 3).join(', ')}
                                {result.authors.length > 3 && ' et al.'}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <BookOpen className="h-3 w-3" />
                                  {result.journal}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {result.year}
                                </span>
                                {result.sampleSize && (
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    n={result.sampleSize}
                                  </span>
                                )}
                              </div>
                              {result.hasConflictOfInterest && (
                                <Badge variant="destructive" className="mt-2 text-xs">
                                  Conflicto de interés declarado
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* AI Assistant */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Asistente IA
              </CardTitle>
              <CardDescription>Sugerencias inteligentes para tu búsqueda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Basándote en tus términos, considera añadir:
              </p>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                  <Plus className="h-3 w-3 mr-2" />
                  Treatment Outcome
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start bg-transparent">
                  <Plus className="h-3 w-3 mr-2" />
                  Clinical Trials as Topic
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Year Range */}
              <div className="space-y-3">
                <Label>
                  Rango de años: {yearRangeDraft[0]} - {yearRangeDraft[1]}
                </Label>
                <Slider
                  min={2000}
                  max={2026}
                  step={1}
                  value={yearRangeDraft}
                  onValueChange={(value) => setYearRangeDraft(value as [number, number])}
                  onValueCommit={(value) => updateYearRange(value as [number, number])}
                  className="mt-2"
                />
              </div>

              {/* Study Types */}
              <div className="space-y-3">
                <Label>Tipo de estudio</Label>
                <div className="space-y-2">
                  {STUDY_TYPES.map((type) => (
                    <div key={type.id} className="flex items-center gap-2">
                      <Checkbox
                        id={type.id}
                        checked={filters.studyTypes?.includes(type.id)}
                        onCheckedChange={(checked) => {
                          setFilters((prev) => ({
                            ...prev,
                            studyTypes: checked
                              ? [...(prev.studyTypes || []), type.id]
                              : prev.studyTypes?.filter((t) => t !== type.id),
                          }))
                        }}
                      />
                      <Label htmlFor={type.id} className="text-sm font-normal cursor-pointer">
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample Size */}
              <div className="space-y-3">
                <Label>Tamaño muestral mínimo: {minSampleDraft[0]}</Label>
                <Slider
                  min={0}
                  max={1000}
                  step={10}
                  value={minSampleDraft}
                  onValueChange={(value) => setMinSampleDraft(value as number[])}
                  onValueCommit={([value]) => updateMinSampleSize(value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Search History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial
              </CardTitle>
            </CardHeader>
            <CardContent>
              {searchHistory.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                  {searchHistory.slice(0, 5).map((search) => (
                    <AccordionItem key={search.id} value={search.id}>
                      <AccordionTrigger className="text-sm">
                        <div className="flex items-center gap-2">
                          {search.isFavorite && <Star className="h-3 w-3 text-warning" />}
                          <span className="truncate max-w-[150px]">{search.rawQuery}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {search.resultCount} resultados
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 bg-transparent"
                              onClick={() => reuseSearch(search)}
                            >
                              Reutilizar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleFavorite(search.id, !!search.isFavorite)}
                            >
                              {search.isFavorite ? (
                                <StarOff className="h-4 w-4" />
                              ) : (
                                <Star className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay búsquedas recientes
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Article Detail Dialog */}
      <Dialog open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedArticle && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{selectedArticle.title}</DialogTitle>
                <DialogDescription>
                  {selectedArticle.authors.join(', ')} - {selectedArticle.journal} (
                  {selectedArticle.year})
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Nivel {selectedArticle.evidenceLevel}</Badge>
                  <Badge variant="secondary">{selectedArticle.studyType}</Badge>
                  {selectedArticle.sampleSize && (
                    <Badge variant="secondary">n={selectedArticle.sampleSize}</Badge>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-2">Resumen</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedArticle.abstract}
                  </p>
                </div>

                {selectedArticle.hasConflictOfInterest && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    Este artículo tiene conflictos de interés declarados
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      toggleResultSelection(selectedArticle)
                      setSelectedArticle(null)
                    }}
                  >
                    Añadir a bibliografía
                  </Button>
                  {selectedArticle.doi && (
                    <Button variant="outline" asChild>
                      <a
                        href={`https://doi.org/${selectedArticle.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Ver en PubMed
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
