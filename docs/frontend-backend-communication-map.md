# Mapeo inicial de comunicacion frontend-backend

Base frontend: `lib/api-client.ts`
Base backend esperada: `NEXT_PUBLIC_API_URL` normalizada con sufijo `/api`.

## Autenticacion

| Frontend | Backend | Roles | Estado |
| --- | --- | --- | --- |
| `lib/auth.ts` `POST /auth/login` | `POST /api/auth/login` | publico | OK |
| `lib/auth-register.ts` `POST /auth/register` | `POST /api/auth/register` | publico | OK, backend fuerza registro como estudiante |
| `lib/auth.ts` `POST /auth/refresh` | `POST /api/auth/refresh` | publico con refresh token | OK, se bloquean tokens de reset |
| `lib/auth.ts` `POST /auth/logout` | `POST /api/auth/logout` | autenticado | OK |
| `lib/auth.ts` `GET /auth/me` | `GET /api/auth/me` | autenticado | OK, frontend normaliza `UserDTO` |
| `lib/auth.ts` `POST /auth/forgot-password` | `POST /api/auth/forgot-password` | publico | Corregido |
| `lib/auth.ts` `POST /auth/reset-password` | `POST /api/auth/reset-password` | publico con token de reset | Corregido |

## Estudiante y profesor

| Frontend | Backend | Roles | Estado |
| --- | --- | --- | --- |
| `lib/search.ts` `/search/**` | `/api/search/**` | estudiante, profesor | OK |
| `lib/search-assistant.ts` `/search/assistant` | `/api/search/assistant` | estudiante, profesor | OK |
| `lib/verification.ts` `/verify/**` | `/api/verify/**` | estudiante, profesor | OK |
| `lib/bibliography.ts` `/export/bibliography` | `/api/export/bibliography` | estudiante, profesor | OK |
| `lib/bibliography.ts` `/bibliography/history` | `/api/bibliography/history` | estudiante, profesor | OK |
| `lib/bibliography.ts` `/bibliography/{id}/download` | `/api/bibliography/{id}/download` | estudiante, profesor | OK |
| `lib/bibliography.ts` `/formats/available` | `/api/formats/available` | estudiante, profesor | OK |
| `lib/progress.ts` `/progress/me` | `/api/progress/me` | estudiante | OK |
| `lib/progress.ts` `/progress/{studentId}` | `/api/progress/{studentId}` | profesor, admin | OK |
| `lib/chat.ts` `/chat/**` | `/api/chat/**` | estudiante, profesor, admin | OK |
| `lib/cases.ts` `/cases/assigned`, `/cases/{id}/submission`, `/cases/{id}/submit` | `/api/cases/**` | estudiante | OK |
| `lib/cases.ts` `/cases/**`, `/cases/students`, `/cases/{id}/submissions` | `/api/cases/**` | profesor | OK |
| `lib/evaluations.ts` `/evaluations/**` | `/api/evaluations/**` | profesor | OK |
| `lib/evaluations.ts` `/submissions/{id}` | `/api/submissions/{id}` | estudiante, profesor | OK |
| `lib/hedges.ts` `/hedges/**` | `/api/hedges/**` | profesor | OK |
| `lib/professor-analytics.ts` `/professor/**` | `/api/professor/**` | profesor | OK |

## Administracion

| Frontend | Backend | Roles | Estado |
| --- | --- | --- | --- |
| `lib/admin-users.ts` `/admin/users/**` | `/api/admin/users/**` | admin | OK |
| `lib/admin-import.ts` `/admin/users/import*` | `/api/admin/users/import*` | admin | OK, limite de archivo alineado a 5 MB |
| `lib/admin-audit.ts` `/admin/audit/**` | `/api/admin/audit/**` | admin | OK |
| `lib/admin-report.ts` `/admin/audit/export` | `/api/admin/audit/export` | admin | OK |
| `lib/admin-system.ts` `/admin/**` | `/api/admin/**` | admin | OK |
| `lib/admin-testing.ts` local `/api/admin/testing/**` | Next route handlers | admin UI/local runner | No pasa por Spring |
| `lib/student-resilience.ts` `GET /auth/me` | `GET /api/auth/me` | publico, devuelve 401 sin token | Usado solo como ping; cualquier respuesta `<500` indica backend alcanzable |

## Seguridad transversal aplicada

- CORS queda centralizado en Spring Security; se elimino el `WebMvcConfigurer` duplicado.
- CORS permite los headers reales del cliente: `Authorization`, `Content-Type`, `Accept`, `Origin`, `X-Requested-With`, `X-UCI-Platform`, `X-User-Role`.
- `SecurityConfig` ahora declara reglas explicitas para familias antes cubiertas solo por `authenticated()`.
- Endpoints auxiliares (`/api/formats/available`, `/api/export/download/{id}`, `/api/system/metrics/prometheus`) tienen proteccion por metodo, no solo por filtro global.
- El cliente HTTP ya no reintenta automaticamente `POST`, `PUT`, `PATCH` ni `DELETE`, evitando duplicar escrituras.
- `GET` respeta `timeoutMs` y el cliente combina correctamente abortos externos con timeout interno.
- Rate limiting usa `remoteAddr` por defecto y solo confia en `X-Forwarded-For`/`X-Real-IP` cuando `app.security.trust-proxy-headers=true`.
- La whitelist de IP para endpoints sensibles usa la misma politica: no confia en headers de proxy salvo `app.security.trust-proxy-headers=true`.
