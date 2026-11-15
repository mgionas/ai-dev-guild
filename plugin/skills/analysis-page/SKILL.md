---
name: analysis-page
description: "Publish a page that lays out the facts behind a decision for the owner: every figure tagged sourced, assumption or gap, sources numbered at the end, options with the recommended one first and marked for the owner to decide, and the owner's dated answer written back onto the page. Use when a decision rests on facts, such as the economics of a pricing model, a competitor comparison, a market study or a critique of the product."
argument-hint: "[the decision]"
---

The owner asked "should we do X?", and the answer depends on numbers nobody has put in one place.
An analysis page puts them there, says how far each one can be trusted, and keeps the owner's answer
beside them, so the page becomes the record of the decision. The page reports. It never decides:
product, money and legal choices are the owner's.

## 1. Ask what the page is for

Before any research, ask the owner two things: what is the decision, and what must the page show for
them to make it. Pages differ with the decision, so do not start from a fixed form. If there are
several questions, send them as one batch (`decision-batch`). If the owner's answer leaves a product
detail unclear, ask again before you research on a guess.

## 2. Gather the facts

Hand the research to an agent with a brief that includes `research-template.md` from the
`write-brief` skill's folder. It makes the agent give every number a URL, write "not found" instead
of estimating, and label each figure. Do the work yourself only when it is a few lookups.

## 3. Tag every figure

Every figure on the page carries one of three tags:

- **Sourced**: it comes from a page someone read, and the source's number is beside it.
- **Assumption**: someone chose it. The line says why and what it rests on.
- **Gap**: it was looked for and not found. Gaps are also listed in their own section, with who could
  answer each.

A figure with no tag is not put on the page. A figure tagged sourced with no source number is a
mistake, and the template flags it in red.

## 4. Write it

Build the page from `analysis-page.md` in this skill's folder: copy the code block, replace the
placeholders, fill the data block, and change nothing else. Its sections, top to bottom:

- the question, and whether it is open or decided;
- a short summary: what the facts say and what they do not;
- findings, each with its figures: value, tag, source number;
- options, the recommended one first, marked "for you to decide";
- the owner's answer, shown only once there is one;
- gaps;
- sources, numbered, each with the page's title and URL.

Keep the summary to what the findings support. If the facts do not point one way, say that and
recommend nothing. A recommendation rests on a stated reason, and an option the owner might prefer
for a reason you cannot see (a legal duty, a promise already made) is listed as an option, not
dropped.

The page uses the house design (`page-design.md` in the `progress-boards` skill's folder): keep its
tokens, and read sourced, assumption and gap as it maps them to green, amber and red.

The page works with embedded data only, so it needs no artifact database. Publish it where the owner
can open it (an artifact or a hosted page). If the person does not publish pages, write it as a
plain file.

## 5. Record the answer

When the owner answers, in the same turn:

1. In the page's data, set `status` to `decided`, set `updated`, and fill `answer` with the owner's
   words quoted as they gave them, the date, and the chosen option's id. Do not paraphrase.
2. Write the answer in the project's decision log, quoting the owner and linking the page.
3. Republish to the same URL, so the link the owner already has shows the decision.

If the owner changes their mind later, add the new answer with its date and keep the old one in the
decision log. The page then shows the latest answer, and the log shows the history.
