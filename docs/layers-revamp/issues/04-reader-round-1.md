# 04 — Reader round 1 over the ported general rules

**Status:** open

## Context

First run of the README's readers over `general-rules.md` (41 rules after `DRV-5` retired) and
`domain.md`. Four Implementer agents by section, then Gap, Contradiction and Adversarial. 163
example files in `examples/`; findings carry a `finding:` field.

## Problem

What the readers found, grouped by the change it implies. Nothing below is applied yet.

### Cannot comply (3)

- `DOM-3` on catalog: Payload stores no field its collection config does not declare, so price
  and sku are stated in shop's domain schema and again in Payload's config. Deriving the config
  from the schema covers neither `Money` nor admin-UI concerns. →  products group rule, or
  `DOM-3` Scope narrowed to records whose storage this codebase declares.
- `TX-3` twice, the client_secret round trip: shop's checkout returns Stripe's `client_secret` in
  the same request, which means a Payment created by payment and a PaymentIntent created at
  Stripe, both inside one request. The all-rules shape exists (PaymentRequested message, payment's
  handler creates the intent, the browser polls) and fails only the fixture's "same request",
  which is a situation, not a rule. → decide: keep `TX-3` and make the polling shape the ok
  example, or a MAY for "a use case needs the third party's answer in the same request".

### Gaps (6)

- Four are Payload's: a hook called inside Payload's transaction; shop's own Local API write
  re-firing shop's own hook; a before-change hook returning shop's price for Payload to write;
  editors editing shop's price in Payload's admin. → a products group file.
- The saga as a sequence: glossary defines saga, choreography, orchestration, process manager; no
  Scope uses them. → messaging group (issue 01).
- Code that is no system: the admin dashboard joining three systems' tables, `/health` and
  `/metrics`. Every SYS and TX Scope begins "this system". → decide: a reporting system of its
  own under `TX-12`, or an Assumptions sentence that such code is outside the layers and the rules.

### Contradictions (0)

Nine candidates, each dismissed with a shape that satisfies both rules. Not a contradiction but a
precedence defect: `TX-11` is a MUST whose Scope is inside `TX-3`'s and whose Statement does what
`TX-3`'s Why calls the harm; its Why does not name `TX-3`.

### Adversarial (28 files): Statement or Scope wording to tighten

Accepted on sight, each a few words:

- `ARR-1` Scope misses a driving adapter reaching a store client through the common library;
  the common library is outside the layers. → Scope also covers "a store client, or anything
  behind a driven port".
- `DOM-1`: `createHash` and `Buffer` compute from their arguments and break in a browser; a port
  *module* of the common library loads `node:async_hooks`. → "a port of the common library,
  imported as a type"; "a library that computes from its arguments and loads on every runtime".
- `DOM-4`: the whole Payload document copied "when it needed it". → "the values it decides by,
  copied".
- `SVC-2`: port takes the loaded Order; service decides on stale, forgeable data. → "from what it
  loads in the call that acts".
- `SVC-3`: a service wired by assembly behind a driven port of this system. → "directly or behind
  a port of this system".
- `SVC-4`: a second repository over Order patches `status` without loading the aggregate. →
  "saving the aggregate the domain returned".
- `DRV-1`: the one acting call carries a callback that calls a second service. → "with values as
  its arguments".
- `DRV-6`: courier read at run time, memoized on first run. → "on each run".
- `ASM-1`: one assembly run twice (register and Payload `onInit`). → "run once".
- `ASM-2`: a container handed to the builder, which `get`s keys. → "each dependency, named in its
  signature".
- `ASM-3`: a driven adapter filters rows by the ambient customer; the use case decides by what it
  loaded. → "nor by what a driven adapter read by it".
- `ASM-6`: a message envelope schema "of no system" in the common library. → "no schema a
  system's records or messages parse against".
- `ASM-7` Scope: a Stripe client declared one-config plumbing, module-mocked in tests. → Scope
  carries "that nobody substitutes".
- `ASM-8`: courier filled with a lazy factory. → "with the instances it produced".
- `TX-7`: `amount` cents to euros, same name and type. → "or given another meaning".
- `SYS-2`: `export *` of the whole domain. → "the schemas its driving ports take, return and
  raise, and its published messages".
