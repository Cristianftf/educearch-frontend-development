# Testing (XP)

This folder scaffolds the automated test layers recommended by the XP plan in `pruebas_xp_edusearch.txt`.

## Structure
- `tests/unit`: Fast, deterministic tests for pure logic (TDD).
- `tests/integration`: API contracts, storage, and cross-module behavior.
- `tests/e2e`: Role-based acceptance flows.

## Commands
- `npm run test` (watch mode)
- `npm run test:unit` (CI-friendly)
- `npm run test:e2e` (requires the app running on `http://localhost:3000` or set `PLAYWRIGHT_BASE_URL`)

## Evidence logs
- Unit test results: `test-results/unit/junit.xml` and `test-results/unit/results.json`
- E2E test results: `test-results/e2e/junit.xml` and `test-results/e2e/html`

## XP Workflow
1. Add or update a user story.
2. Write the acceptance test first (E2E or integration).
3. Implement unit tests for the underlying logic.
4. Deliver in small iterations and rerun regression frequently.
