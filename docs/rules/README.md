# Working rules

One rule per file, each with its reason, so you can adopt, change or drop one on its own.

| Rule | In one line |
| --- | --- |
| [The builder never reviews their own work](builder-never-reviews.md) | Whoever built a change is never one of its reviewers. |
| [One task per fresh agent, with a brief file and a report file](one-task-fresh-agent.md) | Each task goes to a new agent that gets a written brief and writes a report file. |
| [Evidence before done](evidence-before-done.md) | A task is done only when its report pastes the output of the tests, typecheck and lint that were run. |
| [Change only what the task needs](change-only-the-task.md) | Each line you change should be explainable by the task. |
| [Write down what you assumed](write-down-assumptions.md) | Where the brief was silent and the agent had to choose, the report lists each choice under **Assumptions**: what it chose, the other reading, and why. |
| [Build nothing the task did not ask for](build-nothing-unasked.md) | If neither the spec nor any caller needs a setting, switch, argument or plug-in point today, leave it out. |
| [Ask, don't invent](ask-dont-invent.md) | Use only the project's agreed terms. |
| [The owner's documents are not yours to edit](owner-documents.md) | The product owner owns the specs, the decision log and the board records. |
| [Check the installed version](check-installed-version.md) | Before using a library's API, read the installed version and its current documentation. |
| [Use a library before writing one](library-before-writing-one.md) | When a well-known, actively maintained open-source package already does the job (dates, phone numbers, cryptography, basic UI parts), depend on it at an exact version. |
| [Ask the owner in batches, with recommendations](decision-batches.md) | Collect every open question into one file, with a recommendation and a reason for each, and ask once: "Accept all" or "I'll change some". |
| [Re-checks confirm; they do not reopen](confirm-only-rechecks.md) | After a fix round, one combined re-check confirms each fix. |
| [Choose the model on purpose](right-model.md) | Light work on the light model, judgement on the strongest: haiku for lookups and exactly specified edits, sonnet for briefed builds, fixes, QA and docs, opus for security, architecture, money and concurrency. |
| [Run the heavy checks once](heavy-runs-once.md) | Builders and fixers run only the tests for the code they touched. |
| [Never kill processes by pattern](never-kill-by-pattern.md) | Stop only a process you started, by its own PID. |
| [Commit by path in a shared checkout](commit-by-path.md) | When others may work in the same checkout, commit with `git commit -m "…" -- <paths>`, then check `git show --stat HEAD`. |
| [No personal data in code, logs or prompts](no-personal-data.md) | No names, phone numbers, ID numbers or documents in code, fixtures, logs, prompts, event payloads or commits. |
| [Comments explain why](comments-explain-why.md) | A good comment tells a colleague what the code cannot: why it is written this way, or what would go wrong if it were changed. |
| [Shape folders for the reader](structure-for-the-reader.md) | Group by feature, not by kind. |
| [Update the boards with every change](progress-boards.md) | In the same turn as every merge or status change, update the roadmap and the QA board: what changed, which features it touched, what to retest. |
| [Nobody sees a screen before the designer has seen its screenshots](screenshot-review.md) | Each built screen is screenshotted at every width, light and dark, in every reachable state, and reviewed against its spec before it is shown to the owner. |
| [Keep the system map current](system-map.md) | If the project has a system map, every change that adds an operation, screen, table, folder or job updates it, and the check runs and its output is pasted. |
| [Assume no country](international-by-default.md) | Write code that works anywhere. |
