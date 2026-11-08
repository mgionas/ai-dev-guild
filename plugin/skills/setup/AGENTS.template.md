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
2. **People decide product, price, legal and money questions.** Write the question down and ask.
3. **Read the installed version** of a library, and its current docs, before you call it.
4. **No proof, not done.** Paste the output of the tests, type check and lint you ran.
5. **Work in your own area.** Use other modules only through their public interface.
6. **Keep personal data out** of code, test data, logs, prompts and commit messages.
7. **Comments give reasons.** Say why the code is like this, in plain sentences, not what it does.
8. **Organise by feature, for the next reader.** Tests live beside their code; no catch-all
   folders. The test is whether a newcomer can find things, not a file count.
9. **Prefer a well-kept open-source library to new code.** Permissive licences only (MIT,
   Apache-2.0, BSD, ISC). Ask the product owner before adding anything commercial.
10. **Touch only what the task is about.** Leave nearby code alone, and report anything wrong you
    saw under **Noticed**, with `file:line`.
11. **Record your guesses** under **Assumptions**: what you picked, what else it could have meant,
    and why you picked it.
12. **Add nothing extra.** No setting, flag or layer that no one has asked for.
13. **Assume no country.** Times in UTC with IANA zone names, money with its currency code,
    formats by locale, phone numbers in E.164. Country rules (tax, holidays, legal text) come from
    the project's rules.
14. **Decisions are the owner's.** If code and a recorded decision disagree, the code is not done
    yet. Report it; do not edit the decision.

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

Product scope, business rules, anything about money, production releases and migrations, and legal
text are decided by the product owner or a named expert.
