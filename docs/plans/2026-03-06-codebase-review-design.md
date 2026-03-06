# Codebase Review Design

**Date:** 2026-03-06
**Branch:** demo
**Goals:** Pre-release quality gate, technical debt audit, PRD feature completeness check

## Approach: Three-Pass Parallel Review

Three subagents run simultaneously, each with a focused lens. A synthesis step merges all findings into a single prioritized report.

## Passes

### Pass 1 — PRD Alignment
- Read `design/PRD.md` and extract every stated feature/requirement
- For each requirement: locate the backend endpoints, frontend pages/components, and verify test coverage
- Flag: missing features, partially implemented features, PRD drift

### Pass 2 — Code Quality
- **Backend** (`backend/app/**`): architecture consistency, auth/security patterns, error handling, SQL/ORM usage, input validation
- **Frontend** (`frontend/src/**`): component structure, state management, API error handling, type safety, accessibility basics
- **Both**: security issues (injection, exposed secrets, improper auth checks)

### Pass 3 — Test Coverage
- Run `pytest` (backend) and `vitest` (frontend), capture results
- Read each test file to assess quality — meaningful assertions vs. superficial tests
- Identify untested modules, weak assertions, missing edge cases

## Scope

| Area | Included | Excluded |
|------|----------|----------|
| Backend | `backend/app/**` | `backend/.venv/**` |
| Frontend | `frontend/src/**` | `frontend/node_modules/**` |
| Tests | `backend/tests/**`, `frontend/src/**/*.test.*` | — |
| PRD | `design/PRD.md` | — |

## Output

A single report at `docs/plans/2026-03-06-codebase-review.md` with:

- **Executive Summary**
- **PRD Alignment** — feature-by-feature status table
- **Code Quality** — backend and frontend findings
- **Test Health** — coverage results + test quality notes
- **Prioritized Action List** — all findings ranked by severity

### Severity Scale

| Level | Meaning |
|-------|---------|
| P0 | Ship blocker — must fix before release |
| P1 | Important — fix soon after release |
| P2 | Tech debt — fix eventually |

### Finding Format

```
[P0/P1/P2] area/subarea: description
File: path/to/file.py:line (if applicable)
Fix: brief recommendation
```

## Execution

All three passes run in parallel via subagents. Synthesis runs after all three complete and produces the final report committed to the branch.
