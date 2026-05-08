"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Database,
  Eye,
  Play,
  RefreshCw,
  Shield,
  Users,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  AdminTestingReport,
  ManualTestLog,
  PlanTestCase,
  TestCaseResult,
  TestSuiteReport,
  TestingAiInsight,
  analyzeTestingWithAi,
  createManualTestLog,
  getTestingReport,
  runTestSuite,
} from "@/lib/admin-testing"

const XP_SUITES = [
  {
    id: "unit",
    title: "Unitarias (TDD)",
    description: "Validaciones, utilidades, servicios y componentes UI críticos.",
    owner: "Frontend/Backend",
    mode: "Automatizada",
    icon: CheckCircle,
  },
  {
    id: "integration",
    title: "Integración (API + Datos)",
    description: "Endpoints REST, cache, BD, WebSocket, servicios externos.",
    owner: "Backend",
    mode: "Manual/Automatizada",
    icon: Activity,
  },
  {
    id: "e2e",
    title: "E2E por Rol",
    description: "Flujos por rol: público, estudiante, profesor y admin.",
    owner: "QA",
    mode: "Automatizada",
    icon: Users,
  },
  {
    id: "resilience",
    title: "Resiliencia y Fallback",
    description: "Degradación, reintentos, modo offline parcial.",
    owner: "Frontend/Backend",
    mode: "Manual",
    icon: AlertTriangle,
  },
  {
    id: "security",
    title: "Seguridad",
    description: "RBAC, validación de entradas, rate limiting y tokens.",
    owner: "Seguridad",
    mode: "Manual",
    icon: Shield,
  },
  {
    id: "performance",
    title: "Rendimiento",
    description: "Latencias, concurrencia y carga sobre operaciones críticas.",
    owner: "QA",
    mode: "Manual",
    icon: Zap,
  },
  {
    id: "usability",
    title: "Usabilidad y Accesibilidad",
    description: "Responsive, teclado, lector de pantalla, copy de errores.",
    owner: "UX",
    mode: "Manual",
    icon: Eye,
  },
  {
    id: "data",
    title: "Datos y Migraciones",
    description: "Flyway, backups/restore, limpieza de logs y cache.",
    owner: "Backend",
    mode: "Manual",
    icon: Database,
  },
]

type ManualFormState = {
  caseId?: string
  suiteId: string
  name: string
  status: "passed" | "failed" | "skipped"
  notes: string
}

const defaultManualForm: ManualFormState = {
  caseId: undefined,
  suiteId: "unit",
  name: "",
  status: "passed",
  notes: "",
}

const RUNNABLE_SUITES = new Set(["unit", "e2e"])

const EXECUTION_GUIDE: Record<string, { command?: string; steps: string[]; evidence: string[] }> = {
  unit: {
    command: "node scripts/run-unit-suite.mjs",
    steps: [
      "Ejecuta Vitest para frontend y Maven Surefire para backend.",
      "Verifica que los casos UT-01 a UT-09 queden cubiertos por evidencia automatizada.",
      "Corrige cualquier fallo antes de avanzar a integración.",
    ],
    evidence: [
      "test-results/unit/results.json",
      "test-results/unit/junit.xml",
      "backend/target/surefire-reports",
    ],
  },
  integration: {
    steps: [
      "Levanta backend y dependencias (DB/Redis).",
      "Ejecuta las rutas críticas con datos reales.",
      "Registra evidencia manual o automatizada adicional en este panel.",
    ],
    evidence: ["test-results/manual/logs.json"],
  },
  e2e: {
    command: "npm run test:e2e",
    steps: [
      "Ejecuta Playwright con el frontend levantado.",
      "Revisa el reporte HTML y los artefactos JUnit.",
      "Registra hallazgos manuales si hay degradación no cubierta por la suite.",
    ],
    evidence: ["test-results/e2e/junit.xml", "test-results/e2e/html"],
  },
  resilience: {
    steps: [
      "Simula caída del backend y latencias elevadas.",
      "Valida fallback y mensajes de degradación.",
      "Registra evidencia manual en este panel.",
    ],
    evidence: ["test-results/manual/logs.json"],
  },
  security: {
    steps: [
      "Ejecuta pruebas de RBAC, 401/403 y validaciones.",
      "Valida inputs contra SQL/XSS/CSV injection.",
      "Registra evidencia manual en este panel.",
    ],
    evidence: ["test-results/manual/logs.json"],
  },
  performance: {
    steps: [
      "Ejecuta cargas concurrentes en búsqueda, verificación y chat.",
      "Mide p50/p95/p99 en endpoints clave.",
      "Registra evidencia manual en este panel.",
    ],
    evidence: ["test-results/manual/logs.json"],
  },
  usability: {
    steps: [
      "Revisa responsive en pantallas clave.",
      "Valida navegación por teclado y lectura de errores.",
      "Registra evidencia manual en este panel.",
    ],
    evidence: ["test-results/manual/logs.json"],
  },
  data: {
    steps: [
      "Ejecuta migraciones desde cero y sobre BD existente.",
      "Prueba backup/restore y limpieza segura de logs/cache.",
      "Registra evidencia manual en este panel.",
    ],
    evidence: ["test-results/manual/logs.json"],
  },
}

