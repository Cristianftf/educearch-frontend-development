"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info, RotateCcw, ZoomIn, ZoomOut } from "lucide-react"
import type { SearchResult } from "@/types"

type EvidenceLevel = {
  level: number
  name: string
  description: string
  color: string
  bgColor: string
  examples: string[]
  reliability: string
}

const evidenceLevels: EvidenceLevel[] = [
  {
    level: 1,
    name: "Revisiones Sistemáticas y Metaanálisis",
    description: "Síntesis de múltiples estudios con metodología rigurosa. Máximo nivel de evidencia.",
    color: "text-emerald-700",
    bgColor: "bg-emerald-100 hover:bg-emerald-200",
    examples: ["Cochrane Reviews", "Metaanálisis publicados en JAMA"],
    reliability: "Muy Alta",
  },
  {
    level: 2,
    name: "Ensayos Clínicos Aleatorizados (ECA)",
    description: "Estudios experimentales con asignación aleatoria y grupo control.",
    color: "text-green-700",
    bgColor: "bg-green-100 hover:bg-green-200",
    examples: ["Ensayos fase III", "Estudios multicéntricos"],
    reliability: "Alta",
  },
  {
    level: 3,
    name: "Estudios de Cohorte",
    description: "Estudios observacionales que siguen grupos a lo largo del tiempo.",
    color: "text-lime-700",
    bgColor: "bg-lime-100 hover:bg-lime-200",
    examples: ["Framingham Heart Study", "Nurses Health Study"],
    reliability: "Moderada-Alta",
  },
  {
    level: 4,
    name: "Estudios de Casos y Controles",
    description: "Comparan grupos con y sin la condición de interés retrospectivamente.",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100 hover:bg-yellow-200",
    examples: ["Estudios epidemiológicos de factores de riesgo"],
    reliability: "Moderada",
  },
  {
    level: 5,
    name: "Series de Casos y Reportes",
    description: "Descripciones de casos individuales o grupos pequeños sin control.",
    color: "text-orange-700",
    bgColor: "bg-orange-100 hover:bg-orange-200",
    examples: ["Case reports", "Series de casos clínicos"],
    reliability: "Baja",
  },
  {
    level: 6,
    name: "Opinión de Expertos",
    description: "Consensos, editoriales y opiniones basadas en experiencia clínica.",
    color: "text-red-700",
    bgColor: "bg-red-100 hover:bg-red-200",
    examples: ["Guías de práctica clínica", "Editoriales"],
    reliability: "Muy Baja",
  },
]

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

type EvidencePyramidProps = {
  studies?: StudyBlock[]
  onLevelSelect?: (level: number) => void
  selectedLevel?: number | null
  interactive?: boolean
  onStudySelect?: (study: StudyBlock) => void
  selectedStudies?: string[]
  onAddToBibliography?: (studyIds: string[]) => void
}

