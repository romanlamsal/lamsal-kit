# 01 — Rules between systems made explicit

**Status:** closed

## Context

The glossary groups relay, outbox, message, handler, open host service and published language
under "Between systems". The general rules on them are spread over `ASM-5` (relay), `TX-4` to
`TX-8` (outbox, message, handler) and `SYS-1`, `SYS-2` (exports, published language), and were
extracted rule by rule from pass 1 without looking at the group as a whole.

Decided and applied while revising TX in the session that opened this issue:

- `ASM-5` states that the relay delivers each message at least once, until its handler reports
  it handled; "marks a message as delivered" became "as handled".
- `TX-5` was rewritten: id, each id handled once, no guaranteed order (`ASM-5`), an early arrival
  is not handled now and the relay delivers it again. How the handler says "not yet" — failing,
  asking for a delay — is the codebase's. The aggregate version became an *Allowed* for ignoring
  stale messages. The earlier version required the aggregate version and described gap detection,
  which contradicted `TX-8` and `SYS-2`: a handler sees a subset of messages, so gaps are normal.

## Problem

- The group has no section of its own in `general-rules.md`. Whether it gets one, mirroring the
  glossary's grouping, or stays split over Assembly, Transactions and Other systems, is open.
- Facts about the relay (at-least-once, redelivery, order, routing) sit under Assembly because
  pass 1 put them with "the relay is common library". They are rules about communication, not
  about wiring.
- The relay knows the systems in its process (`ASM-5`), handlers decide what they handle (`TX-8`),
  the writer does not know its readers (`TX-8` Why). Who routes, and on what, has no rule beyond
  "the codebase's".

## Decision

- `general-rules.md` gets `## Between systems`, mirroring the glossary. `TX-5`, `TX-7`, `TX-8` move
  there as `MSG-3`, `MSG-4`, `MSG-5`; `ASM-5` retires.
- Relay and bus are told apart, after Khononov (ch. 9): the relay is handed outbox readers and
  publishes to the bus, marking a message *relayed* (`MSG-1`); the bus is handed the handlers and
  delivers at least once until handled (`MSG-2`). Glossary gets *Bus*, *Relay* reworded, relay no
  longer "every system's" outbox, builders return "outbox readers".
- Routing is the receiver's (`MSG-5` *Allowed*: switch on receipt or declared types); no rule.
- Private messages are withheld by the bus (`MSG-6`); how it tells is the codebase's.
- Commands get no rule. A command's type is in the published language of the system that handles
  it; glossary *Upstream*/*Downstream* qualified. Under an anti-corruption layer a command is a
  private message through the translating driven adapter (`SYS-5` *Allowed*).
- `MSG-7` names the caller of a third party and breaks `TX-3` step 1's circle.
- `MSG-3` dedups in the receiving system's use case, not the handler (`DRV-1`).
- Dead letter is an *Allowed* on `MSG-2` only; the relay is strict.
- `TX-3` gains an *Allowed* for a synchronous call to an open host service after commit.
- `SYS-7` reconciles copies, commands sent and third parties called; not events written.
- `SYS-1`/`SYS-2`: driving port interfaces are exported beside the published language, not in it.
- `DVN-1` retired: restated the glossary and `DOM-5`, and contradicted common-library and
  upstream ports.

## Consequences

- Saga, choreography, orchestration stay glossary terms with no general rule; the glossary's split
  (who holds the sequence) differs from Khononov's saga/process manager split (by shape). Open for
  a later issue.
- Reviews of the result found pre-existing contradictions outside this group, chiefly `SYS-1`
  "a downstream's system builder to call" vs `ASM-2`, `TX-1` vs `TX-6` for one aggregate and one
  message, `SYS-3` vs the anti-corruption layer, and hooks having no general rule since `PRD-*`
  retired. Next issue.
- Gaps left on purpose: where handled ids live, the outbox reader's contract, broker topology,
  how a service says "not yet", third-party idempotency on redelivery.
