import { expect, test, type Page } from "@playwright/test"

const professorUser = {
  id: "33333333-3333-3333-3333-333333333333",
  email: "professor.test@uci.cu",
  name: "Professor Test",
  role: "professor",
  createdAt: "2026-03-31T10:00:00Z",
  isActive: true,
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

async function mockProfessorSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("auth_token", "playwright-professor-token")
  })

  await mockJson(page, "**/api/auth/me", professorUser)
}

test.describe("professor panel", () => {
  test.beforeEach(async ({ page }) => {
    await mockProfessorSession(page)
  })

  test("dashboard renders analytics and pending evaluations", async ({ page }) => {
    await mockJson(page, "**/api/professor/analytics/overview", {
      studentCount: 3,
      averageProgress: { access: 72, process: 68, communicate: 75 },
      lowProgressStudents: [
        {
          id: "student-1",
          name: "Student Risk",
          email: "risk@uci.cu",
          averageScore: 52,
        },
      ],
      commonSearchTerms: [{ term: "hypertension", count: 4 }],
      problematicTerms: [{ term: "antibiotics", errorRate: 0.4 }],
      studentCompetencies: [
        {
          studentId: "student-1",
          studentName: "Student Risk",
          studentEmail: "risk@uci.cu",
          scores: { access: 50, process: 55, communicate: 51 },
          averageScore: 52,
        },
      ],
    })
    await mockJson(page, "**/api/evaluations/pending", {
      evaluations: [
        {
          id: "submission-1",
          caseId: "case-1",
          studentId: "student-1",
          submittedAt: "2026-03-31T10:00:00Z",
          content: "Case response",
          bibliography: "",
          selectedArticles: [],
          status: "pending",
        },
      ],
    })

    await page.goto("/professor")

    await expect(page.getByRole("heading", { name: /Bienvenido, Prof\./i })).toBeVisible()
    await expect(page.getByText("Entregas pendientes").first()).toBeVisible()
    await expect(page.getByText("Student Risk").first()).toBeVisible()
    await expect(page.getByText("Insights de búsqueda")).toBeVisible()
  })

  test("students page renders normalized student progress", async ({ page }) => {
    await mockJson(page, "**/api/professor/analytics/overview", {
      studentCount: 2,
      averageProgress: { access: 70, process: 65, communicate: 80 },
      lowProgressStudents: [],
      commonSearchTerms: [],
      problematicTerms: [],
      studentCompetencies: [
        {
          studentId: "student-1",
          studentName: "Student One",
          studentEmail: "student1@uci.cu",
          scores: { access: 80, process: 70, communicate: 90 },
          averageScore: 80,
        },
      ],
    })
    await mockJson(page, "**/api/professor/students", [
      {
        userId: "student-1",
        totalSearches: 10,
        totalVerifications: 4,
        totalBibliographies: 1,
        casesCompleted: 2,
        totalCases: 3,
        competencies: {
          access: { score: 80, type: "access", level: "advanced", lastUpdated: "2026-03-31T10:00:00Z" },
          process: { score: 70, type: "process", level: "intermediate", lastUpdated: "2026-03-31T10:00:00Z" },
          communicate: { score: 90, type: "communicate", level: "advanced", lastUpdated: "2026-03-31T10:00:00Z" },
        },
        recentActivities: [{ id: "act-1", type: "search", description: "Busqueda", timestamp: "2026-03-31T10:00:00Z" }],
      },
    ])
    await mockJson(page, "**/api/professor/analytics/student/student-1", {
      userId: "student-1",
      totalSearches: 10,
      totalVerifications: 4,
      totalBibliographies: 1,
      casesCompleted: 2,
      totalCases: 3,
      recommendations: ["Refinar evaluacion critica"],
      competencies: {
        access: { score: 80, type: "access", level: "advanced", lastUpdated: "2026-03-31T10:00:00Z" },
        process: { score: 70, type: "process", level: "intermediate", lastUpdated: "2026-03-31T10:00:00Z" },
        communicate: { score: 90, type: "communicate", level: "advanced", lastUpdated: "2026-03-31T10:00:00Z" },
      },
      recentActivities: [],
    })

    await page.goto("/professor/students")

    await expect(page.getByRole("heading", { name: /Progreso de Estudiantes/i })).toBeVisible()
    await expect(page.getByText("Student One")).toBeVisible()
    await expect(page.getByText("80%").first()).toBeVisible()
    await page.getByRole("button", { name: /Ver/i }).click()
    await expect(page.getByText("Refinar evaluacion critica")).toBeVisible()
  })

  test("analytics page renders search insights", async ({ page }) => {
    await mockJson(page, "**/api/professor/analytics/overview", {
      studentCount: 4,
      averageProgress: { access: 70, process: 60, communicate: 90 },
      lowProgressStudents: [
        { id: "student-1", name: "Student Risk", email: "risk@uci.cu", averageScore: 54 },
      ],
      commonSearchTerms: [{ term: "sepsis", count: 5 }],
      problematicTerms: [{ term: "covid", errorRate: 0.5 }],
      studentCompetencies: [],
    })

    await page.goto("/professor/analytics")

    await expect(page.getByRole("heading", { name: /Analíticas de Clase/i })).toBeVisible()
    await expect(page.getByText("sepsis")).toBeVisible()
    await expect(page.getByText("Student Risk")).toBeVisible()
  })

  test("hedges page loads categories and hedges", async ({ page }) => {
    await mockJson(page, "**/api/hedges", [
      {
        id: "hedge-1",
        name: "Sepsis therapy",
        category: "Therapy",
        query: "(sepsis[MeSH]) AND therapy",
        description: "Therapy hedge",
        estimatedResults: 25,
        precision: 0.8,
        recall: 0.7,
        createdAt: "2026-03-31T10:00:00Z",
        createdBy: "33333333-3333-3333-3333-333333333333",
      },
    ])
    await mockJson(page, "**/api/hedges/categories", ["Therapy", "Diagnosis"])

    await page.goto("/professor/hedges")

    await expect(page.getByRole("heading", { name: /Configurador de Search Hedges/i })).toBeVisible()
    await expect(page.getByText("Sepsis therapy")).toBeVisible()
    await expect(page.getByText("Therapy").first()).toBeVisible()
  })

  test("evaluations page renders pending and reviewed submissions", async ({ page }) => {
    await mockJson(page, "**/api/evaluations/pending", {
      evaluations: [
        {
          id: "submission-1",
          caseId: "case-1",
          studentId: "student-1",
          submittedAt: "2026-03-31T10:00:00Z",
          content: "Pending response",
          bibliography: "",
          selectedArticles: [],
          status: "pending",
        },
      ],
    })
    await mockJson(page, "**/api/evaluations/reviewed", {
      evaluations: [
        {
          id: "submission-2",
          caseId: "case-2",
          studentId: "student-2",
          submittedAt: "2026-03-30T10:00:00Z",
          content: "Reviewed response",
          bibliography: "",
          selectedArticles: [],
          status: "reviewed",
        },
      ],
    })

    await page.goto("/professor/evaluations")

    await expect(page.getByRole("heading", { name: /Evaluaciones/i })).toBeVisible()
    await expect(page.getByText(/Pendientes \(1\)/i)).toBeVisible()
    await expect(page.getByText(/Evaluadas/i)).toBeVisible()
    await expect(page.getByText(/Estudiante #studen/i)).toBeVisible()
  })
})