export function EvidencePyramid({
  studies = [],
  onLevelSelect,
  selectedLevel,
  interactive = true,
  onStudySelect,
  selectedStudies = [],
  onAddToBibliography,
}: EvidencePyramidProps) {
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null)
  const [rotation, setRotation] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [yearRange, setYearRange] = useState<[number, number]>([2000, 2024])
  const [minSampleSize, setMinSampleSize] = useState(0)
  const [showConflictsOnly, setShowConflictsOnly] = useState(false)

  const handleLevelClick = (level: number) => {
    if (interactive && onLevelSelect) {
      onLevelSelect(level)
    }
  }

  const handleStudyClick = (study: StudyBlock) => {
    if (onStudySelect) {
      onStudySelect(study)
    }
  }

  const getStudyColor = (year: number): string => {
    const currentYear = new Date().getFullYear()
    const age = currentYear - year
    if (age <= 2) return 'bg-blue-500'
    if (age <= 5) return 'bg-green-500'
    if (age <= 10) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getStudySize = (sampleSize: number): number => {
    const minSize = 20
    const maxSize = 60
    const clampedSize = Math.max(10, Math.min(10000, sampleSize))
    return minSize + (clampedSize / 10000) * (maxSize - minSize)
  }

  const filteredStudies = studies.filter(study => {
    const inYearRange = study.year >= yearRange[0] && study.year <= yearRange[1]
    const hasMinSample = study.sampleSize >= minSampleSize
    const conflictsFilter = !showConflictsOnly || study.hasConflictsOfInterest
    return inYearRange && hasMinSample && conflictsFilter
  })

  const studiesByLevel = evidenceLevels.map(level => ({
    ...level,
    studies: filteredStudies.filter(study => study.level === level.level)
  }))

  return (
    <div className="space-y-6">
      {/* 3D Pyramid Visualization */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Pirámide de Evidencia 3D
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Visualización 3D de la pirámide de evidencia con estudios representados como bloques.
                      Color: antigüedad del estudio. Tamaño: número de pacientes.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setRotation(r => r - 15)}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative h-96 overflow-hidden">
            <div
              className="relative w-full h-full flex items-end justify-center"
              style={{
                transform: `rotateY(${rotation}deg) scale(${zoom})`,
                transformStyle: 'preserve-3d',
                perspective: '1000px'
              }}
            >
              {studiesByLevel.map((levelData, levelIndex) => {
                const level = levelData.level
                const width = Math.max(20, 100 - levelIndex * 15)
                const height = 40
                const depth = 30

                return (
                  <div
                    key={level}
                    className="absolute flex flex-col items-center"
                    style={{
                      bottom: `${levelIndex * 60}px`,
                      width: `${width}%`,
                      height: `${height}px`,
                      transform: `translateZ(${levelIndex * 20}px)`,
                      transformStyle: 'preserve-3d'
                    }}
                  >
                    {/* Level Platform */}
                    <div
                      className={`
                        w-full h-full border-2 rounded-sm cursor-pointer transition-all duration-200
                        ${levelData.bgColor} border-gray-300
                        ${selectedLevel === level ? "ring-2 ring-primary ring-offset-2" : ""}
                        ${hoveredLevel === level ? "scale-105 shadow-lg" : ""}
                      `}
                      onClick={() => handleLevelClick(level)}
                      onMouseEnter={() => setHoveredLevel(level)}
                      onMouseLeave={() => setHoveredLevel(null)}
                    >
                      <div className="flex items-center justify-center h-full">
                        <span className={`text-xs font-medium ${levelData.color}`}>
                          Nivel {level}
                        </span>
                      </div>
                    </div>

                    {/* Studies as blocks */}
                    <div className="absolute top-0 left-0 w-full h-full flex flex-wrap justify-center gap-1 p-1">
                      {levelData.studies.map((study, studyIndex) => {
                        const blockSize = getStudySize(study.sampleSize)
                        const isSelected = selectedStudies.includes(study.id)

                        return (
                          <TooltipProvider key={study.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className={`
                                    rounded-sm border-2 transition-all duration-200 hover:scale-110
                                    ${getStudyColor(study.year)}
                                    ${study.hasConflictsOfInterest ? 'border-red-500' : 'border-gray-400'}
                                    ${isSelected ? 'ring-2 ring-yellow-400' : ''}
                                  `}
                                  style={{
                                    width: `${blockSize}px`,
                                    height: `${blockSize}px`,
                                    transform: `translateZ(${studyIndex * 5 + 10}px)`,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleStudyClick(study)
                                  }}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <div className="space-y-1">
                                  <p className="font-semibold text-sm">{study.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {study.authors.join(', ')} ({study.year})
                                  </p>
                                  <p className="text-xs">{study.journal}</p>
                                  <p className="text-xs">Pacientes: {study.sampleSize.toLocaleString()}</p>
                                  {study.hasConflictsOfInterest && (
                                    <p className="text-xs text-red-600 font-medium">
                                      ⚠️ Conflictos de interés
                                    </p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros Contextuales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Año de publicación</Label>
            <Slider
              value={yearRange}
              onValueChange={(value) => setYearRange(value as [number, number])}
              min={2000}
              max={2024}
              step={1}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{yearRange[0]}</span>
              <span>{yearRange[1]}</span>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Tamaño muestral mínimo</Label>
            <Slider
              value={[minSampleSize]}
              onValueChange={(value) => setMinSampleSize(value[0])}
              min={0}
              max={10000}
              step={100}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {minSampleSize.toLocaleString()} pacientes
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="conflicts"
              checked={showConflictsOnly}
              onCheckedChange={(checked) => setShowConflictsOnly(checked === true)}
            />
            <Label htmlFor="conflicts" className="text-sm">
              Mostrar solo estudios con conflictos de interés
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* My Evidence Zone */}
      {selectedStudies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Mi Evidencia
              <Badge variant="secondary">{selectedStudies.length} estudios</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Estudios seleccionados para tu bibliografía
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {selectedStudies.map(studyId => {
                const study = studies.find(s => s.id === studyId)
                if (!study) return null

                return (
                  <div key={study.id} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div>
                      <p className="text-sm font-medium truncate">{study.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {study.authors[0]} et al. ({study.year})
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onStudySelect?.(study)}
                    >
                      Ver detalles
                    </Button>
                  </div>
                )
              })}
            </div>

            {onAddToBibliography && (
              <Button
                className="w-full mt-4"
                onClick={() => onAddToBibliography(selectedStudies)}
              >
                Generar bibliografía con {selectedStudies.length} estudios
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function EvidenceLevelBadge({ level }: { level: number }) {
  const evidenceLevel = evidenceLevels.find((l) => l.level === level)
  if (!evidenceLevel) return null

  return (
    <Badge className={`${evidenceLevel.bgColor} ${evidenceLevel.color} border-0`}>
      Nivel {level}: {evidenceLevel.name.split(" ")[0]}
    </Badge>
  )
}
