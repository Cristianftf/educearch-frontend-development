import { expect, test, type Page } from "@playwright/test"

const studentUser = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "student.test@uci.cu",
  name: "Student Test",
  role: "student",
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

async function mockStudentSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("auth_token", "playwright-student-token")
  })

  await mockJson(page, "**/api/auth/me", studentUser)
  await mockJson(page, /.*\/api\/search\/history(\?.*)?$/, {
    searches: [
      {
        id: "search-1",
        terms: [{ id: "mesh-1", term: "hypertension", description: "Hypertension" }],
        operators: [],
        filters: { maxResults: 20, languages: ["eng"] },
        rawQuery: "hypertension",
        createdAt: "2026-03-31T09:50:00Z",
        resultCount: 12,
        isFavorite: true,
      },
    ],
    total: 1,
  })
  await mockJson(page, /.*\/api\/verify\/history(\?.*)?$/, {
    verifications: [
      {
        id: "verification-1",
        claim: "Exercise reduces blood pressure in adults.",
        status: "verified",
        score: 82,
        supportingEvidence: [],
        contradictingEvidence: [],
        explanation: "La evidencia recuperada apoya la afirmacion en la poblacion analizada.",
        recommendations: ["Buscar revisiones sistematicas recientes."],
        verifiedAt: "2026-03-31T09:40:00Z",
      },
    ],
    total: 1,
  })
  await mockJson(page, "**/api/bibliography/history", [
    {
      id: "bib-1",
      name: "Revision HTA",
      format: "apa",
      content: "Smith J. Hypertension review.",
      createdAt: "2026-03-31T09:30:00Z",
      articleCount: 1,
      articles: [],
    },
  ])
  await mockJson(page, "**/api/formats/available", {
    formats: ["apa", "vancouver", "bibtex"],
  })
}

test.describe("student panel", () => {
  test.beforeEach(async ({ page }) => {
    await mockStudentSession(page)
  })

  test("dashboard renders normalized progress and recent activity", async ({ page }) => {
    await mockJson(page, "**/api/progress/me", {
      userId: studentUser.id,
      competencies: {
        access: { type: "access", score: 78, level: "advanced", lastUpdated: "2026-03-31T09:55:00Z" },
        process: { type: "process", score: 65, level: "intermediate", lastUpdated: "2026-03-31T09:55:00Z" },
        communicate: { type: "communicate", score: 71, level: "intermediate", lastUpdated: "2026-03-31T09:55:00Z" },
      },
      totalSearches: 12,
      totalVerifications: 4,
      totalBibliographies: 2,
      recentActivities: [
        {
          id: "activity-1",
          type: "search",
          description: "Busqueda ejecutada: hypertension",
          timestamp: "2026-03-31T09:56:00Z",
        },
      ],
    })

    await page.goto("/student")

    await expect(page.getByRole("heading", { name: /Bienvenido, Student/i })).toBeVisible()
    await expect(page.getByText(/Búsquedas realizadas/i)).toBeVisible()
    await expect(page.getByText(/Busqueda ejecutada: hypertension/i)).toBeVisible()
  })

  test("search page renders history and assistant sidebar with safe data", async ({ page }) => {
    await page.goto("/student/search")

    await expect(page.getByRole("heading", { name: /Búsqueda Avanzada/i })).toBeVisible()
    await expect(page.getByText(/hypertension/i).first()).toBeVisible()
    await expect(page.getByText(/Actividad de APIs externas/i)).toBeVisible()
  })

  test("verify page renders history and verification tools", async ({ page }) => {
    await page.goto("/student/verify")

    await expect(page.getByRole("heading", { name: /Detector de infodemia/i })).toBeVisible()
    await expect(page.getByText(/Exercise reduces blood pressure/i)).toBeVisible()
    await expect(page.getByText(/Puntaje: 82%/i)).toBeVisible()
  })

  test("bibliography page renders saved data and available formats", async ({ page }) => {
    await page.goto("/student/bibliography")

    await expect(page.getByRole("heading", { name: /Generador de Bibliografías/i })).toBeVisible()
    await expect(page.getByText(/Revision HTA/i)).toBeVisible()
    await expect(page.getByRole("combobox")).toContainText(/APA 7th Edition/i)
  })

  test("cases page renders assigned cases and evaluation status safely", async ({ page }) => {
    await mockJson(page, "**/api/cases/assigned", [
      {
        id: "case-1",
        title: "Hipertension resistente",
        scenario: "Paciente con HTA persistente pese a triple terapia.",
        difficulty: "intermediate",
        status: "active",
        requiredArticles: ["PMID:123456"],
        optionalArticles: [],
        guidingQuestions: ["¿Cual es la mejor estrategia de ajuste terapeutico?"],
        rubric: [
          {
            competency: "access",
            criterion: "Uso de evidencia",
            maxScore: 10,
          },
        ],
        createdBy: "professor-1",
        createdAt: "2026-03-31T09:00:00Z",
        dueDate: "2026-04-05",
        assignedStudents: [studentUser.id],
      },
      {
        id: "case-2",
        title: "Antibioticos en IRA",
        scenario: "Analiza la indicacion de antibioticos en infeccion respiratoria leve.",
        difficulty: "novice",
        status: "archived",
        requiredArticles: ["PMID:456789"],
        optionalArticles: [],
        guidingQuestions: ["¿Existe beneficio clinico demostrado?"],
        rubric: [
          {
            competency: "process",
            criterion: "Analisis critico",
            maxScore: 10,
          },
        ],
        createdBy: "professor-1",
        createdAt: "2026-03-30T09:00:00Z",
        dueDate: "2026-03-30",
        assignedStudents: [studentUser.id],
      },
    ])
    await mockJson(page, "**/api/cases/case-1/submission", null)
    await mockJson(page, "**/api/cases/case-2/submission", {
      id: "submission-2",
      caseId: "case-2",
      studentId: studentUser.id,
      submittedAt: "2026-03-30T12:00:00Z",
      content: "Entrega revisada.",
      selectedArticles: [],
      bibliography: "",
      status: "reviewed",
      evaluation: {
        id: "evaluation-2",
        submissionId: "submission-2",
        professorId: "professor-1",
        scores: { access: 8, process: 9, communicate: 7 },
        comments: { access: "Bien", process: "Muy bien", communicate: "Correcto" },
        overallScore: 80,
        feedback: "Buen trabajo.",
        evaluatedAt: "2026-03-30T13:00:00Z",
      },
    })

    await page.goto("/student/cases")

    await expect(page.getByRole("heading", { name: /Casos de Estudio/i })).toBeVisible()
    await expect(page.getByText(/Hipertension resistente/i)).toBeVisible()
    await page.getByRole("tab", { name: /Completados/i }).click()
    await expect(page.getByText(/Antibioticos en IRA/i).first()).toBeVisible()
    await expect(page.getByText(/Evaluado: 80\/100/i)).toBeVisible()
  })
})
