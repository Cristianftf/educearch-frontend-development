import {
  ApiHttpError,
  ApiTimeoutError,
  ApiNetworkError,
  ApiAbortedError,
} from './api-client'

export {
  ApiHttpError,
  ApiTimeoutError,
  ApiNetworkError,
  ApiAbortedError,
}

export function isConnectivityError(error: unknown): boolean {
  if (error instanceof ApiHttpError) {
    // Los errores HTTP no son errores de conectividad
    return false
  }
  if (error instanceof ApiNetworkError || error instanceof ApiAbortedError) {
    return true
  }
  if (error instanceof ApiTimeoutError) {
    return true
  }

  if (error instanceof SyntaxError) {
    return false
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') return true
    if (/failed to fetch/i.test(error.message)) return true
    if (/network/i.test(error.message)) return true
    if (/load failed/i.test(error.message)) return true
    if (/timed out/i.test(error.message)) return true
    if (/timeout/i.test(error.message)) return true
    return !/^API Error:/.test(error.message)
  }

  return true
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiHttpError) {
    if (error.isRateLimit) {
      return 'Demasiadas solicitudes. Por favor, espera un momento e intenta de nuevo.'
    }
    if (error.isUnauthorized) {
      return 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.'
    }
    if (error.isForbidden) {
      return 'No tienes permiso para realizar esta acción.'
    }
    if (error.isNotFound) {
      return 'El recurso solicitado no fue encontrado.'
    }
    if (error.isServerError) {
      return 'Error del servidor. Por favor, intenta de nuevo más tarde.'
    }
    if (error.isPayloadTooLarge) {
      return 'El archivo es demasiado grande. Por favor, reduce su tamaño.'
    }
    return error.details || 'Ha ocurrido un error inesperado.'
  }

  if (error instanceof ApiTimeoutError) {
    return 'La solicitud tardó demasiado. Por favor, verifica tu conexión e intenta de nuevo.'
  }

  if (error instanceof ApiNetworkError) {
    return 'Error de conexión. Por favor, verifica tu conexión a internet.'
  }

  if (error instanceof ApiAbortedError) {
    return 'La solicitud fue cancelada.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Ha ocurrido un error inesperado.'
}