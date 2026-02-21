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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  CheckCircle2,
} from 'lucide-react'
import QueryBuilder from '@/components/query-builder'
import { useStudent } from '@/contexts/student-context'
import { useStudentSearch } from '@/hooks/use-student-search'

const BOOLEAN_OPERATORS = ['AND', 'OR', 'NOT'] as const
type BooleanOperator = (typeof BOOLEAN_OPERATORS)[number]

const STUDY_TYPES = [
  { id: 'systematic_review', label: 'Revision sistematica' },
  { id: 'meta_analysis', label: 'Metaanalisis' },
  { id: 'rct', label: 'Ensayo clinico aleatorizado' },
  { id: 'cohort', label: 'Estudio de cohorte' },
  { id: 'case_control', label: 'Caso-control' },
  { id: 'case_report', label: 'Reporte de caso' },
]

const LANGUAGE_OPTIONS = [
  { id: 'eng', label: 'Ingles' },
  { id: 'spa', label: 'Espanol' },
  { id: 'por', label: 'Portugues' },
]

const STUDY_TYPE_IDS = new Set(STUDY_TYPES.map((type) => type.id))
const LANGUAGE_IDS = new Set(LANGUAGE_OPTIONS.map((language) => language.id))
const YEAR_MIN = 2000
const YEAR_MAX = 2026

type NormalizedSearchFilters = Required<
  Pick<SearchFilters, 'yearRange' | 'studyTypes' | 'minSampleSize' | 'languages' | 'hasFullText' | 'maxResults'>
>

const DEFAULT_FILTERS: NormalizedSearchFilters = {
  yearRange: [2018, 2026],
  studyTypes: [],
  minSampleSize: 0,
  languages: ['eng'],
  hasFullText: false,
  maxResults: 30,
}

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const normalizeYearRange = (range?: SearchFilters['yearRange']): [number, number] => {
  if (!Array.isArray(range) || range.length !== 2) {
    return DEFAULT_FILTERS.yearRange
  }
  const [fromRaw, toRaw] = range
  const from =
    typeof fromRaw === 'number' && Number.isFinite(fromRaw) ? fromRaw : DEFAULT_FILTERS.yearRange[0]
  const to =
    typeof toRaw === 'number' && Number.isFinite(toRaw) ? toRaw : DEFAULT_FILTERS.yearRange[1]
  const clampedFrom = clampNumber(from, YEAR_MIN, YEAR_MAX)
  const clampedTo = clampNumber(to, YEAR_MIN, YEAR_MAX)
  return clampedFrom <= clampedTo ? [clampedFrom, clampedTo] : [clampedTo, clampedFrom]
}

const normalizeStudyTypes = (studyTypes?: SearchFilters['studyTypes']) => {
  if (!Array.isArray(studyTypes)) return []
  const unique = new Set<string>()
  for (const entry of studyTypes) {
    if (typeof entry === 'string' && STUDY_TYPE_IDS.has(entry)) {
      unique.add(entry)
    }
  }
  return Array.from(unique)
}

const normalizeLanguages = (languages?: SearchFilters['languages']) => {
  if (!Array.isArray(languages) || languages.length === 0) return DEFAULT_FILTERS.languages
  const selected = languages
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => LANGUAGE_IDS.has(entry))
  return selected.length > 0 ? [selected[0]] : DEFAULT_FILTERS.languages
}

const normalizeFilters = (filters?: SearchFilters): NormalizedSearchFilters => ({
  yearRange: normalizeYearRange(filters?.yearRange),
  studyTypes: normalizeStudyTypes(filters?.studyTypes),
  minSampleSize:
    typeof filters?.minSampleSize === 'number' && Number.isFinite(filters.minSampleSize)
      ? clampNumber(filters.minSampleSize, 0, 1000)
      : DEFAULT_FILTERS.minSampleSize,
  languages: normalizeLanguages(filters?.languages),
  hasFullText: filters?.hasFullText === true,
  maxResults:
    typeof filters?.maxResults === 'number' && Number.isFinite(filters.maxResults)
      ? clampNumber(filters.maxResults, 5, 200)
      : DEFAULT_FILTERS.maxResults,
})

