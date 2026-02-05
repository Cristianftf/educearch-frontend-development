'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { CompetencyType } from '@/types'

interface ProgressDataPoint {
  date: string
  access: number
  process: number
  communicate: number
}

interface CompetencyProgressChartProps {
  data: ProgressDataPoint[]
  title?: string
  description?: string
  showLegend?: boolean
  height?: number
}

const chartConfig = {
  access: {
    label: 'Acceso',
    color: 'hsl(var(--chart-1))',
  },
  process: {
    label: 'Procesamiento',
    color: 'hsl(var(--chart-2))',
  },
  communicate: {
    label: 'Comunicación',
    color: 'hsl(var(--chart-3))',
  },
}

export function CompetencyProgressChart({
  data,
  title = 'Evolución de competencias',
  description = 'Progreso a lo largo del tiempo',
  showLegend = true,
  height = 300,
}: CompetencyProgressChartProps) {
  const formattedData = useMemo(() => {
    return data.map((point) => ({
      ...point,
      date: new Date(point.date).toLocaleDateString('es', { month: 'short', day: 'numeric' }),
    }))
  }, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradientAccess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradientProcess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradientCommunicate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              className="text-xs"
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            {showLegend && <Legend />}
            <Area
              type="monotone"
              dataKey="access"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="url(#gradientAccess)"
              name="Acceso"
            />
            <Area
              type="monotone"
              dataKey="process"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              fill="url(#gradientProcess)"
              name="Procesamiento"
            />
            <Area
              type="monotone"
              dataKey="communicate"
              stroke="hsl(var(--chart-3))"
              strokeWidth={2}
              fill="url(#gradientCommunicate)"
              name="Comunicación"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// Mini sparkline version for dashboard cards
export function CompetencySparkline({
  data,
  competency,
  height = 60,
}: {
  data: number[]
  competency: CompetencyType
  height?: number
}) {
  const chartData = data.map((value, index) => ({ index, value }))
  const color = chartConfig[competency].color

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
