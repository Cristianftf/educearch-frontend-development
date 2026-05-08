import { NextResponse } from "next/server"
import path from "node:path"
import fs from "node:fs/promises"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ROOT = process.cwd()
const UNIT_JSON = path.join(ROOT, "test-results", "unit", "results.json")
const UNIT_JUNIT = path.join(ROOT, "test-results", "unit", "junit.xml")
const BACKEND_SUREFIRE = path.join(ROOT, "backend", "target", "surefire-reports")
const E2E_JUNIT = path.join(ROOT, "test-results", "e2e", "junit.xml")
const MANUAL_LOGS = path.join(ROOT, "test-results", "manual", "logs.json")
const RUN_INDEX = path.join(ROOT, "test-results", "runs", "index.json")
const PLAN_CASES = path.join(ROOT, "data", "testing", "xp-test-cases.json")

type SuiteStats = {
  total: number
  passed: number
  failed: number
  skipped: number
  durationMs: number
}

type TestCaseResult = {
  id: string
  suiteId: string
  name: string
  status: "passed" | "failed" | "skipped" | "unknown"
  durationMs?: number
  file?: string
  message?: string
  origin?: "frontend" | "backend" | "e2e"
}

type SuiteReport = {
  id: string
  status: "passed" | "failed" | "skipped" | "unknown"
  stats: SuiteStats
  updatedAt?: string
  artifacts: { label: string; path: string }[]
  lastRun?: { timestamp: string; exitCode: number; logPath?: string }
}

type PlanTestCase = {
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

type ManualLog = {
  id: string
  caseId?: string
  suiteId: string
  name: string
  status: "passed" | "failed" | "skipped"
  notes?: string
  createdAt: string
}

function buildEmptyStats(): SuiteStats {
  return { total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 }
}

function normalizeStatus(stats: SuiteStats): SuiteReport["status"] {
  if (!stats.total) return "unknown"
  if (stats.failed > 0) return "failed"
  if (stats.passed > 0 && stats.failed === 0) return "passed"
  if (stats.skipped > 0) return "skipped"
  return "unknown"
}

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8")
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function readTextSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8")
  } catch {
    return null
  }
}

async function readStatSafe(filePath: string): Promise<Date | null> {
  try {
    const stat = await fs.stat(filePath)
    return stat.mtime
  } catch {
    return null
  }
}

async function readDirectoryFilesSafe(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath)
    return entries
      .filter((entry) => entry.endsWith(".xml"))
      .map((entry) => path.join(dirPath, entry))
  } catch {
    return []
  }
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const regex = /(\w+)="([^"]*)"/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(tag))) {
    attrs[match[1]] = match[2]
  }
  return attrs
}

function parseJUnit(xml: string | null, suiteId: string, origin: TestCaseResult["origin"]): { stats: SuiteStats; cases: TestCaseResult[] } {
  if (!xml) return { stats: buildEmptyStats(), cases: [] }
  const suiteMatch = xml.match(/<testsuite[^>]*>/)
  const suiteAttrs = suiteMatch ? parseAttributes(suiteMatch[0]) : {}

  const total = Number(suiteAttrs.tests ?? 0)
  const failures = Number(suiteAttrs.failures ?? 0)
  const errors = Number(suiteAttrs.errors ?? 0)
  const skipped = Number(suiteAttrs.skipped ?? 0)
  const timeSeconds = Number(suiteAttrs.time ?? 0)

  const cases: TestCaseResult[] = []
  const testCaseRegex = /<testcase[^>]*>([\s\S]*?)<\/testcase>/g
  const selfClosingRegex = /<testcase[^>]*\/>/g

  const consumeTestcase = (tag: string, body: string | null) => {
    const attrs = parseAttributes(tag)
    const name = attrs.name ?? "Caso sin nombre"
    const file = attrs.classname
    const durationMs = attrs.time ? Math.round(Number(attrs.time) * 1000) : undefined

    let status: TestCaseResult["status"] = "passed"
    let message: string | undefined

    if (body) {
      const failureMatch = body.match(/<failure[^>]*>([\s\S]*?)<\/failure>/)
      const errorMatch = body.match(/<error[^>]*>([\s\S]*?)<\/error>/)
      const skippedMatch = body.match(/<skipped[^>]*>/)
      if (failureMatch || errorMatch) {
        status = "failed"
        const tagMatch = (failureMatch ?? errorMatch)?.[0]
        const attrsMessage = tagMatch ? parseAttributes(tagMatch).message : undefined
        message = attrsMessage ?? (failureMatch ?? errorMatch)?.[1]?.trim()
      } else if (skippedMatch) {
        status = "skipped"
      }
    }

    cases.push({
      id: `${suiteId}:${origin}:${name}`,
      suiteId,
      name,
      status,
      durationMs,
      file,
      message,
      origin,
    })
  }

  let match: RegExpExecArray | null
  while ((match = testCaseRegex.exec(xml))) {
    const testcaseTag = match[0].match(/<testcase[^>]*>/)
    if (testcaseTag) {
      consumeTestcase(testcaseTag[0], match[1])
    }
  }

  if (cases.length === 0) {
    while ((match = selfClosingRegex.exec(xml))) {
      consumeTestcase(match[0], null)
    }
  }

  const stats: SuiteStats = {
    total,
    passed: Math.max(0, total - failures - errors - skipped),
    failed: failures + errors,
    skipped,
    durationMs: Math.round(timeSeconds * 1000),
  }

  return { stats, cases }
}

