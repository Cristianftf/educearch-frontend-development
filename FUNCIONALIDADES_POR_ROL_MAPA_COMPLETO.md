# 📊 MAPA EXHAUSTIVO DE FUNCIONALIDADES POR ROL - EDUCEARCH

**Fecha de investigación:** Mayo 5, 2026  
**Proyecto:** educearch-frontend-development  
**Autor:** Investigación de Arquitectura Completa

---

## 🎯 TABLA DE CONTENIDOS

1. [ROL ADMINISTRADOR](#rol-administrador-admin)
2. [ROL PROFESOR](#rol-profesor-professor)
3. [ROL ESTUDIANTE](#rol-estudiante-student)
4. [MÓDULOS COMPARTIDOS](#módulos-compartidos)
5. [MATRIZ DE DEPENDENCIAS](#matriz-de-dependencias)
6. [COMPONENTES TRANSVERSALES](#componentes-transversales)

---

## 🔐 ROL ADMINISTRADOR (ADMIN)

### Módulo 1: Gestión de Usuarios

**Descripción:** Control total de usuarios del sistema (creación, edición, eliminación, cambio de rol, activación/desactivación)

**Endpoints:**
- `GET /api/admin/users` - Listar usuarios con filtros, paginación y estadísticas
- `GET /api/admin/users/{id}` - Obtener datos de usuario específico
- `POST /api/admin/users` - Crear nuevo usuario
- `PUT /api/admin/users/{id}` - Editar datos de usuario
- `DELETE /api/admin/users/{id}` - Eliminar usuario
- `PUT /api/admin/users/{id}/role` - Cambiar rol de usuario
- `PUT /api/admin/users/{id}/status` - Activar/Desactivar usuario

**Backend - Controllers:**
- [AdminController.java](backend/src/main/java/com/uci/competencia/controller/api/AdminController.java) - Líneas 51-215

**Backend - Services:**
- [AdminService.java](backend/src/main/java/com/uci/competencia/service/AdminService.java) - Interface
- [AdminServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/AdminServiceImpl.java) - Implementación con métodos:
  - `searchUsers(Role, Boolean, String, Pageable)`
  - `getUserById(String)`
  - `createUser(UserDTO)`
  - `updateUser(String, UserDTO)`
  - `deleteUser(String)`
  - `changeUserRole(String, String)`
  - `updateUserStatus(String, Boolean)`

**Backend - Repositories:**
- [UserRepository.java](backend/src/main/java/com/uci/competencia/repository/UserRepository.java)
  - Custom queries: `findByRole`, `findByActive`, `findByEmailContaining`

**Backend - Entities:**
- [User.java](backend/src/main/java/com/uci/competencia/model/entity/User.java)

**Backend - DTOs:**
- [UserDTO.java](backend/src/main/java/com/uci/competencia/model/dto/response/UserDTO.java)
- [UserBatchImportDTO.java](backend/src/main/java/com/uci/competencia/model/dto/request/UserBatchImportDTO.java)

**Frontend - Páginas:**
- [app/admin/page.tsx](app/admin/page.tsx) - Dashboard principal
- [app/admin/layout.tsx](app/admin/layout.tsx) - Layout con navegación

**Frontend - Librerías:**
- [lib/admin-users.ts](lib/admin-users.ts) - Funciones:
  - `fetchUsers(page, limit, filters)`
  - `fetchUserById(id)`
  - `createUser(userData)`
  - `updateUser(id, userData)`
  - `deleteUser(id)`
  - `changeUserRole(id, newRole)`
  - `updateUserStatus(id, active)`

**Frontend - Contextos:**
- [contexts/admin-context.tsx](contexts/admin-context.tsx) - AdminContext con state de usuarios

**Frontend - Componentes:**
- [components/protected-component.tsx](components/protected-component.tsx) - HOC para verificar permisos
- [components/csv-user-importer.tsx](components/csv-user-importer.tsx) - Importador CSV

---

### Módulo 2: Importación de Usuarios

**Descripción:** Importación masiva de usuarios desde archivos CSV o XLSX

**Endpoints:**
- `POST /api/admin/users/import` - Importar usuarios desde JSON
- `POST /api/admin/users/import-csv` - Importar usuarios desde CSV

**Backend - Controllers:**
- [AdminController.java](backend/src/main/java/com/uci/competencia/controller/api/AdminController.java) - Líneas 215-341

**Backend - Services:**
- [AdminServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/AdminServiceImpl.java)
  - `importUsers(UserBatchImportDTO)`
  - `importUsersFromCsv(MultipartFile)`

**Backend - Parsers:**
- [UserFileParser.java](backend/src/main/java/com/uci/competencia/service/parser/UserFileParser.java) - Interface base
- [CsvUserParser.java](backend/src/main/java/com/uci/competencia/service/parser/CsvUserParser.java) - Implementación CSV

**Frontend - Componentes:**
- [components/csv-user-importer.tsx](components/csv-user-importer.tsx) - UI para carga

**Frontend - Librerías:**
- [lib/admin-import.ts](lib/admin-import.ts) - Funciones:
  - `importUsersFromCsv(file)`
  - `importUsersBatch(data)`
  - `validateImportData(data)`

---

### Módulo 3: Auditoría y Logging

**Descripción:** Registro y seguimiento de todas las acciones del sistema

**Endpoints:**
- `GET /api/admin/audit/logs` - Obtener logs de auditoría con filtros
- `GET /api/admin/audit/export` - Obtener endpoint para exportar logs

**Backend - Controllers:**
- [AdminController.java](backend/src/main/java/com/uci/competencia/controller/api/AdminController.java) - Líneas 341-427

**Backend - Services:**
- [AdminServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/AdminServiceImpl.java)
  - `getAuditLogs(Pageable, filters)`
  - `logSystemAction(ActionType, details)`

**Backend - Repositories:**
- [SystemLogRepository.java](backend/src/main/java/com/uci/competencia/repository/SystemLogRepository.java)
- [SystemLogSpecifications.java](backend/src/main/java/com/uci/competencia/service/specification/SystemLogSpecifications.java)

**Backend - Entities:**
- [SystemLog.java](backend/src/main/java/com/uci/competencia/model/entity/SystemLog.java)

**Backend - Enums:**
- [ActionType.java](backend/src/main/java/com/uci/competencia/model/enums/ActionType.java)
- [LogLevel.java](backend/src/main/java/com/uci/competencia/model/enums/LogLevel.java)

**Frontend - Librerías:**
- [lib/admin-audit.ts](lib/admin-audit.ts) - Funciones:
  - `fetchAuditLogs(filters, pagination)`
  - `getAuditLogDetails(logId)`
  - `filterAuditLogs(criteria)`

- [lib/admin-audit-export.ts](lib/admin-audit-export.ts) - Funciones:
  - `exportAuditLogs(format, dateRange)`
  - `downloadAuditReport()`

---

### Módulo 4: Monitoreo de Errores

**Descripción:** Captura, análisis y resolución de errores del sistema

**Endpoints:**
- `GET /api/admin/monitoring/errors` - Obtener lista de errores
- `POST /api/admin/monitoring/errors/analyze` - Analizar errores con IA

**Backend - Controllers:**
- [AdminController.java](backend/src/main/java/com/uci/competencia/controller/api/AdminController.java) - Líneas 486-533

**Backend - Services:**
- [AdminServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/AdminServiceImpl.java)
  - `getSystemErrors(filters, pagination)`
  - `analyzeErrorPatterns(errorList)`

- [SystemErrorInsightService.java](backend/src/main/java/com/uci/competencia/service/SystemErrorInsightService.java)
- [SystemErrorInsightServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/SystemErrorInsightServiceImpl.java)
  - Integración con OpenAI para análisis

**Backend - Repositories:**
- [SystemErrorInsightRepository.java](backend/src/main/java/com/uci/competencia/repository/SystemErrorInsightRepository.java)

**Frontend - Componentes:**
- [components/admin-error-monitor.tsx](components/admin-error-monitor.tsx) - Vista de errores en tiempo real

**Frontend - Librerías:**
- [lib/admin-audit.ts](lib/admin-audit.ts) - Funciones de consulta

---

### Módulo 5: Gestión de Salud del Sistema

**Descripción:** Monitoreo de recursos, servicios y su disponibilidad

**Endpoints:**
- `GET /api/admin/health` - Estado general del sistema
- `GET /api/admin/dashboard` - Dashboard con métricas
- `GET /api/admin/system/overview` - Visión general del sistema

**Backend - Controllers:**
- [AdminController.java](backend/src/main/java/com/uci/competencia/controller/api/AdminController.java) - Líneas 533-565
- [SystemController.java](backend/src/main/java/com/uci/competencia/controller/api/SystemController.java)

**Backend - Services:**
- [SystemHealthService.java](backend/src/main/java/com/uci/competencia/service/SystemHealthService.java)
- [SystemHealthServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/SystemHealthServiceImpl.java)
  - Métodos para obtener:
    - CPU Usage
    - Memory Usage
    - Disk Usage
    - Database Connections
    - Redis Status
    - External APIs Status

**Frontend - Componentes:**
- [components/system-health-metrics.tsx](components/system-health-metrics.tsx) - Métricas en tiempo real
- [components/system-config.tsx](components/system-config.tsx) - Configuración del sistema
- [components/system-config-advanced.tsx](components/system-config-advanced.tsx) - Configuración avanzada
- [components/traffic-light-semaphore.tsx](components/traffic-light-semaphore.tsx) - Indicador visual

**Frontend - Hooks:**
- [hooks/use-system-monitor.ts](hooks/use-system-monitor.ts) - Hook para monitoreo

**Frontend - Librerías:**
- [lib/admin-system.ts](lib/admin-system.ts) - Funciones:
  - `getSystemHealth()`
  - `getSystemMetrics()`
  - `getServiceStatus()`

---

### Módulo 6: Gestión de Backups

**Descripción:** Creación, restauración y eliminación de backups del sistema

**Endpoints:**
- `POST /api/admin/backup` - Crear backup
- `GET /api/admin/backups` - Listar backups
- `POST /api/admin/backups/{backupId}/restore` - Restaurar backup
- `DELETE /api/admin/backups/{backupId}` - Eliminar backup

**Backend - Controllers:**
- [AdminController.java](backend/src/main/java/com/uci/competencia/controller/api/AdminController.java) - Líneas 575-689

**Backend - Services:**
- [AdminServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/AdminServiceImpl.java)
  - `initiateBackup(String, boolean)`
  - `getBackups()`
  - `restoreBackup(String)`
  - `deleteBackup(String)`

---

### Módulo 7: Configuración de Alertas

**Descripción:** Creación y gestión de alertas del sistema

**Endpoints:**
- `GET /api/admin/alerts` - Listar alertas
- `POST /api/admin/alerts` - Crear alerta
- `PUT /api/admin/alerts/{alertId}` - Editar alerta
- `DELETE /api/admin/alerts/{alertId}` - Eliminar alerta

**Backend - Controllers:**
- [AdminController.java](backend/src/main/java/com/uci/competencia/controller/api/AdminController.java) - Líneas 657-727

---

### Módulo 8: Monitoreo de APIs Externas

**Descripción:** Verificación del estado de servicios externos (PubMed, Health APIs, etc.)

**Endpoints:**
- `POST /api/admin/external-apis/check` - Verificar ABIs externas
- `POST /api/admin/test-pubmed` - Test especial para PubMed

**Backend - Controllers:**
- [AdminController.java](backend/src/main/java/com/uci/competencia/controller/api/AdminController.java) - Líneas 727-780

**Frontend - Componentes:**
- [components/admin-external-apis-monitor.tsx](components/admin-external-apis-monitor.tsx) - Monitor de APIs

**Frontend - Librerías:**
- [lib/external-api-activity.ts](lib/external-api-activity.ts) - Seguimiento de actividad

---

### Módulo 9: Utilidades de Mantenimiento

**Descripción:** Limpieza de caché, optimización de BD y limpieza de logs

**Endpoints:**
- `POST /api/admin/cache/clear` - Limpiar caché
- `POST /api/admin/db/optimize` - Optimizar base de datos
- `POST /api/admin/logs/cleanup` - Limpiar logs antiguos

**Backend - Controllers:**
- [AdminController.java](backend/src/main/java/com/uci/competencia/controller/api/AdminController.java) - Líneas 869-930

---

### Módulo 10: Testing XP (Experimental)

**Descripción:** Utilidades para pruebas experimentales del sistema

**Endpoints:**
- `POST /api/admin/testing/analyze` - Análisis experimental

**Backend - Controllers:**
- [AdminController.java](backend/src/main/java/com/uci/competencia/controller/api/AdminController.java) - Líneas 516-532

**Frontend - Librerías:**
- [lib/admin-testing.ts](lib/admin-testing.ts) - Funciones de testing

---

### Módulo 11: Exportación de Reportes de Auditoría

**Descripción:** Generación de reportes agregados de auditoría

**Endpoints:**
- `GET /api/admin/audit/export` - Descargar reporte de auditoría
- `POST /api/admin/audit/export` - Generar reporte customizado

**Backend - Controllers:**
- [AdminController.java](backend/src/main/java/com/uci/competencia/controller/api/AdminController.java) - Líneas 773-869

**Frontend - Librerías:**
- [lib/admin-report.ts](lib/admin-report.ts) - Funciones para generar reportes

---

---

## 👨‍🏫 ROL PROFESOR (PROFESSOR)

### Módulo 1: Dashboard Analytics

**Descripción:** Visión general del progreso de la clase, estudiantes y búsquedas

**Endpoints:**
- `GET /api/professor/analytics/overview` - Resumen general de analíticas
- `GET /api/professor/dashboard/overview` - Dashboard del profesor
- `GET /api/professor/analytics/student/{studentId}` - Analíticas de estudiante específico
- `GET /api/professor/analytics/class-performance` - Rendimiento de la clase

**Backend - Controllers:**
- [ProfessorController.java](backend/src/main/java/com/uci/competencia/controller/api/ProfessorController.java) - Líneas 27-75

**Backend - Services:**
- [ProfessorAnalyticsService.java](backend/src/main/java/com/uci/competencia/service/ProfessorAnalyticsService.java)
- [ProfessorAnalyticsServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/ProfessorAnalyticsServiceImpl.java) - Métodos:
  - `getAnalyticsOverview(String professorId)`
  - `getStudentAnalytics(String professorId, String studentId)`
  - `getProfessorStudents(String professorId)`
  - `getProfessorCases(String professorId)`
  - `getClassPerformanceMetrics(String professorId)`
  - `getTopSearchTerms(Set<String> studentIds)`
  - `getProblematicTerms(Set<String> studentIds)`
  - `analyzeStudentProgressTrends()`

**Backend - Repositories:**
- [SearchSessionRepository.java](backend/src/main/java/com/uci/competencia/repository/SearchSessionRepository.java)
- [CaseStudyRepository.java](backend/src/main/java/com/uci/competencia/repository/CaseStudyRepository.java)
- [EvaluationRepository.java](backend/src/main/java/com/uci/competencia/repository/EvaluationRepository.java)

**Frontend - Componentes:**
- [components/students-competency-heatmap.tsx](components/students-competency-heatmap.tsx) - Mapa de calor de competencias
- [components/students-competency-heatmap-enhanced.tsx](components/students-competency-heatmap-enhanced.tsx) - Versión mejorada
- [components/competency-progress-chart.tsx](components/competency-progress-chart.tsx) - Gráfico de progreso
- [components/competency-progress-chart-enhanced.tsx](components/competency-progress-chart-enhanced.tsx) - Versión mejorada

**Frontend - Contextos:**
- [contexts/professor-context.tsx](contexts/professor-context.tsx) - ProfessorContext

**Frontend - Librerías:**
- [lib/professor-analytics.ts](lib/professor-analytics.ts) - Funciones:
  - `fetchAnalyticsOverview()`
  - `fetchStudentAnalytics(studentId)`
  - `fetchClassPerformance()`
  - `fetchStudentsList()`
  - `fetchCasesList()`

**Frontend - Páginas:**
- [app/professor/page.tsx](app/professor/page.tsx) - Dashboard principal
- [app/professor/layout.tsx](app/professor/layout.tsx) - Layout

---

### Módulo 2: Búsqueda Académica

**Descripción:** Ejecución de búsquedas estructuradas para crear casos de estudio

**Endpoints:**
- `POST /api/search/execute` - Ejecutar búsqueda
- `GET /api/search/mesh/suggestions` - Autocompletado MeSH
- `GET /api/search/history` - Historial de búsquedas
- `GET /api/search/sessions/{sessionId}` - Obtener sesión específica
- `PUT /api/search/{searchId}` - Guardar búsqueda como favorita
- `DELETE /api/search/{searchId}` - Eliminar búsqueda
- `POST /api/search/assistant` - Asistente IA de búsqueda

**Backend - Controllers:**
- [SearchController.java](backend/src/main/java/com/uci/competencia/controller/api/SearchController.java) - Líneas 69-241

**Backend - Services:**
- [SearchService.java](backend/src/main/java/com/uci/competencia/service/SearchService.java)
- [SearchServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/SearchServiceImpl.java)
  - `executeSearch(SearchRequestDTO)`
  - `getSearchHistory(String userId)`
  - `saveSearch(String searchId)`
  - `deleteSearch(String searchId)`

- [SearchAssistantService.java](backend/src/main/java/com/uci/competencia/service/SearchAssistantService.java)
- [SearchAssistantServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/SearchAssistantServiceImpl.java)
  - Integración con Gemini/OpenAI

- [PubMedApiService.java](backend/src/main/java/com/uci/competencia/service/external/PubMedApiService.java)
- [PubMedApiServiceImpl.java](backend/src/main/java/com/uci/competencia/service/external/PubMedApiServiceImpl.java)

**Backend - Repositories:**
- [SearchSessionRepository.java](backend/src/main/java/com/uci/competencia/repository/SearchSessionRepository.java)
- [SearchResultRepository.java](backend/src/main/java/com/uci/competencia/repository/SearchResultRepository.java)

**Backend - Entities:**
- [SearchSession.java](backend/src/main/java/com/uci/competencia/model/entity/SearchSession.java)
- [SearchResult.java](backend/src/main/java/com/uci/competencia/model/entity/SearchResult.java)

**Frontend - Librerías:**
- [lib/search.ts](lib/search.ts) - Funciones:
  - `executeSearch(query, filters, context)`
  - `fetchSearchHistory(page, limit)`
  - `saveSearch(searchId, favorite)`
  - `deleteSearch(searchId)`
  - `getMeshSuggestions(term)`
  - `getSearchSession(sessionId)`

- [lib/search-assistant.ts](lib/search-assistant.ts) - Funciones:
  - `askAssistant(message, context)`
  - `generateSearchTermSuggestions()`
  - `refineQuery(originalQuery)`

**Frontend - Componentes:**
- [components/search-assistant.tsx](components/search-assistant.tsx) - UI del asistente
- [components/query-builder.tsx](components/query-builder.tsx) - Constructor de queries
- [components/query-provider.tsx](components/query-provider.tsx) - Provider para queries

---

### Módulo 3: Search Hedges

**Descripción:** Creación y almacenamiento de estrategias de búsqueda reutilizables

**Endpoints:**
- `GET /api/hedges` - Listar hedges
- `GET /api/hedges/categories` - Listar categorías disponibles
- `GET /api/hedges/{id}` - Obtener hedge específico
- `POST /api/hedges` - Crear nuevo hedge
- `PUT /api/hedges/{id}` - Editar hedge
- `DELETE /api/hedges/{id}` - Eliminar hedge
- `POST /api/hedges/test` - Probar hedge

**Backend - Controllers:**
- [SearchHedgesController.java](backend/src/main/java/com/uci/competencia/controller/api/SearchHedgesController.java)

**Backend - Services:**
- [SearchHedgeService.java](backend/src/main/java/com/uci/competencia/service/SearchHedgeService.java)
- [SearchHedgeServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/SearchHedgeServiceImpl.java)

**Backend - Repositories:**
- [SearchHedgeRepository.java](backend/src/main/java/com/uci/competencia/repository/SearchHedgeRepository.java)

**Backend - Entities:**
- [SearchHedge.java](backend/src/main/java/com/uci/competencia/model/entity/SearchHedge.java)

**Frontend - Librerías:**
- [lib/hedges.ts](lib/hedges.ts) - Funciones:
  - `fetchHedges()`
  - `createHedge(hedgeData)`
  - `updateHedge(id, hedgeData)`
  - `deleteHedge(id)`
  - `testHedge(hedgeQuery)`
  - `getHedgeCategories()`

**Frontend - Componentes:**
- [components/hedge-editor-advanced.tsx](components/hedge-editor-advanced.tsx) - Editor de hedges

---

### Módulo 4: Casos de Estudio

**Descripción:** Creación y asignación de casos para que los estudiantes trabajen

**Endpoints:**
- `GET /api/cases` - Listar casos
- `GET /api/cases/{id}` - Obtener caso específico
- `POST /api/cases` - Crear caso
- `PUT /api/cases/{id}` - Editar caso
- `DELETE /api/cases/{id}` - Eliminar caso
- `POST /api/cases/{id}/assign` - Asignar caso a estudiantes
- `GET /api/cases/{caseId}/submissions` - Obtener entregas del caso
- `GET /api/cases/assigned` - Listar casos asignados

**Backend - Controllers:**
- [CaseController.java](backend/src/main/java/com/uci/competencia/controller/api/CaseController.java)

**Backend - Services:**
- [CaseService.java](backend/src/main/java/com/uci/competencia/service/CaseService.java)
- [CaseServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/CaseServiceImpl.java)
- [CaseStudyService.java](backend/src/main/java/com/uci/competencia/service/CaseStudyService.java)

**Backend - Repositories:**
- [CaseStudyRepository.java](backend/src/main/java/com/uci/competencia/repository/CaseStudyRepository.java)
- [CaseSubmissionRepository.java](backend/src/main/java/com/uci/competencia/repository/CaseSubmissionRepository.java)

**Backend - Entities:**
- [CaseStudy.java](backend/src/main/java/com/uci/competencia/model/entity/CaseStudy.java)
- [CaseSubmission.java](backend/src/main/java/com/uci/competencia/model/entity/CaseSubmission.java)

**Frontend - Librerías:**
- [lib/cases.ts](lib/cases.ts) - Funciones:
  - `fetchCases(filters)`
  - `getCaseById(id)`
  - `createCase(caseData)`
  - `updateCase(id, caseData)`
  - `deleteCase(id)`
  - `assignCase(caseId, studentIds)`
  - `getSubmissions(caseId)`

**Frontend - Componentes:**
- [components/case-wizard.tsx](components/case-wizard.tsx) - Asistente para crear casos

**Frontend - Hooks:**
- [hooks/use-professor-cases.ts](hooks/use-professor-cases.ts) - Hook para gestión de casos

---

### Módulo 5: Evaluación de Entregas

**Descripción:** Revisión y evaluación de entregas de estudiantes

**Endpoints:**
- `GET /api/evaluations/pending` - Obtener entregas pendientes
- `GET /api/evaluations/reviewed` - Obtener entregas revisadas
- `GET /api/evaluations` - Listar evaluaciones
- `POST /api/evaluations/{submissionId}` - Crear evaluación
- `GET /api/evaluations/submission/{submissionId}` - Obtener evaluación de entrega
- `PUT /api/evaluations/{evaluationId}` - Editar evaluación
- `DELETE /api/evaluations/{evaluationId}` - Eliminar evaluación
- `GET /api/submissions/{submissionId}` - Obtener detalles de entrega

**Backend - Controllers:**
- [EvaluationController.java](backend/src/main/java/com/uci/competencia/controller/api/EvaluationController.java)
- [SubmissionController.java](backend/src/main/java/com/uci/competencia/controller/api/SubmissionController.java)

**Backend - Services:**
- [EvaluationService.java](backend/src/main/java/com/uci/competencia/service/EvaluationService.java)
- [EvaluationServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/EvaluationServiceImpl.java)

**Backend - Repositories:**
- [EvaluationRepository.java](backend/src/main/java/com/uci/competencia/repository/EvaluationRepository.java)
- [CaseSubmissionRepository.java](backend/src/main/java/com/uci/competencia/repository/CaseSubmissionRepository.java)

**Backend - Entities:**
- [Evaluation.java](backend/src/main/java/com/uci/competencia/model/entity/Evaluation.java)
- [CaseSubmission.java](backend/src/main/java/com/uci/competencia/model/entity/CaseSubmission.java)

**Frontend - Librerías:**
- [lib/evaluations.ts](lib/evaluations.ts) - Funciones:
  - `fetchPendingEvaluations()`
  - `fetchReviewedEvaluations()`
  - `createEvaluation(submissionId, evaluationData)`
  - `updateEvaluation(evaluationId, data)`
  - `deleteEvaluation(evaluationId)`
  - `getSubmissionDetails(submissionId)`

---

### Módulo 6: Seguimiento de Estudiantes

**Descripción:** Vista del progreso individual de cada estudiante

**Endpoints:**
- `GET /api/professor/students` - Listar estudiantes del profesor
- `GET /api/progress/{studentId}` - Progreso de estudiante específico

**Backend - Services:**
- [ProfessorAnalyticsServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/ProfessorAnalyticsServiceImpl.java)
  - `getProfessorStudents(String professorId)`
  - `getStudentAnalytics(String professorId, String studentId)`

**Frontend - Librerías:**
- [lib/progress.ts](lib/progress.ts)
- [lib/professor-analytics.ts](lib/professor-analytics.ts)

---

### Módulo 7: Chat y Comunicación

**Descripción:** Sistema de mensajería entre profesor-estudiante

**Endpoints:**
- `GET /api/chat/contacts` - Listar contactos
- `GET /api/chat/messages` - Obtener mensajes
- `POST /api/chat/send` - Enviar mensaje
- `POST /api/chat/read` - Marcar como leído

**Backend - Controllers:**
- [ChatController.java](backend/src/main/java/com/uci/competencia/controller/api/ChatController.java)

**Backend - Services:**
- [ChatService.java](backend/src/main/java/com/uci/competencia/service/ChatService.java)
- [ChatServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/ChatServiceImpl.java)

**Backend - Repositories:**
- [ChatMessageRepository.java](backend/src/main/java/com/uci/competencia/repository/ChatMessageRepository.java)

**Backend - Entities:**
- [ChatMessage.java](backend/src/main/java/com/uci/competencia/model/entity/ChatMessage.java)

**Backend - WebSocket:**
- [ChatWebSocketController.java](backend/src/main/java/com/uci/competencia/controller/ws/ChatWebSocketController.java)

**Frontend - Librerías:**
- [lib/chat.ts](lib/chat.ts) - Funciones:
  - `fetchContacts()`
  - `fetchMessages(contactId)`
  - `sendMessage(contactId, message)`
  - `markAsRead(messageId)`

**Frontend - Hooks:**
- [hooks/use-chat-realtime.ts](hooks/use-chat-realtime.ts) - Hook para chat en tiempo real

**Frontend - Componentes:**
- [components/chat/](components/chat/) - Componentes de chat

---

---

## 👨‍🎓 ROL ESTUDIANTE (STUDENT)

### Módulo 1: Dashboard de Progreso

**Descripción:** Visualización del progreso académico y competencias del estudiante

**Endpoints:**
- `GET /api/student/dashboard/overview` - Resumen del dashboard
- `GET /api/student/progress/detailed` - Progreso detallado
- `GET /api/student/search/history` - Historial de búsquedas
- `GET /api/progress/me` - Progreso del usuario autenticado

**Backend - Controllers:**
- [StudentController.java](backend/src/main/java/com/uci/competencia/controller/api/StudentController.java)
- [ProgressController.java](backend/src/main/java/com/uci/competencia/controller/api/ProgressController.java)

**Backend - Services:**
- [StudentService.java](backend/src/main/java/com/uci/competencia/service/StudentService.java)
- [StudentServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/StudentServiceImpl.java)
  - `getStudentProgress(String studentId)`
  - `getSearchHistory(String studentId)`

- [ProgressTrackingService.java](backend/src/main/java/com/uci/competencia/service/ProgressTrackingService.java)
- [ProgressTrackingServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/ProgressTrackingServiceImpl.java)
- [ProgressService.java](backend/src/main/java/com/uci/competencia/service/ProgressService.java)

**Backend - Repositories:**
- [CompetencyProgressRepository.java](backend/src/main/java/com/uci/competencia/repository/CompetencyProgressRepository.java)
- [StudentRepository.java](backend/src/main/java/com/uci/competencia/repository/StudentRepository.java)

**Backend - Entities:**
- [CompetencyProgress.java](backend/src/main/java/com/uci/competencia/model/entity/CompetencyProgress.java)
- [Student.java](backend/src/main/java/com/uci/competencia/model/entity/Student.java)

**Frontend - Componentes:**
- [components/competency-progress-chart.tsx](components/competency-progress-chart.tsx) - Gráfico de competencias
- [components/competency-progress-chart-enhanced.tsx](components/competency-progress-chart-enhanced.tsx) - Versión mejorada
- [components/evidence-pyramid.tsx](components/evidence-pyramid.tsx) - Pirámide de evidencia

**Frontend - Contextos:**
- [contexts/student-context.tsx](contexts/student-context.tsx) - StudentContext

**Frontend - Librerías:**
- [lib/progress.ts](lib/progress.ts) - Funciones:
  - `fetchStudentProgress()`
  - `fetchDetailedProgress()`
  - `getCompetencyMetrics()`
  - `getProgressHistory()`

**Frontend - Páginas:**
- [app/student/page.tsx](app/student/page.tsx) - Dashboard principal
- [app/student/layout.tsx](app/student/layout.tsx) - Layout

---

### Módulo 2: Búsqueda Avanzada con Asistente IA

**Descripción:** Ejecución de búsquedas sobre fuentes académicas con ayuda de IA

**Endpoints:**
- `POST /api/search/execute` - Ejecutar búsqueda
- `GET /api/search/mesh/suggestions` - Autocompletado MeSH
- `GET /api/search/history` - Historial
- `POST /api/search/assistant` - Asistente IA
- `GET /api/search/results/{searchId}/evidence-pyramid` - Pirámide de evidencia
- `GET /api/search/sessions/{sessionId}` - Sesión de búsqueda
- `PUT /api/search/{searchId}` - Guardar como favorita
- `DELETE /api/search/{searchId}` - Eliminar búsqueda
- `POST /api/search/external-fallback` - Búsqueda de fallback

**Backend - Controllers:**
- [SearchController.java](backend/src/main/java/com/uci/competencia/controller/api/SearchController.java)

**Backend - Services:**
- [SearchService.java](backend/src/main/java/com/uci/competencia/service/SearchService.java)
- [SearchAssistantService.java](backend/src/main/java/com/uci/competencia/service/SearchAssistantService.java)
- [PubMedApiService.java](backend/src/main/java/com/uci/competencia/service/external/PubMedApiService.java)
- [HealthSearchProxyService.java](backend/src/main/java/com/uci/competencia/service/external/HealthSearchProxyService.java)

**Frontend - Librerías:**
- [lib/search.ts](lib/search.ts)
- [lib/search-assistant.ts](lib/search-assistant.ts)
- [lib/health-sources.ts](lib/health-sources.ts) - Funciones:
  - `getHealthSources(query)`
  - `parseHealthApi(response)`

**Frontend - Componentes:**
- [components/search-assistant.tsx](components/search-assistant.tsx)
- [components/query-builder.tsx](components/query-builder.tsx)
- [components/external-api-thinking-indicator.tsx](components/external-api-thinking-indicator.tsx)
- [components/evidence-pyramid.tsx](components/evidence-pyramid.tsx)

**Frontend - Hooks:**
- [hooks/use-student-search.ts](hooks/use-student-search.ts) - Hook para búsqueda

---

### Módulo 3: Verificación de Veracidad

**Descripción:** Verificación de claims/afirmaciones contra evidencia académica

**Endpoints:**
- `POST /api/verify/claim` - Verificar claim
- `GET /api/verify/result/{verificationId}` - Obtener resultado
- `GET /api/verify/history` - Historial de verificaciones

**Backend - Controllers:**
- [VerificationController.java](backend/src/main/java/com/uci/competencia/controller/api/VerificationController.java)

**Backend - Services:**
- [VerificationService.java](backend/src/main/java/com/uci/competencia/service/VerificationService.java)
- [VerificationServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/VerificationServiceImpl.java)
- [RAGService.java](backend/src/main/java/com/uci/competencia/service/RAGService.java)
- [RAGServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/RAGServiceImpl.java) - Retrieval-Augmented Generation

**Backend - Repositories:**
- [VerificationResultRepository.java](backend/src/main/java/com/uci/competencia/repository/VerificationResultRepository.java)

**Backend - Entities:**
- [VerificationResult.java](backend/src/main/java/com/uci/competencia/model/entity/VerificationResult.java)

**Frontend - Librerías:**
- [lib/verification.ts](lib/verification.ts) - Funciones:
  - `verifyClaim(claimText, sourceUrl)`
  - `getVerificationResult(verificationId)`
  - `getVerificationHistory()`

**Frontend - Componentes:**
- [components/verification-semaphore.tsx](components/verification-semaphore.tsx) - Indicador visual
- [components/verification-recommendations.tsx](components/verification-recommendations.tsx) - Recomendaciones

**Frontend - Hooks:**
- [hooks/use-student-verify.ts](hooks/use-student-verify.ts) - Hook para verificación

---

### Módulo 4: Gestión de Bibliografías

**Descripción:** Generación y descarga de bibliografías basadas en búsquedas

**Endpoints:**
- `POST /api/export/bibliography` - Generar bibliografía
- `GET /api/bibliography/history` - Historial de bibliografías
- `GET /api/bibliography/{id}/download` - Descargar bibliografía
- `GET /api/export/download/{id}` - Descargar export

**Backend - Controllers:**
- [BibliographyController.java](backend/src/main/java/com/uci/competencia/controller/api/BibliographyController.java)
- [ExportController.java](backend/src/main/java/com/uci/competencia/controller/api/ExportController.java)

**Backend - Services:**
- [ExportService.java](backend/src/main/java/com/uci/competencia/service/ExportService.java)
- [ExportServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/ExportServiceImpl.java)

**Backend - Repositories:**
- [BibliographyRepository.java](backend/src/main/java/com/uci/competencia/repository/BibliographyRepository.java)

**Backend - Entities:**
- [Bibliography.java](backend/src/main/java/com/uci/competencia/model/entity/Bibliography.java)

**Frontend - Componentes:**
- [components/bibliography-generator.tsx](components/bibliography-generator.tsx) - Generador

**Frontend - Librerías:**
- [lib/bibliography.ts](lib/bibliography.ts) - Funciones:
  - `generateBibliography(articles, format)`
  - `fetchBibliographyHistory()`
  - `downloadBibliography(id)`

---

### Módulo 5: Entregas y Evaluación

**Descripción:** Envío de entregas y recepción de feedback de evaluaciones

**Endpoints:**
- `POST /api/cases/{caseId}/submit` - Enviar entrega
- `GET /api/cases/{caseId}/submission` - Obtener entrega del caso
- `GET /api/submissions/{submissionId}` - Detalles de entrega
- `POST /api/cases/submissions/{submissionId}/evaluate` - Solicitar evaluación

**Backend - Controllers:**
- [CaseController.java](backend/src/main/java/com/uci/competencia/controller/api/CaseController.java)

**Backend - Services:**
- [CaseService.java](backend/src/main/java/com/uci/competencia/service/CaseService.java)

**Frontend - Librerías:**
- [lib/cases.ts](lib/cases.ts)
- [lib/evaluations.ts](lib/evaluations.ts)

---

### Módulo 6: Chat y Comunicación

**Descripción:** Chat con profesor para dudas y consultas

**Endpoints:** 
(Mismos que Profesor)
- `GET /api/chat/contacts`
- `GET /api/chat/messages`
- `POST /api/chat/send`
- `POST /api/chat/read`

**Frontend:**
- [lib/chat.ts](lib/chat.ts)
- [hooks/use-chat-realtime.ts](hooks/use-chat-realtime.ts)
- [components/chat/](components/chat/)

---

### Módulo 7: Formato de Exportación

**Descripción:** Selección de formatos para exportar contenido

**Endpoints:**
- `GET /api/formats/available` - Formatos disponibles

**Backend - Controllers:**
- [FormatsController.java](backend/src/main/java/com/uci/competencia/controller/api/FormatsController.java)

---

---

## 🔄 MÓDULOS COMPARTIDOS

### Módulo 1: Autenticación y Autorización

**Descripción:** Gestión de sesiones y control de acceso basado en roles

**Endpoints:**
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `POST /api/auth/refresh` - Refrescar token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Datos del usuario autenticado

**Backend - Controllers:**
- [AuthController.java](backend/src/main/java/com/uci/competencia/auth/AuthController.java)

**Backend - Services:**
- [AuthService.java](backend/src/main/java/com/uci/competencia/service/AuthService.java)
- [AuthServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/AuthServiceImpl.java)

**Backend - Security:**
- [JwtTokenProvider.java](backend/src/main/java/com/uci/competencia/security/JwtTokenProvider.java)
- [UserIdentityResolver.java](backend/src/main/java/com/uci/competencia/security/UserIdentityResolver.java)
- [SecurityUtils.java](backend/src/main/java/com/uci/competencia/util/SecurityUtils.java)

**Frontend - Contextos:**
- [contexts/auth-context.tsx](contexts/auth-context.tsx) - AuthContext

**Frontend - Librerías:**
- [lib/auth.ts](lib/auth.ts) - Funciones:
  - `login(email, password)`
  - `register(userData)`
  - `logout()`
  - `refreshToken()`
  - `getCurrentUser()`

- [lib/auth-register.ts](lib/auth-register.ts) - Registro específico

**Frontend - Páginas:**
- [app/login/page.tsx](app/login/page.tsx)
- [app/register/page.tsx](app/register/page.tsx)
- [app/forgot-password/page.tsx](app/forgot-password/page.tsx)
- [app/reset-password/page.tsx](app/reset-password/page.tsx)

**Frontend - Componentes:**
- [components/protected-component.tsx](components/protected-component.tsx)

**Frontend - Hooks:**
- [hooks/use-permissions.ts](hooks/use-permissions.ts) - Hook para permisos

---

### Módulo 2: Gestión de Usuarios (Perfil)

**Descripción:** Datos y configuración del perfil de usuario

**Backend - Services:**
- [UserService.java](backend/src/main/java/com/uci/competencia/service/UserService.java)
- [UserServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/UserServiceImpl.java)

**Backend - Repositories:**
- [UserRepository.java](backend/src/main/java/com/uci/competencia/repository/UserRepository.java)

---

### Módulo 3: API Client Central

**Descripción:** Cliente HTTP centralizado para todas las llamadas API

**Frontend - Librerías:**
- [lib/api.ts](lib/api.ts) - Funciones base:
  - `apiCall(method, endpoint, data)`
  - `handleApiError(error)`
  - `createAuthHeader()`

---

### Módulo 4: Sistema de Notificaciones Toast

**Descripción:** Mensajes de usuario en tiempo real

**Frontend - Hooks:**
- [hooks/use-toast.ts](hooks/use-toast.ts) - Hook para toast

---

### Módulo 5: Utilidades y Helpers

**Frontend - Librerías:**
- [lib/utils.ts](lib/utils.ts) - Funciones generales
- [lib/url-validation.ts](lib/url-validation.ts) - Validación de URLs
- [lib/password-policy.ts](lib/password-policy.ts) - Políticas de contraseña
- [lib/student-resilience.ts](lib/student-resilience.ts) - Lógica de resiliencia
- [lib/request-load-profile.ts](lib/request-load-profile.ts) - Perfiles de carga

**Frontend - Componentes:**
- [components/theme-provider.tsx](components/theme-provider.tsx)
- [components/role-help-panel.tsx](components/role-help-panel.tsx)
- [components/rich-text-editor.tsx](components/rich-text-editor.tsx)

**Frontend - Componentes UI:**
- [components/ui/](components/ui/) - Componentes shadcn/ui reutilizables

---

### Módulo 6: Sistema de Salud

**Descripción:** Health checks y métricas del sistema

**Backend - Controllers:**
- [SystemController.java](backend/src/main/java/com/uci/competencia/controller/api/SystemController.java)

**Backend - Services:**
- [SystemHealthService.java](backend/src/main/java/com/uci/competencia/service/SystemHealthService.java)
- [SystemHealthServiceImpl.java](backend/src/main/java/com/uci/competencia/service/impl/SystemHealthServiceImpl.java)

---

---

## 📊 MATRIZ DE DEPENDENCIAS

### Flujo de Datos: Estudiante Busca

```
StudentController (GET /api/student/dashboard/overview)
  ↓
StudentService → ProgressTrackingService
  ↓
CompetencyProgressRepository + SearchSessionRepository
  ↓
CompetencyProgress + SearchSession (Entities)

SearchController (POST /api/search/execute)
  ↓
SearchService → [PubMedApiService | HealthSearchProxyService]
  ↓
SearchSessionRepository + SearchResultRepository
  ↓
SearchSession + SearchResult (Entities)
```

### Flujo de Datos: Profesor Evalúa

```
EvaluationController (POST /api/evaluations/{submissionId})
  ↓
EvaluationService
  ↓
EvaluationRepository + CaseSubmissionRepository
  ↓
Evaluation + CaseSubmission (Entities)
```

### Flujo de Datos: Admin Gestiona

```
AdminController (GET /api/admin/users)
  ↓
AdminService
  ↓
UserRepository + SystemLogRepository
  ↓
User + SystemLog (Entities)
```

---

## 🔗 COMPONENTES TRANSVERSALES

### Autenticación y Autorización
- **Implementación:** Spring Security + JWT
- **Anotación:** `@PreAuthorize("hasRole('ROLE_X')")`
- **Archivos clave:**
  - `JwtTokenProvider.java`
  - `UserIdentityResolver.java`
  - `SecurityUtils.java`

### Persistencia
- **ORM:** JPA/Hibernate
- **Base de datos:** PostgreSQL
- **Cache:** Redis
- **BD en memoria:** H2 (testing)

### Servicios Externos
- **PubMed:** API REST para búsquedas académicas
- **Health Search APIs:** Múltiples fuentes de salud
- **Gemini/OpenAI:** IA para asistente y verificación
- **Monitoreo:** Prometheus + Grafana (prometheus registry)

### Logging y Auditoría
- **Framework:** SLF4J + Logback
- **Auditoría:** `@Audited` annotations + tabla `SystemLog`
- **Niveles:** DEBUG, INFO, WARN, ERROR

### Testing
- **Unit:** JUnit 5 + Mockito
- **Integration:** TestContainers
- **E2E:** Playwright
- **Archivos:** `*Test.java` en `backend/src/test`

### CI/CD
- **Build:** Maven
- **Automatización:** GitHub Actions / Jenkins
- **Validación:** PMD, FindBugs, SonarQube (si aplica)

---

## 📱 ESTRUCTURA FRONTEND - APARTADO POR ROL

### Rutas Admin
```
/admin
  ├── Dashboard principal
  ├── /users - Gestión de usuarios
  ├── /audit - Auditoría
  ├── /health - Salud del sistema
  ├── /alerts - Configuración de alertas
  ├── /backups - Gestión de backups
  └── /external-apis - Monitor de APIs
```

### Rutas Profesor
```
/professor
  ├── Dashboard (Analytics overview)
  ├── /cases - Gestión de casos
  ├── /search - Búsqueda académica
  ├── /hedges - Search hedges
  ├── /evaluations - Evaluación de entregas
  ├── /students - Seguimiento
  └── /analytics - Analíticas detalladas
```

### Rutas Estudiante
```
/student
  ├── Dashboard (Progreso de competencias)
  ├── /search - Búsqueda académica
  ├── /verify - Verificación de claims
  ├── /cases - Casos asignados
  ├── /bibliography - Gestión de bibliografías
  └── /submissions - Entregas
```

---

## 🔐 CONFIGURACIÓN DE ACCESO POR ENDPOINT

| Endpoint | Admin | Profesor | Estudiante | Público |
|----------|-------|----------|-----------|---------|
| `/api/admin/*` | ✅ | ❌ | ❌ | ❌ |
| `/api/professor/*` | ❌ | ✅ | ❌ | ❌ |
| `/api/student/*` | ❌ | ❌ | ✅ | ❌ |
| `/api/search/*` | ❌ | ✅ | ✅ | ❌ |
| `/api/verify/*` | ❌ | ✅ | ✅ | ❌ |
| `/api/audit/*` | ✅ | ❌ | ❌ | ❌ |
| `/api/health` | ✅ | ⚠️ | ⚠️ | ⚠️ |
| `/api/auth/*` | ✅ | ✅ | ✅ | ✅ |

⚠️ = Acceso limitado

---

## 📝 NOTAS DE ARQUITECTURA

1. **Separación por Roles:** Cada rol tiene su propio controlador + contexto + librerías
2. **Servicios Compartidos:** Search, Chat, Progress, Auth reutilizados entre roles
3. **DTOs:** Todas las capas HTTP usan DTOs para abstracción
4. **Transacciones:** `@Transactional` en servicios para ACID
5. **AOP:** Puede hay aspectos para auditoría y logging
6. **Caché:** Redis para sesiones y resultados de búsqueda
7. **WebSocket:** Para chat en tiempo real
8. **File Upload:** Multipart para importación de usuarios

---

**Documento generado:** 2026-05-05  
**Estado:** ✅ Investigación completa
