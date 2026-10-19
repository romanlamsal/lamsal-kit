# Where the outbox's handler wiring lives

**Status:** ready

**Kind:** misleading wording · **Touches:** Transactions (the outbox bullets); Other systems (the
export list) · **Related:** `08-assembly-per-process.md`, `11-saga-state.md`; resolves
`open-questions.md` B

## Context

In `domain.md`, shop's outbox carries `OrderPaid` to billing, in the web process, and to
fulfillment, in its own worker process with its own assembly.

## Problem

The outbox bullet says "handing each receiver's handler to the relay is wired once, above the
systems" (ticket 11). Other systems allows a composition root for three reasons only — "until one
of these holds, a root is ceremony" — and systems exchanging messages is none of them. An agent
builds a composition root for messaging, or hands the receivers' handlers in shop's assembly, so
the sender learns its receivers. "Above the systems" cannot exist across processes anyway. It
should let whichever assembly runs the relay call each receiver's handler builder.

## Resolution

Outbox bullet:

> - The relay is common-library plumbing. The receiver decides which messages it handles.

Export list, the handler item:

> - where it handles messages, a function that takes configuration and builds its message handler,
>   for the assembly that hands it to the relay. Whether one function builds both is each
>   codebase's choice.

## Grounding

No source speaks to composition roots or relay wiring; assembly and the export list are this
document's constructs.

## Done when

Both clauses pass the four tests; the sweep finds no other sentence placing the wiring above the
systems; presented for approval.

## Decision

**The export list already places the wiring.** Its handler item is "for the assembly that hands it
to the relay", and a message handler is a driving adapter, which assembly hands what it needs.
"Wired once, above the systems" added nothing but a contradiction with the escalation reasons, so
it is deleted rather than reworded. Messaging creates no dependency between assemblies: the sender
never names its receivers, and the receiver's handler builder needs nothing of the sender's, so it
is no fourth escalation reason. "Once" goes too: a handler wired in two processes is harmless under
at-least-once delivery and idempotent handling.

The handler's assembly may differ from the one that builds the system's open host service: shop's
assembly builds billing's open host service, while billing's handler may run wherever the relay
does. Which process runs the relay, and how it finds an outbox, stay the codebase's; that is
mechanism.

**One builder or two is the codebase's choice, stated.** Two "a function" items read as two
required functions. Within one process, two independent builds duplicate whatever the system
holds that must exist once: a cache the handler invalidates stays stale in the copy shop reads.
A composition root does not help, since it still calls two builders. The clause allows one
function to build both; no "say which", since the assembly's code shows it.

**Considered options**

- "The assembly that builds the receiver hands its handler to the relay": ambiguous once the open
  host service and the handler are built by different assemblies.
- A fourth escalation reason for systems exchanging messages: messaging couples no assemblies.
- The double build left unsaid, ruled out in the spec: the two items still read as two required
  functions.
