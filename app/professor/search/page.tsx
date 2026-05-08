"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { hedgesApi, searchApi } from "@/lib/api"
import { searchAssistantApi, type AssistantConversationMessage } from "@/lib/search-assistant"
import type { MeshTerm, SearchFilters, SearchQuery, SearchResult } from "@/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bot, History, Loader2, Save, Search, Sparkles, Star, StarOff } from "lucide-react"
import QueryBuilder from "@/components/query-builder"

type BooleanOperator = "AND" | "OR" | "NOT"
type QueryMode = "visual" | "raw"
type AssistantMessage = { role: "assistant" | "user"; content: string }
type NormalizedSearchFilters = Required<
  Pick<SearchFilters, "yearRange" | "studyTypes" | "minSampleSize" | "languages" | "hasFullText" | "maxResults">
>

const STORAGE_KEY = "professor_search_workspace_v1"
const YEAR_MIN = 2000
const YEAR_MAX = 2026
const DEFAULT_FILTERS: NormalizedSearchFilters = {
  yearRange: [2018, YEAR_MAX],
  studyTypes: [],
  minSampleSize: 0,
  languages: ["eng"],
  hasFullText: false,
  maxResults: 30,
}
const STUDY_TYPES = [
  ["systematic_review", "Revisión sistemática"],
  ["meta_analysis", "Metaanálisis"],
  ["rct", "Ensayo clínico aleatorizado"],
  ["cohort", "Estudio de cohorte"],
  ["case_control", "Caso-control"],
  ["case_report", "Reporte de caso"],
] as const
const LANGUAGES = [
  ["eng", "Inglés"],
  ["spa", "Español"],
  ["por", "Portugués"],
] as const

const normalizeFilters = (filters?: SearchFilters): NormalizedSearchFilters => ({
  yearRange: Array.isArray(filters?.yearRange) && filters.yearRange.length === 2
    ? [Math.max(YEAR_MIN, Math.min(YEAR_MAX, filters.yearRange[0])), Math.max(YEAR_MIN, Math.min(YEAR_MAX, filters.yearRange[1]))].sort((a, b) => a - b) as [number, number]
    : DEFAULT_FILTERS.yearRange,
  studyTypes: Array.isArray(filters?.studyTypes) ? filters.studyTypes.filter(Boolean) : [],
  minSampleSize: typeof filters?.minSampleSize === "number" ? Math.max(0, Math.min(1000, Math.round(filters.minSampleSize))) : 0,
  languages: Array.isArray(filters?.languages) && filters.languages.length > 0 ? [filters.languages[0]] : ["eng"],
  hasFullText: filters?.hasFullText === true,
  maxResults: typeof filters?.maxResults === "number" ? Math.max(5, Math.min(200, Math.round(filters.maxResults))) : 30,
})

const sanitizeTerms = (terms: MeshTerm[]) => {
  const seen = new Set<string>()
  return terms.filter((term) => {
    const value = term.term.trim().toLowerCase()
    if (!value || seen.has(value)) return false
    seen.add(value)
    return true
  })
}

const buildVisualRawQuery = (terms: MeshTerm[], operators: BooleanOperator[]) =>
  terms.reduce((acc, term, index) => {
    if (index === 0) return `[${term.term}]`
    return `${acc} ${operators[index - 1] ?? "AND"} [${term.term}]`
  }, "")

/** Pure presentational sub-components so Slider doesn't re-render with the parent. */
function YearRangeSlider({ value, min, max, onValueChange }: { value: [number, number]; min: number; max: number; onValueChange: (v: number[]) => void }) {
  const memoValue = useMemo(() => value, [value[0], value[1]])
  return <Slider value={memoValue} min={min} max={max} step={1} onValueChange={onValueChange} />
}

function SingleSlider({ value, min, max, step, onValueChange }: { value: number; min: number; max: number; step: number; onValueChange: (v: number[]) => void }) {
  const memoValue = useMemo(() => [value] as const, [value])
  return <Slider value={memoValue as unknown as number[]} min={min} max={max} step={step} onValueChange={onValueChange} />
}

