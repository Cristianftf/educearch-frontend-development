import { NextResponse } from "next/server"
import path from "node:path"
import fs from "node:fs/promises"
import { spawn } from "node:child_process"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const RUN_INDEX = path.join(process.cwd(), "test-results", "runs", "index.json")

const RUNNERS: Record<string, { label: string; command: string[] }> = {
  unit: { label: "Unitarias", command: ["node", "scripts/run-unit-suite.mjs"] },
  e2e: { label: "E2E", command: ["npm", "run", "test:e2e"] },
}

async function ensureRunIndex() {
  const dir = path.dirname(RUN_INDEX)
  await fs.mkdir(dir, { recursive: true })
  try {
    await fs.access(RUN_INDEX)
  } catch {
    await fs.writeFile(RUN_INDEX, JSON.stringify({}, null, 2), "utf8")
  }
}

async function updateRunIndex(suiteId: string, payload: { timestamp: string; exitCode: number; logPath?: string }) {
  await ensureRunIndex()
  const raw = await fs.readFile(RUN_INDEX, "utf8")
  const json = JSON.parse(raw)
  const updated = { ...(typeof json === "object" && json !== null ? json : {}), [suiteId]: payload }
  await fs.writeFile(RUN_INDEX, JSON.stringify(updated, null, 2), "utf8")
}

export async function POST(request: Request) {
  if (process.env.ENABLE_ADMIN_TEST_RUNNER !== "true") {
    return NextResponse.json(
      { message: "Ejecución remota deshabilitada. Habilita ENABLE_ADMIN_TEST_RUNNER=true." },
      { status: 403 }
    )
  }

  const body = await request.json().catch(() => null)
  const suiteId = typeof body?.suiteId === "string" ? body.suiteId : ""
  const runner = RUNNERS[suiteId]
  if (!runner) {
    return NextResponse.json({ message: "Suite no soportada" }, { status: 400 })
  }

  const timestamp = new Date().toISOString()
  const safeStamp = timestamp.replace(/[:.]/g, "-")
  const logDir = path.join(process.cwd(), "test-results", "runs")
  await fs.mkdir(logDir, { recursive: true })
  const logPath = path.join(logDir, `${suiteId}-${safeStamp}.log`)

  const command = runner.command.join(" ")
  const child = spawn(command, {
    shell: true,
    env: process.env,
  })

  let output = ""
  child.stdout.on("data", (data) => {
    output += data.toString()
  })
  child.stderr.on("data", (data) => {
    output += data.toString()
  })

  const exitCode = await new Promise<number>((resolve) => {
    child.on("close", (code) => resolve(code ?? 0))
  })

  await fs.writeFile(logPath, output, "utf8")
  await updateRunIndex(suiteId, { timestamp, exitCode, logPath: path.relative(process.cwd(), logPath) })

  return NextResponse.json({
    suiteId,
    label: runner.label,
    timestamp,
    exitCode,
    logPath: path.relative(process.cwd(), logPath),
  })
}
