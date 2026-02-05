'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { CompetencyType } from '@/types'
import { cn } from '@/lib/utils'

interface StudentProgress {
  id: string
  name: string
  email: string
  avatar?: string
  competencies: Record<CompetencyType, number>
}

interface StudentsCompetencyHeatmapProps {
  students: StudentProgress[]
  onStudentClick?: (studentId: string) => void
  lowThreshold?: number
}

const competencyLabels: Record<CompetencyType, string> = {
  access: 'Acceso',
  process: 'Procesamiento',
  communicate: 'Comunicación',
}

function getColorClass(score: number, threshold: number): string {
  if (score < threshold) {
    return 'bg-red-500'
  }
  if (score < 70) {
    return 'bg-yellow-400'
  }
  if (score < 85) {
    return 'bg-lime-400'
  }
  return 'bg-green-500'
}

function getColorIntensity(score: number): number {
  // Returns opacity based on score
  return Math.max(0.3, score / 100)
}

export function StudentsCompetencyHeatmap({
  students,
  onStudentClick,
  lowThreshold = 60,
}: StudentsCompetencyHeatmapProps) {
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const avgA = (a.competencies.access + a.competencies.process + a.competencies.communicate) / 3
      const avgB = (b.competencies.access + b.competencies.process + b.competencies.communicate) / 3
      return avgA - avgB // Lowest first to highlight problems
    })
  }, [students])

  const competencies: CompetencyType[] = ['access', 'process', 'communicate']

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Mapa de calor - Competencias por estudiante</CardTitle>
        <CardDescription>
          Visualización del progreso de cada estudiante. Los colores más oscuros indican mejor desempeño.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Header row */}
        <div className="flex items-center gap-2 mb-4 pb-2 border-b">
          <div className="w-48 text-sm font-medium text-muted-foreground">Estudiante</div>
          {competencies.map((comp) => (
            <div
              key={comp}
              className="flex-1 text-center text-sm font-medium text-muted-foreground"
            >
              {competencyLabels[comp]}
            </div>
          ))}
          <div className="w-16 text-center text-sm font-medium text-muted-foreground">Prom.</div>
        </div>

        {/* Student rows */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-1">
            {sortedStudents.map((student) => {
              const avg = Math.round(
                (student.competencies.access +
                  student.competencies.process +
                  student.competencies.communicate) /
                  3
              )
              const hasLowScore = Object.values(student.competencies).some(
                (score) => score < lowThreshold
              )

              return (
                <div
                  key={student.id}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-lg transition-colors',
                    hasLowScore && 'bg-destructive/5',
                    onStudentClick && 'cursor-pointer hover:bg-muted'
                  )}
                  onClick={() => onStudentClick?.(student.id)}
                >
                  {/* Student info */}
                  <div className="w-48 flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={student.avatar || "/placeholder.svg"} />
                      <AvatarFallback className="text-xs">
                        {student.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{student.name}</p>
                    </div>
                  </div>

                  {/* Competency cells */}
                  {competencies.map((comp) => {
                    const score = student.competencies[comp]
                    return (
                      <TooltipProvider key={comp}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex-1 flex justify-center">
                              <div
                                className={cn(
                                  'w-full max-w-[80px] h-8 rounded-md flex items-center justify-center text-xs font-medium transition-all',
                                  getColorClass(score, lowThreshold)
                                )}
                                style={{ opacity: getColorIntensity(score) }}
                              >
                                <span className="text-white drop-shadow-sm">{score}%</span>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{student.name}</p>
                            <p className="text-sm">
                              {competencyLabels[comp]}: {score}%
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )
                  })}

                  {/* Average */}
                  <div className="w-16 flex justify-center">
                    <Badge
                      variant={avg < lowThreshold ? 'destructive' : avg < 70 ? 'secondary' : 'default'}
                    >
                      {avg}%
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t flex items-center justify-center gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-4 h-4 rounded bg-red-500" />
            <span>{'<'}{lowThreshold}%</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-4 h-4 rounded bg-yellow-400" />
            <span>{lowThreshold}-69%</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-4 h-4 rounded bg-lime-400" />
            <span>70-84%</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-4 h-4 rounded bg-green-500" />
            <span>85%+</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
