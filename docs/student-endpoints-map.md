# Mapa de Endpoints del Rol Estudiante

## Alcance

Este documento resume los endpoints que sostienen el flujo del estudiante en EDUCEARCH, con prioridad en:

- busqueda avanzada,
- verificacion de veracidad,
- piramide de evidencia,
- asistente IA,
- historial y persistencia asociada.

Base de backend: `/api`

## Dashboard y progreso

### `GET /api/student/dashboard/overview`

- Rol: `STUDENT`
- Backend: `StudentController.getDashboardOverview`
- Servicio: `StudentService.getStudentProgress`
- Uso frontend: dashboard del estudiante
- Devuelve:
  - progreso por competencias
  - contadores agregados
  - actividad reciente

### `GET /api/student/progress/detailed`

- Rol: `STUDENT`
- Backend: `StudentController.getDetailedProgress`
- Servicio: `ProgressTrackingService.getDetailedProgress`
- Uso:
  - progreso detallado
  - ampliaciones analiticas del dashboard

### `GET /api/student/search/history`

- Rol: `STUDENT`
- Backend: `StudentController.getSearchHistory`
- Uso:
  - endpoint disponible para historial basico por rol
  - el frontend actual usa principalmente `/api/search/history`

## Busqueda avanzada

### `POST /api/search/execute`

- Rol: `STUDENT | PROFESSOR`
- Backend: `SearchController.executeSearch`
- Servicio: `SearchService.executeSearch`
- Cliente frontend: `searchApi.execute(...)`
- Pantalla: `/student/search`

Request principal:

- `query.terms`
- `query.operators`
- `query.meshTerms`
- `filters.yearFrom`
- `filters.yearTo`
- `filters.studyTypes`
- `filters.minSampleSize`
- `filters.language`
- `filters.hasFullText`
- `filters.maxResults`
- `context.sessionId`

Respuesta principal:

- `searchId`
- `results[]`
  - `id`, `pmid`, `title`, `abstractText`, `authors`, `journal`, `year`
  - `studyType`, `evidenceLevel`, `sampleSize`, `hasConflictOfInterest`
  - `doi`, `fullTextUrl`, `meshTerms`
- `metadata.totalResults`

Comportamiento:

- primer intento por PubMed
- fallback local persistido
- fallback externo de salud
- actividad de APIs externas en tiempo real

### `GET /api/search/mesh/suggestions?term=...`

- Rol: `STUDENT | PROFESSOR`
- Backend: `SearchController.getMeshSuggestions`
- Servicio: `PubMedApiService.getSuggestedMeshTerms`
- Cliente frontend: `searchApi.getMeshSuggestions(...)`
- Uso:
  - autocompletado MeSH
  - constructor visual
  - modo avanzado

### `GET /api/search/history?page={page}&limit={limit}`

- Rol: `STUDENT | PROFESSOR`
- Backend: `SearchController.getSearchHistory`
- Cliente frontend: `searchApi.getHistory(...)`
- Uso:
  - historial
  - favoritos
  - reutilizacion

### `GET /api/search/sessions/{sessionId}`

- Rol: `STUDENT | PROFESSOR`
- Backend: `SearchController.getSearchSession`
- Cliente frontend: `searchApi.getSession(...)`
- Uso:
  - rehidratar una sesion concreta
  - recuperar query y resultados

### `PUT /api/search/{searchId}`

- Rol: `STUDENT | PROFESSOR`
- Backend: `SearchController.updateSearch`
- Cliente frontend: `searchApi.saveSearch(...)`
- Uso:
  - marcar o quitar favorito

### `DELETE /api/search/{searchId}`

- Rol: `STUDENT | PROFESSOR`
- Backend: `SearchController.deleteSearch`
- Cliente frontend: `searchApi.deleteSearch(...)`
- Uso:
  - eliminar historial

### `POST /api/search/external-fallback`

- Rol: `STUDENT | PROFESSOR`
- Backend: `SearchController.executeExternalFallback`
- Servicio: `HealthSearchProxyService.search(...)`
- Estado:
  - backend disponible
  - el cliente actual resuelve contingencia sobre todo desde `lib/health-sources.ts`

