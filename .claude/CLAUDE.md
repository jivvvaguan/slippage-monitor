# jivvvagentic Project Configuration

> Execution methodology, steering rules, and skills are provided by PAI (~/.claude/).
> Project context is in .ai/project/. Read .ai/CONTEXT_ROUTING.md for the full index.

---

## Session Init

**On session start, check whether `.ai/` exists in the project root.**

- If `.ai/` exists: Read `.ai/CONTEXT_ROUTING.md` for the context index.
  Load project docs on demand during Algorithm phases.
- If `.ai/` does NOT exist: Ask the user what they want to build, then run:
  ```
  bun ~/.claude/jivvvagentic/tools/init-project.ts <project_dir>
  ```

---

## Project Context

Read `.ai/CONTEXT_ROUTING.md` for the full index. Key files:

| What | Where | When to Read |
|------|-------|-------------|
| Product intent & anti-goals | `.ai/project/OVERVIEW.md` | OBSERVE phase |
| System map & module boundaries | `.ai/project/ARCHITECTURE.md` | PLAN phase |
| Interface contracts | `.ai/project/INTERFACES.md` | PLAN phase |
| Technical constraints & non-negotiable rules | `.ai/project/CONSTRAINTS.md` | THINK phase |
| Quality standards & patterns | `.ai/project/STANDARDS.md` | BUILD/EXECUTE phase |
| Roadmap & known blockers | `.ai/project/ROADMAP.md` | OBSERVE phase |
| Architecture decision records | `.ai/project/DECISIONS.md` | THINK phase |
| Reference implementations | `.ai/project/references/INDEX.md` | BUILD/EXECUTE phase |

---

## JAI Rules

- **No agent git push.** Agents may stage and commit, but must not push.
  Push requires human confirmation.

- **Complete the knowledge loop.** After finishing any significant work:
  1. Archive the Plan to `Plans/done/` (if a Plan file was used)
  2. Update affected `.ai/project/` files to reflect the new reality:
     - Changed architecture → update `ARCHITECTURE.md`
     - Changed module interfaces → update `INTERFACES.md`
     - Made cross-task decisions → update `DECISIONS.md`
     - Added/changed constraints → update `CONSTRAINTS.md`
     - Changed patterns/standards → update `STANDARDS.md`
     - Completed a workstream → update `ROADMAP.md`
  3. `.ai/project/` must always reflect the current state, not a past state

---

## State CLI

```bash
jai state create-task --desc "description" --priority 8
jai state list-tasks --status pending
jai state complete-task --id 1 --result "Done"
jai state create-feature --desc "..." --criteria "1. ...\n2. ..."
jai state list-features
jai state approve-features
jai state write-signal --category ops --metric latency --value 230
jai status
jai tasks
```

---

## PAI Fallback

If PAI is not installed (`~/.claude/CLAUDE.md` does not exist), follow these minimal principles:

1. Decompose requests into verifiable criteria before executing
2. Fix bugs with surgical precision -- smallest possible change
3. Never assert without verification -- evidence required
4. Read existing code before modifying
5. One change at a time when debugging
6. Ask before destructive actions
