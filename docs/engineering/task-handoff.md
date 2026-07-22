# PR task handoff

Complete this at the end of every PR-sized task. The next fresh task must be able to continue without relying on chat history.

```text
Milestone and PR:
Build-plan section and gate:
Goal:
Codex task title:
Task lifecycle: active | complete-and-ready-to-archive | retired
Canonical repository:
Branch:
Commit:
Base commit:

Concurrency/worktree record:
- Visible lead tasks used:
- Internal workers used:
- Editing worktree ownership:

Behavior completed:

Files/modules changed:

Public interfaces changed:

Database migrations:

Tests and checks executed:
- Command:
  Result:

Security/privacy review:

Cost impact:

AWS/provider actions taken:
- Approval ID:
- Action:
- Result:

Unresolved risks or decisions:

Build-plan deviations:

Rollback notes:

Exact recommended next task prompt:

Task retirement:
- Final exact-head checks passed:
- Rename to `Section N — <build-plan section name> (Complete)`:
- Archive before the next section starts:
```

Exactly one visible lead task must be listed. If a task was replaced or a duplicate
was discovered, record its title, last mutation, reconciliation result, renamed
`Retired — ...` title, and archive status before marking this handoff complete.