## Asistente IA de busqueda

### `POST /api/search/assistant`

- Rol: `STUDENT | PROFESSOR`
- Backend: `SearchController.askSearchAssistant`
- Servicio: `SearchAssistantServiceImpl.generateResponse`
- Cliente frontend:
  - `searchAssistantApi.ask(...)`
  - pagina `/student/search`
  - enriquecimiento en `lib/verification.ts`

Request:

- `message`
- `selectedTerms`
- `operators`
- `recentTerms`
- `projectContext`
- `conversationHistory`
- `filters`

Respuesta:

- `reply`
- `suggestedTerms`
- `suggestedOperators`
- `suggestedFilters`
- `autoPlan`
- `tips`
- `canAutoApply`
- `usedAi`
- `fallbackUsed`

Comportamiento:

- usa Gemini desde backend
- si la IA falla, devuelve fallback operativo
- permite aplicar terminos, operadores, filtros y plan completo

## Verificacion de veracidad

### `POST /api/verify/claim`

- Rol: `STUDENT | PROFESSOR`
- Backend: `VerificationController.verifyClaim`
- Servicio: `VerificationServiceImpl.verifyClaim`
- Cliente frontend: `verifyApi.verifyClaim(...)`
- Hook: `useStudentVerify.verifyClaim(...)`
- Pantalla: `/student/verify`

Request:

- `claimText` o `sourceUrl`
- `context.sessionId` opcional

Respuesta:

- `id`
- `claim`
- `status`
- `score`
- `supportingEvidence[]`
- `contradictingEvidence[]`
- `explanation`
- `recommendations[]`
- `verifiedAt`

Comportamiento:

- acepta texto o URL
- si llega URL sin claim, el backend extrae contenido
- persiste estados `PROCESSING`, `COMPLETED` o `FAILED`
- el cliente puede esperar resultado final y fusionar fallback externo

### `GET /api/verify/result/{verificationId}`

- Rol: `STUDENT | PROFESSOR`
- Backend: `VerificationController.getVerificationResult`
- Cliente frontend: polling interno en `verifyApi.verifyClaim(...)`
- Uso:
  - consolidar analisis final
  - completar explicacion IA y evidencia

### `GET /api/verify/history?page={page}&limit={limit}`

- Rol: `STUDENT | PROFESSOR`
- Backend: `VerificationController.getVerificationHistory`
- Cliente frontend: `verifyApi.getHistory(...)`
- Uso:
  - historial de verificaciones
  - sidebar de resultados recientes

## Piramide de evidencia

### `GET /api/search/results/{searchId}/evidence-pyramid`

- Rol: `STUDENT | PROFESSOR`
- Backend: `SearchController.getEvidencePyramid`
- Cliente frontend: `searchApi.getEvidencePyramid(...)`
- Pantalla: `/student/pyramid`

Respuesta:

- `searchId`
- `source`
- `generatedAt`
- `query`
  - `terms`
  - `raw`
  - `filters`
- `totalStudies`
- `strength`
  - `code`
  - `description`
  - `score`
- `levels[]`
  - `level`
  - `label`
  - `count`
  - `percentage`
  - `studies[]`

Estado actual del frontend tras este ajuste:

- si la pagina recibe `searchId`, consume este endpoint consolidado
- si recibe solo `q`, ejecuta una busqueda normal y construye la piramide desde resultados

## Estado funcional revisado

- busqueda avanzada: operativa
- asistente IA: operativa con IA real y fallback
- verificacion: operativa con backend principal, polling y enriquecimiento IA
- piramide: ahora conectada al endpoint backend consolidado por `searchId`
- build: se estabilizo retirando `experimental.workerThreads`, que estaba provocando `DataCloneError` en `next build`

## Observaciones

- `typescript.ignoreBuildErrors = true` sigue activo en Next, por lo que una build verde no garantiza ausencia total de errores de tipos.
- Las pruebas unitarias no pudieron correr en este entorno por `spawn EPERM`, que apunta a una restriccion del runtime actual.
