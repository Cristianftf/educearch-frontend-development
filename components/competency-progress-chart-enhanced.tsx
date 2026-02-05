'use client'

import React, { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowRight, TrendingUp } from 'lucide-react'
import type { CompetencyType, CompetencyProgress } from '@/types'

interface CompetencyChartData {
  date: string
  score: number
  level: string
}

interface CompetencyProgressChartProps {
  competencyType: CompetencyType
  competencyData: CompetencyProgress
  historicalData?: CompetencyChartData[]
  onActionClick?: () => void
  actionLabel?: string
}

const competencyLabels: Record<CompetencyType, string> = {
  access: 'Acceso a la Información',
  process: 'Procesamiento de Información',
  communicate: 'Comunicación de Información',
}

const competencyDescriptions: Record<CompetencyType, string> = {
  access: 'Dominio de búsquedas MeSH y operadores booleanos',
  process: 'Verificación de claims y evaluación de evidencia',
  communicate: 'Generación de bibliografías y citación',
}

const competencyColors: Record<CompetencyType, string> = {
  access: 'text-chart-1',
  process: 'text-chart-2',
  communicate: 'text-chart-3',
}

const levelLabels = {
  novice: 'Novato',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
}

const levelColors = {
  novice: 'bg-warning/20 text-warning-foreground border-warning',
  intermediate: 'bg-chart-1/20 text-chart-1 border-chart-1',
  advanced: 'bg-success/20 text-success border-success',
}

// Datos simulados para histórico (en producción vienen del backend)
const generateMockHistoricalData = (competencyType: CompetencyType): CompetencyChartData[] => {
  const data: CompetencyChartData[] = []
  const baseScores = {
    access: [20, 30, 40, 45, 55, 60, 70, 75],
    process: [15, 25, 35, 40, 48, 52, 60, 65],
    communicate: [30, 35, 45, 50, 60, 68, 75, 82],
  }

  const scores = baseScores[competencyType]
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)

  for (let i = 0; i < scores.length; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i * 4)
    data.push({
      date: date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
      score: scores[i],
      level: scores[i] < 50 ? 'novice' : scores[i] < 75 ? 'intermediate' : 'advanced',
    })
  }

  return data
}

export function CompetencyProgressChart({
  competencyType,
  competencyData,
  historicalData,
  onActionClick,
  actionLabel,
}: CompetencyProgressChartProps) {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('month')

  const data = useMemo(() => {
    if (historicalData) {
      return historicalData
    }
    return generateMockHistoricalData(competencyType)
  }, [competencyType, historicalData])

  const filteredData = useMemo(() => {
    if (timeRange === 'week') {
      return data.slice(-2)
    }
    if (timeRange === 'month') {
      return data.slice(-4)
    }
    return data
  }, [data, timeRange])

  const avgScore = useMemo(() => {
    const scores = filteredData.map((d) => d.score)
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  }, [filteredData])

  const trend = useMemo(() => {
    if (filteredData.length < 2) return 0
    const first = filteredData[0].score
    const last = filteredData[filteredData.length - 1].score
    return last - first
  }, [filteredData])

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{competencyLabels[competencyType]}</CardTitle>
            <CardDescription>{competencyDescriptions[competencyType]}</CardDescription>
          </div>
          {competencyData && (
            <Badge variant="outline" className={levelColors[competencyData.level]}>
              {levelLabels[competencyData.level]}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Score Display */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Score Actual</p>
            <p className="text-2xl font-bold text-chart-1">{competencyData?.score || 0}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Promedio (período)</p>
            <p className="text-2xl font-bold text-chart-2">{avgScore}%</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tendencia</p>
            <div className="flex items-center gap-1">
              <TrendingUp
                className={`h-4 w-4 ${trend >= 0 ? 'text-success' : 'text-destructive'} ${
                  trend < 0 ? 'rotate-180' : ''
                }`}
              />
              <p className={`text-2xl font-bold ${trend >= 0 ? 'text-success' : 'text-destructive'}`}>
                {trend >= 0 ? '+' : ''}{trend}%
              </p>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="w-full h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--muted-foreground)" opacity={0.2} />
              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground)"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                style={{ fontSize: '12px' }}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke={`var(--chart-${['1', '2', '3'][['access', 'process', 'communicate'].indexOf(competencyType)]})`}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Ver:</span>
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as any)}>
            <SelectTrigger className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="all">Todo el período</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action Button */}
        {onActionClick && actionLabel && (
          <Button onClick={onActionClick} className="w-full">
            {actionLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
