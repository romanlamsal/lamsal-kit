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

## Consequences

—
