import { expect, test, type Page } from "@playwright/test"

const adminUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "admin.test@uci.cu",
  name: "Admin Test",
  role: "admin",
  createdAt: "2026-03-31T10:00:00Z",
  isActive: true,
}

const healthPayload = {
  status: "UP",
  cpu: 22,
  memory: 44,
  disk: 31,
  dbConnections: 8,
  cacheHitRatio: 91,
  apiLatency: { p50: 45, p75: 60, p95: 90, p99: 120 },
  activeUsers: 12,
  requestsPerMinute: 34,
  services: [
    { name: "API Principal", status: "online", latency: 55, uptime: "5 días", lastCheck: "2026-03-31T10:15:00Z" },
    { name: "Base de Datos", status: "online", latency: 18, uptime: "5 días", lastCheck: "2026-03-31T10:15:00Z" },
  ],
  pubmedUsage: { used: 120, limit: 10000, percent: 1.2 },
}

const alertsPayload = {
  alerts: [
    {
      id: "alert-1",
      condition: "High latency",
      action: "NOTIFY",
      severity: "warning",
      isActive: true,
      lastTriggered: "2026-03-31T10:14:00Z",
    },
  ],
  count: 1,
}

async function mockJson(page: Page, url: string | RegExp, body: unknown) {
  await page.route(url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    })
  })
}

async function mockAdminSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("auth_token", "playwright-admin-token")
  })

  await mockJson(page, "**/api/auth/me", adminUser)
  await mockJson(page, "**/api/admin/health", healthPayload)
  await mockJson(page, "**/api/admin/alerts", alertsPayload)
}

