# Mapa de Endpoints del Rol Administrador

## Alcance

Este documento resume los endpoints que sostienen el flujo del rol administrador en EDUCEARCH, con foco en:

- dashboard administrativo,
- gestión de usuarios,
- auditoría y exportación,
- salud y monitoreo del sistema,
- backups y mantenimiento,
- configuración global,
- testing XP,
- componentes compartidos usados por `/admin`.

Base de backend: `/api`

## Dashboard

### `GET /api/admin/dashboard`

- Método: `GET`
- Propósito funcional: cargar métricas generales del panel administrativo.
- Consumidores:
  - `/admin`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se mantuvo como fuente principal del dashboard,
  - se reforzó la normalización para números enviados como string y listas opcionales.

### `GET /api/admin/health`

- Método: `GET`
- Propósito funcional: banner de estado general, recursos y servicios resumidos.
- Consumidores:
  - `/admin`
  - `/admin/health`
  - `/admin/layout`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se reutilizó como fuente compartida entre dashboard, layout y vista de salud,
  - se saneó el parseo de porcentajes y latencias.

### `GET /api/admin/alerts`

- Método: `GET`
- Propósito funcional: contar alertas activas y poblar widgets administrativos.
- Consumidores:
  - `/admin`
  - `/admin/layout`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - el layout usa ya el conteo real para la campana,
  - se consolidó la respuesta en `{ alerts, count }`.

## Gestión de usuarios

### `GET /api/admin/users?page={page}&limit={limit}&role={role}&status={status}&search={search}`

- Método: `GET`
- Propósito funcional: listar usuarios con filtros, paginación y estadísticas agregadas.
- Consumidores:
  - `/admin/users`
  - `lib/admin-users.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la pantalla quedó conectada al endpoint real con persistencia local de filtros y página,
  - se reforzó la normalización de `stats`, `page`, `limit` y `totalPages`.

### `POST /api/admin/users`

- Método: `POST`
- Propósito funcional: crear un usuario.
- Consumidores:
  - `/admin/users`
  - `lib/admin-users.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se sanean nombre, correo, facultad y estado antes del envío,
  - se eliminó lógica provisional y se usa el payload real del backend.

### `PUT /api/admin/users/{id}`

- Método: `PUT`
- Propósito funcional: editar datos de un usuario.
- Consumidores:
  - `/admin/users`
  - `lib/admin-users.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la edición quedó alineada al DTO real del backend,
  - se conservó estado activo/inactivo en la actualización.

### `DELETE /api/admin/users/{id}`

- Método: `DELETE`
- Propósito funcional: eliminar usuario.
- Consumidores:
  - `/admin/users`
  - `lib/admin-users.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - eliminación simple y bulk conectadas al backend real.

### `PUT /api/admin/users/{id}/role`

- Método: `PUT`
- Propósito funcional: cambiar rol de usuario.
- Consumidores:
  - `lib/admin-users.ts`
- Estado actual: disponible.
- Corrección aplicada:
  - se mantuvo el cliente tipado y saneado, listo para uso desde UI futura.

### `PUT /api/admin/users/{id}/status`

- Método: `PUT`
- Propósito funcional: activar o desactivar cuenta.
- Consumidores:
  - `/admin/users`
  - `lib/admin-users.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - activación individual y masiva ya usan este endpoint real.

### `POST /api/admin/users/import`

- Método: `POST`
- Propósito funcional: importar usuarios desde archivo multipart.
- Consumidores:
  - `components/csv-user-importer.tsx`
  - `lib/admin-users.ts`
  - `lib/admin-import.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se corrigieron validaciones y mensajes visibles,
  - el importador ya usa backend real en vez de mock local.

### `POST /api/admin/users/import-csv`

