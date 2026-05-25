import { beforeEach, describe, expect, it, vi } from "vitest"
import { getScopedStorageKey, getStorageScope, isBackendReachable, paginateItems } from "@/lib/student-resilience"

const makeToken = (payload: Record<string, unknown>) => {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${header}.${body}.signature`
}

describe("student resilience helpers", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.unstubAllGlobals()
  })

  it("paginates items safely", () => {
    const result = paginateItems([1, 2, 3, 4, 5], 2, 2)
    expect(result.pageItems).toEqual([3, 4])
    expect(result.total).toBe(5)
  })

  it("uses anonymous scope when no token exists", () => {
    expect(getStorageScope()).toBe("anonymous")
    expect(getScopedStorageKey("history")).toBe("history:anonymous")
  })

  it("derives scope from auth token", () => {
    const token = makeToken({ sub: "User@Test.com", authorities: "ROLE_STUDENT" })
    window.localStorage.setItem("auth_token", token)

    expect(getStorageScope()).toBe("student:user_test.com")
  })

  it("treats authenticated endpoint responses below 500 as reachable", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 401 })
    vi.stubGlobal("fetch", fetchMock)

    await expect(isBackendReachable(true)).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    )
  })
})
