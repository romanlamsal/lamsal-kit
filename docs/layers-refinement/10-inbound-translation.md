# Anti-corruption layer on the way in

**Status:** ready to draft · **Kind:** real gap · **Touches:** Other systems (the
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
- Evans, *DDD* ch. 14: the anti-corruption layer may translate in both directions *(from memory;
  a search found no primary text to confirm it)*.

## Done when

The clause passes the four tests; the controllers row and question 8 agree with it; presented
for approval.
