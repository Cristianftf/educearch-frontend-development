const HTTP_PROTOCOLS = new Set(['http:', 'https:'])

const PRIVATE_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^::1$/i,
  /^\[::1\]$/i,
  /^fc/i,
  /^fd/i,
  /\.local$/i,
]

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase()
  return PRIVATE_HOSTNAME_PATTERNS.some((pattern) => pattern.test(normalized))
}

export type SourceUrlValidation = {
  normalizedUrl?: string
  error?: string
}

export function validateContentSourceUrl(value: string): SourceUrlValidation {
  const raw = value.trim()
  if (!raw) {
    return { error: 'Ingresa una URL para verificar.' }
  }

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { error: 'La URL no tiene un formato valido.' }
  }

  if (!HTTP_PROTOCOLS.has(parsed.protocol)) {
    return { error: 'Solo se permiten URLs con http o https.' }
  }

  if (!parsed.hostname) {
    return { error: 'La URL debe incluir un dominio valido.' }
  }

  if (parsed.username || parsed.password) {
    return { error: 'La URL no debe incluir credenciales embebidas.' }
  }

  if (isPrivateHostname(parsed.hostname)) {
    return { error: 'No se permiten URLs locales o de red privada.' }
  }

  parsed.hash = ''
  return { normalizedUrl: parsed.toString() }
}

export function normalizeHttpUrl(value: string): string | null {
  const { normalizedUrl } = validateContentSourceUrl(value)
  return normalizedUrl ?? null
}