const buildEmptySuite = (id: string): TestSuiteReport => ({
  id,
  status: "unknown",
  stats: { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 },
  artifacts: [],
})

const formatDateTime = (value?: string) => {
  if (!value) return "Sin datos"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sin datos"
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const formatDuration = (ms?: number) => {
  if (!ms || ms <= 0) return "--"
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

const formatSourceLabel = (source: "manual" | "automated" | "plan" | "none") => {
  if (source === "manual") return "Manual"
  if (source === "automated") return "Automatizada"
  if (source === "plan") return "Plan"
  return "Sin evidencia"
}

const statusBadge = (status: TestSuiteReport["status"]) => {
  if (status === "passed") return "bg-green-100 text-green-700 border-green-200"
  if (status === "failed") return "bg-red-100 text-red-700 border-red-200"
  if (status === "skipped") return "bg-amber-100 text-amber-700 border-amber-200"
  return "bg-muted text-muted-foreground border-border"
}

const normalizeAiInsight = (value: Partial<TestingAiInsight> | null): TestingAiInsight | null => {
  if (!value) return null
  return {
    generatedAt: value.generatedAt ?? new Date().toISOString(),
    summary: value.summary ?? "Sin resumen disponible.",
    strengths: value.strengths ?? [],
    gaps: value.gaps ?? [],
    improvements: value.improvements ?? [],
    risks: value.risks ?? [],
    nextActions: value.nextActions ?? [],
    confidence: typeof value.confidence === "number" ? value.confidence : 0.5,
  }
}

export default function AdminTestingPage() {
  const [report, setReport] = useState<AdminTestingReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [runningSuite, setRunningSuite] = useState<string | null>(null)
  const [manualForm, setManualForm] = useState<ManualFormState>(defaultManualForm)
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [aiInsight, setAiInsight] = useState<TestingAiInsight | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const loadReport = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getTestingReport()
      setReport(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar reporte")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReport()
  }, [loadReport])

  const suiteMap = useMemo(() => {
    const map = new Map<string, TestSuiteReport>()
    for (const suite of report?.suites ?? []) {
      map.set(suite.id, suite)
    }
    return map
  }, [report])

  const casesBySuite = useMemo(() => {
    const grouped = new Map<string, TestCaseResult[]>()
    for (const item of report?.cases ?? []) {
      const existing = grouped.get(item.suiteId) ?? []
      existing.push(item)
      grouped.set(item.suiteId, existing)
    }
    return grouped
  }, [report])

  const manualBySuite = useMemo(() => {
    const grouped = new Map<string, ManualTestLog[]>()
    for (const item of report?.manual ?? []) {
      const existing = grouped.get(item.suiteId) ?? []
      existing.push(item)
      grouped.set(item.suiteId, existing)
    }
    return grouped
  }, [report])

  const manualByCaseId = useMemo(() => {
    const map = new Map<string, ManualTestLog>()
    for (const entry of report?.manual ?? []) {
      if (!entry.caseId) continue
      const current = map.get(entry.caseId)
      if (!current || new Date(entry.createdAt) > new Date(current.createdAt)) {
        map.set(entry.caseId, entry)
      }
    }
    return map
  }, [report])

  const planCasesBySuite = useMemo(() => {
    const grouped = new Map<string, PlanTestCase[]>()
    for (const item of report?.planCases ?? []) {
      const existing = grouped.get(item.suiteId) ?? []
      existing.push(item)
      grouped.set(item.suiteId, existing)
    }
    return grouped
  }, [report])

  const coverageBySuite = useMemo(() => {
    const map = new Map<string, NonNullable<AdminTestingReport["coverage"]>["suites"][number]>()
    for (const suite of report?.coverage?.suites ?? []) {
      map.set(suite.suiteId, suite)
    }
    return map
  }, [report])

  const totalStats = useMemo(() => {
    const base = { total: 0, passed: 0, failed: 0, skipped: 0 }
    for (const suite of report?.suites ?? []) {
      base.total += suite.stats.total
      base.passed += suite.stats.passed
      base.failed += suite.stats.failed
      base.skipped += suite.stats.skipped
    }
    return base
  }, [report])

  const unitPlanCases = useMemo(
    () => (report?.planCases ?? []).filter((planCase) => planCase.suiteId === "unit"),
    [report]
  )

  const resolveCaseStatus = useCallback(
    (planCase: PlanTestCase): { status: TestSuiteReport["status"]; source: "manual" | "automated" | "plan" | "none"; updatedAt?: string } => {
      const manual = manualByCaseId.get(planCase.id)
      if (manual) {
        return { status: manual.status as TestSuiteReport["status"], source: "manual", updatedAt: manual.createdAt }
      }

      if (planCase.matches?.length) {
        const automated = casesBySuite.get(planCase.suiteId) ?? []
        const matched = automated.filter((item) =>
          planCase.matches?.some((match) => item.name.toLowerCase().includes(match.toLowerCase()))
        )
        if (matched.length) {
          const hasFailed = matched.some((item) => item.status === "failed")
          const hasSkipped = matched.some((item) => item.status === "skipped")
          return {
            status: hasFailed ? "failed" : hasSkipped ? "skipped" : "passed",
            source: "automated",
            updatedAt: report?.generatedAt,
          }
        }
      }

      return { status: "unknown", source: "none", updatedAt: undefined }
    },
    [casesBySuite, manualByCaseId, report]
  )

  const buildAiPayload = useCallback(() => {
    if (!report) return null
    const suites = report.suites.map((suite) => ({
      id: suite.id,
      status: suite.status,
      stats: suite.stats,
      updatedAt: suite.updatedAt,
      lastRun: suite.lastRun,
    }))
    const failingTests = report.cases
      .filter((testCase) => testCase.status === "failed")
      .slice(0, 30)
      .map((testCase) => ({
        name: testCase.name,
        file: testCase.file,
        durationMs: testCase.durationMs,
        origin: testCase.origin,
      }))
    const manualRecent = report.manual.slice(0, 30).map((entry) => ({
      caseId: entry.caseId,
      suiteId: entry.suiteId,
      name: entry.name,
      status: entry.status,
      createdAt: entry.createdAt,
    }))

    return {
      generatedAt: report.generatedAt,
      summary: totalStats,
      suites,
      planCoverage: report.coverage,
      conclusion: report.conclusion,
      failingTests,
      manualRecent,
    }
  }, [report, totalStats])

  const handleAiAnalyze = async () => {
    const payload = buildAiPayload()
    if (!payload) return
    setAiLoading(true)
    setAiError(null)
    try {
      const response = await analyzeTestingWithAi(payload)
      setAiInsight(normalizeAiInsight(response))
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "No se pudo ejecutar el analisis IA")
    } finally {
      setAiLoading(false)
    }
  }

  const handleRunSuite = async (suiteId: string) => {
    if (!report?.runnerEnabled || !RUNNABLE_SUITES.has(suiteId)) return
    setRunningSuite(suiteId)
    setError(null)
    try {
      await runTestSuite(suiteId)
      await loadReport()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ejecutar la suite")
    } finally {
      setRunningSuite(null)
    }
  }

  const handleManualSubmit = async () => {
    setManualSubmitting(true)
    setError(null)
    try {
      await createManualTestLog({
        caseId: manualForm.caseId,
        suiteId: manualForm.suiteId,
        name: manualForm.name,
        status: manualForm.status,
        notes: manualForm.notes,
      })
      setManualForm((prev) => ({ ...prev, caseId: undefined, name: "", notes: "" }))
      await loadReport()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el log")
    } finally {
      setManualSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pruebas XP del Sistema</h1>
          <p className="text-muted-foreground">
            Evidencia automatizada y manual basada en el plan de pruebas del proyecto.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadReport} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar logs
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pruebas automatizadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pasaron</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalStats.passed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Fallaron</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalStats.failed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{totalStats.skipped}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Estado General del Plan</CardTitle>
            <CardDescription>
              Cobertura del plan XP y readiness de pruebas unitarias antes de integración.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Casos del plan</p>
                <p className="text-2xl font-bold">{report?.coverage.overall.total ?? 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cobertura</p>
                <p className="text-2xl font-bold">{report?.coverage.overall.coveragePercent ?? 0}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">UT cubiertas</p>
                <p className="text-2xl font-bold text-green-600">
                  {report?.coverage.unitReadiness.passedCases ?? 0}/{report?.coverage.unitReadiness.totalCases ?? 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Listo para integración</p>
                <p
                  className={`text-2xl font-bold ${
                    report?.coverage.unitReadiness.readyForIntegration ? "text-green-600" : "text-amber-600"
                  }`}
                >
                  {report?.coverage.unitReadiness.readyForIntegration ? "Sí" : "No"}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {(report?.coverage.suites ?? []).map((suiteCoverage) => {
                const suite = XP_SUITES.find((item) => item.id === suiteCoverage.suiteId)
                return (
                  <div key={suiteCoverage.suiteId} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {suite?.title ?? suiteCoverage.suiteId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {suiteCoverage.passed} OK · {suiteCoverage.failed} fallos · {suiteCoverage.unknown} sin evidencia
                        </p>
                      </div>
                      <Badge variant="outline">{suiteCoverage.coveragePercent}%</Badge>
                    </div>
                    <Progress value={suiteCoverage.coveragePercent} className="mt-3 h-2" />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conclusión Operativa</CardTitle>
            <CardDescription>
              Dictamen automático según fallos, cobertura y readiness de las unitarias.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge
              variant="outline"
              className={
                report?.conclusion.status === "healthy"
                  ? "bg-green-100 text-green-700 border-green-200"
                  : report?.conclusion.status === "critical"
                    ? "bg-red-100 text-red-700 border-red-200"
                    : "bg-amber-100 text-amber-700 border-amber-200"
              }
            >
              {report?.conclusion.status === "healthy"
                ? "Estable"
                : report?.conclusion.status === "critical"
                  ? "Bloqueado"
                  : "Incompleto"}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {report?.conclusion.summary ?? "Sin conclusión disponible."}
            </p>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-semibold text-foreground mb-2">Bloqueadores</p>
              {(report?.conclusion.blockers?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Sin bloqueadores registrados.</p>
              ) : (
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  {report?.conclusion.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Matriz Unitaria Prioritaria</CardTitle>
          <CardDescription>
            Seguimiento de los casos UT-01 a UT-09 con módulo, datos de prueba y evidencia actual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Caso</TableHead>
                <TableHead>Datos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Evidencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unitPlanCases.map((planCase) => {
                const resolved = resolveCaseStatus(planCase)
                return (
                  <TableRow key={planCase.id}>
                    <TableCell className="font-medium">{planCase.id}</TableCell>
                    <TableCell>{planCase.module}</TableCell>
                    <TableCell className="max-w-[320px]">
                      <div className="space-y-1">
                        <p className="font-medium">{planCase.title}</p>
                        <p className="text-xs text-muted-foreground">{planCase.expected}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {(planCase.seedData ?? []).length === 0 ? (
                          <span>Sin datos semilla</span>
                        ) : (
                          planCase.seedData?.map((item) => (
                            <div key={`${planCase.id}-${item}`}>{item}</div>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadge(resolved.status)}>
                        {resolved.status === "passed"
                          ? "OK"
                          : resolved.status === "failed"
                            ? "Falló"
                            : resolved.status === "skipped"
                              ? "Pendiente"
                              : "Sin datos"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div>{formatSourceLabel(resolved.source)}</div>
                        <div>{resolved.updatedAt ? formatDateTime(resolved.updatedAt) : "--"}</div>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Análisis IA de Pruebas</CardTitle>
            <CardDescription>
              Envía los logs actuales a la IA integrada para recibir mejoras y sugerencias.
            </CardDescription>
          </div>
          <Button onClick={handleAiAnalyze} disabled={aiLoading || !report}>
            {aiLoading ? "Analizando..." : "Analizar con IA"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {aiError && <div className="text-sm text-destructive">{aiError}</div>}

          {aiInsight ? (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <Badge variant="secondary">Actualizado: {formatDateTime(aiInsight.generatedAt)}</Badge>
                <Badge variant="outline">
                  Confianza: {(aiInsight.confidence * 100).toFixed(0)}%
                </Badge>
              </div>
              <Progress value={Math.round(aiInsight.confidence * 100)} className="h-2" />

              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-semibold text-foreground mb-2">Resumen IA</p>
                <p className="text-sm text-muted-foreground">{aiInsight.summary}</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-semibold text-foreground mb-2">Fortalezas</p>
                  {aiInsight.strengths.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin fortalezas registradas.</p>
                  ) : (
                    <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                      {aiInsight.strengths.map((item) => (
                        <li key={`strength-${item}`}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-semibold text-foreground mb-2">Brechas</p>
                  {aiInsight.gaps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin brechas registradas.</p>
                  ) : (
                    <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                      {aiInsight.gaps.map((item) => (
                        <li key={`gap-${item}`}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-semibold text-foreground mb-2">Mejoras sugeridas</p>
                  {aiInsight.improvements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin mejoras registradas.</p>
                  ) : (
                    <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                      {aiInsight.improvements.map((item) => (
                        <li key={`improve-${item}`}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-semibold text-foreground mb-2">Riesgos</p>
                  {aiInsight.risks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin riesgos registrados.</p>
                  ) : (
                    <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                      {aiInsight.risks.map((item) => (
                        <li key={`risk-${item}`}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold text-foreground mb-2">Siguientes acciones</p>
                {aiInsight.nextActions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin acciones sugeridas.</p>
                ) : (
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                    {aiInsight.nextActions.map((item) => (
                      <li key={`next-${item}`}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ejecuta el análisis para obtener mejoras y sugerencias de la IA.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {XP_SUITES.map((suite) => {
          const reportSuite = suiteMap.get(suite.id) ?? buildEmptySuite(suite.id)
          const suiteCoverage = coverageBySuite.get(suite.id)
          const Icon = suite.icon
          const isRunning = runningSuite === suite.id
          const canRun = report?.runnerEnabled && RUNNABLE_SUITES.has(suite.id)
          return (
            <Card key={suite.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>{suite.title}</CardTitle>
                      <CardDescription>{suite.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className={statusBadge(reportSuite.status)}>
                    {reportSuite.status === "passed"
                      ? "OK"
                      : reportSuite.status === "failed"
                        ? "Falló"
                        : reportSuite.status === "skipped"
                          ? "Pendiente"
                          : "Sin datos"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Owner</p>
                    <p className="font-medium">{suite.owner}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Modo</p>
                    <p className="font-medium">{suite.mode}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-medium">{reportSuite.stats.total}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fallos</p>
                    <p className="font-medium text-red-600">{reportSuite.stats.failed}</p>
                  </div>
                </div>

                {suiteCoverage && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    Cobertura: {suiteCoverage.coveragePercent}% · {suiteCoverage.passed} OK · {suiteCoverage.failed} fallos · {suiteCoverage.unknown} sin evidencia
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {reportSuite.artifacts.map((artifact) => (
                    <Badge key={`${suite.id}-${artifact.path}`} variant="secondary">
                      {artifact.label}: {artifact.path}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Última actualización: {formatDateTime(reportSuite.updatedAt)}</span>
                  {reportSuite.lastRun?.timestamp && (
                    <span>Última ejecución: {formatDateTime(reportSuite.lastRun.timestamp)}</span>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRunSuite(suite.id)}
                    disabled={!canRun || isRunning}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {isRunning ? "Ejecutando..." : "Ejecutar"}
                  </Button>
                  {!RUNNABLE_SUITES.has(suite.id) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setManualForm((prev) => ({
                          ...prev,
                          suiteId: suite.id,
                          caseId: undefined,
                          name: "",
                        }))
                      }
                    >
                      Registrar evidencia
                    </Button>
                  )}
                  {!canRun && suite.mode !== "Manual" && (
                    <span className="self-center text-xs text-muted-foreground">
                      Habilita `ENABLE_ADMIN_TEST_RUNNER=true` para ejecutar desde el panel.
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registro Manual de Evidencias</CardTitle>
          <CardDescription>
            Registra resultados de pruebas manuales o externas para mantener trazabilidad.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">Suite</label>
              <Select
                value={manualForm.suiteId}
                onValueChange={(value) => setManualForm((prev) => ({ ...prev, suiteId: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {XP_SUITES.map((suite) => (
                    <SelectItem key={suite.id} value={suite.id}>
                      {suite.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Caso del plan</label>
              <Select
                value={manualForm.caseId ?? "none"}
                onValueChange={(value) =>
                  setManualForm((prev) => {
                    if (value === "none") {
                      return { ...prev, caseId: undefined }
                    }
                    const selectedPlanCase = (report?.planCases ?? []).find((item) => item.id === value)
                    return {
                      ...prev,
                      caseId: value,
                      suiteId: selectedPlanCase?.suiteId ?? prev.suiteId,
                      name: selectedPlanCase ? `${selectedPlanCase.id} ${selectedPlanCase.title}` : prev.name,
                    }
                  })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecciona un caso del plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asociar</SelectItem>
                  {(report?.planCases ?? []).map((planCase) => (
                    <SelectItem key={planCase.id} value={planCase.id}>
                      {planCase.id} · {planCase.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Nombre de la prueba</label>
              <Input
                className="mt-1"
                placeholder="Ej: /api/auth/login devuelve 200"
                value={manualForm.name}
                onChange={(event) => setManualForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground">Resultado</label>
              <Select
                value={manualForm.status}
                onValueChange={(value) =>
                  setManualForm((prev) => ({
                    ...prev,
                    status: value === "failed" || value === "skipped" ? value : "passed",
                  }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passed">Pasó</SelectItem>
                  <SelectItem value="failed">Falló</SelectItem>
                  <SelectItem value="skipped">Pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Notas</label>
              <Textarea
                className="mt-1 min-h-[90px]"
                placeholder="Observaciones, entorno, evidencias..."
                value={manualForm.notes}
                onChange={(event) => setManualForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end md:col-span-2">
            <Button onClick={handleManualSubmit} disabled={manualSubmitting || !manualForm.name.trim()}>
              {manualSubmitting ? "Guardando..." : "Registrar evidencia"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalle por Suite</CardTitle>
          <CardDescription>Listado de pruebas automatizadas, cobertura del plan y logs manuales.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="unit">
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
              {XP_SUITES.map((suite) => (
                <TabsTrigger key={suite.id} value={suite.id}>
                  {suite.title.split(" ")[0]}
                </TabsTrigger>
              ))}
            </TabsList>
            {XP_SUITES.map((suite) => {
              const automatedCases = casesBySuite.get(suite.id) ?? []
              const manualCases = manualBySuite.get(suite.id) ?? []
              const guide = EXECUTION_GUIDE[suite.id]
              const planCases = planCasesBySuite.get(suite.id) ?? []
              const suiteCoverage = coverageBySuite.get(suite.id)
              return (
                <TabsContent key={suite.id} value={suite.id} className="mt-4 space-y-6">
                  {guide && (
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">Guía de ejecución</span>
                        {guide.command && <Badge variant="secondary">Comando: {guide.command}</Badge>}
                      </div>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {guide.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-2">
                        {guide.evidence.map((evidencePath) => (
                          <Badge key={`${suite.id}-${evidencePath}`} variant="outline">
                            Evidencia: {evidencePath}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-foreground">Casos del plan XP</h3>
                    {planCases.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin casos definidos para esta suite.</p>
                    ) : (
                      <Accordion type="single" collapsible className="space-y-2">
                        {planCases.map((planCase) => {
                          const resolved = resolveCaseStatus(planCase)
                          return (
                            <AccordionItem key={planCase.id} value={planCase.id} className="rounded-lg border px-3">
                              <AccordionTrigger className="py-3">
                                <div className="flex flex-wrap items-center gap-3 text-left">
                                  <span className="font-medium text-foreground">
                                    {planCase.id} · {planCase.title}
                                  </span>
                                  <Badge variant="outline" className={statusBadge(resolved.status)}>
                                    {resolved.status === "passed"
                                      ? "OK"
                                      : resolved.status === "failed"
                                        ? "Falló"
                                        : resolved.status === "skipped"
                                          ? "Pendiente"
                                          : "Sin datos"}
                                  </Badge>
                                  <Badge variant="secondary">
                                    {planCase.automation === "automated" ? "Automatizada" : "Manual"}
                                  </Badge>
                                  <Badge variant="outline">{planCase.module}</Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="space-y-3 pb-4">
                                {(planCase.seedData?.length ?? 0) > 0 && (
                                  <div className="text-sm text-muted-foreground">
                                    <p className="mb-1 font-medium text-foreground">Datos de prueba</p>
                                    <ul className="list-disc space-y-1 pl-5">
                                      {planCase.seedData?.map((item) => (
                                        <li key={`${planCase.id}-${item}`}>{item}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                <div className="text-sm text-muted-foreground">
                                  <p className="mb-1 font-medium text-foreground">Pasos</p>
                                  <ol className="list-decimal space-y-1 pl-5">
                                    {planCase.steps.map((step) => (
                                      <li key={`${planCase.id}-${step}`}>{step}</li>
                                    ))}
                                  </ol>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  <span className="font-medium text-foreground">Esperado: </span>
                                  {planCase.expected}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setManualForm((prev) => ({
                                        ...prev,
                                        suiteId: planCase.suiteId,
                                        caseId: planCase.id,
                                        name: `${planCase.id} ${planCase.title}`,
                                      }))
                                    }
                                  >
                                    Registrar resultado
                                  </Button>
                                  {RUNNABLE_SUITES.has(planCase.suiteId) && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => handleRunSuite(planCase.suiteId)}
                                      disabled={!report?.runnerEnabled || runningSuite === planCase.suiteId}
                                    >
                                      {runningSuite === planCase.suiteId ? "Ejecutando..." : "Ejecutar suite"}
                                    </Button>
                                  )}
                                  {resolved.updatedAt && (
                                    <span className="text-xs text-muted-foreground">
                                      Última evidencia: {formatDateTime(resolved.updatedAt)}
                                    </span>
                                  )}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          )
                        })}
                      </Accordion>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-foreground">Automatizadas</h3>
                    {suiteCoverage && (
                      <div className="mb-3 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                        Cobertura de suite: {suiteCoverage.coveragePercent}% · {suiteCoverage.passed} OK · {suiteCoverage.failed} fallos · {suiteCoverage.unknown} sin evidencia
                      </div>
                    )}
                    {automatedCases.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin pruebas automatizadas registradas.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Prueba</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Duración</TableHead>
                            <TableHead>Origen</TableHead>
                            <TableHead>Fuente</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {automatedCases.map((testCase) => (
                            <TableRow key={testCase.id}>
                              <TableCell className="max-w-[420px] truncate">{testCase.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={statusBadge(testCase.status)}>
                                  {testCase.status === "passed"
                                    ? "OK"
                                    : testCase.status === "failed"
                                      ? "Falló"
                                      : testCase.status === "skipped"
                                        ? "Pendiente"
                                        : "Sin datos"}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatDuration(testCase.durationMs)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{testCase.origin ?? "--"}</TableCell>
                              <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                                {testCase.file ?? "--"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-foreground">Logs manuales</h3>
                    {manualCases.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin evidencia manual registrada.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Prueba</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Notas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {manualCases.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="max-w-[320px] truncate">{entry.name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={statusBadge(entry.status)}>
                                  {entry.status === "passed"
                                    ? "OK"
                                    : entry.status === "failed"
                                      ? "Falló"
                                      : "Pendiente"}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatDateTime(entry.createdAt)}</TableCell>
                              <TableCell className="max-w-[320px] truncate text-xs text-muted-foreground">
                                {entry.notes || "--"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
