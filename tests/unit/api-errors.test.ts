import { describe, expect, it } from "vitest"
import { isConnectivityError } from "@/lib/api-errors"
import { ApiHttpError } from "@/lib/api-client"

describe("isConnectivityError", () => {
  it("treats network failures as connectivity errors", () => {
    expect(isConnectivityError(new Error("Failed to fetch"))).toBe(true)
    expect(isConnectivityError(new Error("Network request failed"))).toBe(true)
  })

  it("ignores API errors", () => {
    const error = new ApiHttpError("/api/test", 500, "Internal Server Error")
    expect(isConnectivityError(error)).toBe(false)
  })

  it("ignores syntax errors", () => {
    expect(isConnectivityError(new SyntaxError("Unexpected token"))).toBe(false)
  })

  it("flags unknown values defensively", () => {
    expect(isConnectivityError("unexpected" as unknown)).toBe(true)
  })
})
