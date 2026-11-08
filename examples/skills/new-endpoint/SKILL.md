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
6. **Regenerate the API document** and commit it; CI checks it is current.
7. **Integration test** through the real HTTP layer: the happy path, the wrong user, another
   account's id, an unknown field, the same request twice.
