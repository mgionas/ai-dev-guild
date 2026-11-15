# Findings: task delta-import, round 1

**Head reviewed:** abc1234   **Reviewers:** reviewer-security, reviewer-code, reviewer-tests

| # | Severity | Where | What is wrong | How to see it | Test that should catch it |
| - | -------- | ----- | ------------- | ------------- | ------------------------- |
| 1 | critical | `d.ts:2` | Claim: the import is idempotent | import twice | d.test |
| 2 | medium | `d.ts:7` | Errors are swallowed | bad file | d.test |
| 3 | urgent | `d.ts:9` | A severity this script does not know | read it | none |
