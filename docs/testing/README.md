# XP Testing Assets

This folder contains the core XP testing artifacts for EduSearch.

## Source Plan
- `pruebas_xp_edusearch.txt` (baseline scope and priorities)

## Artifacts
- `test-backlog.md`: prioritized list of test targets mapped to XP layers.
- `test-case-template.md`: template for manual or automated cases.
- `traceability-matrix.csv`: requirement-to-test mapping starter.
- `data/testing/xp-test-cases.json`: casos detallados del plan XP.
- `test-results/`: generated evidence logs (JUnit + JSON + HTML).
- Admin panel: `/admin/testing` centralizes evidence and manual logs.

## Admin Runner (optional)
- Set `ENABLE_ADMIN_TEST_RUNNER=true` to allow running suites from the admin panel.

## IA de Pruebas (opcional)
- El panel envía logs a la IA integrada usando `/api/admin/testing/analyze` para obtener sugerencias.

Keep these artifacts updated as user stories evolve.