- `SYS-7`: reconciliation exists, nothing calls it. → "and a driving adapter that runs it".
- `TST-2`: a "fake" mailer that is a real adapter to a sandbox. → glossary term *Fake*: an
  implementation of a port that reaches nothing outside the process.
- `TST-6`: one suite with cases skipped for the real run. → "every case of it".

Needing a decision:

- `TX-5` / `TX-11`: claim in the handler's transaction, third-party call, later write fails, claim
  rolls back, the 3PL ships twice. The call to a third party is not rolled back by anything. →
  `TX-11` gains "keyed by the message id where the third party takes a key", or this is the
  messaging group's.
- `TX-12`: billing's open host service offers `findInvoices(where: SQL)`; shop queries rows
  "through the open host service". → a sentence on what a driving port is (names the question, in
  the published language) in `SYS-1` or the glossary, not in `TX-12`.
- `TX-17`: shop publishes a `ReserveStock` command shaped for fulfillment's use case, naming no
  system. A process manager (glossary: Orchestration) sends exactly such commands. `TX-17` as
  written forbids orchestration. → decide with the saga gap, in the messaging group.
- `SYS-11` (SHOULD): an anti-corruption layer that maps PaymentIntent onto Payment one to one is
  one in name only. No Statement wording found; a Why sentence.

Covered by another rule, example to relabel: `ASM-5` self-registering readers (`ASM-2`), `SYS-9`
wildcard export path (`SYS-1`), `SYS-8` repository writing the whole document (`TX-3`), `SVC-5`
getter dependency reading request context (`ASM-3`).

### Wording defects, not contradictions

- `TX-5`, `TX-11`: "It" is the handler, a driving adapter, but `DRV-1` and `SVC-2` put the
  deduplication and the third-party call into the service; "handle once" and "make the call" mean
  cause, not execute. `TX-8` "in a transaction of its own" reads as if the handler opens it,
  against `TX-1`.
- `ASM-4`, `DRV-3`: two ok examples (`sys-1-ok-shop-hooks-via-builder.md`,
  `sys-11-ok-payload-terms-stop-in-shop-payload-module.md`) have closures that shop's builder
  constructed read the courier. Either the examples are wrong, the shape being hooks as
  module-level functions Payload finds, or "a driving adapter that assembly does not construct"
  is the wrong cut.
- `ASM-6` Why: "the shape two systems both need has a home in each system's domain, or in the
  published language of the upstream" is a ruling against a shared kernel. Shared kernel has no
  glossary term and no slot in `DOM-1`'s list; `asm-6-ok` places `Money` and `Sku` in a
  `@teeladen/kernel` package by leaning on "a library that computes from its arguments".
- `SYS-7` "keeps a copy" and `DOM-4` "a value copied": one word, two meanings, live copy and
  snapshot.
- Glossary *Published language* omits driving port types; `SYS-1` and `SYS-10` put them on the
  same export path; whether `DOM-1` lets a conformist domain import an upstream's driving port
  type is unresolved.
- `TX-7` with `SYS-2` and `DOM-3` freezes every domain schema a published message re-uses. A
  consequence nobody stated.
- `SVC-4` "writes a record" against glossary *Repository* "loads, saves, finds": the outbox port
  and a handled-ids port are write-only; whether they are repositories is undecided.
- `TST-9` SHOULD own fake and `SYS-1` listing an exported fake pull apart; the Why says when the
  shared one fits, the Statement does not.
- `ASM-8` obliges assembly; in a test the test fills the courier and counts as that process's
  assembly by inference.

### Example defects

- `tx-3-ok-order-confirmation-mail-through-outbox.md` calls `randomUUID()` in a domain module
  (`DOM-1`).
- MAY rules have no breach of their own; `asm-7-breach-*`, `tx-13-breach-*`, `tx-15-breach-*`
  list the MAY under `breaches`. Decide the convention: a "breach" of a MAY is listed under the
  rule that governs once the MAY's Scope fails.

## Decision

—

## Consequences

—
