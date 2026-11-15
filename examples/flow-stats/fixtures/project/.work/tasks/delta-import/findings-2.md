# Findings: task delta-import, round 2

**Head reviewed:** abc1234   **Reviewers:** reviewer-code

| # | Severity | Where | What is wrong | How to see it | Test that should catch it |
| - | -------- | ----- | ------------- | ------------- | ------------------------- |
| 1 | high | `d.ts:12` | The fix breaks the second import | import twice | d.test |