const normalizeStudyTypeValue = (value: string) => {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  switch (normalized) {
    case 'systematic_review':
    case 'systematicreview':
      return 'systematic_review'
    case 'meta_analysis':
    case 'metaanalysis':
      return 'meta_analysis'
    case 'rct':
    case 'randomized_controlled_trial':
    case 'randomizedcontrolledtrial':
      return 'rct'
    case 'cohort':
    case 'cohort_study':
    case 'cohortstudy':
      return 'cohort'
    case 'case_control':
    case 'casecontrol':
      return 'case_control'
    case 'case_report':
    case 'casereport':
      return 'case_report'
    default:
      return normalized
  }
}

const areOperatorsEqual = (a?: BooleanOperator[], b?: BooleanOperator[]) => {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  return a.every((item, index) => item === b[index])
}

const areTermsEqual = (a?: MeshTerm[], b?: MeshTerm[]) => {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]
    const right = b[i]
    if (left?.id !== right?.id || left?.term !== right?.term) {
      return false
    }
  }
  return true
}

const sanitizeMeshTerms = (terms: MeshTerm[]): MeshTerm[] => {
  const unique = new Set<string>()
  const sanitized: MeshTerm[] = []

  for (const term of terms) {
    const rawTerm = typeof term?.term === 'string' ? term.term.trim() : ''
    if (!rawTerm) continue
    const normalizedKey = rawTerm.toLowerCase()
    if (unique.has(normalizedKey)) continue
    unique.add(normalizedKey)

    sanitized.push({
      id: typeof term?.id === 'string' && term.id.trim() ? term.id : rawTerm.toUpperCase(),
      term: rawTerm,
      description: typeof term?.description === 'string' ? term.description : undefined,
    })
  }

  return sanitized
}

const normalizeQueryParts = (terms: MeshTerm[], operators: BooleanOperator[]) => {
  const normalizedTerms = sanitizeMeshTerms(terms)
  const maxOperators = Math.max(0, normalizedTerms.length - 1)
  const normalizedOperators = operators
    .filter((operator): operator is BooleanOperator => BOOLEAN_OPERATORS.includes(operator))
    .slice(0, maxOperators)

  while (normalizedOperators.length < maxOperators) {
    normalizedOperators.push('AND')
  }

  return {
    terms: normalizedTerms,
    operators: normalizedOperators,
  }
}

