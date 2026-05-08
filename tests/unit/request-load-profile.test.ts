import { beforeEach, describe, expect, it } from "vitest"
import {
  DEFAULT_REQUEST_LOAD_PROFILE,
  normalizeRequestLoadProfile,
  readStoredRequestLoadProfile,
  writeStoredRequestLoadProfile,
} from "@/lib/request-load-profile"

describe("request load profile", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("normalizes unknown values to default", () => {
    expect(normalizeRequestLoadProfile("unknown")).toBe(DEFAULT_REQUEST_LOAD_PROFILE)
  })

  it("stores and reads the selected profile", () => {
    writeStoredRequestLoadProfile("deep")
    expect(readStoredRequestLoadProfile()).toBe("deep")
  })

  it("falls back when storage contains invalid data", () => {
    window.localStorage.setItem("student_request_load_profile_v1", "invalid")
    expect(readStoredRequestLoadProfile()).toBe(DEFAULT_REQUEST_LOAD_PROFILE)
  })
})
