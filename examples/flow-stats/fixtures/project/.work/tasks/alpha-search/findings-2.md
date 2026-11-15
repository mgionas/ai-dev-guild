# Findings: task alpha-search, round 2

**Head reviewed:** abc1234   **Reviewers:** reviewer-code

| # | Severity | Where | What is wrong | How to see it | Test that should catch it |
| - | -------- | ----- | ------------- | ------------- | ------------------------- |
| 1 | medium | `a.ts:4` | The fix left a stale cache | run twice | a.test |
| 2 | high | `a.ts:30` | The retry has no limit | fail the call | a.test |
