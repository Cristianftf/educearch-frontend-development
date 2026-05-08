# 🛡️ Auditoría de Seguridad, Rendimiento y Comunicación con APIs Externas

**Fecha**: 7 de mayo de 2026  
**Archivos Analizados**: 20+  
**Alcance**: Frontend Next.js, APIs externas, WebSockets/STOMP, seguridad perimetral

---

## 🔴 HALLAZGOS CRÍTICOS

### 🔴 CR-01: `unsafe-inline` + `unsafe-eval` en CSP - Riesgo de XSS
- **Archivo**: `next.config.mjs` (línea 28)
- **Problema**: La política CSP usa `'unsafe-inline'` y `'unsafe-eval'` en `script-src`, lo que **anula la protección contra XSS**. Cualquier script inyectado se ejecutará sin restricciones.
- **Severidad**: 🔴 **CRITICAL**
- **Impacto**: Un atacante que logre inyectar HTML/JS (ej. en inputs de usuario mal sanitizados) podrá ejecutar código arbitrario, robar tokens JWT, modificar el DOM.
- **Recomendación**:
  - En producción, eliminar `'unsafe-inline'` y `'unsafe-eval'` de `script-src`
  - Usar **nonces** o **hashes** para scripts inline legítimos
  - `style-src 'unsafe-inline'` también es riesgoso — usar CSS modules o styled-components con nonces

### 🔴 CR-02: Token JWT expuesto en `connectHeaders` de WebSocket sin WSS forzado
- **Archivo**: `hooks/use-chat-realtime.ts` (líneas 84-87)
- **Problema**: El JWT se envía como header de conexión STOMP en texto plano. Si la conexión WebSocket no usa WSS (TLS), el token viaja sin cifrar. No hay validación que fuerce WSS en producción.
- **Severidad**: 🔴 **CRITICAL**
- **Impacto**: Un atacante en la misma red (MITM) puede interceptar el token JWT y suplantar la identidad del usuario.
- **Recomendación**:
  - Forzar WSS en producción (validar que `wsUrl` use protocolo `wss:` antes de conectar)
  - Configurar HSTS en `next.config.mjs` (actualmente no hay HSTS en frontend)
  - Como fallback, no exponer el token si la conexión no es segura

### 🔴 CR-03: Tokens JWT almacenados en `localStorage` (vulnerable a XSS)
- **Archivo**: `contexts/auth-context.tsx` (líneas 34, 91)
- **Problema**: El token JWT se guarda en `localStorage` bajo `auth_token`. No se usa `httpOnly` cookie.
- **Severidad**: 🔴 **CRITICAL**
- **Impacto**: Con un XSS (CR-01), el atacante lee `localStorage` y roba el token. El token persiste incluso si se cierra el navegador.
- **Recomendación**:
  - Migrar a **httpOnly cookies** para el token de acceso
  - Usar `refreshToken` almacenado solo en memoria o cookie separada
  - Alternativa inmediata: usar `sessionStorage` (no persiste entre pestañas)

### 🔴 CR-04: `connect-src` demasiado permisivo - Exfiltración de datos sin restricciones
- **Archivo**: `next.config.mjs` (línea 33)
- **Problema**: `connect-src 'self' https: wss: ws: http://localhost:* http://127.0.0.1:*` permite conexiones a **cualquier origen HTTPS/WSS/WS**, incluyendo `localhost` en cualquier puerto.
- **Severidad**: 🔴 **CRITICAL**
- **Impacto**: Un atacante puede exfiltrar datos a cualquier servidor externo vía fetch/WebSocket. Las extensiones maliciosas del navegador pueden comunicarse con APIs locales.
- **Recomendación**:
  - Listar explícitamente los orígenes permitidos: `connect-src 'self' https://api.uci.cu wss://api.uci.cu`
  - En desarrollo, usar variables de entorno limitadas

---

## 🟠 HALLAZGOS DE ALTA SEVERIDAD

