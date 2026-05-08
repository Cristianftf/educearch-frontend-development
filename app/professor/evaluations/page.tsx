'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { evaluationApi } from '@/lib/api'
import type { CaseSubmission } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  RefreshCw,
} from 'lucide-react'

const safeShortId = (value?: string, length = 8) => {
  if (typeof value !== 'string') return 'N/A'
  const normalized = value.trim()
  return normalized ? normalized.slice(0, length) : 'N/A'
}

const formatSubmissionDate = (value?: string) => {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Sin fecha'
    : date.toLocaleString('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
}

export default function ProfessorEvaluationsPage() {
  const [pending, setPending] = useState<CaseSubmission[]>([])
  const [reviewed, setReviewed] = useState<CaseSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSubmissions = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }
    setError(null)

    try {
      const response = await evaluationApi.getAll()
      setPending(response.pending)
      setReviewed(response.reviewed)
    } catch (loadError) {
      console.error('[professor evaluations] Error loading submissions:', loadError)
      setError('No se pudieron cargar las evaluaciones del profesor.')
      setPending([])
      setReviewed([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadSubmissions('initial')
  }, [loadSubmissions])

  const averageReviewedScore = useMemo(() => {
    if (reviewed.length === 0) return 0
    const total = reviewed.reduce((sum, submission) => sum + (submission.evaluation?.overallScore ?? 0), 0)
    return Math.round(total / reviewed.length)
  }, [reviewed])

  if (isLoading) {
    return <EvaluationsSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
            <ClipboardCheck className="h-8 w-8 text-primary" />
            Evaluaciones
          </h1>
          <p className="mt-1 text-muted-foreground">
            Revisa entregas pendientes, consulta evaluaciones ya emitidas y continúa el flujo por detalle.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadSubmissions('refresh')} disabled={isRefreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          label="Pendientes"
          value={pending.length}
          helper="Entregas por revisar"
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          label="Evaluadas"
          value={reviewed.length}
          helper="Con retroalimentación registrada"
        />
        <SummaryCard
          icon={<FileText className="h-5 w-5 text-blue-600" />}
          label="Promedio emitido"
          value={`${averageReviewedScore}%`}
          helper="Promedio sobre evaluaciones finalizadas"
        />
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">Pendientes</TabsTrigger>
          <TabsTrigger value="reviewed">Revisadas</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <SubmissionList
            title="Entregas pendientes"
            description="Continúa cada evaluación desde la vista detallada."
            items={pending}
            emptyMessage="No hay entregas pendientes."
            actionLabel="Evaluar"
          />
        </TabsContent>

        <TabsContent value="reviewed">
          <SubmissionList
            title="Evaluaciones revisadas"
            description="Consulta o ajusta evaluaciones emitidas previamente."
            items={reviewed}
            emptyMessage="No hay evaluaciones registradas."
            actionLabel="Ver detalle"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SubmissionList({
  title,
  description,
  items,
  emptyMessage,
  actionLabel,
}: {
  title: string
  description: string
  items: CaseSubmission[]
  emptyMessage: string
  actionLabel: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex min-h-[160px] items-center justify-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((submission) => (
              <div
                key={submission.id}
                className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={submission.status === 'reviewed' ? 'secondary' : 'outline'}>
                      {submission.status === 'reviewed' ? 'Revisada' : 'Pendiente'}
                    </Badge>
                    {submission.evaluation?.overallScore !== undefined && (
                      <Badge variant="outline">{submission.evaluation.overallScore}%</Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium">
                    Caso #{safeShortId(submission.caseId)} · Estudiante #{safeShortId(submission.studentId)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Enviado: {formatSubmissionDate(submission.submittedAt)}
                  </p>
                </div>

                <Button asChild>
                  <Link href={`/professor/evaluations/${submission.id}`}>
                    {actionLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode
  label: string
  value: string | number
  helper: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">{helper}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function EvaluationsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-28 w-full" />
        ))}
      </div>

      <Skeleton className="h-[360px] w-full" />
    </div>
  )
}
