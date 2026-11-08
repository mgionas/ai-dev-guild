# Run the heavy checks once

Builders and fixers run only the tests for the code they touched. Everything else runs a single time, in the strict local check just before merging.

**Why:** Rerunning a twenty-minute suite after every small fix on unchanged code was a large share of the time spent.

**How to apply:**

- Briefs name the covering tests.
- Never run two heavy runs at once if they share a database or containers.

**Where it lives:** the `local-ci` and `fix-round` skills.

Origin: field-tested.