const buildRawQuery = (
  terms: MeshTerm[],
  operators: BooleanOperator[],
  filters: NormalizedSearchFilters
): string => {
  if (terms.length === 0) return ''

  let query = `[${terms[0].term}]`
  for (let i = 1; i < terms.length; i += 1) {
    const op = operators[i - 1] || 'AND'
    query += ` ${op} [${terms[i].term}]`
  }

  query += ` AND [${filters.yearRange[0]}:${filters.yearRange[1]}]`
  if (filters.languages.length > 0) {
    query += ` AND [lang:${filters.languages[0]}]`
  }
  if (filters.hasFullText) {
    query += ' AND [full-text]'
  }
  query += ` [max:${filters.maxResults}]`

  return query
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
  const [filters, setFilters] = useState<NormalizedSearchFilters>(() => normalizeFilters())
  const {
    searchHistory,
    loadHistory,
    executeSearch: executeSearchHook,
    error: searchHookError,
  } = useStudentSearch()
  const [currentSession, setCurrentSession] = useState<SearchSession | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<SearchResult | null>(null)
  const [selectedResults, setSelectedResults] = useState<SearchResult[]>([])
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const { toggleSearchFavorite } = useStudent()
  const router = useRouter()

  const handleVisualQueryChange = useCallback(
    (data: { rawQuery: string; terms: MeshTerm[]; operators: BooleanOperator[] }) => {
      setVisualQuery((prev) => {
        if (
          prev &&
          prev.rawQuery === data.rawQuery &&
          areTermsEqual(prev.terms, data.terms) &&
          areOperatorsEqual(prev.operators, data.operators)
        ) {
          return prev
        }
        return data
      })
    },
    []
  )

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
    setOperators((prev) => {
      const maxOperators = Math.max(0, selectedTerms.length - 1)
      if (maxOperators === 0 || prev.length >= maxOperators) {
        return prev
      }
      return [...prev, operator]
    })
  }, [selectedTerms.length])

  const buildQueryString = useCallback(
    (termsInput = selectedTerms, operatorsInput = operators): string => {
      const normalized = normalizeQueryParts(termsInput, operatorsInput)
      return buildRawQuery(normalized.terms, normalized.operators, filters)
    },
    [selectedTerms, operators, filters]
  )

  const executeSearch = useCallback(async () => {
    const activeTerms = queryMode === 'visual' ? (visualQuery?.terms ?? []) : selectedTerms
    const activeOperators = queryMode === 'visual' ? (visualQuery?.operators ?? []) : operators
    const normalizedQuery = normalizeQueryParts(activeTerms, activeOperators)
    const activeRawQuery = buildRawQuery(normalizedQuery.terms, normalizedQuery.operators, filters)

    if (normalizedQuery.terms.length === 0) {
      setError('Anade al menos un termino MeSH para buscar')
      return
    }

    setIsSearching(true)
    setError(null)

    try {
      const query: SearchQuery = {
        id: `query-${Date.now()}`,
        terms: normalizedQuery.terms,
        operators: normalizedQuery.operators,
        filters,
        rawQuery: activeRawQuery,
        createdAt: new Date().toISOString(),
      }

      const session = await executeSearchHook(query)
      if (!session) {
        setError(searchHookError || 'No se pudieron obtener resultados validos para esta busqueda.')
        return
      }
      setCurrentSession(session)
      setSelectedResults([])
      await loadHistory(1, 10)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al ejecutar la busqueda. Intenta de nuevo.'
      setError(message)
      console.error('[v0] Search error:', err)
    } finally {
      setIsSearching(false)
    }
  }, [selectedTerms, operators, filters, queryMode, visualQuery, executeSearchHook, loadHistory, searchHookError])

  const toggleResultSelection = useCallback((result: SearchResult) => {
    setSelectedResults((prev) => {
      const exists = prev.some((item) => item.id === result.id)
      if (exists) {
        return prev.filter((item) => item.id !== result.id)
      }
      return [...prev, result]
    })
  }, [])

  const addResultSelection = useCallback((result: SearchResult) => {
    setSelectedResults((prev) => {
      if (prev.some((item) => item.id === result.id)) {
        return prev
      }
      return [...prev, result]
    })
  }, [])

  const exportSelection = useCallback(() => {
    if (selectedResults.length === 0) {
      setError('Selecciona al menos un articulo para exportar.')
      return
    }
    try {
      setError(null)
      localStorage.setItem(
        'search_selection_v2',
        JSON.stringify({ version: 2, items: selectedResults })
      )
      setExportMessage('Seleccion enviada a bibliografias.')
      setTimeout(() => setExportMessage(null), 2000)
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

  const reuseSearch = useCallback((query: SearchQuery) => {
    const normalized = normalizeQueryParts(query.terms, query.operators as BooleanOperator[])
    setSelectedTerms(normalized.terms)
    setOperators(normalized.operators)
    setFilters(normalizeFilters(query.filters))
    setQueryMode('advanced')
    setVisualQuery({
      rawQuery: query.rawQuery,
      terms: normalized.terms,
      operators: normalized.operators,
    })
  }, [])

  const yearRangeValue = filters.yearRange
  const minSampleValue = [filters.minSampleSize]
  const maxResultsValue = [filters.maxResults]

  const [yearRangeDraft, setYearRangeDraft] = useState<[number, number]>(yearRangeValue)
  const [minSampleDraft, setMinSampleDraft] = useState<number[]>(minSampleValue)
  const [maxResultsDraft, setMaxResultsDraft] = useState<number[]>(maxResultsValue)

  useEffect(() => {
    setYearRangeDraft((prev) =>
      prev[0] === yearRangeValue[0] && prev[1] === yearRangeValue[1]
        ? prev
        : yearRangeValue
    )
  }, [yearRangeValue[0], yearRangeValue[1]])

  useEffect(() => {
    setMinSampleDraft((prev) =>
      prev[0] === minSampleValue[0]
        ? prev
        : minSampleValue
    )
  }, [minSampleValue[0]])

  useEffect(() => {
    setMaxResultsDraft((prev) =>
      prev[0] === maxResultsValue[0]
        ? prev
        : maxResultsValue
    )
  }, [maxResultsValue[0]])

  const updateYearRange = useCallback((value: [number, number]) => {
    setFilters((prev) => {
      const current = prev.yearRange
      if (current[0] === value[0] && current[1] === value[1]) {
        return prev
      }
      return { ...prev, yearRange: value }
    })
  }, [])

  const updateMinSampleSize = useCallback((value: number) => {
    setFilters((prev) => {
      const current = prev.minSampleSize
      if (current === value) {
        return prev
      }
      return { ...prev, minSampleSize: value }
    })
  }, [])

  const updateMaxResults = useCallback((value: number) => {
    setFilters((prev) => {
      const current = prev.maxResults
      if (current === value) {
        return prev
      }
      return { ...prev, maxResults: value }
    })
  }, [])

  const displayQuery = queryMode === 'visual'
    ? buildQueryString(visualQuery?.terms ?? [], visualQuery?.operators ?? [])
    : buildQueryString()

  const canSearch = useMemo(() => {
    const activeTerms = queryMode === 'visual' ? (visualQuery?.terms ?? []) : selectedTerms
    const activeOperators = queryMode === 'visual' ? (visualQuery?.operators ?? []) : operators
    return normalizeQueryParts(activeTerms, activeOperators).terms.length > 0
  }, [queryMode, visualQuery, selectedTerms, operators])

  const filteredResults = useMemo(() => {
    if (!currentSession) return []
    const [yearFrom, yearTo] = filters.yearRange
    const filtered = currentSession.results.filter((result) => {
      if (result.year < yearFrom || result.year > yearTo) {
        return false
      }
      if (filters.studyTypes.length > 0) {
        const normalizedStudyType = result.studyType ? normalizeStudyTypeValue(result.studyType) : ''
        if (!filters.studyTypes.includes(normalizedStudyType)) {
          return false
        }
      }
      if (filters.minSampleSize > 0) {
        const sampleSize = result.sampleSize ?? 0
        if (sampleSize < filters.minSampleSize) {
          return false
        }
      }
      if (filters.hasFullText && !result.sourceUrl && !result.doi) {
        return false
      }
      return true
    })
    return filtered.slice(0, filters.maxResults)
  }, [
    currentSession,
    filters.yearRange,
    filters.studyTypes,
    filters.minSampleSize,
    filters.hasFullText,
    filters.maxResults,
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Busqueda Avanzada</h1>
        <p className="text-muted-foreground mt-1">
          Construye queries con terminos MeSH y operadores booleanos
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
                onQueryChange={handleVisualQueryChange}
              />
            </TabsContent>

            <TabsContent value="advanced" className="space-y-6">
              {/* Term Search */}
              <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                Terminos MeSH
              </CardTitle>
              <CardDescription>
                Busca y anade terminos del vocabulario controlado MeSH
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar terminos MeSH (ej: diabetes, hypertension)..."
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
                  <Label>Terminos seleccionados</Label>
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
                    Anade terminos para construir tu query...
                  </span>
                )}
              </div>

              {error && (
                <div className="mt-4 flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              {exportMessage && (
                <div className="mt-4 flex items-center gap-2 text-success text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  {exportMessage}
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
                    Ejecutar busqueda
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
                      {filteredResults.length} articulos encontrados
                      {currentSession.totalResults !== filteredResults.length && (
                        <span className="text-muted-foreground">
                          {' '}
                          (de {currentSession.totalResults} totales)
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportSelection}>
                    Exportar seleccion
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {filteredResults.map((result) => {
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
                                {result.source && (
                                  <Badge variant="secondary" className="text-[10px] h-5">
                                    {result.source}
                                  </Badge>
                                )}
                              </div>
                              {result.hasConflictOfInterest && (
                                <Badge variant="destructive" className="mt-2 text-xs">
                                  Conflicto de interes declarado
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      )
                    })}
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
              <CardDescription>Sugerencias inteligentes para tu busqueda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Basandote en tus terminos, considera anadir:
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
              <CardTitle className="text-lg">Filtros avanzados</CardTitle>
              <CardDescription>
                Aplica estos parametros en todas las fuentes externas antes de mostrar resultados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Year Range */}
              <div className="space-y-3">
                <Label>
                  Rango anual: {yearRangeDraft[0]} - {yearRangeDraft[1]}
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
                <p className="text-xs text-muted-foreground">
                  Selecciona uno o mas disenos para filtrar evidencia clinica.
                </p>
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

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="language-filter">Idioma principal</Label>
                  <p className="text-xs text-muted-foreground">
                    Prioriza resultados indexados en el idioma seleccionado.
                  </p>
                </div>
                <Select
                  value={filters.languages[0] || 'eng'}
                  onValueChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      languages: [value],
                    }))
                  }
                >
                  <SelectTrigger id="language-filter">
                    <SelectValue placeholder="Selecciona un idioma" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((language) => (
                      <SelectItem key={language.id} value={language.id}>
                        {language.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="full-text-only"
                    checked={filters.hasFullText}
                    onCheckedChange={(checked) =>
                      setFilters((prev) => ({
                        ...prev,
                        hasFullText: checked === true,
                      }))
                    }
                  />
                  <Label htmlFor="full-text-only" className="text-sm font-normal cursor-pointer">
                    Solo resultados con texto completo
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Excluye registros sin enlace de acceso al contenido.
                </p>
              </div>

              {/* Sample Size */}
              <div className="space-y-3">
                <Label>Tamano muestral minimo: {minSampleDraft[0]}</Label>
                <p className="text-xs text-muted-foreground">
                  Util para priorizar estudios con mayor robustez estadistica.
                </p>
                <Slider
                  min={0}
                  max={1000}
                  step={10}
                  value={minSampleDraft}
                  onValueChange={(value) => setMinSampleDraft(value as number[])}
                  onValueCommit={([value]) => updateMinSampleSize(value)}
                />
              </div>

              <div className="space-y-3">
                <Label>Maximo de resultados: {maxResultsDraft[0]}</Label>
                <p className="text-xs text-muted-foreground">
                  Limita la cantidad final mostrada y acelera la revision.
                </p>
                <Slider
                  min={5}
                  max={200}
                  step={5}
                  value={maxResultsDraft}
                  onValueChange={(value) => setMaxResultsDraft(value as number[])}
                  onValueCommit={([value]) => updateMaxResults(value)}
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
                  No hay busquedas recientes
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
                  {selectedArticle.source && (
                    <Badge variant="secondary">{selectedArticle.source}</Badge>
                  )}
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
                    Este articulo tiene conflictos de interes declarados
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      addResultSelection(selectedArticle)
                      setSelectedArticle(null)
                    }}
                  >
                    Anadir a bibliografia
                  </Button>
                  {(selectedArticle.sourceUrl || selectedArticle.doi) && (
                    <Button variant="outline" asChild>
                      <a
                        href={selectedArticle.sourceUrl || `https://doi.org/${selectedArticle.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {selectedArticle.source ? `Ver en ${selectedArticle.source}` : 'Ver fuente'}
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
