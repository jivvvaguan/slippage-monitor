# Context Routing

Three-layer context hierarchy. Read the layer you need, not everything.

## System (PAI — execution methodology)
- algorithm: ~/.claude/PAI/Algorithm/v3.7.0.md
- steering-rules: (auto-injected by PAI startup hook)
- skills: ~/.claude/skills/

## Project (JAI — project context)
- overview: .ai/project/OVERVIEW.md
- architecture: .ai/project/ARCHITECTURE.md
- interfaces: .ai/project/INTERFACES.md
- constraints: .ai/project/CONSTRAINTS.md
- standards: .ai/project/STANDARDS.md
- roadmap: .ai/project/ROADMAP.md
- decisions: .ai/project/DECISIONS.md
- references: .ai/project/references/INDEX.md

## Task (PRD — current work)
- active-work: .ai/memory/work/ (by mtime)
- work-registry: .ai/state/work.json

## Loading Strategy (Execution Layer — by Algorithm Phase)
| Phase | Load |
|-------|------|
| OBSERVE | OVERVIEW.md + ROADMAP.md |
| THINK | CONSTRAINTS.md + DECISIONS.md |
| PLAN | ARCHITECTURE.md + INTERFACES.md |
| BUILD/EXECUTE | STANDARDS.md + references/INDEX.md |
| LEARN | Write back to DECISIONS.md if cross-task impact |
