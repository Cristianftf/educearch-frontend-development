"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { searchApi, hedgesApi } from "@/lib/api"
import type { MeshTerm, SearchFilters, SearchQuery, SearchResult } from "@/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Search, Save, Sparkles } from "lucide-react"
import QueryBuilder from "@/components/query-builder"

type BooleanOperator = "AND" | "OR" | "NOT"

export default function ProfessorSearchPage() {
  const [queryMode, setQueryMode] = useState<"visual" | "raw">("visual")
  const [searchTerm, setSearchTerm] = useState("")
  const [suggestions, setSuggestions] = useState<MeshTerm[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [visualQuery, setVisualQuery] = useState<{
    rawQuery: string
    terms: MeshTerm[]
    operators: BooleanOperator[]
  } | null>(null)
  const [rawQuery, setRawQuery] = useState("")
  const [filters, setFilters] = useState<SearchFilters>({ yearRange: [2018, 2026] })
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [hedgeOpen, setHedgeOpen] = useState(false)
  const [hedgeName, setHedgeName] = useState("")
  const [hedgeCategory, setHedgeCategory] = useState("")
  const [hedgeDescription, setHedgeDescription] = useState("")
  const [categories, setCategories] = useState<string[]>([])
  const [isSavingHedge, setIsSavingHedge] = useState(false)

  useEffect(() => {
    hedgesApi.getCategories().then(setCategories).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (searchTerm.length < 2) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      setIsLoadingSuggestions(true)
      try {
        const res = await searchApi.getMeshSuggestions(searchTerm)
        setSuggestions(res)
      } catch {
        setSuggestions([])
      } finally {
        setIsLoadingSuggestions(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  const activeRawQuery = useMemo(() => (
    queryMode === "visual" ? visualQuery?.rawQuery || "" : rawQuery
  ), [queryMode, rawQuery, visualQuery])
  const activeTerms = useMemo(() => (
    queryMode === "visual"
      ? visualQuery?.terms || []
      : rawQuery
        ? [{ id: "raw", term: rawQuery }]
        : []
  ), [queryMode, rawQuery, visualQuery])
  const activeOperators = useMemo(() => (
    queryMode === "visual" ? visualQuery?.operators || [] : []
  ), [queryMode, visualQuery])

  const executeSearch = useCallback(async () => {
    if (!activeRawQuery.trim() || activeTerms.length === 0) {
      setError("Construye una Búsqueda antes de ejecutar.")
      return
    }
    setIsSearching(true)
    setError(null)
    try {
      const query: SearchQuery = {
        id:
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `prof-query-${Date.now()}`,
        terms: activeTerms,
        operators: activeOperators,
        filters,
        rawQuery: activeRawQuery,
        createdAt: new Date().toISOString(),
      }
      const session = await searchApi.execute(query)
      setResults(session.results)
    } catch (err) {
      setError("Error al ejecutar la Búsqueda.")
    } finally {
      setIsSearching(false)
    }
  }, [activeRawQuery, activeTerms, activeOperators, filters])

  const saveAsHedge = useCallback(async () => {
    if (!activeRawQuery.trim() || !hedgeName.trim()) return
    setIsSavingHedge(true)
    try {
      await hedgesApi.create({
        name: hedgeName.trim(),
        category: hedgeCategory || "General",
        query: activeRawQuery.trim(),
        description: hedgeDescription.trim(),
        estimatedResults: results.length,
      })
      setHedgeOpen(false)
      setHedgeName("")
      setHedgeDescription("")
    } finally {
      setIsSavingHedge(false)
    }
  }, [activeRawQuery, hedgeName, hedgeCategory, hedgeDescription, results.length])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Búsqueda Profesor</h1>
        <p className="text-muted-foreground mt-1">
          Ejecuta Búsquedas y guarda estrategias como Search Hedges reutilizables.
        </p>
      </div>

      <Tabs value={queryMode} onValueChange={(v) => setQueryMode(v as "visual" | "raw")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="visual" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Constructor visual
          </TabsTrigger>
          <TabsTrigger value="raw">Query avanzada</TabsTrigger>
        </TabsList>

        <TabsContent value="visual" className="mt-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar Términos MeSH..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {isLoadingSuggestions && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
            )}
          </div>

          {suggestions.length > 0 && (
            <Card className="border-primary/20">
              <CardContent className="p-3">
                <div className="flex flex-wrap gap-2">
                  {suggestions.slice(0, 10).map((term) => (
                    <Badge key={term.id} variant="secondary">
                      {term.term}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <QueryBuilder
            availableTerms={suggestions}
            onQueryChange={(data) => setVisualQuery(data)}
          />
        </TabsContent>

        <TabsContent value="raw" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Query PubMed</Label>
            <Textarea
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder='Ej: ("Diabetes Mellitus"[MeSH]) AND ("Metformin"[MeSH])'
              className="min-h-[120px] font-mono text-xs"
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={executeSearch} disabled={isSearching}>
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Ejecutar Búsqueda
            </>
          )}
        </Button>

        <Dialog open={hedgeOpen} onOpenChange={setHedgeOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={!activeRawQuery.trim()}>
              <Save className="mr-2 h-4 w-4" />
              Guardar como hedge
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Guardar estrategia</DialogTitle>
              <DialogDescription>
                Convierte esta Búsqueda en un Search Hedge reutilizable.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={hedgeName} onChange={(e) => setHedgeName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={hedgeCategory} onValueChange={setHedgeCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories.length > 0 ? categories : ["General"]).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={hedgeDescription}
                  onChange={(e) => setHedgeDescription(e.target.value)}
                />
              </div>
              <Button onClick={saveAsHedge} disabled={isSavingHedge || !hedgeName.trim()}>
                {isSavingHedge ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Resultados</CardTitle>
          <CardDescription>{results.length} artículos encontrados</CardDescription>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay resultados aún.</p>
          ) : (
            <ScrollArea className="h-[420px] pr-4">
              <div className="space-y-3">
                {results.map((result) => (
                  <Card key={result.id} className="hover:bg-muted/40 transition-colors">
                    <CardContent className="p-4 space-y-2">
                      <p className="font-medium">{result.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {result.authors.slice(0, 3).join(", ")}
                        {result.authors.length > 3 && " et al."}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{result.journal}</span>
                        <span>{result.year}</span>
                        <Badge variant="outline">Nivel {result.evidenceLevel}</Badge>
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
  )
}
