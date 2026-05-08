# Mapa de Endpoints del Rol Profesor

## Alcance

Este documento resume los endpoints que sostienen el flujo del profesor en EDUCEARCH, con foco en:

- dashboard del profesor,
- búsqueda académica y recuperación de sesiones,
- search hedges,
- casos de estudio,
- evaluaciones,
- seguimiento de estudiantes,
- analíticas,
- chat y navegación contextual.

Base de backend: `/api`

## Dashboard

### `GET /api/professor/analytics/overview`

- Método: `GET`
- Propósito funcional: cargar resumen general de la clase, progreso promedio, estudiantes en seguimiento y términos de búsqueda relevantes.
- Consumidores:
  - `/professor`
  - `/professor/analytics`
  - `/professor/students`
  - `lib/professor-analytics.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se normalizó la respuesta para evitar caídas por campos faltantes,
  - se reutilizó como fuente principal del dashboard y analíticas.

### `GET /api/evaluations/pending`

- Método: `GET`
- Propósito funcional: obtener entregas pendientes de evaluación.
- Consumidores:
  - `/professor`
  - `/professor/evaluations`
  - `lib/evaluations.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se consolidó el consumo desde `evaluationApi.getPending()`,
  - el dashboard ahora enlaza al detalle real de evaluación por submission.

## Búsqueda académica del profesor

### `POST /api/search/execute`

- Método: `POST`
- Propósito funcional: ejecutar búsqueda estructurada para profesor.
- Consumidores:
  - `/professor/search`
  - `lib/search.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la página del profesor ahora ejecuta la búsqueda real, persiste estado local, y recupera resultados para crear casos.

### `GET /api/search/mesh/suggestions?term=...`

- Método: `GET`
- Propósito funcional: autocompletado MeSH.
- Consumidores:
  - `/professor/search`
  - `lib/search.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se conectó el autocompletado al constructor visual del profesor.

### `GET /api/search/history?page={page}&limit={limit}`

- Método: `GET`
- Propósito funcional: recuperar historial de sesiones de búsqueda.
- Consumidores:
  - `/professor/search`
  - `lib/search.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la UI del profesor ahora muestra historial reciente y permite reabrir sesiones.

### `GET /api/search/sessions/{sessionId}`

- Método: `GET`
- Propósito funcional: rehidratar una sesión concreta con query y resultados.
- Consumidores:
  - `/professor/search`
  - `lib/search.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se añadió recuperación de sesiones dentro del flujo del profesor.

### `PUT /api/search/{searchId}`

- Método: `PUT`
- Propósito funcional: marcar o desmarcar una búsqueda como favorita.
- Consumidores:
  - `/professor/search`
  - `lib/search.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se habilitó el toggle de favorito desde el historial del profesor.

### `POST /api/search/assistant`

- Método: `POST`
- Propósito funcional: asistente IA para mejorar términos, operadores y filtros.
- Consumidores:
  - `/professor/search`
  - `lib/search-assistant.ts`
- Estado actual: operativo con respuesta IA o fallback backend.
- Corrección aplicada:
  - el profesor ya tiene panel IA conectado a backend con historial corto de conversación.

## Search Hedges

### `GET /api/hedges`

- Método: `GET`
- Propósito funcional: listar hedges del profesor.
- Consumidores:
  - `/professor/hedges`
  - `lib/hedges.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se mantuvo el normalizador de hedges y se usa categoría real del backend.

### `GET /api/hedges/categories`

- Método: `GET`
- Propósito funcional: listar categorías disponibles.
- Consumidores:
  - `/professor/hedges`
  - `/professor/search`
  - `lib/hedges.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la búsqueda del profesor ahora usa categorías reales al guardar un hedge.

### `POST /api/hedges`

- Método: `POST`
- Propósito funcional: crear hedge nuevo.
- Consumidores:
  - `/professor/hedges`
  - `/professor/search`
  - `lib/hedges.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se conectó guardado de hedge desde búsqueda y desde la pantalla de administración de hedges.

### `PUT /api/hedges/{id}`

- Método: `PUT`
- Propósito funcional: editar hedge existente.
- Consumidores:
  - `/professor/hedges`
  - `lib/hedges.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se conservó el payload saneado para nombre, categoría, query y descripción.

### `DELETE /api/hedges/{id}`

- Método: `DELETE`
- Propósito funcional: eliminar hedge.
- Consumidores:
  - `/professor/hedges`
  - `lib/hedges.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la vista mantiene eliminación directa sobre backend.

### `POST /api/hedges/test`

- Método: `POST`
- Propósito funcional: validar una query de hedge.
- Consumidores:
  - `/professor/hedges`
  - `lib/hedges.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se conserva el flujo de prueba y normalización del resultado.

## Casos de estudio

### `GET /api/cases`

- Método: `GET`
- Propósito funcional: listar casos del profesor, opcionalmente filtrados por estado.
- Consumidores:
  - `/professor/cases`
  - `hooks/use-professor-cases.ts`
  - `lib/cases.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se mantuvo como endpoint principal y se agregó persistencia del filtro docente desde contexto.

### `GET /api/cases/{id}`

