# Messages missing from the published language

**Status:** closed (dedd87d)

**Kind:** real gap · **Touches:** Other systems (the open host
service definition and its snippet); Transactions (the outbox bullets); review checklist
(questions 8 and 9)

## Context

In `domain.md`, shop publishes `OrderPlaced` and `OrderPaid`; billing and fulfillment react.
Under orchestration, a process manager would send commands instead, asking another system to act.

## Problem

Transactions, rule 2 says "the owner publishes" and rule 1 sends messages through the outbox, but
the open host service exports only driving ports, their published language (what those ports
take, return and raise), and a builder. A message is neither a port's input nor its output. An
agent defines `OrderPaid`'s schema in each consumer, or has consumers import shop's internals.
It should export the schema with shop's published language.

## Resolution

Extend the open host service definition:

> **A system offers an open host service: its driving ports, and their *published language* — the
> schemas, types and errors those ports take, return and raise, and the messages the system
> publishes.**

The export list then needs no new entry: messages ride in "the published language".

Whose language a command belongs to follows already: the receiver handles it through a driving
adapter calling one service, so a command such as `ReserveStock` is the receiver's published
language and the sender conforms to it. Run the derivation test on that; add a clause only if it fails.

## Grounding

- Evans, *DDD* ch. 14: a published language is "a well-documented shared language that can
  express the necessary domain information as a common medium of communication", not limited to
  calls *(definition as summarized on Wikipedia; book wording from memory)*.
- Vernon, *IDDD* ch. 13: notifications are published in a published language (media types)
  *(from memory)*.
- Khononov, *Learning DDD* ch. 15 separates public events from private ones *(from memory; the
  chapter's table of contents confirms "Types of Events" and "Designing Event-Driven
  Integration", not the passage itself)*.

## Done when

The clause passes the four tests; the sweep finds no sentence that limits the published language
to port input and output (Terms, Other systems, the linter sentence "reach a system only
through these exports", question 8); presented for approval.

## Decision

**Messages a system publishes are its published language.** The open host service is "its
driving ports and its *published language* — the schemas, types and errors those ports take,
return and raise, and the messages the system publishes, if any". A system need not publish. The
export list needs no new entry: by default a message's schema is the domain's own, so it rides in
the entry that loads only the domain, and the snippet shows one (`PriceListChanged`). How many
entries a system exports stays the codebase's. This follows Evans: a published language is a
medium of communication, not limited to calls.

*Publishes* means public, for other systems to consume. A message only its own system handles is
private, in Khononov's split of private and public events, and stays inside. Shop's
order-confirmation mail is one: rule 1 sends it through the outbox (ticket 12), and shop's own
handler calls the mailer, since the mail provider does not read the relay. The outbox fixes a
commit and a side effect not being atomic, whoever reads the message.

A command needs no clause: it carries what the receiver's driving port takes, so it is the
receiver's published language and the sender conforms.

**A message outlives the code that wrote it.** It waits in the outbox across a deploy, and a
receiver in another process, or an old instance in a rolling deploy, may run older code than the
sender. The relay bullet now states the property: a message's schema stays backward and forward
compatible. The mechanism (expand and contract, versions) is the codebase's. It sits in the outbox
bullets, not in the published language, because private messages break the same way.

**Two checklist tells.** Question 8 gains "a message schema copied field for field from the
system that publishes it": a translation that changes nothing. "Field for field" keeps a reader
that takes only the fields it needs, in its own terms, out of the fault (Vernon's notification
reader, Fowler's tolerant reader, from his bliki, not *PoEAA*); that is translation, ticket 10. A new question 9 asks whether a
message schema change breaks a message in flight. The property follows from the relay bullet, but
not the tell: under the default, renaming a field of `OrderPaid` is a domain edit, the type
checker passes, and the failure shows at runtime in another system.

**Considered options**

- Messages as a separate export bullet: more visible, but splits messages from the language.
- The same compatibility sentence in the published language: misses private messages.
- An imperative ("change a message's schema so that …"): `layers.md` states properties.
- Leaving the checklist alone: an agent editing the domain never reads the outbox bullets.
- A fix line under question 9: names a mechanism.

**Grounding added**

- Khononov, *Learning DDD*: the outbox publishes an aggregate's domain events reliably, state and
  outbox row in one transaction; private events stay in the bounded context, public ones are
  chosen for others *(secondary summaries: https://www.web-developpeur.com/en/library/learning-domain-driven-design/,
  https://eda-visuals.boyney.io/visuals/internal-vs-external-events; book wording unchecked)*.
- Vernon, *IDDD* ch. 13: versioned media types for notifications; consumers read them without
  the publisher's classes *(from memory)*.
- Fallback: Richardson, *Microservices Patterns* ch. 3: message schemas evolve compatibly
  *(from memory)*.
