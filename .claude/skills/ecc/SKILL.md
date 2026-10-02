---
name: ecc
description: Everything Claude Code (ECC) master skill for advanced agent workflows, token optimization, memory persistence, verification loops, subagent orchestration, and production rules.
---

# Everything Claude Code (ECC) Master Skill

Master workflows and operational guidelines derived from Everything Claude Code (ECC).

## Core Pillars

### 1. Token Optimization & Context Budgeting
- **Context Hygiene:** Never dump large outputs directly into the main context. Use targeted tools (Read with line offsets, Grep, Glob) and delegate large searches to subagents.
- **Model Matching:** Use fast models for routine operations and high-reasoning models (`opus`/`sonnet`) for architecture, complex refactoring, and security reviews.
- **Selective Tooling:** Disable unused MCP servers or heavy plugins to preserve context window.

### 2. Memory & Session Persistence
- Extract repeatable domain patterns, architectural constraints, and user preferences into structured memory records.
- Before compacting or wrapping up, capture critical invariants, decisions, and remaining roadmap checkpoints.

### 3. Verification Loops & TDD (Red-Green-Refactor)
- **TDD Workflow:**
  1. Define interfaces & contracts.
  2. Write failing test (RED).
  3. Implement minimal code (GREEN).
  4. Refactor and eliminate complexity (IMPROVE).
  5. Verify coverage and regression safety.
- Run continuous smoke testing and verification commands after every major change.

### 4. Specialized Subagent Orchestration
- Delegate discrete, parallelizable tasks to specialized roles:
  - **Planner:** Break down ambiguous requirements into strict dependency graphs.
  - **Architect:** Evaluate system trade-offs, schemas, and API contracts.
  - **Code Reviewer:** Audit for security, complexity, and performance.
  - **Refactor Cleaner:** Remove dead code, redundant abstractions, and unused dependencies.

### 5. Production Rules & Code Quality
- **Security:** Zero hardcoded secrets, sanitize all inputs at boundaries, enforce RBAC/auth checks.
- **Coding Style:** Prefer explicit, flat code over deep inheritance hierarchies. Shortest working diff wins.
- **Git Hygiene:** Atomic, well-scoped commits with descriptive summaries.
