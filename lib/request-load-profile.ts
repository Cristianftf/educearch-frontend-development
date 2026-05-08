export type RequestLoadProfile = 'light' | 'balanced' | 'deep'

export const REQUEST_LOAD_PROFILE_STORAGE_KEY = 'student_request_load_profile_v1'
export const DEFAULT_REQUEST_LOAD_PROFILE: RequestLoadProfile = 'balanced'

export const REQUEST_LOAD_PROFILE_LABELS: Record<RequestLoadProfile, string> = {
  light: 'Ligera',
  balanced: 'Equilibrada',
  deep: 'Profunda',
}

export const REQUEST_LOAD_PROFILE_DESCRIPTIONS: Record<RequestLoadProfile, string> = {
  light: 'Menor consumo de APIs, resultados acotados y timeouts mas cortos.',
  balanced: 'Balance entre cobertura y estabilidad para uso diario.',
  deep: 'Mayor cobertura documental, mas costo de API y latencia.',
}

export const SEARCH_MAX_RESULTS_BY_PROFILE: Record<RequestLoadProfile, number> = {
  light: 20,
  balanced: 40,
  deep: 80,
}

export const SEARCH_FALLBACK_LIMIT_BY_PROFILE: Record<RequestLoadProfile, number> = {
  light: 8,
  balanced: 12,
  deep: 20,
}

export const SEARCH_TIMEOUT_MS_BY_PROFILE: Record<RequestLoadProfile, number> = {
  light: 8000,
  balanced: 10500,
  deep: 14000,
}

export const SEARCH_COOLDOWN_MS_BY_PROFILE: Record<RequestLoadProfile, number> = {
  light: 1200,
  balanced: 900,
  deep: 700,
}

export const VERIFICATION_TIMEOUT_MS_BY_PROFILE: Record<RequestLoadProfile, number> = {
  light: 20000,
  balanced: 32000,
  deep: 46000,
}

export function normalizeRequestLoadProfile(value: unknown): RequestLoadProfile {
  if (value === 'light' || value === 'balanced' || value === 'deep') {
    return value
  }
  return DEFAULT_REQUEST_LOAD_PROFILE
}

export function readStoredRequestLoadProfile(): RequestLoadProfile {
  if (typeof window === 'undefined') {
    return DEFAULT_REQUEST_LOAD_PROFILE
  }
  try {
    const raw = window.localStorage.getItem(REQUEST_LOAD_PROFILE_STORAGE_KEY)
    return normalizeRequestLoadProfile(raw)
  } catch {
    return DEFAULT_REQUEST_LOAD_PROFILE
  }
}

export function writeStoredRequestLoadProfile(profile: RequestLoadProfile): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(REQUEST_LOAD_PROFILE_STORAGE_KEY, profile)
  } catch {
    // Ignore storage failures.
  }
}
