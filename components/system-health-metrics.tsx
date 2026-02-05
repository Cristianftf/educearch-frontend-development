'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Cpu,
  Database,
  HardDrive,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react'
import type { SystemHealth } from '@/types'

interface SystemHealthMetricsProps {
  health: SystemHealth | null
  isLoading?: boolean
}

export function SystemHealthMetrics({ health, isLoading = false }: SystemHealthMetricsProps) {
  if (!health || isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-20 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const metrics = [
    {
      label: 'CPU',
      value: `${Math.round(health.cpu)}%`,
      icon: Cpu,
      color: 'text-orange-500',
      bgColor: 'bg-orange-100/10',
      progress: health.cpu,
      critical: health.cpu > 80,
    },
    {
      label: 'Memoria',
      value: `${Math.round(health.memory)}%`,
      icon: Database,
      color: 'text-blue-500',
      bgColor: 'bg-blue-100/10',
      progress: health.memory,
      critical: health.memory > 85,
    },
    {
      label: 'Cache Hit Ratio',
      value: `${Math.round(health.cacheHitRatio * 100)}%`,
      icon: HardDrive,
      color: 'text-green-500',
      bgColor: 'bg-green-100/10',
      progress: health.cacheHitRatio * 100,
      critical: health.cacheHitRatio < 50,
    },
    {
      label: 'Peticiones/min',
      value: Math.round(health.requestsPerMinute).toString(),
      icon: Activity,
      color: 'text-purple-500',
      bgColor: 'bg-purple-100/10',
      progress: Math.min((health.requestsPerMinute / 10000) * 100, 100),
      critical: false,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon
        return (
          <Card key={metric.label} className={metric.critical ? 'border-red-200 bg-red-50/10' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  <Icon className={`h-4 w-4 ${metric.color}`} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{metric.value}</span>
                {metric.critical && (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <Progress
                value={metric.progress}
                className={metric.critical ? '[&>div]:bg-red-500' : ''}
              />
              <p className="text-xs text-muted-foreground">
                {metric.progress > 80 ? 'Alto' : metric.progress > 50 ? 'Normal' : 'Bajo'}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