### 🟠 HI-01: Falta de timeout global en `ApiClient`
- **Archivo**: `lib/api-client.ts` (líneas 71-126)
- **Problema**: El método `request()` usa `fetch()` sin `AbortController` con timeout global. Si el backend no responde, la petición puede quedar colgada indefinidamente.
- **Severidad**: 🟠 **HIGH**
- **Impacto**: Acumulación de conexiones colgadas, degradación del rendimiento, usuario congelado.
- **Recomendación**: Añadir timeout global (ej. 30s) en cada petición `fetch()`:

```typescript
private async request<T>(...): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    })
    // ... manejar response
  } finally {
    clearTimeout(timeoutId)
  }
}
```

### 🟠 HI-02: Sin retry/backoff en `ApiClient`
- **Archivo**: `lib/api-client.ts` (líneas 128-161)
- **Problema**: Las operaciones `get`, `post`, `put`, `delete` no tienen mecanismo de reintento ante fallos transitorios (timeout, 503, 429).
- **Severidad**: 🟠 **HIGH**
- **Impacto**: El usuario ve errores por fallos temporales de red que podrían resolverse con un reintento.
- **Recomendación**: Implementar patrón retry con exponential backoff:

```typescript
async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 500): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try { return await fn() } catch (e) {
      if (i === retries) throw e
      const delay = baseDelay * Math.pow(2, i) + Math.random() * 100
      await new Promise(r => setTimeout(r, delay))
    }
  }
}
```

### 🟠 HI-03: Prefetch ignora errores silenciosamente
- **Archivo**: `lib/api-client.ts` (líneas 163-173)
- **Problema**: El método `prefetch()` atrapa todos los errores (`catch {}`) y los ignora. No hay logging ni monitoreo.
- **Severidad**: 🟠 **HIGH**
- **Impacto**: No se detectan fallos en precarga de datos. El usuario podría ver pantallas de carga lentas sin saber que la precarga falló.
- **Recomendación**: Al menos loguear en consola o a un endpoint de monitoreo:

```typescript
async prefetch(endpoint: string): Promise<void> {
  try {
    await fetch(`${this.baseUrl}${endpoint}`, { method: 'GET', headers: this.buildHeaders() })
  } catch (error) {
    console.warn(`[Prefetch] Failed: ${endpoint}`, error)
  }
}
```

### 🟠 HI-04: Conexión STOMP sin reconexión robusta ni heartbeat configurado contra fallos de red
- **Archivo**: `hooks/use-chat-realtime.ts` (líneas 83-94)
- **Problema**: Aunque hay `reconnectDelay: 5000`, no hay límite máximo de reintentos. El cliente intentará reconectar infinitamente aunque el servidor esté caído. Los heartbeats están en 10000ms pero no hay validación de que el servidor soporte STOMP heartbeats.
- **Severidad**: 🟠 **HIGH**
- **Impacto**: En escenarios de desconexión prolongada, el cliente acumula intentos de reconexión infinitos, consumiendo recursos del navegador.
- **Recomendación**:
  - Añadir `maxReconnectAttempts: 10`
  - Agregar un event listener para `onWebSocketClose` que implemente exponential backoff manual
  - Mostrar indicador al usuario cuando la reconexión supere cierto número de intentos

### 🟠 HI-05: `X-Content-Type-Options` y otras cabeceras duplicadas entre frontend y backend
- **Archivo**: `next.config.mjs` (líneas 39-57) y `backend SecurityHeadersFilter`
- **Problema**: Cabeceras como `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` se configuran tanto en Next.js como en el backend Spring. Esto no causa error, pero puede crear confusión sobre quién es responsable de qué.
- **Severidad**: 🟠 **HIGH** (por confusión de responsabilidades)
- **Impacto**: Si se cambia una cabecera en un lugar pero no en el otro, hay inconsistencia.
- **Recomendación**: Unificar la estrategia:
  - **Frontend (Next.js)**: CSP, HSTS, Permissions-Policy
  - **Backend (Spring)**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
  - Documentar claramente la separación de responsabilidades

