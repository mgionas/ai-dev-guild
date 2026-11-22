# <Project> — agent brief

<One paragraph: what the product is, who uses it, and what is being built right now.>

## Where to look first

| You need                                 | Look in                                         |
| ---------------------------------------- | ----------------------------------------------- |
| The words we use, and the business rules | `<glossary path>` (no other terms are allowed)  |
| The reasons behind past choices          | `<decision log path>`                           |
| What is being built now                  | `<spec and plan paths>`                         |
| Rules for one part of the code           | the `AGENTS.md` closest to the files you change |

## Working rules

1. **Only glossary words.** If you need a concept the glossary lacks, stop and ask for it.
2. **People decide product, business and legal questions.** Write the question down and ask.
3. **Read the installed version** of a library, and its current docs, before you call it.
4. **No proof, not done.** Paste the output of the tests, type check and lint you ran.
5. **Work in your own area.** Use other modules only through their public interface.
6. **Keep personal data out** of code, test data, logs, prompts and commit messages.
7. **Comments give reasons.** Say why the code is like this, in plain sentences, not what it does.
   Never name a plan task or fix round; link the decision instead. Folder guides hold what is true
   now; history goes in the plan or a history file.
8. **Organise by feature, for the next reader.** Tests live beside their code; no catch-all
   folders. The test is whether a newcomer can find things, not a file count.
9. **Prefer a well-kept open-source library to new code.** Permissive licences only (MIT,
   Apache-2.0, BSD, ISC). Ask the product owner before adding anything commercial.
10. **Touch only what the task is about.** Leave nearby code alone, and report anything wrong you
    saw under **Noticed**, with `file:line`.
11. **Record your guesses** under **Assumptions**: what you picked, what else it could have meant,
    and why you picked it.
12. **Add nothing extra.** No setting, flag or layer that no one has asked for.
13. **Decisions are the owner's.** If code and a recorded decision disagree, the code is not done
    yet. Report it; do not edit the decision.
14. **Work on the task's branch, never on `main`.** Each task has its own branch (or worktree),
    named in its brief. Changes reach `main` only by a pull request, or by a local merge when the
    project has no remote.

## History

<Fix forward: follow-ups are new commits and history is never rewritten. Or: squash follow-ups:
commit them with `git commit --fixup=<sha>` and squash with `git rebase -i --autosquash <base>`
before reporting. Setup asks, and writes fix forward when there is no answer.>

## Pages

<The living pages this project keeps current when a task merges, one per line, for example:
roadmap, QA board, system map. Setup asks which ones and writes them here; the controller updates
only these.>

## Mistakes that keep happening

<List each mistake review has caught more than once, with a short example. Start from
https://github.com/mgionas/ai-dev-guild/blob/main/docs/mistakes.md and keep only what applies here.>

## Stack (exact versions)

| Area | Version |
| ---- | ------- |

## Commands

| Command | What it does |
| ------- | ------------ |

## Repository map

```
<each top-level folder, with one line on what it holds>
```

## Reviews

Whoever builds a change does not review it. The `review-panel` skill says who does.

## Decisions for people

Product scope, business rules, production releases and migrations, and legal text are decided by the product owner or a named expert.
