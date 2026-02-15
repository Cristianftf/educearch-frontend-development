import type { AuditLog } from "@/types"
import { adminAuditApi } from "./admin-audit"

type AuditExportFormat = "pdf" | "excel" | "json" | "csv"

type AuditExportOptions = {
  format: AuditExportFormat
  startDate?: string
  endDate?: string
  level?: string
  userId?: string
  fileNamePrefix?: string
}

type AuditExportResult = {
  id: string
  fileName: string
  downloadUrl: string
  size: number
  format: AuditExportFormat
  createdAt: string
}

const escapeCsv = (value: unknown) => {
  const text = String(value ?? "")
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const toCsv = (logs: AuditLog[]) => {
  const headers = [
    "timestamp",
    "level",
    "user",
    "action",
    "details",
    "resource",
    "ip",
    "userAgent",
  ]
  const rows = logs.map((log) =>
    [
      log.timestamp,
      log.level,
      log.user,
      log.action,
      log.details,
      log.resource ?? "",
      log.ip,
      log.userAgent,
    ]
      .map(escapeCsv)
      .join(",")
  )
  return [headers.join(","), ...rows].join("\n")
}

const toJson = (logs: AuditLog[]) => JSON.stringify(logs, null, 2)

const toSimplePdfBytes = (logs: AuditLog[]) => {
  const encoder = new TextEncoder()
  const toAscii = (text: string) =>
    text
      .replace(/[^\x20-\x7E]/g, "?")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")

  const maxLines = 220
  const lines = [
    `Audit report generated: ${new Date().toISOString()}`,
    `Total events: ${logs.length}`,
    "------------------------------------------------------------",
    ...logs.slice(0, maxLines).map((log) => {
      const details = log.details.length > 80 ? `${log.details.slice(0, 77)}...` : log.details
      return `${log.timestamp} | ${log.level} | ${log.user} | ${log.action} | ${details}`
    }),
  ]

  const content = [
    "BT",
    "/F1 9 Tf",
    "50 800 Td",
    "11 TL",
    ...lines.map((line) => `(${toAscii(line)}) Tj\nT*`),
    "ET",
  ].join("\n")

  const contentBytes = encoder.encode(content)

  const objects: string[] = []
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n")
  objects.push("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n")
  objects.push(
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n"
  )
  objects.push("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n")
  objects.push(`5 0 obj << /Length ${contentBytes.length} >> stream\n${content}\nendstream\nendobj\n`)

  let pdf = "%PDF-1.4\n"
  const offsets: number[] = [0]
  for (const obj of objects) {
    offsets.push(encoder.encode(pdf).length)
    pdf += obj
  }
  const xrefStart = encoder.encode(pdf).length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += "0000000000 65535 f \n"
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return encoder.encode(pdf)
}

const mimeForFormat = (format: AuditExportFormat) => {
  switch (format) {
    case "json":
      return "application/json;charset=utf-8"
    case "csv":
      return "text/csv;charset=utf-8"
    case "excel":
      return "application/vnd.ms-excel;charset=utf-8"
    case "pdf":
      return "application/pdf"
  }
}

const extensionForFormat = (format: AuditExportFormat) => {
  switch (format) {
    case "excel":
      return "csv"
    default:
      return format
  }
}

const fetchAllAuditLogs = async (options: AuditExportOptions): Promise<AuditLog[]> => {
  const all: AuditLog[] = []
  let page = 1
  let hasMore = true
  while (hasMore && page <= 50) {
    const response = await adminAuditApi.getLogs(page, 500, {
      level: options.level,
      userId: options.userId,
      startDate: options.startDate,
      endDate: options.endDate,
    })
    all.push(...response.logs)
    hasMore = Boolean(response.hasMore) && page < response.totalPages
    page += 1
  }
  return all
}

export const exportAuditLogsClient = async (options: AuditExportOptions): Promise<AuditExportResult> => {
  const logs = await fetchAllAuditLogs(options)
  const now = new Date()
  const timestamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-")
  const extension = extensionForFormat(options.format)
  const fileName = `${options.fileNamePrefix ?? "audit-report"}-${timestamp}.${extension}`

  let blob: Blob
  if (options.format === "json") {
    blob = new Blob([toJson(logs)], { type: mimeForFormat(options.format) })
  } else if (options.format === "pdf") {
    blob = new Blob([toSimplePdfBytes(logs)], { type: mimeForFormat(options.format) })
  } else {
    blob = new Blob([toCsv(logs)], { type: mimeForFormat(options.format) })
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  return {
    id: `export-${Date.now()}`,
    fileName,
    downloadUrl: url,
    size: blob.size,
    format: options.format,
    createdAt: now.toISOString(),
  }
}