### 🟠 HI-06: `img-src data: https: blob:` demasiado permisivo
- **Archivo**: `next.config.mjs` (línea 30)
- **Problema**: `img-src 'self' data: https: blob:` permite cargar imágenes desde **cualquier origen HTTPS** y desde blobs.
- **Severidad**: 🟠 **HIGH**
- **Impacto**: Un atacante puede cargar imágenes desde servidores maliciosos (pixel tracking, exfiltración de datos vía URL params en solicitudes de imagen).
- **Recomendación**: Restringir a dominios específicos: `img-src 'self' data: https://*.uci.cu blob:`

---

## 🟡 HALLAZGOS DE SEVERIDAD MEDIA

### 🟡 MD-01: APIs externas consultadas directamente desde el frontend sin proxy
- **Archivo**: `lib/health-sources.ts` (líneas 686-976)
- **Problema**: Las APIs de PubMed, Europe PMC y ClinicalTrials.gov se consultan **directamente desde el frontend** usando `fetch()` del navegador. Las API keys y tokens de proveedores externos se exponen en `connect-src`.
- **Severidad**: 🟡 **MEDIUM**
- **Impacto**: Las API keys (si se añaden en el futuro) quedarían expuestas. Dependencia de CORS de terceros. Latencia visible al usuario.
- **Recomendación**:
  - Migrar todas las consultas a proveedores externos a través del **backend proxy** (`/search/external-fallback`)
  - Eliminar las llamadas directas a PubMed/Europe PMC/ClinicalTrials.gov del frontend
  - Esto también reduce el tamaño del bundle y mejora el rendimiento

### 🟡 MD-02: `searchAssistantApi.ask()` sin timeout específico
- **Archivo**: `lib/search-assistant.ts` (línea 173)
- **Problema**: La llamada a `/search/assistant` usa el método `post` genérico de `api-client` sin timeout adaptado. Si el asistente IA tarda demasiado, la petición queda colgada.
- **Severidad**: 🟡 **MEDIUM**
- **Impacto**: El usuario puede experimentar congelamiento de la UI mientras espera respuesta del asistente.
- **Recomendación**: Añadir timeout (ej. 15s) específico para esta operación:

```typescript
ask: async (request: SearchAssistantRequest, signal?: AbortSignal): Promise<SearchAssistantResponse> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await api.post<SearchAssistantResponse>('/search/assistant', request, {
      signal: signal || controller.signal
    })
    return normalizeResponse(response)
  } finally {
    clearTimeout(timeoutId)
  }
}
```

### 🟡 MD-03: Errores de conexión WebSocket atrapados silenciosamente (sin feedback al usuario)
- **Archivo**: `hooks/use-chat-realtime.ts` (líneas 91-93, 124-131, 119-122)
- **Problema**: Los errores de WebSocket se almacenan en estado `connectionError` pero no se exponen al usuario de forma visible (no hay componente de UI que muestre este estado).
- **Severidad**: 🟡 **MEDIUM**
- **Impacto**: El usuario no sabe por qué no puede enviar mensajes en tiempo real. La función `sendRealtimeMessage` retorna `false` silenciosamente.
- **Recomendación**: Añadir un badge/indicador en la UI del chat que muestre "Desconectado" o "Reconectando..." basado en `isConnected` y `connectionError`.

### 🟡 MD-04: Cache local de búsquedas sin límite de tamaño en localStorage
- **Archivo**: `lib/health-sources.ts` (líneas 979-1017)
- **Problema**: Aunque hay un límite de 40 entradas, el tamaño de cada entrada puede ser grande (arrays de resultados de búsqueda con abstracts). `localStorage` tiene un límite de ~5-10MB.
- **Severidad**: 🟡 **MEDIUM**
- **Impacto**: Con el tiempo, el cache puede llenar `localStorage` y causar errores de `QuotaExceededError` en otras funcionalidades.
- **Recomendación**: Añadir límite de tamaño total (ej. 2MB) además del límite de entradas:

```typescript
const CACHE_MAX_TOTAL_BYTES = 2 * 1024 * 1024 // 2MB

function writeSearchCache(entries: CachedSearchEntry[]): void {
  let totalBytes = 0
  const trimmed: CachedSearchEntry[] = []
  for (const entry of entries) {
    const bytes = new Blob([JSON.stringify(entry)]).size
    if (totalBytes + bytes > CACHE_MAX_TOTAL_BYTES) break
    trimmed.push(entry)
    totalBytes += bytes
  }
  writeLocalStorage(EXTERNAL_SEARCH_CACHE_KEY, trimmed)
}
```

### 🟡 MD-05: Sin mecanismo de cancelación de peticiones en hooks de búsqueda
- **Archivo**: `hooks/use-student-search.ts` (potencialmente, verificar)
- **Problema**: No hay `AbortController` en las peticiones de búsqueda del estudiante. Si el usuario escribe rápidamente, se pueden acumular múltiples peticiones obsoletas.
- **Severidad**: 🟡 **MEDIUM**
- **Impacto**: Peticiones innecesarias al backend, posible sobrecarga y race conditions en resultados.
- **Recomendación**: Cancelar peticiones anteriores en cada nueva búsqueda:

```typescript
// En el hook de búsqueda
const abortRef = useRef<AbortController | null>(null)

const search = async (query: string) => {
  abortRef.current?.abort()
  const controller = new AbortController()
  abortRef.current = controller
  const results = await searchApi.search({ query }, { signal: controller.signal })
  setResults(results)
}
```

---

## 🟢 HALLAZGOS DE BAJA SEVERIDAD / RECOMENDACIONES

### 🟢 LW-01: `HSTS` no configurado en frontend
- **Archivo**: `next.config.mjs`
- **Problema**: No hay cabecera `Strict-Transport-Security` en los headers de Next.js. Solo está en el backend Spring.
- **Impacto**: Bajo riesgo si el backend ya fuerza HTTPS, pero es buena práctica tenerlo en ambos.
- **Recomendación**: Añadir HSTS en `next.config.mjs`:

```typescript
{
  key: 'Strict-Transport-Security',
  value: 'max-age=31536000; includeSubDomains; preload',
}
```

### 🟢 LW-02: `X-Powered-By` vacío pero aún presente
- **Archivo**: `next.config.mjs` (línea 59-61)
- **Problema**: Se envía `X-Powered-By: ''` (vacío). Esto es mejor que exponer "Next.js", pero la cabecera sigue presente. Algunos scanners de seguridad marcan esto como "server header leaking".
- **Impacto**: Informativo sobre la tecnología usada.
- **Recomendación**: Eliminar completamente la cabecera (no sobrescribir a vacío):

```typescript
{
  key: 'X-Powered-By',
  value: undefined, // no enviar la cabecera
}
```

### 🟢 LW-03: Logging de depuración intencionalmente silenciado
- **Archivo**: `hooks/use-chat-realtime.ts` (línea 91-93)
- **Problema**: El callback `debug` está vacío intencionalmente. Esto es común y no es un bug, pero impide depurar problemas de conexión WebSocket en producción.
- **Recomendación**: En desarrollo, habilitar debug logging; en producción, usar un logger condicional.

### 🟢 LW-04: `allowedDevOrigins` en next.config.mjs permite `*.tunnelmole.net`
- **Archivo**: `next.config.mjs` (línea 5-8)
- **Problema**: `allowedDevOrigins` incluye `*.tunnelmole.net` y `*.tunnelmole.com`, que son servicios de tunneling público. Esto es aceptable para desarrollo pero debe eliminarse en producción.
- **Recomendación**: Asegurarse de que esta variable de entorno esté vacía o solo contenga orígenes propios en producción:

```
# .env.production
NEXT_ALLOWED_DEV_ORIGINS=
```

---

## 📊 RESUMEN DE HALLAZGOS POR CATEGORÍA