export default function ProfessorSearchPage() {
  const initial = useMemo(() => {
    if (typeof window === "undefined") return null
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null")
    } catch {
      return null
    }
  }, [])

  const [queryMode, setQueryMode] = useState<QueryMode>(initial?.queryMode === "raw" ? "raw" : "visual")
  const [searchTerm, setSearchTerm] = useState(initial?.searchTerm ?? "")
  const [visualQuery, setVisualQuery] = useState<{ rawQuery: string; terms: MeshTerm[]; operators: BooleanOperator[] } | null>(initial?.visualQuery ?? null)
  const [rawQuery, setRawQuery] = useState(initial?.rawQuery ?? "")
  const [filters, setFilters] = useState<NormalizedSearchFilters>(normalizeFilters(initial?.filters))
  const [results, setResults] = useState<SearchResult[]>(Array.isArray(initial?.results) ? initial.results : [])
  const [selectedIds, setSelectedIds] = useState<string[]>(Array.isArray(initial?.selectedIds) ? initial.selectedIds : [])
  const [history, setHistory] = useState<SearchQuery[]>([])
  const [suggestions, setSuggestions] = useState<MeshTerm[]>([])
  const [categories, setCategories] = useState<string[]>(["General"])
  const [hedgeName, setHedgeName] = useState("")
  const [hedgeCategory, setHedgeCategory] = useState("General")
  const [hedgeDescription, setHedgeDescription] = useState("")
  const [hedgeOpen, setHedgeOpen] = useState(false)
  const [assistantInput, setAssistantInput] = useState("")
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    { role: "assistant", content: "Puedo ayudarte a mejorar la estrategia docente y preparar búsquedas reutilizables." },
  ])
  const [assistantStatus, setAssistantStatus] = useState<string | null>(null)
  const [assistantTips, setAssistantTips] = useState<string[]>([])
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [isSavingHedge, setIsSavingHedge] = useState(false)
  const [assistantLoading, setAssistantLoading] = useState(false)
  const activeSearchControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ queryMode, searchTerm, visualQuery, rawQuery, filters, results, selectedIds })
    )
  }, [filters, queryMode, rawQuery, results, searchTerm, selectedIds, visualQuery])

  useEffect(() => {
    const loadMeta = async () => {
      setIsLoadingHistory(true)
      try {
        const [historyResponse, categoriesResponse] = await Promise.all([
          searchApi.getHistory(1, 10),
          hedgesApi.getCategories().catch(() => ["General"]),
        ])
        setHistory(historyResponse.searches)
        setCategories(Array.from(new Set(["General", ...(categoriesResponse ?? [])])))
      } finally {
        setIsLoadingHistory(false)
      }
    }
    void loadMeta()
  }, [])

  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      setIsLoadingSuggestions(true)
      try {
        const response = await searchApi.getMeshSuggestions(searchTerm.trim())
        setSuggestions(sanitizeTerms(response).slice(0, 12))
      } finally {
        setIsLoadingSuggestions(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const queryData = useMemo(() => {
    if (queryMode === "raw") {
      const trimmed = rawQuery.trim()
      return {
        rawQuery: trimmed,
        terms: trimmed ? [{ id: "raw-query", term: trimmed, description: "Consulta avanzada" }] : [],
        operators: [] as BooleanOperator[],
      }
    }
    const terms = sanitizeTerms(visualQuery?.terms ?? [])
    const operators = (visualQuery?.operators ?? []).slice(0, Math.max(0, terms.length - 1))
    while (operators.length < Math.max(0, terms.length - 1)) operators.push("AND")
    return { rawQuery: buildVisualRawQuery(terms, operators), terms, operators }
  }, [queryMode, rawQuery, visualQuery])

  const selectedResults = useMemo(() => results.filter((result) => selectedIds.includes(result.id)), [results, selectedIds])

  const executeSearch = useCallback(async () => {
    if (!queryData.rawQuery.trim() || queryData.terms.length === 0) {
      setError("Construye una búsqueda válida antes de ejecutar.")
      return
    }
    activeSearchControllerRef.current?.abort()
    activeSearchControllerRef.current = new AbortController()
    setIsSearching(true)
    setError(null)
    setStatusMessage(null)
    try {
      const query: SearchQuery = {
        id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `prof-query-${Date.now()}`,
        terms: queryData.terms,
        operators: queryData.operators,
        filters,
        rawQuery: queryData.rawQuery,
        createdAt: new Date().toISOString(),
      }
      const session = await searchApi.execute(query, { signal: activeSearchControllerRef.current.signal })
      setResults(session.results)
      setSelectedIds([])
      setStatusMessage(`Sesión recuperada con ${session.results.length} resultados.`)
      const refreshed = await searchApi.getHistory(1, 10)
      setHistory(refreshed.searches)
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "No se pudo ejecutar la búsqueda.")
    } finally {
      setIsSearching(false)
    }
  }, [filters, queryData])

  const recoverSession = useCallback(async (sessionId: string) => {
    setError(null)
    const session = await searchApi.getSession(sessionId)
    setResults(session.results)
    setSelectedIds([])
    setFilters(normalizeFilters(session.query.filters))
    setRawQuery(session.query.rawQuery ?? "")
    setVisualQuery({ rawQuery: session.query.rawQuery ?? "", terms: session.query.terms ?? [], operators: session.query.operators as BooleanOperator[] })
    setQueryMode((session.query.terms?.length ?? 0) > 1 ? "visual" : "raw")
    setStatusMessage(`Se recuperó la sesión ${session.id}.`)
  }, [])

  const saveAsHedge = useCallback(async () => {
    if (!hedgeName.trim() || !queryData.rawQuery.trim()) {
      setError("Debes indicar nombre y una consulta válida para guardar el hedge.")
      return
    }
    setIsSavingHedge(true)
    setError(null)
    try {
      await hedgesApi.create({
        name: hedgeName.trim(),
        category: hedgeCategory,
        query: queryData.rawQuery.trim(),
        description: hedgeDescription.trim(),
        estimatedResults: results.length,
      })
      setHedgeOpen(false)
      setHedgeName("")
      setHedgeDescription("")
      setStatusMessage("Hedge guardado correctamente.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el hedge.")
    } finally {
      setIsSavingHedge(false)
    }
  }, [hedgeCategory, hedgeDescription, hedgeName, queryData.rawQuery, results.length])

  const handleYearRangeChange = useCallback((value: number[]) => {
    if (!Array.isArray(value) || value.length !== 2) return
    const nextRange = [Math.min(value[0], value[1]), Math.max(value[0], value[1])] as [number, number]
    setFilters((prev) =>
      prev.yearRange[0] === nextRange[0] && prev.yearRange[1] === nextRange[1]
        ? prev
        : { ...prev, yearRange: nextRange }
    )
  }, [])

  const handleMinSampleSizeChange = useCallback((value: number[]) => {
    if (!Array.isArray(value)) return
    const nextSampleSize = Math.round(value[0] ?? 0)
    setFilters((prev) =>
      prev.minSampleSize === nextSampleSize
        ? prev
        : { ...prev, minSampleSize: nextSampleSize }
    )
  }, [])

  const handleMaxResultsChange = useCallback((value: number[]) => {
    if (!Array.isArray(value)) return
    const nextMaxResults = Math.round(value[0] ?? 30)
    setFilters((prev) =>
      prev.maxResults === nextMaxResults
        ? prev
        : { ...prev, maxResults: nextMaxResults }
    )
  }, [])

  const askAssistant = useCallback(async () => {
    if (!assistantInput.trim() || assistantLoading) return
    const nextMessages = [...assistantMessages, { role: "user" as const, content: assistantInput.trim() }]
    setAssistantMessages(nextMessages)
    setAssistantInput("")
    setAssistantLoading(true)
    try {
      const response = await searchAssistantApi.ask({
        message: nextMessages[nextMessages.length - 1].content,
        selectedTerms: queryData.terms.map((term) => term.term),
        operators: queryData.operators,
        recentTerms: history.flatMap((item) => item.terms.map((term) => term.term)).slice(0, 8),
        projectContext: "Profesor de EDUCEARCH preparando búsquedas docentes, hedges y casos clínicos.",
        conversationHistory: nextMessages.slice(-8).map((item): AssistantConversationMessage => ({ role: item.role, content: item.content })),
        filters: {
          yearFrom: filters.yearRange[0],
          yearTo: filters.yearRange[1],
          studyTypes: filters.studyTypes,
          hasFullText: filters.hasFullText,
          language: filters.languages[0],
          minSampleSize: filters.minSampleSize,
          maxResults: filters.maxResults,
        },
      })
      setAssistantMessages((prev) => [...prev, { role: "assistant", content: response.reply }])
      setAssistantTips(response.tips)
      setAssistantStatus(response.usedAi ? "Respuesta generada por IA." : "Respuesta entregada con fallback operativo.")
    } catch (assistantError) {
      setAssistantMessages((prev) => [...prev, { role: "assistant", content: assistantError instanceof Error ? assistantError.message : "Asistente no disponible." }])
      setAssistantStatus("Asistente no disponible temporalmente.")
    } finally {
      setAssistantLoading(false)
    }
  }, [assistantInput, assistantLoading, assistantMessages, filters, history, queryData.operators, queryData.terms])

  // Critical: stable callback so QueryBuilder's useEffect doesn't loop.
  const handleQueryChange = useCallback(
    (data: { rawQuery: string; terms: MeshTerm[]; operators: BooleanOperator[] }) => {
      setVisualQuery(data)
    },
    [],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Búsqueda del profesor</h1>
        <p className="mt-1 text-muted-foreground">Ejecuta búsquedas, recupera sesiones, guarda hedges y lleva evidencia directamente a un nuevo caso.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Tabs value={queryMode} onValueChange={(value) => setQueryMode(value === "raw" ? "raw" : "visual")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="visual">Constructor visual</TabsTrigger>
              <TabsTrigger value="raw">Consulta avanzada</TabsTrigger>
            </TabsList>
            <TabsContent value="visual" className="mt-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar términos MeSH..." className="pl-9" />
                {isLoadingSuggestions && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />}
              </div>
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((term) => <Badge key={term.id} variant="secondary">{term.term}</Badge>)}
                </div>
              )}
              <QueryBuilder availableTerms={suggestions} onQueryChange={handleQueryChange} />
            </TabsContent>
            <TabsContent value="raw" className="mt-4">
              <Textarea value={rawQuery} onChange={(e) => setRawQuery(e.target.value.slice(0, 1500))} className="min-h-[120px] font-mono text-xs" placeholder='Ej: ("Diabetes Mellitus"[MeSH]) AND ("Metformin"[MeSH])' />
            </TabsContent>
          </Tabs>

          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
              <CardDescription>Configuración docente para refinar resultados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Rango anual: {filters.yearRange[0]} - {filters.yearRange[1]}</Label>
                <YearRangeSlider
                  value={filters.yearRange}
                  min={YEAR_MIN}
                  max={YEAR_MAX}
                  onValueChange={handleYearRangeChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de estudio</Label>
                <div className="grid gap-2 md:grid-cols-2">
                  {STUDY_TYPES.map(([id, label]) => (
                    <label key={id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={filters.studyTypes.includes(id)} onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, studyTypes: checked ? [...new Set([...prev.studyTypes, id])] : prev.studyTypes.filter((item) => item !== id) }))} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Idioma principal</Label>
                <Select value={filters.languages[0]} onValueChange={(value) => setFilters((prev) => ({ ...prev, languages: [value] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={filters.hasFullText} onCheckedChange={(checked) => setFilters((prev) => ({ ...prev, hasFullText: checked === true }))} />
                <Label className="text-sm font-normal">Solo texto completo</Label>
              </div>
              <div className="space-y-2">
                <Label>Tamaño muestral mínimo: {filters.minSampleSize}</Label>
                <SingleSlider
                  value={filters.minSampleSize}
                  min={0}
                  max={1000}
                  step={10}
                  onValueChange={handleMinSampleSizeChange}
                />
              </div>
              <div className="space-y-2">
                <Label>Máximo de resultados: {filters.maxResults}</Label>
                <SingleSlider
                  value={filters.maxResults}
                  min={5}
                  max={200}
                  step={5}
                  onValueChange={handleMaxResultsChange}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => void executeSearch()} disabled={isSearching}>
              {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Ejecutar búsqueda
            </Button>
            <Dialog open={hedgeOpen} onOpenChange={setHedgeOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" disabled={!queryData.rawQuery.trim()}><Save className="mr-2 h-4 w-4" />Guardar como hedge</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Guardar estrategia</DialogTitle>
                  <DialogDescription>Convierte esta búsqueda en un Search Hedge reutilizable.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Input value={hedgeName} onChange={(e) => setHedgeName(e.target.value)} placeholder="Nombre del hedge" />
                  <Select value={hedgeCategory} onValueChange={setHedgeCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
                  </Select>
                  <Textarea value={hedgeDescription} onChange={(e) => setHedgeDescription(e.target.value)} placeholder="Descripción" />
                  <Button onClick={() => void saveAsHedge()} disabled={isSavingHedge}>{isSavingHedge ? "Guardando..." : "Guardar hedge"}</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="secondary" asChild disabled={selectedResults.length === 0}>
              <Link href={selectedResults.length > 0 ? `/professor/cases/new?articles=${encodeURIComponent(selectedResults.map((item) => item.id).join(","))}` : "/professor/cases/new"}>Crear caso con selección</Link>
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {statusMessage && <p className="text-sm text-muted-foreground">{statusMessage}</p>}

          <Card>
            <CardHeader>
              <CardTitle>Resultados</CardTitle>
              <CardDescription>{results.length} artículos recuperados</CardDescription>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay resultados cargados.</p>
              ) : (
                <ScrollArea className="h-[520px] pr-4">
                  <div className="space-y-3">
                    {results.map((result) => (
                      <Card key={result.id}>
                        <CardContent className="space-y-2 p-4">
                          <div className="flex items-start gap-3">
                            <Checkbox checked={selectedIds.includes(result.id)} onCheckedChange={(checked) => setSelectedIds((prev) => checked === true ? [...new Set([...prev, result.id])] : prev.filter((id) => id !== result.id))} />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{result.title || "Sin título"}</p>
                              <p className="text-sm text-muted-foreground">{result.authors.slice(0, 3).join(", ") || "Autor no disponible"}</p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <span>{result.journal || "Fuente sin revista"}</span>
                                <span>{result.year}</span>
                                <Badge variant="outline">Nivel {result.evidenceLevel}</Badge>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Historial reciente</CardTitle>
              <CardDescription>Sesiones reutilizables para continuar búsquedas anteriores.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando historial...</div>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay búsquedas guardadas.</p>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="line-clamp-2 text-sm font-medium">{item.rawQuery || item.terms.map((term) => term.term).join(" · ")}</p>
                          <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            void searchApi.saveSearch(item.id, !item.isFavorite).then(() => {
                              setHistory((prev) =>
                                prev.map((entry) =>
                                  entry.id === item.id ? { ...entry, isFavorite: !entry.isFavorite } : entry
                                )
                              )
                            })
                          }}
                        >
                          {item.isFavorite ? <Star className="h-4 w-4 fill-current text-amber-500" /> : <StarOff className="h-4 w-4" />}
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <Badge variant="outline">{item.resultCount ?? 0} resultados</Badge>
                        <Button size="sm" variant="outline" onClick={() => void recoverSession(item.id)}>Recuperar</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />Asistente IA</CardTitle>
              <CardDescription>Ayuda para refinar la estrategia docente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-[240px] rounded-lg border p-3">
                <div className="space-y-3">
                  {assistantMessages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={`rounded-lg px-3 py-2 text-sm ${message.role === "assistant" ? "bg-muted" : "bg-primary text-primary-foreground"}`}>{message.content}</div>
                  ))}
                </div>
              </ScrollArea>
              <Textarea value={assistantInput} onChange={(e) => setAssistantInput(e.target.value)} className="min-h-[100px]" placeholder="Ej: optimiza esta búsqueda para convertirla en un caso sobre EPOC..." />
              <Button onClick={() => void askAssistant()} disabled={assistantLoading || !assistantInput.trim()}>
                {assistantLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Consultar IA
              </Button>
              {assistantStatus && <p className="text-xs text-muted-foreground">{assistantStatus}</p>}
              {assistantTips.length > 0 && (
                <div className="space-y-1">
                  {assistantTips.map((tip, index) => <p key={index} className="text-xs text-muted-foreground">• {tip}</p>)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Selección para caso</CardTitle>
              <CardDescription>Artículos marcados para reutilizar en un nuevo caso.</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">Selecciona resultados de la lista para llevarlos a creación de casos.</p>
              ) : (
                <div className="space-y-3">
                  {selectedResults.map((result) => (
                    <div key={result.id} className="rounded-lg border p-3">
                      <p className="text-sm font-medium">{result.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{result.id} · {result.year}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}