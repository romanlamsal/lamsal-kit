# Layers — review checklist

Nine questions, each answerable from a diff. Each names the rules in `layers-revised.md` it
checks; the rule is stated there, the example in `layers-revised-examples.md`. Most faults here are
ones a linter cannot see, because they are about what a function *does* rather than where it
imports from.

The checklist is a prompt to look. Concluding that a case is fine is a complete answer.

### 1. Does a service write a table itself? — SVC-4

**In a diff:** an insert, update or delete inside a service, or a service reaching for a store
handle to query it, against any table.

### 2. Is the new use case in a driven adapter, or in a driving one? — ARR-3, DRV-1, DVN-3

**In a diff:** a driven adapter that gained an import of another driven adapter or of a service.
Or a driving adapter's body that grew past "call one service"; preparing the call — resolving its
caller, validating, translating, putting ambient values in, asking a specification — is not
growth.

### 3. Does this add a second constructor for the same row? — DOM-4

**In a diff:** a row shape for one table built in two places — commonly once on the server and
once in a client-side optimistic update, or in two services.

### 4. Does the write invalidate every aggregate its service wrote? — `components.md`

**In a diff:** a write declaring one invalidation (`components.md` defines the terms) while the
service it calls writes two tables.

Open the service and count the tables it touches — **including the ones reached through a
transaction context it handed to another aggregate's repository**. Every aggregate written needs
to be named. The write the screen is obviously about is the easy half; the one further down the
shared transaction is the half that gets missed.

```
// settleOrder writes `orders` and clears `invoices.dunning_stage`
// declared: ["order"]            — the fault
// declared: ["order", "invoice"] — correct
```

*Fine:* a use case touching three aggregates and naming three invalidations is correct, not a
breach of one mutation per use case. `components.md` is the client-side form of this question.

### 5. Did one transaction quietly become several? — TX-2, SVC-3, S-TX-1, S-PRD-1

**In a diff:** a function that opens its own transaction instead of joining the one it was given,
except where S-TX-1 or S-PRD-1 step 3.2 or 3.4 opens one; a repository method that takes the
context and writes without it; a loop that calls a write per item; a service that receives or
imports another service of its system; a call to another system's writing port inside `run`.

### 6. Does a driven adapter import a service? — ARR-3

**In a diff:** a service import inside a driven adapter's file. Question 2's fault seen from the
other end, and the cheapest to spot.

### 7. Does anything build its own dependency instead of receiving it? — ASM-2, DRV-3

**In a diff:** a concrete adapter imported into a service file, constructed inside a service body
or a factory body, or read from the per-process registry there, rather than passed in; a driving
adapter importing an instance from the root, or reading a courier when its module loads. Also: a
module exporting a ready-made instance next to the factory that produces it.

Constructed in place, this one is invisible to questions 1–6 — the code sits in the right layer
and calls along the arrow.

### 8. Does the boundary match the relationship? — SYS-5

**In a diff:** a driven port whose types copy another system's field for field, and an adapter
mapping each field to itself. Or a message schema copied field for field from the system that
publishes it. Or, behind an anti-corruption layer, one of the other system's terms in this domain
or a service.

### 9. Does a message schema change break a message in flight? — TX-5

**In a diff:** a field renamed, removed, made required, or narrowed in the schema of a message —
including a domain schema the published language re-exports.
