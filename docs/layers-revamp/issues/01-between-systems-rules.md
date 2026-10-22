# 01 — Rules between systems made explicit

**Status:** open

## Context

The glossary groups relay, outbox, message, handler, open host service and published language
under "Between systems". The general rules on them are spread over `ASM-5` (relay), `TX-4` to
`TX-8` (outbox, message, handler) and `SYS-1`, `SYS-2` (exports, published language), and were
extracted rule by rule from pass 1 without looking at the group as a whole.

Decided while revising TX in the session that opened this issue, not yet applied:

- The relay delivers each message at least once, until its handler reports it handled. No
  general rule states this; `TX-8`'s Why and pass-1 `DRV-2` assume it. `ASM-5` is the place, and
  "what marks a message as delivered" there becomes "as handled".
- Delivery order is the codebase's (`ASM-5`), so a handler assumes none. `TX-5` cites that.
- A message about something the receiving system has not recorded yet is not handled now; the
  relay delivers it again. How the handler says "not yet" — failing, asking for a delay — is the
  codebase's. No rule prescribes throwing.
- The aggregate version on a message is optional, an *Allowed*: it lets a handler ignore a
  message staler than what it holds. It is not how an early arrival is told from a repeat.
- Proposed `TX-5` wording: "A message carries an id, and a handler handles each id once.
  Messages arrive in no guaranteed order (ASM-5), so a message about something the receiving
  system has not recorded yet is not handled now; the relay delivers it again (ASM-5)."
  Provenance: at-least-once with consumer de-duplication, Vernon ch. 8, Khononov ch. 9.

## Problem

- `TX-5` as committed requires the aggregate version and its Why describes gap detection
  (version 5 arrives, 3 is held, so 4 is missing). That contradicts `TX-8` (a receiving system
  handles a subset of messages) and `SYS-2` (private messages): gaps are normal, so a handler
  cannot wait on one. The rule is wrong as written.
- The group has no section of its own in `general-rules.md`. Whether it gets one, mirroring the
  glossary's grouping, or stays split over Assembly, Transactions and Other systems, is open.
- Facts about the relay (at-least-once, redelivery, order, routing) sit under Assembly because
  pass 1 put them with "the relay is common library". They are rules about communication, not
  about wiring.
- The relay knows the systems in its process (`ASM-5`), handlers decide what they handle (`TX-8`),
  the writer does not know its readers (`TX-8` Why). Who routes, and on what, has no rule beyond
  "the codebase's".

## Decision

—

## Consequences

—