- Método: `POST`
- Propósito funcional: importar usuarios a partir de filas parseadas por frontend.
- Consumidores:
  - `components/csv-user-importer.tsx`
  - `lib/admin-import.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - el flujo CSV quedó funcional de punta a punta,
  - se normalizan filas inválidas, warnings y errores de respuesta.

## Auditoría

### `GET /api/admin/audit/logs`

- Método: `GET`
- Propósito funcional: listar eventos de auditoría con filtros por nivel, búsqueda y rango de fechas.
- Consumidores:
  - `/admin/audit`
  - `lib/admin-audit.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la página quedó conectada al endpoint real con persistencia de filtro de texto y nivel,
  - se normalizó mejor la identidad del actor, detalles e IP.

### `GET /api/admin/audit/export`

- Método: `GET`
- Propósito funcional: exportar logs de auditoría.
- Consumidores:
  - `lib/admin-audit.ts`
  - `lib/admin-report.ts`
- Estado actual: disponible.
- Corrección aplicada:
  - se dejó documentado y soportado desde cliente compartido.

### `POST /api/admin/audit/export`

- Método: `POST`
- Propósito funcional: exportar logs con payload de filtros.
- Consumidores:
  - `components/audit-report-generator.tsx`
  - `/admin/audit`
  - `lib/admin-report.ts`
  - `lib/admin-audit-export.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - el exportador administrativo ahora intenta primero el export real del backend,
  - si el backend no devuelve descarga utilizable, aplica fallback local explícito para no cortar el flujo.

## Salud, monitoreo y mantenimiento

### `GET /api/admin/system/overview`

- Método: `GET`
- Propósito funcional: cargar información de servidor, base de datos, redis, almacenamiento y tareas programadas.
- Consumidores:
  - `/admin/system`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se reforzó la normalización de números y estructuras opcionales.

### `GET /api/admin/external-apis/check`

- Método: no usado directamente por frontend.
- Propósito funcional: no aplica.
- Estado actual: no consumido.
- Corrección aplicada:
  - no aplica.

### `POST /api/admin/external-apis/check`

- Método: `POST`
- Propósito funcional: diagnosticar APIs externas usadas por búsqueda.
- Consumidores:
  - `components/admin-external-apis-monitor.tsx`
  - `/admin/system`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se mantiene como diagnóstico real, con query saneada y normalización de proveedores.

### `GET /api/admin/monitoring/errors`

- Método: `GET`
- Propósito funcional: recuperar errores recientes e insights de análisis.
- Consumidores:
  - `components/admin-error-monitor.tsx`
  - `/admin/system`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se estabilizó el parseo de `summary`, `analysisStatus`, `insights` y `recentErrors`.

### `POST /api/admin/monitoring/errors/analyze`

- Método: `POST`
- Propósito funcional: disparar análisis inmediato de errores.
- Consumidores:
  - `components/admin-error-monitor.tsx`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - botón de análisis en UI ya conectado a backend real.

### `POST /api/admin/backup`

- Método: `POST`
- Propósito funcional: iniciar backup.
- Consumidores:
  - `/admin/system`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la vista de sistema ya ejecuta backup real con opciones coherentes.

### `GET /api/admin/backups`

- Método: `GET`
- Propósito funcional: listar backups existentes.
- Consumidores:
  - `/admin/system`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se normalizó `status`, `size`, `downloadUrl` y fechas.

### `POST /api/admin/backups/{backupId}/restore`

- Método: `POST`
- Propósito funcional: restaurar backup.
- Consumidores:
  - `/admin/system`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la restauración quedó enlazada desde la UI de backups.

### `DELETE /api/admin/backups/{backupId}`

- Método: `DELETE`
- Propósito funcional: eliminar backup.
- Consumidores:
  - `/admin/system`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - eliminación real desde tabla de backups.

### `POST /api/admin/cache/clear`

- Método: `POST`
- Propósito funcional: limpiar cachés del sistema.
- Consumidores:
  - `/admin/system`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se saneó el payload `cacheNames`.

### `POST /api/admin/db/optimize`

- Método: `POST`
- Propósito funcional: optimizar base de datos.
- Consumidores:
  - `/admin/system`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la acción de mantenimiento está conectada.

### `POST /api/admin/logs/cleanup`

- Método: `POST`
- Propósito funcional: limpiar logs antiguos.
- Consumidores:
  - `/admin/system`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se acotó el parámetro `olderThanDays`.

### `POST /api/admin/search/reindex`

- Método: `POST`
- Propósito funcional: regenerar índices de búsqueda.
- Consumidores:
  - `/admin/system`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - acción conectada desde mantenimiento.

### `POST /api/admin/test-pubmed`

- Método: `POST`
- Propósito funcional: validar conexión con PubMed.
- Consumidores:
  - `/admin/settings`
  - `components/system-config-advanced.tsx`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la prueba quedó integrada al formulario de configuración real.

## Configuración

### `GET /api/admin/settings`

- Método: `GET`
- Propósito funcional: leer configuración global del sistema.
- Consumidores:
  - `/admin/settings`
  - `components/system-config-advanced.tsx`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la pantalla de configuración quedó limpia y conectada al backend real.

### `PUT /api/admin/settings`

- Método: `PUT`
- Propósito funcional: guardar configuración global.
- Consumidores:
  - `/admin/settings`
  - `components/system-config-advanced.tsx`
  - `lib/admin-system.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se unificó el payload entre UI y estructura backend.

