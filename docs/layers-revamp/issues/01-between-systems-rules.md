# 01 — Rules between systems made explicit

**Status:** open

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

Closed once in `4db0dfb` (seven `MSG-*` rules, relay/bus split) and reverted in `3e4958c`: the
result added delivery semantics to a layering document and its carve-outs contradicted the
general tier. Kept from it: the glossary's *Bus* beside *Relay*. The rest stays in history for a
messaging document of its own. Reopened; to be reworked after the general tier has rule strengths
and examples.

The port of `general-rules.md` to the new shape left these out of the general tier, for the
messaging group to rule:

- at-least-once delivery and redelivery until handled, formerly in `ASM-5`;
- an early arrival, a message about something the receiver has not recorded yet, and how a
  handler says "not yet", formerly in `TX-5`; `TX-5` now rules idempotency alone;
- ordering, and routing by type versus every message to every handler;
- what assembly hands the relay and what it hands the bus, now that they are two terms.

`ASM-5` keeps one ruling: relay and bus import no system. `TX-17` rules that a publisher names no
handler.

Forwarded from issue 05, detail in its Decision. The general tier now rules delivery (`TX-20`,
`TX-21`, `DRV-7`), the early arrival and ordering (`TX-19`) and idempotency (`TX-5`); this group
may revise them. Left for it:

- the saga gap: who acts on a refusal or a failure, the payment arriving after the deadline
  cancelled the order;
- commands, `TX-17` ruling events only: every source names the receiver (Khononov p. 235, p. 149;
  NServiceBus "logical owner"). Open: the command's published language (issue 06), routing to one
  receiver while the bus delivers to subscribers and the relay imports no system (`ASM-5`), the
  sender importing the receiver's command (`SYS-9`), the refusal coming back. Fowler's
  passive-aggressive command, issue 04's `ReserveStock`, whose example stays under its old label:
  `tx-17-breach-published-command-named-for-receiver.md`;
- the fixture's request id and trace context crossing the bus, beside the relay and bus rules.

Forwarded from issue 09, detail in its Consequences:

- a message's id kept across repeats, which `TX-5` by ids and `TX-22`'s idempotency key need; a
  change to the glossary's Message;
- the order `TX-19`'s Why has the publisher put on messages that override each other, which no
  rule obliges;
- what the modules of a published language and of a shared kernel import: `DOM-1` admits both,
  `SYS-2` rules out the domain only, nothing bounds the shared kernel. Lead: import lists, like
  `DOM-1`'s;
- the open host service's schemas and errors kept compatible: `SYS-2` relies on `TX-7`, which
  covers messages.

Moved to issue 07, decided there with the external system items they pair with: recovery of a
message that fails for good, beside `TX-21`; NServiceBus's repeat and the idempotency key; a
tentative operation left open. From issue 06, changed here under the glossary's tier rules:
whose published language holds a command, with Upstream and downstream; Message, Saga, Handler,
Bus; Reconciliation. Order: `specs/01-work-order.md`, step 7.

## Consequences

—
