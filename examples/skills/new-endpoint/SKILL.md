---
name: new-endpoint
description: "EXAMPLE (TypeScript API with shared schemas): add an endpoint — contract first, strict request bodies, one permission check, stable error codes, generated API docs and an integration test. Rewrite for your stack before use."
---

> Example skill. It assumes request and response schemas shared between client and server (for
> example Zod) and a generated OpenAPI document. Replace the paths and names with your project's.

The builder is `builder`; reviewers are `architect` for the contract, and `security-reviewer` when
it touches login, permissions or personal data.

1. **Write the contract first**, in the shared package, in a folder that mirrors the API's folder.
   Client and server validate against the same object.
2. **Request bodies are strict.** A loose object silently drops unknown fields, so a client that
   sends `userId` to act as someone else is ignored instead of refused. Refuse unknown fields with
   one shared error, so the refusal reads the same everywhere.
3. **The handler holds no business logic.** It parses, checks permission through the project's one
   permission function, calls the domain, and maps the result.
4. **Errors have stable codes** in a standard shape (for example RFC 9457 problem details). Never
   put the raw error from a library in the response: it may carry the query and its parameters.
5. **Unknown values mean no.** A role, state or plan the code does not recognise is refused, never
   ranked above the known ones.
6. **Give the operation its place in the API reference.** Each operation gets one tag, named with
   the glossary's term (`Projects`, not `jobs`), set in the operation's own contract file. Tags
   sit in groups that follow the glossary's chapter order (for example `x-tagGroups`, which Redoc and Scalar read). The summary
   is short and imperative: "Create a project", not "Creates a project". Add these from the
   first route, even when there is only one: a reference with a hundred untagged operations is
   hard to fix later.
7. **A guard test enforces what a machine can check.** It fails when an operation has no tag or a tag the list does not
   know, when a tag is in no group, a group names an unknown tag or a group is empty, or when a summary is too long or does not
   start with one of the project's verbs. The glossary term and the group order stay with the
   reviewer. Break the test once on purpose and watch it fail. A sketch (Vitest syntax):

   ```ts
   // allOperations, knownTags, tagGroups, summaryVerbs: from your generated document and tag list.
   const groupedTags = tagGroups.flatMap((g) => g.tags);
   for (const op of allOperations) {
     expect(op.tags, op.id).toHaveLength(1);
     expect(knownTags, op.id).toContain(op.tags[0]);
     expect(op.summary.length, op.id).toBeLessThanOrEqual(60);
     // A short list of allowed verbs ("Create", "List", "Change"…) beats guessing at grammar.
     expect(summaryVerbs, op.id).toContain(op.summary.split(" ")[0]);
   }
   for (const tag of knownTags) expect(groupedTags, tag).toContain(tag);
   for (const tag of groupedTags) expect(knownTags, tag).toContain(tag);
   for (const group of tagGroups) {
     expect(group.tags.length, group.name).toBeGreaterThan(0);
   }
   ```

8. **Regenerate the API document** and commit it; CI checks it is current.
9. **Integration test** through the real HTTP layer: the happy path, the wrong user, another
   account's id, an unknown field, the same request twice.
