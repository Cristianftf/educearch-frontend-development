import { api } from "./api-client"

export type TestSuiteStatus = "passed" | "failed" | "skipped" | "unknown"

export type TestSuiteStats = {
  total: number
  passed: number
  failed: number
  skipped: number
  durationMs: number
}

export type TestSuiteReport = {
  id: string
  status: TestSuiteStatus
  stats: TestSuiteStats
  updatedAt?: string
  artifacts: { label: string; path: string }[]
  lastRun?: { timestamp: string; exitCode: number; logPath?: string }
}

export type TestCaseResult = {
  id: string
  suiteId: string
  name: string
  status: TestSuiteStatus
  durationMs?: number
  file?: string
  message?: string
  origin?: "frontend" | "backend" | "e2e"
}

export type ManualTestLog = {
  id: string
  caseId?: string
  suiteId: string
  name: string
  status: "passed" | "failed" | "skipped"
  notes?: string
  createdAt: string
}

export type PlanTestCase = {
  id: string
  suiteId: string
  module: string
  title: string
  automation: "automated" | "manual"
  steps: string[]
  expected: string
  seedData?: string[]
  matches?: string[]
}

export type PlanCaseResolution = {
  caseId: string
  suiteId: string
  title: string
  module: string
  status: TestSuiteStatus
  source: "manual" | "automated" | "none"
  updatedAt?: string
  matchedTests: string[]
}

export type PlanCoverageSummary = {
  suiteId: string
  total: number
  passed: number
  failed: number
  skipped: number
  unknown: number
  coveragePercent: number
}

export type TestingCoverage = {
  overall: {
    total: number
    passed: number
    failed: number
    skipped: number
    unknown: number
    coveragePercent: number
  }
  suites: PlanCoverageSummary[]
  resolutions: PlanCaseResolution[]
  unitReadiness: {
    totalCases: number
    passedCases: number
    blockingFailures: number
    uncoveredCases: number
    readyForIntegration: boolean
  }
}

export type TestingConclusion = {
  status: "healthy" | "warning" | "critical"
  summary: string
  blockers: string[]
  readyForIntegration: boolean
}

export type TestingAiInsight = {
  generatedAt: string
  summary: string
  strengths: string[]
  gaps: string[]
  improvements: string[]
  risks: string[]
  nextActions: string[]
  confidence: number
}

export type AdminTestingReport = {
  generatedAt: string
  runnerEnabled: boolean
  suites: TestSuiteReport[]
  cases: TestCaseResult[]
  planCases: PlanTestCase[]
  manual: ManualTestLog[]
  coverage: TestingCoverage
  conclusion: TestingConclusion
}

export async function getTestingReport(): Promise<AdminTestingReport> {
  const response = await fetch("/api/admin/testing", { cache: "no-store" })
  if (!response.ok) {
    throw new Error("No se pudo cargar el reporte de pruebas")
  }
  return response.json()
}

export async function runTestSuite(suiteId: string) {
  const response = await fetch("/api/admin/testing/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suiteId }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.message || "No se pudo ejecutar la suite")
  }
  return response.json()
}

export async function createManualTestLog(payload: {
  suiteId: string
  caseId?: string
  name: string
  status: "passed" | "failed" | "skipped"
  notes?: string
}) {
  const response = await fetch("/api/admin/testing/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message || "No se pudo registrar la evidencia")
  }
  return response.json()
}


export async function analyzeTestingWithAi(payload: Record<string, unknown>): Promise<TestingAiInsight> {
  const response = await api.post<unknown>("/admin/testing/analyze", payload)
  return response as TestingAiInsight
}