- Método: `GET`
- Propósito funcional: obtener detalle de un caso.
- Consumidores:
  - `/professor/cases/[id]`
  - `/professor/cases/[id]/edit`
  - `/professor/evaluations/[id]`
  - `lib/cases.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - el detalle del caso ahora muestra escenario, rúbrica, estudiantes y entregas vinculadas.

### `POST /api/cases`

- Método: `POST`
- Propósito funcional: crear caso nuevo.
- Consumidores:
  - `/professor/cases/new`
  - `/professor/cases`
  - `hooks/use-professor-cases.ts`
  - `lib/cases.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se habilitó navegación contextual desde `/professor/search` hacia creación de caso con artículos preseleccionados.

### `PUT /api/cases/{id}`

- Método: `PUT`
- Propósito funcional: editar caso o cambiar estado.
- Consumidores:
  - `/professor/cases`
  - `/professor/cases/[id]`
  - `/professor/cases/[id]/edit`
  - `hooks/use-professor-cases.ts`
  - `lib/cases.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - el detalle del caso y la edición usan este endpoint para estado y actualización.

### `DELETE /api/cases/{id}`

- Método: `DELETE`
- Propósito funcional: eliminar caso.
- Consumidores:
  - `/professor/cases`
  - `/professor/cases/[id]`
  - `hooks/use-professor-cases.ts`
  - `lib/cases.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la eliminación quedó conectada en listado y detalle.

### `POST /api/cases/{id}/assign`

- Método: `POST`
- Propósito funcional: asignar estudiantes a un caso.
- Consumidores:
  - `/professor/cases/[id]`
  - `hooks/use-professor-cases.ts`
  - `lib/cases.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - el detalle del caso ahora actualiza asignaciones reales y protege activación sin estudiantes.

### `GET /api/cases/students`

- Método: `GET`
- Propósito funcional: obtener estudiantes asignables.
- Consumidores:
  - `/professor/cases/new`
  - `/professor/cases/[id]`
  - `lib/cases.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se usa para publicación y reasignación desde vistas de caso.

### `GET /api/cases/{caseId}/submissions`

- Método: `GET`
- Propósito funcional: listar entregas asociadas a un caso.
- Consumidores:
  - `/professor/cases/[id]`
  - `hooks/use-professor-cases.ts`
  - `lib/cases.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - el detalle del caso ahora muestra entregas y acceso directo a evaluación.

## Evaluaciones

### `GET /api/evaluations/pending`

- Método: `GET`
- Propósito funcional: entregas pendientes.
- Consumidores:
  - `/professor`
  - `/professor/evaluations`
  - `lib/evaluations.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se centralizó su uso desde una vista índice y desde dashboard.

### `GET /api/evaluations/reviewed`

- Método: `GET`
- Propósito funcional: entregas ya evaluadas.
- Consumidores:
  - `/professor/evaluations`
  - `lib/evaluations.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la vista índice ahora separa pendientes y revisadas.

### `GET /api/submissions/{submissionId}`

- Método: `GET`
- Propósito funcional: detalle completo de una entrega por submission.
- Consumidores:
  - `/professor/evaluations/[id]`
  - `lib/evaluations.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la vista detalle ahora se hidrata con esta fuente antes de cargar la evaluación.

### `GET /api/evaluations/submission/{submissionId}`

- Método: `GET`
- Propósito funcional: recuperar evaluación existente para una entrega.
- Consumidores:
  - `/professor/evaluations/[id]`
  - `lib/evaluations.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - el detalle ahora precarga comentarios, puntuaciones y feedback si ya existían.

### `POST /api/evaluations/{submissionId}`

- Método: `POST`
- Propósito funcional: crear evaluación para una entrega.
- Consumidores:
  - `/professor/evaluations/[id]`
  - `lib/evaluations.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la evaluación detallada ya publica scores por competencia, comentarios y feedback general.

## Seguimiento de estudiantes y analíticas

### `GET /api/professor/students`

- Método: `GET`
- Propósito funcional: progreso de estudiantes vinculados al profesor.
- Consumidores:
  - `/professor/students`
  - `lib/professor-analytics.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se mantiene como fuente principal de tabla y seguimiento.

### `GET /api/professor/analytics/student/{studentId}`

- Método: `GET`
- Propósito funcional: detalle individual de progreso.
- Consumidores:
  - `/professor/students`
  - `lib/professor-analytics.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la vista de detalle del estudiante sigue este endpoint con fallback normalizado.

### `GET /api/professor/analytics/class-performance`

- Método: `GET`
- Propósito funcional: métricas agregadas de rendimiento de la clase.
- Consumidores:
  - `/professor/analytics`
  - `lib/professor-analytics.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se añadió el cliente frontend y la pantalla de analíticas ya lo consume.

## Estado funcional revisado

- dashboard del profesor: operativo.
- búsqueda del profesor: operativa con historial, recuperación de sesiones, favoritos y asistente IA.
- search hedges: operativo.
- casos de estudio: listado, detalle, creación, edición, asignación y eliminación operativos.
- evaluaciones: índice y detalle operativo con rehidratación de evaluación existente.
- seguimiento de estudiantes: operativo.
- analíticas: operativo con overview y class-performance.
- chat del profesor: operativo.

## Pendientes reales dependientes del backend

- la evaluación detallada muestra retroalimentación por criterio en frontend, pero el backend actual persiste formalmente scores y comments por competencia, no comentarios por criterio de rúbrica.
- `next build` sigue usando `Skipping validation of types`, por configuración actual de Next; por eso se validó aparte con `tsc --noEmit`.