test.describe("admin panel", () => {
  test.beforeEach(async ({ page }) => {
    await mockAdminSession(page)
  })

  test("dashboard renders operational overview", async ({ page }) => {
    await mockJson(page, "**/api/admin/dashboard", {
      stats: {
        totalUsers: 42,
        students: 30,
        professors: 8,
        admins: 4,
        activeStudents: 26,
        searchesToday: 18,
        searchesYesterday: 15,
        searchesChange: 3,
        searchesChangePercent: 20,
        usersLast30Days: 12,
        usersPrev30Days: 10,
        usersChangePercent: 20,
      },
      resources: {
        cpu: 22,
        memory: 44,
        disk: 31,
        latency: { p50: 45, p75: 60, p95: 90, p99: 120 },
        pubmedUsage: { used: 120, limit: 10000, percent: 1.2 },
      },
      systemStatus: {
        status: "UP",
        lastCheck: "2026-03-31T10:15:00Z",
        uptimeMs: 3600000,
      },
      services: healthPayload.services,
      alerts: [
        { id: "alert-dashboard", type: "warning", message: "Latencia elevada", timestamp: "2026-03-31T10:10:00Z" },
      ],
      activity: {
        users: [
          {
            id: "act-1",
            action: "LOGIN",
            user: "Admin Test",
            timestamp: "2026-03-31T10:08:00Z",
          },
        ],
        system: [
          {
            id: "sys-1",
            action: "BACKUP",
            user: "Admin Test",
            timestamp: "2026-03-31T09:58:00Z",
          },
        ],
        api: [{ endpoint: "/api/admin/dashboard", calls: 4, status: "OK" }],
      },
    })

    await page.goto("/admin")

    await expect(page.getByRole("heading", { name: /Bienvenido, Admin Test/i })).toBeVisible()
    await expect(page.getByText("Total Usuarios")).toBeVisible()
    await expect(page.getByText("42")).toBeVisible()
    await expect(page.getByText("Actividad Reciente")).toBeVisible()
    await expect(page.getByText("Admin Test").first()).toBeVisible()
  })

  test("users page loads list and stats", async ({ page }) => {
    await mockJson(page, /.*\/api\/admin\/users(\?.*)?$/, {
      users: [
        {
          id: "22222222-2222-2222-2222-222222222222",
          email: "student1@uci.cu",
          name: "Student One",
          firstName: "Student",
          lastName: "One",
          role: "student",
          faculty: "Medicina",
          isActive: true,
          createdAt: "2026-03-01T10:00:00Z",
          lastLogin: "2026-03-31T08:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      stats: {
        totalUsers: 1,
        students: 1,
        professors: 0,
        admins: 0,
        active: 1,
        inactive: 0,
        pending: 0,
      },
    })

    await page.goto("/admin/users")

    await expect(page.getByRole("heading", { name: /Gestión de Usuarios/i })).toBeVisible()
    await expect(page.getByText("Student One")).toBeVisible()
    await expect(page.getByText("student1@uci.cu")).toBeVisible()
    await expect(page.getByText("Estudiantes")).toBeVisible()
  })

  test("audit page resolves display names and logs", async ({ page }) => {
    await mockJson(page, /.*\/api\/admin\/audit\/logs(\?.*)?$/, {
      logs: [
        {
          id: "log-1",
          timestamp: "2026-03-31T10:00:00Z",
          level: "WARN",
          userId: "11111111-1111-1111-1111-111111111111",
          userIdentifier: "admin.test@uci.cu",
          userDisplayName: "Admin Test",
          userEmail: "admin.test@uci.cu",
          action: "GENERATE_REPORT",
          endpoint: "/api/admin/audit/export",
          responseStatus: 200,
          errorMessage: "Generated report",
          ipAddress: "127.0.0.1",
          userAgent: "Playwright",
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasMore: false,
      stats: { info: 0, warn: 1, error: 0 },
    })

    await page.goto("/admin/audit")

    await expect(page.getByRole("heading", { name: /Auditoría del Sistema/i })).toBeVisible()
    await expect(page.getByText("GENERATE_REPORT")).toBeVisible()
    await expect(page.getByText("Admin Test").first()).toBeVisible()
  })

  test("system page renders overview, backups and monitoring widgets", async ({ page }) => {
    await mockJson(page, "**/api/admin/system/overview", {
      timestamp: "2026-03-31T10:20:00Z",
      server: { os: "Windows", java: "21", runtime: "OpenJDK", uptimeMs: 7200000 },
      database: { engine: "PostgreSQL", sizeBytes: 1024 * 1024, connections: 8, maxConnections: 100 },
      redis: { available: true, usedBytes: 2048, maxBytes: 4096, hitRate: 88, keys: 14 },
      storage: { totalBytes: 1024 * 1024 * 1024, freeBytes: 512 * 1024 * 1024 },
      scheduledTasks: [{ name: "Backup diario", schedule: "22:00", status: "active" }],
    })
    await mockJson(page, "**/api/admin/backups", {
      backups: [
        {
          id: "backup-1",
          createdAt: "2026-03-31T09:00:00Z",
          size: 2048,
          status: "COMPLETED",
          type: "FULL",
          progress: 100,
          downloadUrl: "/downloads/backup-1",
        },
      ],
      count: 1,
    })
    await mockJson(page, /.*\/api\/admin\/monitoring\/errors(\?.*)?$/, {
      generatedAt: "2026-03-31T10:20:00Z",
      summary: {
        windowMinutes: 120,
        totalErrors: 2,
        totalWarnings: 1,
        trackedInsights: 1,
        criticalInsights: 0,
      },
      analysisStatus: {
        lastRun: "2026-03-31T10:10:00Z",
        lastProcessedErrors: 2,
        lastUpdatedInsights: 1,
      },
      insights: [
        {
          id: "insight-1",
          fingerprint: "fp-1",
          endpoint: "/api/admin/dashboard",
          severity: "medium",
          occurrences: 2,
          recommendations: ["Validar datos de auditoría"],
        },
      ],
      recentErrors: [],
    })

    await page.goto("/admin/system")

    await expect(page.getByRole("heading", { name: /Gestión del Sistema/i })).toBeVisible()
    await expect(page.getByText("Backups del Sistema")).toBeVisible()
    await expect(page.getByText("Vigilancia de Errores del Backend")).toBeVisible()
    await expect(page.getByText("Diagnostico de APIs externas")).toBeVisible()
    await expect(page.getByText("Backup diario")).toBeVisible()
  })

  test("settings page loads advanced configuration", async ({ page }) => {
    await mockJson(page, "**/api/admin/settings", {
      pubmed: {
        apiKey: "",
        rateLimitPerDay: 10000,
        cacheTTL: 3600,
      },
      rag: {
        modelProvider: "gemini",
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2000,
        contextWindow: 4096,
      },
      pedagogical: {
        competencyThresholds: {
          access: 70,
          process: 75,
          communicate: 80,
        },
        feedbackMessages: {
          excellent: "Excelente desempeño",
          good: "Buen trabajo",
          fair: "Necesitas mejorar",
          poor: "Requiere atención",
        },
      },
      security: {
        passwordMinLength: 8,
        sessionTimeoutMinutes: 30,
      },
    })

    await page.goto("/admin/settings")

    await expect(page.getByRole("heading", { name: /Configuración del Sistema/i })).toBeVisible()
    await expect(page.getByText("Configuración de PubMed API")).toBeVisible()
    await expect(page.getByText("Configuración de Modelos IA")).toBeVisible()
    await expect(page.getByText("Configuración Pedagógica")).toBeVisible()
  })
})