function parseVitest(json: any, suiteId: string): { stats: SuiteStats; cases: TestCaseResult[] } {
  if (!json) return { stats: buildEmptyStats(), cases: [] }

  const stats: SuiteStats = {
    total: Number(json.numTotalTests ?? 0),
    passed: Number(json.numPassedTests ?? 0),
    failed: Number(json.numFailedTests ?? 0),
    skipped: Number(json.numPendingTests ?? 0) + Number(json.numTodoTests ?? 0),
    durationMs: 0,
  }

  const cases: TestCaseResult[] = []
  const testResults = Array.isArray(json.testResults) ? json.testResults : []
  for (const suite of testResults) {
    const assertions = Array.isArray(suite.assertionResults) ? suite.assertionResults : []
    for (const testCase of assertions) {
      const statusRaw = String(testCase.status ?? "").toLowerCase()
      const status: TestCaseResult["status"] =
        statusRaw === "passed" ? "passed" : statusRaw === "failed" ? "failed" : statusRaw === "skipped" ? "skipped" : "unknown"
      cases.push({
        id: `${suiteId}:frontend:${testCase.fullName ?? testCase.title ?? "test"}`,
        suiteId,
        name: testCase.fullName ?? testCase.title ?? "Caso sin nombre",
        status,
        durationMs: typeof testCase.duration === "number" ? testCase.duration : undefined,
        file: suite.name,
        message: Array.isArray(testCase.failureMessages) ? testCase.failureMessages.join("\n") : undefined,
        origin: "frontend",
      })
    }
  }

  return { stats, cases }
}

function mergeStats(...statsList: SuiteStats[]): SuiteStats {
  return statsList.reduce(
    (acc, stats) => ({
      total: acc.total + stats.total,
      passed: acc.passed + stats.passed,
      failed: acc.failed + stats.failed,
      skipped: acc.skipped + stats.skipped,
      durationMs: acc.durationMs + stats.durationMs,
    }),
    buildEmptyStats()
  )
}

function toCoveragePercent(total: number, unknown: number) {
  if (!total) return 0
  return Math.round(((total - unknown) / total) * 100)
}

