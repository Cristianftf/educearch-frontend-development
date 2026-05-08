import { NextResponse } from "next/server"
import path from "node:path"
import fs from "node:fs/promises"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LOG_PATH = path.join(process.cwd(), "test-results", "manual", "logs.json")

async function ensureLogFile() {
  const dir = path.dirname(LOG_PATH)
  await fs.mkdir(dir, { recursive: true })
  try {
    await fs.access(LOG_PATH)
  } catch {
    await fs.writeFile(LOG_PATH, JSON.stringify({ entries: [] }, null, 2), "utf8")
  }
}

function normalizeStatus(value: unknown): "passed" | "failed" | "skipped" {
  return value === "failed" || value === "skipped" ? value : "passed"
}

function sanitizeText(value: unknown, max = 240) {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, max)
}

export async function GET() {
  await ensureLogFile()
  const raw = await fs.readFile(LOG_PATH, "utf8")
  const json = JSON.parse(raw)
  return NextResponse.json(json, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ message: "Carga invalida" }, { status: 400 })
  }

  const suiteId = sanitizeText(body.suiteId, 60)
  const name = sanitizeText(body.name, 160)
  const caseId = sanitizeText(body.caseId, 20)
  if (!suiteId || !name) {
    return NextResponse.json({ message: "suiteId y name son requeridos" }, { status: 400 })
  }

  const entry = {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    caseId: caseId || undefined,
    suiteId,
    name,
    status: normalizeStatus(body.status),
    notes: sanitizeText(body.notes, 600),
    createdAt: new Date().toISOString(),
  }

  await ensureLogFile()
  const raw = await fs.readFile(LOG_PATH, "utf8")
  const json = JSON.parse(raw)
  const entries = Array.isArray(json.entries) ? json.entries : []
  entries.unshift(entry)
  const updated = { entries: entries.slice(0, 500) }
  await fs.writeFile(LOG_PATH, JSON.stringify(updated, null, 2), "utf8")

  return NextResponse.json({ entry })
}
