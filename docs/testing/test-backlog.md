# Test Backlog (XP)

Status legend: `pending`, `in-progress`, `done`.

## Unit (TDD)
- A1 Auth: login, roles, token refresh, logout. (pending)
- A2 Password policy, reset token validity. (pending)
- A3 Search query builder, filters, result normalization. (pending)
- A4 Verification scoring, merge rules, claim parsing. (pending)
- A5 Bibliography formatting and DOI handling. (pending)
- A6 Cases and evaluations serialization and state rules. (pending)
- A7 Admin dashboard normalization and filter sanitization. (pending)

## Integration (API + data)
- B1 Auth API: login, refresh, logout, me. (pending)
- B2 Search API: execute, mesh suggestions, fallback merge. (pending)
- B3 Verification API: claim, url, history. (pending)
- B4 Bibliography API: export, history, download. (pending)
- B5 Cases + evaluations: CRUD, assignments, submissions. (pending)
- B6 Progress + analytics: overview and detail. (pending)
- B7 Chat: REST + websocket fallback. (pending)
- B8 Admin: users, audit, health, backups, cache, monitoring. (pending)

## E2E (Acceptance by role)
- C1 Public: home, register, login, reset password. (pending)
- C2 Student: search, verify, bibliography, cases, chat. (pending)
- C3 Professor: cases, grading, analytics, chat. (pending)
- C4 Admin: users, audit, health, maintenance. (pending)

## Resilience + Security + Performance
- D1 Backend down or slow: fallback paths. (pending)
- D2 External API failures: retries and degradation. (pending)
- D3 Offline partial mode: local history sync. (pending)
- D4 Chat instability: REST fallback. (pending)
- E1 RBAC on routes and endpoints. (pending)
- E2 Input validation (SQL/XSS/CSV). (pending)
- E3 Token expiry and rate limits. (pending)
- F1 Search concurrency latency. (pending)
- F2 Verification response times. (pending)
- F3 Chat ordering under load. (pending)
- F4 Admin exports under load. (pending)

## Usability + Accessibility + Data
- G1 Responsive checks and keyboard navigation. (pending)
- G2 Error copy and loading states. (pending)
- H1 Flyway migrations (fresh and existing). (pending)
- H2 Backup/restore consistency. (pending)
- H3 Log and cache cleanup safety. (pending)