function computeCoverage(planCases: PlanTestCase[], automatedCases: TestCaseResult[], manualLogs: ManualLog[]) {
  const latestManualByCase = new Map<string, ManualLog>()
  for (const entry of manualLogs) {
    if (!entry.caseId) continue
    const current = latestManualByCase.get(entry.caseId)
    if (!current || new Date(entry.createdAt) > new Date(current.createdAt)) {
      latestManualByCase.set(entry.caseId, entry)
    }
  }

  const resolutions = planCases.map((planCase) => {
    const manual = latestManualByCase.get(planCase.id)
    if (manual) {
      return {
        caseId: planCase.id,
        suiteId: planCase.suiteId,
        title: planCase.title,
        module: planCase.module,
        status: manual.status,
        source: "manual" as const,
        updatedAt: manual.createdAt,
        matchedTests: [],
      }
    }

    const matchedTests = automatedCases.filter((item) =>
      (planCase.matches ?? []).some((match) => item.name.toLowerCase().includes(match.toLowerCase()))
    )

    if (matchedTests.length > 0) {
      const hasFailed = matchedTests.some((item) => item.status === "failed")
      const hasSkipped = matchedTests.some((item) => item.status === "skipped")
      const latestUpdate = matchedTests.find((item) => item.durationMs !== undefined)
      return {
        caseId: planCase.id,
        suiteId: planCase.suiteId,
        title: planCase.title,
        module: planCase.module,
        status: hasFailed ? "failed" as const : hasSkipped ? "skipped" as const : "passed" as const,
        source: "automated" as const,
        updatedAt: latestUpdate ? new Date().toISOString() : undefined,
        matchedTests: matchedTests.map((item) => item.name),
      }
    }

    return {
      caseId: planCase.id,
      suiteId: planCase.suiteId,
      title: planCase.title,
      module: planCase.module,
      status: "unknown" as const,
      source: "none" as const,
      updatedAt: undefined,
      matchedTests: [],
    }
  })

  const suiteIds = Array.from(new Set(planCases.map((item) => item.suiteId)))
  const suites = suiteIds.map((suiteId) => {
    const suiteCases = resolutions.filter((item) => item.suiteId === suiteId)
    const total = suiteCases.length
    const passed = suiteCases.filter((item) => item.status === "passed").length
    const failed = suiteCases.filter((item) => item.status === "failed").length
    const skipped = suiteCases.filter((item) => item.status === "skipped").length
    const unknown = suiteCases.filter((item) => item.status === "unknown").length
    return {
      suiteId,
      total,
      passed,
      failed,
      skipped,
      unknown,
      coveragePercent: toCoveragePercent(total, unknown),
    }
  })

  const overall = suites.reduce(
    (acc, suite) => ({
      total: acc.total + suite.total,
      passed: acc.passed + suite.passed,
      failed: acc.failed + suite.failed,
      skipped: acc.skipped + suite.skipped,
      unknown: acc.unknown + suite.unknown,
    }),
    { total: 0, passed: 0, failed: 0, skipped: 0, unknown: 0 }
  )

  const unitResolutions = resolutions.filter((item) => item.suiteId === "unit")
  const unitFailed = unitResolutions.filter((item) => item.status === "failed").length
  const unitUnknown = unitResolutions.filter((item) => item.status === "unknown").length

  return {
    overall: {
      ...overall,
      coveragePercent: toCoveragePercent(overall.total, overall.unknown),
    },
    suites,
    resolutions,
    unitReadiness: {
      totalCases: unitResolutions.length,
      passedCases: unitResolutions.filter((item) => item.status === "passed").length,
      blockingFailures: unitFailed,
      uncoveredCases: unitUnknown,
      readyForIntegration: unitFailed === 0 && unitUnknown === 0 && unitResolutions.length > 0,
    },
  }
}

function computeConclusion(coverage: ReturnType<typeof computeCoverage>) {
  const blockers: string[] = []
  if (coverage.unitReadiness.blockingFailures > 0) {
    blockers.push(`${coverage.unitReadiness.blockingFailures} caso(s) unitario(s) fallando`)
  }
  if (coverage.unitReadiness.uncoveredCases > 0) {
    blockers.push(`${coverage.unitReadiness.uncoveredCases} caso(s) unitario(s) sin evidencia`)
  }
  const failingSuites = coverage.suites.filter((suite) => suite.failed > 0)
  if (failingSuites.length > 0) {
    blockers.push(`Suites con fallos: ${failingSuites.map((suite) => suite.suiteId).join(", ")}`)
  }

  if (coverage.unitReadiness.readyForIntegration) {
    return {
      status: "healthy" as const,
      summary: "Todas las pruebas unitarias planificadas tienen evidencia valida y no presentan fallos bloqueantes.",
      blockers,
      readyForIntegration: true,
    }
  }

  if (coverage.unitReadiness.blockingFailures > 0) {
    return {
      status: "critical" as const,
      summary: "La suite unitaria todavia presenta fallos bloqueantes. No deberia avanzarse a integracion hasta corregirlos.",
      blockers,
      readyForIntegration: false,
    }
  }

  return {
    status: "warning" as const,
    summary: "La cobertura unitaria sigue incompleta. Faltan evidencias antes de considerar estable la base para integracion.",
    blockers,
    readyForIntegration: false,
  }
}

