# Claude Task: Comprehensive Code Review & Improvement Plan for TerraCube Sentinel

## Context
TerraCube Sentinel is an open-source intelligence platform (Palantir Foundry alternative) with ontology-native architecture. It has just undergone a 10-task enhancement that added data fusion, GSE scoring, AI briefings, socio-economic data, alerting, and more.

## Your Mission

Perform a thorough code review of the ENTIRE project (excluding open-foundry/ which is a submodule). Identify every issue, weakness, and improvement opportunity. Then create a prioritized improvement plan.

## Phase 1: Architecture Review

Read these files to understand the system:
1. ENHANCEMENT_PLAN.md — the enhancement plan that was executed
2. README.md — master documentation
3. ARCHITECTURE.md
4. docker-compose.yml — infrastructure
5. open-foundry/domain-packs/geo-sentinel/schema/*.odl — all ontology schemas

Check for:
- Architecture consistency — does the actual code match the documented architecture?
- Missing components — anything in the plan that wasn't fully implemented?
- Integration gaps — do the adapters actually wire into Dagster pipelines? Do agents actually call the ontology API?
- Infrastructure mismatches — does docker-compose reflect all services needed?
- Import chain issues — do modules import from each other correctly?

## Phase 2: Code Quality Review

Review ALL Python files in:
- `dagster/pipelines/*.py` (7 files)
- `dagster/sources/*.py` (13 files)
- `dagster/ai_ingest/__init__.py`
- `agents/*.py`
- `agents/agents/*.py`
- `agents/gse/*.py`
- `agents/briefing/*.py`
- `agents/alerting/*.py`
- `agents/tools/*.py`

For each file, check:
- **Error handling**: Are API calls wrapped in try/except? Are errors logged properly? Does the system degrade gracefully?
- **Type hints**: Are function signatures properly typed?
- **Docstrings**: Do public functions have docstrings?
- **Security**: Any hardcoded credentials? SQL injection risks? Proper input validation?
- **Resource management**: Are HTTP clients properly managed (connection pooling)? Are database connections closed?
- **Concurrency**: Are async functions actually awaited? Any blocking calls in async contexts?
- **Data validation**: Are external API responses validated before use?
- **Configuration**: Are magic numbers extracted to constants/config? Are environment variables used for secrets?
- **Code duplication**: Is the same logic repeated across files?
- **Dead code**: Any unused imports, functions, or variables?

Review ALL TypeScript/React files in:
- `frontend/src/pages/*.tsx` (8 files)
- `frontend/src/lib/*.ts`
- `frontend/src/hooks/*.ts`
- `frontend/src/components/*.tsx`
- `frontend/App.tsx`

For each file, check:
- **Component structure**: Proper use of React patterns (hooks, memoization where needed)?
- **Type safety**: Are TypeScript types complete (no `any` abuse)?
- **Error boundaries**: Are there error boundaries for network failures?
- **Performance**: Large lists without virtualization? Unnecessary re-renders?
- **UX**: Loading states, empty states, error states for all data displays?
- **Accessibility**: Basic a11y (alt text, keyboard nav, color contrast)?
- **Bundle size**: Are heavy imports lazy-loaded?

## Phase 3: Integration Testing

Verify that all the pieces actually connect:

1. **Source adapters → Dagster**: Do the source adapters in dagster/sources/ actually get called by fusion_pipeline.py? Check the Dagster Definitions object in pipelines/__init__.py includes all new assets.

2. **Dagster → Open Foundry**: Do pipelines actually load data to the ontology? Check the FOUNDRY_API_URL usage.

3. **Agents → Ontology API**: Do agent tools actually call the Open Foundry GraphQL API? Check for correct endpoints.

4. **GSE → Risk Scoring**: Is the GSE engine integrated into the risk_scoring pipeline?

5. **Alerting → Agents**: Do alert rules actually trigger through the orchestrator?

6. **Frontend → Backend**: Does the frontend API client point to the correct backend URLs? Check Vite proxy config.

7. **Docker Compose**: Can all services start? Check port conflicts, dependency ordering, volume mounts.

## Phase 4: Security Review

- Check .env.example has no real credentials
- Check all API keys are read from environment variables
- Check CORS configuration
- Check authentication (Keycloak integration)
- Check for SSRF vulnerabilities in adapter URLs
- Check for injection vulnerabilities in GraphQL queries

## Phase 5: Documentation Review

- Does README.md accurately reflect the current state?
- Are all API endpoints documented?
- Is the Getting Started guide complete and accurate?
- Are architecture diagrams up to date?

## Phase 6: Create Improvement Plan

Write your findings to `REVIEW_AND_IMPROVEMENTS.md` with this structure:

```markdown
# TerraCube Sentinel — Code Review & Improvement Plan

## Executive Summary
[Brief overview of project health, key strengths, critical issues]

## Critical Issues (Fix Immediately)
[Issues that would cause crashes, data loss, or security breaches]

## High Priority Improvements
[Issues that significantly affect functionality or reliability]

## Medium Priority Improvements
[Code quality, performance, UX improvements]

## Low Priority / Nice to Have
[Polish, documentation, future features]

## Architecture Recommendations
[Structural changes for long-term health]

## Detailed Findings

### Python Backend
[File-by-file findings]

### Frontend
[File-by-file findings]

### Infrastructure
[Docker, deployment, configuration findings]

### Security
[Security findings]
```

## Phase 7: Fix Critical Issues

After writing the review, actually FIX all critical issues in the code. Edit the files directly. Commit with: git add -A && git commit -m "review: comprehensive code review, fix critical issues"

## CRITICAL RULES

- Do NOT skip any file. Review everything.
- Do NOT stop to ask questions. Make assessments and move on.
- Be honest about problems. Don't sugarcoat.
- If something looks broken, test it by reading the import chain.
- If you fix something, make sure the fix compiles.
- Commit all changes at the end.
