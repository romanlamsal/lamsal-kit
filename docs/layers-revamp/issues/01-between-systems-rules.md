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
- From issue 11: a downstream system acts on what an upstream's acting use case returns, where the
  upstream also published a message for that consequence; the consequence happens twice, once
  past relay and bus. Inside a system, `DRV-1` and `DRV-8` leave a driving adapter nothing to do
  with the result but hand it to its caller.

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

Moved to issue 07 and decided there: a message that fails for good stays kept, parked in a
dead-letter queue (`TX-21`); what happens when an answer or a confirmation does not come is a
business rule's (`TX-30`), which also ends a tentative operation left open; the idempotency key is
one the message carries (`TX-31`), so it needs no id kept across repeats; a hook call is a delivered
message (`TX-5`'s Why). The saga gap's refusal and late payment stay here. From issue 06, changed
here under the glossary's tier rules: whose published language holds a command, with Upstream and
downstream; Message, Saga, Handler, Bus; Reconciliation. Order: `specs/01-work-order.md`, step 8.

Worked as step 8. No group file and no section of its own: every ruling holds for any system that
sends or handles messages (issue 07's reasoning). New rules go beside their kin in Transactions and
Other systems; ids are labels.

- **Glossary.** *Message*: an id, the same on every delivery; no receiver can refuse an event; a
  command goes to the one system that offers it, which may refuse. *Published language*: the events
  it publishes and the commands it takes from other systems: a command is the receiver's (Khononov
  p. 235, NServiceBus "logical owner"). *Upstream* and *Downstream* follow: the sender of a command
  is downstream. Saga, Handler, Bus unchanged; Reconciliation kept, `TX-24` and `TX-30` use it.
- **Commands.** `SYS-13`: a command to another system of this codebase is one the receiver's
  published language declares. `TX-33`: only the declaring system's handler subscribes to it.
  Routing to one receiver follows: the receiver's assembly subscribes, the relay and bus import
  nothing (`ASM-5`); how the bus finds handlers is the stack document's (Assumptions). The sender
  imports the command through the receiver's export path (`SYS-9`); a conformist's service writes
  it, an anti-corruption layer's driven adapter does.
- **The refusal coming back.** `TX-34`: a use case refusing another system's command publishes an
  event telling of it, and succeeds. Throwing loops through redelivery into the dead-letter queue.
  Refusals only: a command's success may come late, through an external system.
- **The saga gap.** `TX-35`: an event that tells a system its part cannot go on as it stands, a
  refusal or a payment after the cancel, gets a business rule's decision. Choreography or
  orchestration is the repository's (Assumptions); `gap-checkout-saga-sequence-holder` becomes a
  `SYS-13` ok example.
- **Trace context across the bus.** No rule: telemetry, so `ASM-3` and `ASM-7` let the outbox
  adapter read it and the envelope carry it.
- **Issue 09's gaps.** The id kept across repeats: the glossary's Message. The order on overriding
  messages: `TX-32`, a version, rising with each change; `TX-19` relies on it. Imports of a
  published language and a shared kernel: `SYS-14`, a closed list; `DOM-1` relies on it. The open
  host service kept compatible: `TX-7`'s Scope widens to a port called from another process;
  `SYS-2`'s line follows.
- **Issue 11's item**, a downstream acting on an acting use case's result: no rule. `TX-3` leaves no
  acting call into another system of this codebase; an external system's answer recorded under
  `TX-22` and told again by its hook is `TX-5`'s repeat.
- **Swept.** `TX-12` reads the owner's published events, not messages; `TX-17`'s Why puts commands
  outside its Scope.
- **Fixture.** Refunds and the disputed charge (payment), credit notes and the dunning stage
  (billing), pay-by-invoice refused in dunning (shop), saga step 7, a payment after the cancel.

## Consequences

- New rules, each with a breach and an ok example: `TX-32`, `TX-33`, `TX-34`, `TX-35`, `SYS-13`,
  `SYS-14`.
- Changed: `TX-7` Scope and Statement, `TX-12` Statement, `TX-19` Relies on and Why, `DOM-1` and
  `SYS-2` Relies on, `TX-17` Why, the Assumptions' Not covered.
- Examples relabeled: `tx-17-breach-published-command-named-for-receiver` to
  `sys-13-breach-shop-declares-reserve-stock`; `gap-checkout-saga-sequence-holder` to
  `sys-13-ok-checkout-process-sends-receivers-commands`. New:
  `asm-3-ok-trace-context-crosses-bus-in-envelope`.
- To issue 08: see its Problem.

## Review

A review after closing changed, with no new issue:

- `TX-33`'s Scope is a published command. A system may tell itself "do this" (glossary: Message), a
  private command, which no published language declares, so no handler could comply. Khononov p. 149
  issues commands to the saga's own aggregate through the outbox. Issue 08's lead on a private
  command goes.
- `TX-34`'s Scope is a command from another system of this codebase. A hook call is a delivered
  message (`TX-5`'s Why), and an external system asking by hook, Stripe Issuing's authorization
  request, takes the refusal in the hook's answer (`TX-28`).
- `TX-26` writes a replica from the owner's events and what it returns, not its replies: a command's
  outcome comes back as the receiver's event (`TX-34`), and the glossary's Message knows no reply.
- `TX-17`'s Why loses its sentence on commands: its Scope says event, and the rest restated the
  glossary and `SYS-13`. `SYS-14`'s Why says why `DOM-1`'s published language of an upstream stays
  off its list. `TX-12`'s line on `TX-7` names the open host service, as `SYS-2`'s does.
- Examples: `sys-13-breach-shop-declares-reserve-stock` breaches `TX-33` too and no longer claims
  `TX-17`, whose Scope is events; `tx-32-breach-dunning-stage-changed-without-version` breaches
  `TX-19` too; `asm-3-ok-trace-context-crosses-bus-in-envelope` reads the trace context through the
  common library's tracer, `@opentelemetry/api` being on no line of `DVN-4`;
  `sys-13-ok-checkout-process-sends-receivers-commands` loses an unused import.
- Sources checked: NServiceBus throws on subscribing to a command, so `TX-33` cites "Should be sent
  to the logical owner" and MS's single receiver. Richardson's outcome event answers an event, not a
  command; `TX-34` cites Khononov p. 148, where `PublishingConfirmed` and `PublishingRejected`
  answer the saga's command. Richardson names compensation only; `TX-35` adds Khononov p. 151 and
  Vernon EAD II p. 8–9. `SYS-13`'s saga commands are p. 148–150. No source lists what a shared
  kernel imports: `SYS-14` follows Khononov p. 51 and Garrido §3, and departs from Evans p. 251,
  whose kernel shares code and database design.
