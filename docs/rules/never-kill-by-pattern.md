# Never kill processes by pattern

Stop only a process you started, by its own PID. Never `pkill`, `killall` or `kill $(pgrep …)`.

**Why:** On a machine where several agents work, a pattern kill stops everyone's tests and the CI run too.

**How to apply:**

- Never stop containers or services you did not start.

**Where it lives:** the `bash-guard` hook; see [mistakes](../mistakes.md#killing-processes-by-pattern).

Origin: field-tested.