export async function GET() {
  const [unitJson, unitXml, e2eXml, manualLogs, unitUpdated, e2eUpdated, runIndex, planCases] = await Promise.all([
    readJsonSafe<any>(UNIT_JSON),
    readTextSafe(UNIT_JUNIT),
    readTextSafe(E2E_JUNIT),
    readJsonSafe<{ entries: ManualLog[] }>(MANUAL_LOGS),
    readStatSafe(UNIT_JSON),
    readStatSafe(E2E_JUNIT),
    readJsonSafe<Record<string, { timestamp: string; exitCode: number; logPath?: string }>>(RUN_INDEX),
    readJsonSafe<{ cases: PlanTestCase[] }>(PLAN_CASES),
  ])

  const backendUnitFiles = await readDirectoryFilesSafe(BACKEND_SUREFIRE)
  const backendXmlResults = await Promise.all(backendUnitFiles.map((file) => readTextSafe(file)))

  const frontendUnitParsed = parseVitest(unitJson, "unit")
  const frontendUnitJunitParsed = parseJUnit(unitXml, "unit", "frontend")
  const backendUnitParsed = backendXmlResults
    .map((xml) => parseJUnit(xml, "unit", "backend"))
    .reduce(
      (acc, current) => ({
        stats: mergeStats(acc.stats, current.stats),
        cases: [...acc.cases, ...current.cases],
      }),
      { stats: buildEmptyStats(), cases: [] as TestCaseResult[] }
    )
  const e2eParsed = parseJUnit(e2eXml, "e2e", "e2e")

  const unitCases = [
    ...frontendUnitParsed.cases,
    ...frontendUnitJunitParsed.cases.filter((candidate) =>
      !frontendUnitParsed.cases.some((existing) => existing.name === candidate.name)
    ),
    ...backendUnitParsed.cases,
  ]
  const unitStats = mergeStats(frontendUnitParsed.stats, backendUnitParsed.stats)

  const suites: SuiteReport[] = [
    {
      id: "unit",
      status: normalizeStatus(unitStats),
      stats: unitStats,
      updatedAt: unitUpdated?.toISOString(),
      artifacts: [
        { label: "Vitest JSON", path: "test-results/unit/results.json" },
        { label: "Vitest JUnit", path: "test-results/unit/junit.xml" },
        { label: "JUnit Backend", path: "backend/target/surefire-reports" },
      ],
      lastRun: runIndex?.unit,
    },
    {
      id: "e2e",
      status: normalizeStatus(e2eParsed.stats),
      stats: e2eParsed.stats,
      updatedAt: e2eUpdated?.toISOString(),
      artifacts: [
        { label: "JUnit", path: "test-results/e2e/junit.xml" },
        { label: "Reporte HTML", path: "test-results/e2e/html" },
      ],
      lastRun: runIndex?.e2e,
    },
  ]

  const allCases = [...unitCases, ...e2eParsed.cases]
  const normalizedPlanCases = Array.isArray(planCases?.cases) ? planCases.cases : []
  const normalizedManual = Array.isArray(manualLogs?.entries) ? manualLogs.entries : []
  const coverage = computeCoverage(normalizedPlanCases, allCases, normalizedManual)
  const conclusion = computeConclusion(coverage)

  const response = {
    generatedAt: new Date().toISOString(),
    runnerEnabled: process.env.ENABLE_ADMIN_TEST_RUNNER === "true",
    suites,
    cases: allCases,
    planCases: normalizedPlanCases,
    manual: normalizedManual,
    coverage,
    conclusion,
  }

  return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } })
}
