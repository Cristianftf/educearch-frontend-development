'use client'

import React, { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import type { CompetencyType, User } from '@/types'

interface StudentCompetencyScore {
  studentId: string
  studentName: string
  studentEmail: string
  avatar?: string
  scores: Record<CompetencyType, number>
  averageScore: number
}

interface StudentsCompetencyHeatmapProps {
  students: StudentCompetencyScore[]
  isLoading?: boolean
  onStudentClick?: (student: StudentCompetencyScore) => void
  lowProgressThreshold?: number
}

const competencyLabels: Record<CompetencyType, string> = {
  access: 'Acceso',
  process: 'Procesamiento',
  communicate: 'Comunicación',
}

const getScoreColor = (score: number): string => {
  if (score >= 75) return 'bg-emerald-500/20 text-emerald-700'
  if (score >= 50) return 'bg-yellow-500/20 text-yellow-700'
  if (score >= 25) return 'bg-orange-500/20 text-orange-700'
  return 'bg-red-500/20 text-red-700'
}

const getScoreBgColor = (score: number): string => {
  if (score >= 75) return 'bg-emerald-600'
  if (score >= 50) return 'bg-yellow-600'
  if (score >= 25) return 'bg-orange-600'
  return 'bg-red-600'
}

export function StudentsCompetencyHeatmap({
  students,
  isLoading = false,
  onStudentClick,
  lowProgressThreshold = 60,
}: StudentsCompetencyHeatmapProps) {
  const lowProgressStudents = useMemo(() => {
    return students.filter((s) => s.averageScore < lowProgressThreshold)
  }, [students, lowProgressThreshold])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Heatmap de Competencias</CardTitle>
          <CardDescription>Progreso por estudiante y competencia</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Alerts for low progress students */}
      {lowProgressStudents.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="flex items-start gap-4 py-4">
            <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-orange-900">
                {lowProgressStudents.length} estudiante{lowProgressStudents.length !== 1 ? 's' : ''} con progreso bajo ({lowProgressThreshold}% o menor)
              </p>
              <p className="text-sm text-orange-800 mt-1">
                Considera enviar recordatorios o ofrecer ayuda adicional.
              </p>
              <div className="flex gap-2 mt-3 flex-wrap">
                {lowProgressStudents.map((student) => (
                  <Badge key={student.studentId} variant="outline" className="border-orange-300">
                    {student.studentName}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Heatmap Table */}
      <Card>
        <CardHeader>
          <CardTitle>Heatmap de Competencias</CardTitle>
          <CardDescription>Progreso por estudiante y competencia (0-100%)</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[200px]">Estudiante</TableHead>
                <TableHead className="text-center">{competencyLabels.access}</TableHead>
                <TableHead className="text-center">{competencyLabels.process}</TableHead>
                <TableHead className="text-center">{competencyLabels.communicate}</TableHead>
                <TableHead className="text-center font-bold">Promedio</TableHead>
                <TableHead className="text-center">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow
                  key={student.studentId}
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => onStudentClick?.(student)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {student.avatar && (
                        <img
                          src={student.avatar}
                          alt={student.studentName}
                          className="h-8 w-8 rounded-full"
                        />
                      )}
                      <div>
                        <p className="font-medium">{student.studentName}</p>
                        <p className="text-xs text-muted-foreground">{student.studentEmail}</p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Competency scores */}
                  {(['access', 'process', 'communicate'] as CompetencyType[]).map((comp) => {
                    const score = student.scores[comp]
                    return (
                      <TableCell key={comp} className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${getScoreBgColor(score)}`}
                          >
                            {score}
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded ${getScoreColor(score)}`}>
                            {score >= 75 ? '✓' : score >= 50 ? '⚠' : '✗'}
                          </span>
                        </div>
                      </TableCell>
                    )
                  })}

                  {/* Average score */}
                  <TableCell className="text-center font-bold">
                    <div
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-bold ${getScoreBgColor(
                        student.averageScore
                      )}`}
                    >
                      {Math.round(student.averageScore)}
                    </div>
                  </TableCell>

                  {/* Action */}
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onStudentClick?.(student)
                      }}
                    >
                      Ver detalles
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>

        {/* Legend */}
        <div className="px-6 py-4 border-t bg-muted/30">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-600"></div>
              <span>75-100% (Avanzado)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
              <span>50-74% (Intermedio)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-600"></div>
              <span>25-49% (Básico)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-600"></div>
              <span>0-24% (Novato)</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
