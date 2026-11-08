# No personal data in code, logs or prompts

No names, phone numbers, ID numbers or documents in code, fixtures, logs, prompts, event payloads or commits.

**Why:** Logs, error trackers and test fixtures are copied everywhere. Personal data that reaches them cannot be recalled.

**How to apply:**

- Log and send ids, not details.
- Assume any error you did not build contains its inputs.
- Test accounts are named by role.

**Where it lives:** the `security-reviewer` role; no automatic check catches this, so reviewers must.

Origin: field-tested.
