import React from "react"
import { act } from "react"
import { createRoot, Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import ProfessorSearchPage from "@/app/professor/search/page"

const mocks = vi.hoisted(() => ({
  executeMock: vi.fn(),
  getHistoryMock: vi.fn(),
  getMeshSuggestionsMock: vi.fn(),
  getSessionMock: vi.fn(),
  getCategoriesMock: vi.fn(),
  createHedgeMock: vi.fn(),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@/lib/api", () => ({
  searchApi: {
    execute: mocks.executeMock,
    getHistory: mocks.getHistoryMock,
    getMeshSuggestions: mocks.getMeshSuggestionsMock,
    getSession: mocks.getSessionMock,
  },
  hedgesApi: {
    getCategories: mocks.getCategoriesMock,
    create: mocks.createHedgeMock,
  },
}))

vi.mock("@/lib/search-assistant", () => ({
  searchAssistantApi: {
    ask: vi.fn(),
  },
}))

vi.mock("@/components/query-builder", () => ({
  default: ({ onQueryChange }: { onQueryChange: (data: any) => void }) => (
    <button
      type="button"
      data-testid="mock-query-builder"
      onClick={() =>
        onQueryChange({
          rawQuery: "[Diabetes Mellitus]",
          terms: [{ id: "D003920", term: "Diabetes Mellitus" }],
          operators: [],
        })
      }
    >
      Inject Query
    </button>
  ),
}))

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean
    onCheckedChange?: (value: boolean) => void
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  ),
}))

vi.mock("@/components/ui/slider", () => ({
  Slider: ({
    value,
    min = 0,
    max = 100,
    step = 1,
    onValueChange,
  }: {
    value?: number[]
    min?: number
    max?: number
    step?: number
    onValueChange?: (value: number[]) => void
  }) => (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={Array.isArray(value) ? value[0] ?? min : min}
      onChange={(event) => onValueChange?.([Number(event.target.value)])}
    />
  ),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe("ProfessorSearchPage", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    window.localStorage.clear()

    mocks.getHistoryMock.mockResolvedValue({ searches: [], total: 0 })
    mocks.getMeshSuggestionsMock.mockResolvedValue([])
    mocks.getSessionMock.mockResolvedValue({ results: [], query: { filters: {}, rawQuery: "", terms: [], operators: [] }, id: "session-1" })
    mocks.getCategoriesMock.mockResolvedValue(["General"])
    mocks.createHedgeMock.mockResolvedValue({})
    mocks.executeMock.mockResolvedValue({
      id: "search-session-1",
      query: { id: "search-query-1", terms: [], operators: [], filters: {}, rawQuery: "", createdAt: new Date().toISOString() },
      results: [],
      totalResults: 0,
      executedAt: new Date().toISOString(),
    })

    await act(async () => {
      root.render(<ProfessorSearchPage />)
    })
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    vi.clearAllMocks()
  })

  it("UT-08 renders professor search form with mesh input and submit button", () => {
    const searchInput = container.querySelector('input[placeholder*="MeSH"]')
    const submitButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Ejecutar búsqueda")
    )

    expect(searchInput).not.toBeNull()
    expect(submitButton).not.toBeUndefined()
  })

  it("UT-09 updates filters and calls search API on submit", async () => {
    const queryBuilderButton = container.querySelector('[data-testid="mock-query-builder"]') as HTMLButtonElement
    const checkboxes = container.querySelectorAll('input[type="checkbox"]')
    const systematicReviewCheckbox = checkboxes[0] as HTMLInputElement
    const fullTextCheckbox = Array.from(checkboxes).at(-1) as HTMLInputElement
    const submitButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Ejecutar búsqueda")
    ) as HTMLButtonElement

    await act(async () => {
      queryBuilderButton.click()
    })
    await act(async () => {
      systematicReviewCheckbox.click()
      fullTextCheckbox.click()
    })
    await act(async () => {
      submitButton.click()
    })

    expect(mocks.executeMock).toHaveBeenCalledTimes(1)
    const query = mocks.executeMock.mock.calls[0][0]
    expect(query.terms).toEqual([{ id: "D003920", term: "Diabetes Mellitus" }])
    expect(query.filters.studyTypes).toContain("systematic_review")
    expect(query.filters.hasFullText).toBe(true)
  })
})
