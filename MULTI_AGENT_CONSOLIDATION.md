# Multi-agent Resilience Maps consolidation

Eight parallel “Resilience Maps application” cloud agents wrote competing scaffolds.
One is already on `main` (PR #1). This pass re-ran builds, finished incomplete
writes, and opened PRs so each remaining candidate can be deployed and compared.

## Agents → branches → status

| Agent branch | Build | Tests | PR |
|---|---|---|---|
| `cursor/resilience-maps-e937` | ✅ (on main) | — | **Merged** as PR #1 |
| `cursor/resilience-maps-73b2` | ✅ | UI exercised | Pending create (this agent) |
| `cursor/resilience-maps-0726` | ✅ | ✅ vitest 3/3 | Pending create |
| `cursor/resilience-maps-scaffold-afc6` | ✅ | — | Pending create |
| `cursor/resilience-maps-offline-first-d911` | 🔧 completing missing `src/data/*` | — | After fix |
| `cursor/resilience-maps-scaffold-a0bc` | 🔧 completing missing `src/data/*` | — | After fix |
| `cursor/resilience-maps-scaffold-814c` | 🔧 completing missing `mockFacilities` | — | After fix |
| `cursor/resilience-maps-scaffold-f0d2` | ❌ type errors + missing `categories` | — | Optional follow-up |

## Top 5 for deployment testing

1. **e937** — already on `main` (baseline deploy)
2. **73b2** — fullest UI (all 6 patterns + WebGL fallback)
3. **0726** — only candidate with automated Vitest coverage
4. **offline-first-d911** — largest surface (hazards + routing network) once data seeds land
5. **a0bc** or **afc6** — alternate scaffold layouts

## How to deploy-test a candidate

```bash
git fetch origin
git checkout <branch>
npm ci
npm run build
npm run preview   # or: docker compose -f docker/docker-compose.yml up --build
```

Do **not** merge multiple candidates into `main` without a deliberate pick —
they are competing full apps, not incremental patches.
