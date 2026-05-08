"use client"

import { useMemo, useState, useCallback, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { EvidencePyramid } from "@/components/evidence-pyramid"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { searchApi } from "@/lib/search"
import { BookOpen, Filter, Layers, ArrowRight, Loader2, Search } from "lucide-react"
import type { SearchResult } from "@/types"

type StudyBlock = {
  id: string
  pmid?: string
  title: string
  year: number
  sampleSize: number
  level: number
  hasConflictsOfInterest: boolean
  authors: string[]
  journal: string
  studyType?: string
  doi?: string
}

type PyramidResponseLevel = {
  level: number
  studies: Array<{
    id: string
    pmid?: string
    title: string
    year?: number
    sampleSize?: number
    evidenceLevel?: number
    hasConflictOfInterest?: boolean
    authors?: string[]
    journal?: string
    studyType?: string
    doi?: string
  }>
}

function mapToSearchResult(study: StudyBlock): SearchResult {
  const studyTypeByLevel: Record<number, string> = {
    1: "Systematic Review",
    2: "Randomized Controlled Trial",
    3: "Cohort Study",
    4: "Case-Control Study",
    5: "Case Series",
    6: "Expert Opinion",
  }

  return {
    id: study.id,
    pmid: study.pmid ?? study.id,
    title: study.title,
    authors: study.authors,
    journal: study.journal,
    year: study.year,
    abstract: "",
    studyType: study.studyType || studyTypeByLevel[study.level] || "Study",
    evidenceLevel: study.level,
    sampleSize: study.sampleSize || undefined,
    hasConflictOfInterest: study.hasConflictsOfInterest,
    doi: study.doi,
  }
}

export default function EvidencePyramidPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchId = (searchParams.get("searchId") ?? "").trim()
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null)
  const [selectedStudies, setSelectedStudies] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [studies, setStudies] = useState<StudyBlock[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastAutoQueryRef = useRef<string | null>(null)

  const inferEvidenceLevel = useCallback((studyType?: string) => {
    if (!studyType) return 6
    const normalized = studyType.toLowerCase()
    if (normalized.includes("systematic") || normalized.includes("meta")) return 1
    if (normalized.includes("randomized") || normalized.includes("clinical trial")) return 2
    if (normalized.includes("cohort")) return 3
    if (normalized.includes("case-control")) return 4
    if (normalized.includes("case report")) return 5
    return 6
  }, [])

  const mapResultsToStudies = useCallback((results: SearchResult[]) => {
    return results.map((result) => ({
      id: result.id,
      pmid: result.pmid,
      title: result.title,
      year: result.year,
      sampleSize: result.sampleSize || 0,
      level: result.evidenceLevel ?? inferEvidenceLevel(result.studyType),
      hasConflictsOfInterest: result.hasConflictOfInterest ?? false,
      authors: result.authors || [],
      journal: result.journal || "",
      studyType: result.studyType,
      doi: result.doi,
    }))
  }, [inferEvidenceLevel])

  const mapPyramidStudies = useCallback((levels: PyramidResponseLevel[]) => {
    return levels.flatMap((level) =>
      level.studies.map((study) => ({
        id: study.id,
        pmid: study.pmid,
        title: study.title,
        year: study.year ?? new Date().getFullYear(),
        sampleSize: study.sampleSize ?? 0,
        level: study.evidenceLevel ?? level.level,
        hasConflictsOfInterest: study.hasConflictOfInterest ?? false,
        authors: Array.isArray(study.authors) ? study.authors : [],
        journal: study.journal ?? "",
        studyType: study.studyType,
        doi: study.doi,
      }))
    )
  }, [])

  const runSearch = useCallback(async (term: string) => {
    const searchTerm = term.trim()
    if (!searchTerm) {
      setError("Ingresa un tema para buscar evidencia.")
      return
    }

    setIsSearching(true)
    setError(null)

    try {
      const session = await searchApi.execute({
        id: `pyramid-${Date.now()}`,
        terms: [{ id: searchTerm, term: searchTerm, description: "" }],
        operators: [],
        filters: {},
        rawQuery: searchTerm,
      })
      setStudies(mapResultsToStudies(session.results))
      setSelectedStudies([])
      setSelectedLevel(null)
    } catch (err) {
      console.error("[pyramid] Error fetching evidence:", err)
      setError("No se pudo cargar evidencia desde PubMed.")
    } finally {
      setIsSearching(false)
    }
  }, [mapResultsToStudies])

  const initialQuery = useMemo(() => (searchParams.get("q") ?? "").trim(), [searchParams])

  useEffect(() => {
    if (searchId) {
      let cancelled = false
      setIsSearching(true)
      setError(null)

      void searchApi
        .getEvidencePyramid(searchId)
        .then((response) => {
          if (cancelled) return
          const resolvedQuery = response.query?.raw || response.query?.terms?.join(" ") || initialQuery
          if (resolvedQuery) {
            setQuery(resolvedQuery)
          }
          setStudies(mapPyramidStudies(response.levels))
          setSelectedStudies([])
          setSelectedLevel(null)
        })
        .catch((err) => {
          if (cancelled) return
          console.error("[pyramid] Error fetching consolidated pyramid:", err)
          setError("No se pudo cargar la piramide consolidada de esta busqueda.")
        })
        .finally(() => {
          if (cancelled) return
          setIsSearching(false)
        })

      return () => {
        cancelled = true
      }
    }

    if (!initialQuery || lastAutoQueryRef.current === initialQuery) return
    lastAutoQueryRef.current = initialQuery
    setQuery(initialQuery)
    void runSearch(initialQuery)
  }, [initialQuery, mapPyramidStudies, runSearch, searchId])

  const filteredStudies = useMemo(() => {
    if (!selectedLevel) return studies
    return studies.filter((study) => study.level === selectedLevel)
  }, [selectedLevel, studies])

  const handleStudySelect = (study: StudyBlock) => {
    setSelectedStudies((prev) =>
      prev.includes(study.id) ? prev.filter((id) => id !== study.id) : [...prev, study.id]
    )
  }

  const handleAddToBibliography = (studyIds: string[]) => {
    const payload = studyIds
      .map((id) => studies.find((study) => study.id === id))
      .filter(Boolean)
      .map((study) => mapToSearchResult(study as StudyBlock))

    localStorage.setItem(
      "evidence_pyramid_selection_v2",
      JSON.stringify({ version: 2, items: payload })
    )
    router.push("/student/bibliography?source=pyramid")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
          <Layers className="h-7 w-7 text-primary" />
          Piramide de Evidencia Interactiva
        </h1>
        <p className="text-muted-foreground mt-1">
          Explora la jerarquia de evidencia y selecciona estudios para tu bibliografia.
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Buscar evidencia real
          </CardTitle>
          <CardDescription>
            {searchId
              ? "Visualiza la distribucion consolidada de la busqueda seleccionada o lanza una nueva consulta."
              : "Ingresa un tema o pregunta clinica para consultar PubMed."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ej: diabetes tipo 2 y metformina"
              disabled={isSearching}
            />
            <Button onClick={() => runSearch(query)} disabled={isSearching || !query.trim()}>
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                "Buscar evidencia"
              )}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && studies.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aun no hay resultados. Realiza una busqueda para cargar estudios reales.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EvidencePyramid
            studies={filteredStudies}
            selectedLevel={selectedLevel}
            onLevelSelect={(level) => setSelectedLevel(level === selectedLevel ? null : level)}
            selectedStudies={selectedStudies}
            onStudySelect={handleStudySelect}
            onAddToBibliography={handleAddToBibliography}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Uso sugerido
              </CardTitle>
              <CardDescription>
                Esta vista ayuda a priorizar evidencia de mayor calidad en tus trabajos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>1. Selecciona un nivel para filtrar el tipo de estudio.</p>
              <p>2. Haz clic en los bloques para marcar evidencia relevante.</p>
              <p>3. Genera tu bibliografia con la seleccion actual.</p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Seleccion actual
              </CardTitle>
              <CardDescription>
                {selectedStudies.length === 0
                  ? "No hay estudios seleccionados aun."
                  : "Revisa tu seleccion y genera bibliografia."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge variant="secondary">{selectedStudies.length} estudios seleccionados</Badge>
              <Button
                className="w-full"
                disabled={selectedStudies.length === 0}
                onClick={() => handleAddToBibliography(selectedStudies)}
              >
                Ir a bibliografia
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
