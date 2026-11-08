---
name: new-event
description: "EXAMPLE (transactional outbox): add a domain event — named in past tense from the glossary, written in the same transaction as the change, ids only in the payload, an idempotent handler. Rewrite for your stack before use."
---

> Example skill. It assumes an outbox table in the same database and a worker that delivers rows.

Reviewed by `architect`.

1. **Name it in past tense, from the glossary** (`OrderShipped`, not `HandleShipping`). If the
   event is not in the agreed list, ask.
2. **Define the type in the publishing module's public interface.**
3. **Payload: ids and dates only.** An outbox row is shared storage that other modules read. If a
   handler needs more, it asks the owning module by id.
4. **Publish in the same transaction** as the change that makes it true. Then the event exists if
   and only if the change committed.
5. **Handlers are idempotent.** Delivery is at least once. Record what was handled, or make the
   effect safe to repeat, and test by delivering the same event twice.
6. **Handlers have a timeout** and never hold a lock while they call something slow.
