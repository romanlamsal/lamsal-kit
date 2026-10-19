# Anti-corruption layer on the way in

**Status:** closed (c30b656)

**Kind:** real gap · **Touches:** Other systems (the
anti-corruption-layer bullet); The layers (controllers row); question 8

## Context

In `domain.md`, Stripe posts `payment_intent.succeeded` to payment's webhook; the 3PL posts
shipment updates to fulfillment's; Payload hooks hand shop a `req.user` from Payload's auth.

## Problem

The anti-corruption layer is defined only on the way out: "This system's domain declares a driven
port in its own terms; an adapter in infrastructure implements it". Calls from a foreign system
arrive in its terms. An agent passes the Stripe event into the service, and question 8 then
fires ("one of the other system's terms in this domain or a service") with no place to put the
fix. It should translate in the driving adapter that receives the call.

## Resolution

Append to the anti-corruption-layer bullet:

> On the way in, the driving adapter that receives the other system's call translates it, as its
> validator.

Sweep concern: the controllers row may import "services, domain, session infrastructure". A
webhook verifies Stripe's signature and reads Stripe's payload shape. Check whether signature
verification counts as resolving the caller (session infrastructure) and whether the foreign
payload's schema needs naming in that column. Settle it in this ticket, or split a new ticket.

## Grounding

- Cockburn, *Hexagonal Architecture*: on the driving side "a technology-specific adapter converts
  it into a usable procedure call or message"; "The application is blissfully ignorant of the
  nature of the input device." *(verified,
  https://alistair.cockburn.us/hexagonal-architecture/)*
- Vernon, *IDDD* ch. 13: message listeners in the port-adapter layer read the other context's
  notifications through a reader over its published language and call the application service
  with this context's terms *(from memory)*.
- Evans, *DDD* ch. 14 (final manuscript, April 2003): "Internally the layer translates in both
  directions as necessary between the two models" (p. 258); "An ANTICORRUPTION LAYER can be
  bi-directional, defining SERVICES on both interfaces with their own ADAPTERS, potentially using
  the same translators with symmetrical translations" (p. 259); a translator "belongs with the
  adaptor(s) it serves" (p. 258); placement is "implementation and deployment decisions" (p. 259)
  *(verified)*.

## Done when

The clause passes the four tests; the controllers row and question 8 agree with it; presented
for approval.

## Decision

**An anti-corruption layer covers the calls the other system starts.** It is chosen because the
other model is upstream and foreign, not because of who calls. Stripe calls payment's webhook; it
is still Stripe's model. The driving adapter that receives the call translates it into this
system's terms before it calls a service, as Evans's bi-directional layer and Cockburn's driving
adapter both have it. The clause names a webhook, a product's hook and a message; a message from a
system behind the layer is ticket 09's tolerant reader. A conformist caller needs nothing: the
services row already lets a service use the open host service of a system it conforms to.

**The foreign schema lives in the adapter or beside the outbound one, never in the domain.** "A
schema is a rule" pulls Stripe's schema into the domain, which is question 8's fault. Evans lets
both directions share translators and calls placement an implementation decision, so either the
driving adapter holds the schema as its validator, or infrastructure holds a translator the
outbound adapter also uses. The controllers row's import column follows: "infrastructure that
resolves or translates its caller" replaces "session infrastructure".

**A controller unpacks everything its driving port needs.** Resolving the caller includes a
signature or a key, not only a session: a signature over the raw body is the input device's
detail, which Cockburn keeps out of the application. Terms names the cases in parentheses. "Calls
into one thing" stays without "exactly": a controller also calls specifications and, now,
caller-resolving or translating infrastructure; acting through one service is already bounded in
the driving-adapter paragraph.

Question 8 and the infrastructure row stay: question 8's tell already catches a foreign term in a
service, and the infrastructure row already "translates between this system's ports and the other
system". Tests need nothing: a driving adapter's translation runs in the default suite (ticket
17), and a shared translator is a mapping function. The spec's controllers-row split is not needed.

**Considered options**

- Translation only in the driving adapter: rules out Evans's shared translator.
- Translation only in infrastructure: a controller parsing a payload it alone receives gains an
  extra module for nothing.
- "Calls into exactly one thing": contradicts specifications and the translator.
- A second snippet under question 8: the inbound clause already places the fix.
