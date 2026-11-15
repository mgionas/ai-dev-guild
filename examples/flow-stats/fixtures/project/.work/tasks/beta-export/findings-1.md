# Findings: task beta-export, round 1

**Head reviewed:** abc1234   **Reviewers:** reviewer-code

| # | Severity | Where | What is wrong | How to see it | Test that should catch it |
| - | -------- | ----- | ------------- | ------------- | ------------------------- |
| 1 | high | `b.ts:3` | A file is not closed | export twice | b.test |
| 2 | Low | `b.ts:8` | A comment is stale | read it | none |
