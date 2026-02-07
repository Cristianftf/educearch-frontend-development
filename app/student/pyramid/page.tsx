"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { EvidencePyramid } from "@/components/evidence-pyramid"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Filter, Layers, ArrowRight } from "lucide-react"
import type { SearchResult } from "@/types"

type StudyBlock = {
  id: string
  title: string
  year: number
  sampleSize: number
  level: number
  hasConflictsOfInterest: boolean
  authors: string[]
  journal: string
}

const demoStudies: StudyBlock[] = [
  {
    id: "sr-01",
    title: "Metaanálisis sobre control glucémico en diabetes tipo 2",
    year: 2023,
    sampleSize: 24500,
    level: 1,
    hasConflictsOfInterest: false,
    authors: ["Lopez A.", "Mendez R."],
    journal: "Journal of Clinical Evidence",
  },
  {
    id: "rct-01",
    title: "Ensayo clínico aleatorizado: dieta mediterránea vs estándar",
    year: 2022,
    sampleSize: 820,
    level: 2,
    hasConflictsOfInterest: true,
    authors: ["Garcia P.", "Duarte M."],
    journal: "Clinical Nutrition Research",
  },
  {
    id: "coh-01",
    title: "Cohorte multicéntrica de hipertensión en adultos jóvenes",
    year: 2021,
    sampleSize: 5400,
    level: 3,
    hasConflictsOfInterest: false,
    authors: ["Santos L.", "Perez J."],
    journal: "Epidemiology Today",
  },
  {
    id: "cc-01",
    title: "Caso-control: factores de riesgo cardiovasculares",
    year: 2020,
    sampleSize: 1200,
    level: 4,
    hasConflictsOfInterest: false,
    authors: ["Ramos T.", "Vega C."],
    journal: "Cardio Science",
  },
  {
    id: "cr-01",
    title: "Serie de casos sobre efectos adversos de antibióticos",
    year: 2019,
    sampleSize: 38,
    level: 5,
    hasConflictsOfInterest: false,
    authors: ["Ruiz H."],
    journal: "Case Reports in Medicine",
  },
  {
    id: "exp-01",
    title: "Opinión de expertos sobre manejo del dolor crónico",
    year: 2018,
    sampleSize: 0,
    level: 6,
    hasConflictsOfInterest: true,
    authors: ["Panel de expertos UCI"],
    journal: "Clinical Guidelines Review",
  },
]

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
    pmid: study.id,
    title: study.title,
    authors: study.authors,
    journal: study.journal,
    year: study.year,
    abstract: "Resumen no disponible en modo demo. Reemplazar con datos reales.",
    studyType: studyTypeByLevel[study.level] || "Study",
    evidenceLevel: study.level,
    sampleSize: study.sampleSize || undefined,
    hasConflictOfInterest: study.hasConflictsOfInterest,
  }
}

export default function EvidencePyramidPage() {
  const router = useRouter()
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null)
  const [selectedStudies, setSelectedStudies] = useState<string[]>([])

  const filteredStudies = useMemo(() => {
    if (!selectedLevel) return demoStudies
    return demoStudies.filter((s) => s.level === selectedLevel)
  }, [selectedLevel])

  const handleStudySelect = (study: StudyBlock) => {
    setSelectedStudies((prev) =>
      prev.includes(study.id) ? prev.filter((id) => id !== study.id) : [...prev, study.id]
    )
  }

  const handleAddToBibliography = (studyIds: string[]) => {
    const payload = studyIds
      .map((id) => demoStudies.find((s) => s.id === id))
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
          Pirámide de Evidencia Interactiva
        </h1>
        <p className="text-muted-foreground mt-1">
          Explora la jerarquía de evidencia y selecciona estudios para tu bibliografía.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Vista demo: los datos son de ejemplo y no provienen de búsquedas reales.
        </p>
      </div>

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
              <p>3. Genera tu bibliografía con la selección actual.</p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Selección actual
              </CardTitle>
              <CardDescription>
                {selectedStudies.length === 0
                  ? "No hay estudios seleccionados aún."
                  : "Revisa tu selección y genera bibliografía."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge variant="secondary">
                {selectedStudies.length} estudios seleccionados
              </Badge>
              <Button
                className="w-full"
                disabled={selectedStudies.length === 0}
                onClick={() => handleAddToBibliography(selectedStudies)}
              >
                Ir a bibliografía
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