## Testing XP

### `GET /api/admin/testing/analyze`

- Método: no existe.
- Propósito funcional: no aplica.
- Estado actual: no aplica.
- Corrección aplicada:
  - no aplica.

### `POST /api/admin/testing/analyze`

- Método: `POST`
- Propósito funcional: enviar resumen de testing al backend para análisis IA.
- Consumidores:
  - `/admin/testing`
  - `lib/admin-testing.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - la IA del panel de testing ya consume backend real.

### `GET /api/admin/testing`

- Método: ruta interna Next.js `app/api/admin/testing/route.ts`
- Propósito funcional: consolidar artefactos locales de tests y plan XP.
- Consumidores:
  - `/admin/testing`
  - `lib/admin-testing.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se mantuvo como agregador local del frontend para artefactos de test.

### `POST /api/admin/testing/run`

- Método: ruta interna Next.js `app/api/admin/testing/run/route.ts`
- Propósito funcional: ejecutar suites locales desde el panel.
- Consumidores:
  - `/admin/testing`
  - `lib/admin-testing.ts`
- Estado actual: operativo con `ENABLE_ADMIN_TEST_RUNNER=true`.
- Corrección aplicada:
  - se conserva como flujo local controlado por flag.

### `POST /api/admin/testing/logs`

- Método: ruta interna Next.js `app/api/admin/testing/logs/route.ts`
- Propósito funcional: registrar evidencia manual.
- Consumidores:
  - `/admin/testing`
  - `lib/admin-testing.ts`
- Estado actual: operativo.
- Corrección aplicada:
  - se mantiene persistencia local de evidencias manuales.

## Estado funcional revisado

- `/admin`: operativo.
- `/admin/users`: operativo con CRUD, activación, borrado, correo y CSV.
- `/admin/audit`: operativo con filtros persistentes, export real y fallback local.
- `/admin/system`: operativo con overview, backups, monitoreo y mantenimiento.
- `/admin/health`: operativo.
- `/admin/settings`: operativo con PubMed y configuración global.
- `/admin/testing`: operativo.
- `/admin/chat`: operativo.

## Pendientes reales dependientes del backend

- el export de auditoría ya usa el endpoint real del backend, pero si el servidor no entrega un archivo descargable efectivo la UI cae a fallback local para preservar funcionalidad;
- la ejecución de suites desde `/admin/testing` depende del flag `ENABLE_ADMIN_TEST_RUNNER=true`, porque es una ruta interna de Next.js y no una capacidad expuesta por el backend Java.
