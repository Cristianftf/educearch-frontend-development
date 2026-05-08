import { describe, expect, it } from "vitest"
import { normalizeHttpUrl, validateContentSourceUrl } from "@/lib/url-validation"

describe("validateContentSourceUrl", () => {
  it("rejects empty input", () => {
    expect(validateContentSourceUrl("").error).toBe("Ingresa una URL para verificar.")
  })

  it("rejects non-http protocols", () => {
    expect(validateContentSourceUrl("ftp://example.com").error).toBe(
      "Solo se permiten URLs con http o https."
    )
  })

  it("rejects private hosts", () => {
    expect(validateContentSourceUrl("http://localhost/test").error).toBe(
      "No se permiten URLs locales o de red privada."
    )
  })

  it("normalizes valid urls", () => {
    const result = validateContentSourceUrl("https://example.com/path#hash")
    expect(result.normalizedUrl).toBe("https://example.com/path")
  })
})

describe("normalizeHttpUrl", () => {
  it("returns null on invalid inputs", () => {
    expect(normalizeHttpUrl("not-a-url")).toBeNull()
  })
})
