# Findings: task alpha-search, round 1

**Head reviewed:** abc1234   **Reviewers:** reviewer-security, reviewer-code

| # | Severity | Where | What is wrong | How to see it | Test that should catch it |
| - | -------- | ----- | ------------- | ------------- | ------------------------- |
| 1 | blocker | `a.ts:1` | Claim: the input is validated | send an empty value | a.test |
| 2 | important | `a.ts:9` | The limit is off by one | send 101 items | a.test |
| 3 | minor | `a.ts:20` | A name is unclear | read it | none |
