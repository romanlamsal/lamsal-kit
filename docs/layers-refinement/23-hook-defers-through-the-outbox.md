# A hook defers through the outbox; a handler is a driving adapter the relay calls

**Status:** ready

**Kind:** contradiction (review 03, S1) and a term with no definition · **Touches:** Terms
(reconciliation, new entry *handler*), The layers ("Stop delivering"), Other systems (export list),
Products (hook steps 1–4 and the closing paragraph), Transactions (rule 1, both paragraphs),
`domain.md` (placed-as list), the layer table (driving row, via the skill) · **Related:**
`review-03.md` R02-04, R02-12, R02-05, R03-39, R03-28, Q4, Q10; `14-hook-writes-product-transaction.md`
(steps 3 and 4 as written there); `12-side-effects-through-outbox.md` (rule 1's exception);
`16-relay-wiring.md` ("a message handler is a driving adapter"); `22-driving-adapter-prepares-and-acts.md`
(step 4's handler uses its shape: the service loads, decides, acts). Apply 22 first.

Grilled and decided on 2026-10-21; the `## Decision` section is the ruling and the Resolution is
the agreed wording. A fresh session applies it: read `registry/docs/agents/layers.md` whole and
`docs/extending-layers.md`, then work the before/after pairs through steps 3–6 of the process
doc. The decision is not up for re-litigation; wording may be tightened where a test fails.

## Context

Hook step 4 came in with the Transactions section (`3c0821c`): "Where [a hook runs inside the
product's transaction], the hook leaves its work to a handler that first checks the change through
the product." Its intent was never to act on a product's change before the product commits it.
Ticket 14 split the hook into four steps and kept step 4's hand-off, now "in-process", with "a
hand-off … is lost when the process stops first … reconciliation repairs it". That contradicts
"Stop delivering": a hook of a product that may not retry "records what it was given, through its
one service, before anything that can fail" (R02-04).

"Handler" has no Terms entry. A sweep found it used for the relay-called adapter (table, export
list, outbox bullets), for a webhook's or product hook's adapter ("a handler of one", R03-39), for
step 4's in-memory receiver, and in rule 1 for a driving adapter that calls Stripe itself
("a handler of this system calls it"; "a handler or scheduled task of this system repeats the
call", R02-12), against "acts through one service". Rule 1 also has "a duplicate is repaired by
the saga or by reconciliation", though reconciliation "repairs this system's record" and a
duplicate PaymentIntent is Stripe's (R02-05).

## Problem

Step 3 holds when a write in the hook commits and rolls back with the product's change. Today its
parenthesis names one way, "the outbox is in a store this system's transaction port reaches
through that transaction", which needs a transaction port over the product's connection. The
document already has a second way, in Preconditions: where a store cannot apply several writes
atomically, "an aggregate's outgoing messages are embedded in its own record" (Khononov p. 146).
From this system's port, the product's store is such a store. A hook that may change the record
the product is writing embeds the message there, and it commits or vanishes with the change. No
cold read can make that derivation across two sections.

Step 4 is only the leftover: the hook can write nothing that commits with the change. Holding
the deferral in memory was never justified; the message goes to this system's outbox in this
system's own transaction, and the handler's service verifies through the product before acting.
The relay delivers after this system's commit while the product's transaction may still be open,
so a miss is "not yet", which the document already rules "is not a repeat".

## Resolution

### 1. Terms, new entry after the reconciliation paragraph

> A *handler* is a driving adapter: the relay calls it with a message — an event or a command —
> and it acts through one service.

### 2. Terms, reconciliation

Before: "it compares what this system recorded with what another system holds, and repairs this
system's record."

After: "it compares what this system recorded with what another system holds, and repairs this
system's record, or starts the step that repairs the other's."

### 3. The layers, "Stop delivering" (R03-39)

Before:

> … and a product may not run a hook again, so a handler of one records what it was given,
> through its one service, before anything that can fail. The fault: the handler throws on an
> early delivery, and the caller never sends it again.

After:

> … and a product may not run a hook again, so a driving adapter for such a caller records what
> it was given, through its one service, before anything that can fail. The fault: the adapter
> throws on an early delivery, and the caller never sends it again.

### 4. Other systems, export list

Before: "where it handles messages, a function that takes configuration and builds its message
handler, for the assembly that hands it to the relay."

After: "where it handles messages, a function that takes configuration and builds its handler,
for the assembly that hands it to the relay."

### 5. Products, hook steps and closing paragraph

Before:

> - **It acts** → answer in order:
>   1. **The product has committed the change** → the hook acts through one service.
>   2. **The product's caller needs this system's work before the product answers it**, such as a
>      profile for a user signing up → the hook acts now, through one service, in this system's
>      own transaction, which touches no row the product's transaction holds. If the product
>      rolls back, reconciliation undoes the work. Where the product offers a hook that runs
>      after its commit and before it answers, step 1 applies and nothing needs undoing.
>   3. **The hook runs inside the product's transaction, and a write there commits and rolls
>      back with the change** (the product hands the hook its transaction, and the outbox is in a
>      store this system's transaction port reaches through that transaction) → the hook calls
>      one service, handing it the product's transaction as the context repositories take; the
>      service writes only a message there, to this system's outbox or the product's, as each
>      codebase chooses. Nothing is lost.
>   4. **Otherwise**, inside the transaction or before it opens → the hook hands its work,
>      in-process, to a handler that first checks the change through the product.
>
>   Steps 2 and 3 are this document's choice; the sources do not cover a product's transaction. A
>   hand-off, or an act after the commit, is lost when the process stops first and the product
>   does not run the hook again; reconciliation repairs it.

After:

> - **It acts** → answer in order:
>   1. **The product has committed the change.** The hook acts through one service.
>   2. **The product's caller needs this system's work before the product answers it**, such as a
>      profile for a user signing up. The hook acts now, through one service, in this system's
>      own transaction, which touches no row the product's transaction holds. If the product
>      rolls back, reconciliation undoes the work. Where the product offers a hook that runs
>      after its commit and before it answers, step 1 applies and nothing needs undoing.
>   3. **The hook runs inside the product's transaction, and a write there commits and rolls
>      back with the change.** That holds when the message is embedded in the record the product
>      is writing (Preconditions), when this system's outbox is in a store the product's
>      transaction reaches, or when the product has an outbox of its own. The hook calls one
>      service and passes on what the product handed it: the transaction, or the record. The
>      service writes only a message, through the outbox port, into that context. Nothing is
>      lost.
>   4. **Otherwise**, the hook can write nothing that commits with the change. The hook calls one
>      service. The service writes the message to this system's outbox, in this system's own
>      transaction. The handler receives the message; its service first checks through the
>      product that the change committed, then acts. Not yet is not a repeat (Terms): the handler
>      fails, the relay retries, until a deadline passes.
>
>   Steps 2 to 4 are this document's choice; the sources do not cover a product's transaction. An
>   act after the commit is lost when the process stops before it and the product does not run
>   the hook again. Reconciliation repairs that, and undoes step 2's work when the product rolls
>   back.

### 6. Transactions, rule 1

Before: "A third party handles none: a handler of this system calls it when the message arrives,
and the message is the retry."

After: "A third party reads no relay: a handler of this system receives the message instead, and
the message is the retry."

Before: "The pending state is the retry: a handler or scheduled task of this system repeats the
call until the answer is recorded or a deadline passes. A duplicate is repaired by the saga or by
reconciliation."

After: "The pending state is the retry: a scheduled task of this system repeats it until the
answer is recorded or a deadline passes. A duplicate is undone by a compensating call, a saga
step, which reconciliation starts when it finds one."

### 7. `domain.md`, placed-as-fault list, and the catalog edge cases

Add to the catalog bullet: "Payload's before-write hook may change the record it saves: an
editor's change lands in hook step 3 by embedding the message in the document (ticket 23)."

### Sweep

Grep `handler`, `handles`, `hand-off`, `reconcil`, `in-process`. "Message handler" in the table
follows through the skill. `tanstack-start.md:16` "reads its service inside the handler" names
the framework's callback and now collides with the term: "inside the server function's body".
The Transactions lead's exception "except a message a product's hook writes in the product's
transaction (Products)" still holds. Ticket 14's Resolution gets a footnote: steps 3 and 4
superseded here.

## Grounding

- Khononov p. 145: "Both the updated aggregate's state and the new domain events are committed
  in the same atomic transaction." p. 146: "When using a NoSQL database that doesn't support
  multidocument transactions, the outgoing domain events have to be embedded in the aggregate's
  record." p. 150: "no two transactions can be considered atomic"; outside an aggregate,
  "everything … is eventually consistent".
- Richardson, *Microservices Patterns* (from memory, as ticket 14): the compensating step.
- Evans, Cockburn: silent on a hook inside a foreign transaction.

The embedding is Khononov's; applying it to a record a product writes, and the whole hook order,
are this document's choice, marked in the closing paragraph.

## Done when

The seven pairs are applied, 22 first; each new sentence passes the four tests; the sweep finds
no "handler" that the relay does not call and no driving adapter calling a third party; the skill
has rebuilt the table; a fresh agent with only `layers.md` places at confidence 4–5: an editor's
change through a Payload before-write hook (step 3, embedded); a product whose only hook may not
write (step 4, the handler's service verifies, fails on "not yet"); shop's confirmation mail
(handler, one service, the mailer behind a port); a duplicate PaymentIntent (compensating step).
Committed per `CLAUDE.md`; status set here, in `spec-01.md` and noted in `review-03.md`.

## Decision

**A handler is a driving adapter the relay calls.** One word, one meaning: Terms defines
*handler*; "message handler" drops its qualifier; an adapter behind a webhook or a product's hook
is "a driving adapter", not a handler. What a handler takes — the message, or a command built
from it — needs no clause: ticket 09 makes a command a message of the receiver's published
language.

**Step 3 is a property with three ways, embedding first.** "A write there commits and rolls back
with the change" holds when the message is embedded in the record the product is writing
(Preconditions, Khononov p. 146), when this system's outbox is in a store the product's
transaction reaches, or when the product has an outbox of its own. Embedding needs no shared
store and no product outbox, which is why it leads. Which way a codebase uses is its choice,
implied by "holds when".

**Step 4 defers through this system's outbox, not through memory.** The hook writes the message
in this system's own transaction; the handler's service verifies through the product before it
acts. A miss is "not yet", not a repeat: fail, let the relay retry, until a deadline the codebase
sets. Step 4 loses nothing; reconciliation is named only for step 1 (a crash between the
product's commit and ours) and step 2 (our work stands after the product's rollback).

**Rule 1 stops naming who calls the third party.** A handler receives the message; a scheduled
task repeats the pending call. By Terms both are driving adapters, so one service, so a driven
port reaches Stripe or the mailer. The chain is not spelled in place.

**A duplicate is undone by a compensating saga step, which reconciliation starts.** Terms widens
reconciliation to "repairs this system's record, or starts the step that repairs the other's".

**Considered options**

- Keep the in-memory hand-off as a marked lossy exception: keeps a path that loses work on
  purpose, against "Stop delivering".
- Step 4 as a pending row in this system's tables swept by a scheduled task: the same deferral
  with a second mechanism beside the outbox.
- Prefer the product's outbox where it has one: a preference with no reason, and a second relay
  wired to this system's handler.
- Spell the chain handler → service → driven port in rule 1: true, redundant with Terms.

**Consequences**

- The reconciliation clause shrinks to steps 1 and 2; an agent no longer builds a reconciliation
  job for a hook that can write.
- The product's record gains a field this system owns for the embedded messages, hidden in the
  product's screens ("a field this system owns is read-only there"); its declaration in the
  product's collection config is R02-28's case, not a second constructor.
- The relay reads the product's records through an outbox adapter over the product's store, a
  second implementation of the outbox port under the same contract suite; R02-38's wording for
  "the product's outbox" follows.
- A message embedded in a record carries the record's version: Q7's ordering property without a
  separate sequence.
- Whether the embedded message holds the product's raw change or this system's terms is Q19,
  undecided here; both fit.
- R02-04, R02-12, R02-05, R03-39 close with this ticket; ticket 14's steps 3 and 4 are superseded.
