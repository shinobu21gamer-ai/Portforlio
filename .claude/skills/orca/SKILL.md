---
name: orca
description: Orca deep step-by-step reasoning, progressive explanation, causal validation, and self-correcting problem solving skill.
---

# Orca Progressive Reasoning & Problem-Solving Skill

Enforces rigorous, structured step-by-step thinking, causal dependency tracing, and continuous self-correction inspired by progressive explanation research.

## When Activated

Use for complex debugging, multi-component architectural changes, algorithmic problems, or when deep analytical reasoning is required before writing code.

---

## 5-Step Orca Reasoning Framework

### Step 1: Decomposition & Problem Formulation
- State the exact goal in 1-2 precise technical sentences.
- Identify all implicit constraints, edge cases, invariants, and failure modes.
- Distinguish between **symptoms** and **root causes**.

### Step 2: Causal Exploration & Call-Graph Tracing
- Map the entire execution path from input/trigger to output/side-effect.
- Grep and inspect all upstream callers and downstream callees before touching any file.
- Verify assumptions against actual code rather than guessing.

### Step 3: Progressive Hypothesis Formulation
- Formulate candidate solutions and explicitly score them:
  - **Option A (Minimal / Direct):** Lowest surface area, fastest to verify.
  - **Option B (Architectural / Structural):** Root-cause resolution, future-proof.
- Evaluate trade-offs: complexity vs. maintainability vs. risk.

### Step 4: Step-by-Step Execution with Verification Milestones
- Break implementation into small, atomic, verifiable steps.
- After each discrete step:
  - Execute a targeted validation (unit test, assertion, syntax/lint check).
  - Verify state invariants remain intact.

### Step 5: Self-Correction & Adversarial Review
- Check: *“What could break this change under high load, bad input, or race conditions?”*
- If an error occurs, inspect the full error stack, formulate a specific hypothesis on why it failed, and fix the root cause rather than patching symptoms.