| Categoría | CRITICAL | HIGH | MEDIUM | LOW | Total |
|-----------|----------|------|--------|-----|-------|
| CSP / Headers | 2 (CR-01, CR-04) | 2 (HI-05, HI-06) | 0 | 3 (LW-01, LW-02, LW-04) | 7 |
| Autenticación/Tokens | 2 (CR-02, CR-03) | 0 | 0 | 0 | 2 |
| Timeout/Retry | 0 | 2 (HI-01, HI-02) | 1 (MD-02) | 0 | 3 |
| WebSocket/STOMP | 0 | 1 (HI-04) | 1 (MD-03) | 1 (LW-03) | 3 |
| APIs Externas | 0 | 0 | 1 (MD-01) | 0 | 1 |
| Cache/LocalStorage | 0 | 0 | 1 (MD-04) | 0 | 1 |
| Cancelación Peticiones | 0 | 0 | 1 (MD-05) | 0 | 1 |
| **Total** | **4** | **5** | **5** | **4** | **18** |

---

## 🎯 PLAN DE ACCIÓN RECOMENDADO

### Prioridad Inmediata (Impacto inmediato)
1. **CR-01**: Eliminar `'unsafe-inline'` y `'unsafe-eval'` de CSP en producción — implementar nonces
2. **CR-02**: Forzar WSS en WebSocket — agregar validación de protocolo seguro
3. **CR-03**: Migrar tokens JWT de `localStorage` a `httpOnly` cookies
4. **CR-04**: Restringir `connect-src` a orígenes específicos de producción

### Prioridad Alta (Siguiente sprint)
5. **HI-01**: Añadir timeout global al `ApiClient`
6. **HI-02**: Implementar retry con exponential backoff
7. **HI-04**: Limitar reconexiones WebSocket con maxReconnectAttempts
8. **HI-05**: Unificar responsabilidad de cabeceras de seguridad
9. **HI-06**: Restringir `img-src` a dominios específicos

### Prioridad Media (Mejora continua)
10. **MD-01**: Mover APIs externas a backend proxy (PubMed, Europe PMC, ClinicalTrials)
11. **MD-02**: Añadir timeout específico al asistente IA
12. **MD-03**: Mostrar estado de conexión WebSocket en UI
13. **MD-04**: Limitar tamaño total de cache en localStorage
14. **MD-05**: Implementar AbortController en hooks de búsqueda

### Prioridad Baja (Housekeeping)
15. **LW-01**: Añadir HSTS al frontend
16. **LW-02**: Eliminar cabecera `X-Powered-By` completamente
17. **LW-04**: Validar `allowedDevOrigins` vacío en producción

---

## 🔧 BUENAS PRÁCTICAS IDENTIFICADAS (Positivo)

A pesar de los hallazgos, se identificaron prácticas positivas:

1. ✅ **AbortController en verificación**: `lib/verification.ts` usa `AbortController` correctamente para cancelar peticiones de verificación cuando expira el presupuesto de tiempo.
2. ✅ **Timeout en health-sources**: `fetchJsonWithTimeout()` implementa timeout de 8s para APIs externas.
3. ✅ **Mecanismo de fallback robusto**: El sistema de verificación tiene múltiples capas de fallback (backend -> proxy -> proveedores directos -> cache local -> emergencia).
4. ✅ **Header en backend**: Spring Security aplica cabeceras de seguridad correctamente (X-Frame-Options, HSTS, X-Content-Type-Options).
5. ✅ **CORS configurado**: El backend tiene configuración CORS restrictiva para producción.
6. ✅ **Refresh tokens**: El sistema de autenticación soporta refresh tokens, lo que permite rotación de credenciales.
7. ✅ **Cache de búsqueda con TTL**: Las búsquedas externas se cachean con TTL de 12h y verificaciones con 24h.
8. ✅ **Separación de ambientes**: Existen perfiles `dev` y `prod` separados para configuración de seguridad.

---

*Documento generado el 7 de mayo de 2026 como parte de la auditoría de seguridad, rendimiento y comunicación del proyecto EduSearch Frontend.*