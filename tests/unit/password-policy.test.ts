import { describe, expect, it } from "vitest"
import { evaluatePassword, PASSWORD_MIN_LENGTH } from "@/lib/password-policy"

describe("evaluatePassword", () => {
  it("marks weak passwords as invalid", () => {
    const result = evaluatePassword("abcdefg")

    expect(result.hasMinLength).toBe(false)
    expect(result.hasUpper).toBe(false)
    expect(result.hasNumber).toBe(false)
    expect(result.hasSymbol).toBe(false)
    expect(result.isValid).toBe(false)
  })

  it("accepts passwords that meet all criteria", () => {
    const sample = `Abcdef1${"!"}`
    const result = evaluatePassword(sample)

    expect(sample.length).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH)
    expect(result.isValid).toBe(true)
  })
})
