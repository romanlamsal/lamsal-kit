# Fakes of another system's driving port

**Status:** ready

**Kind:** real gap · **Touches:** Tests (services, adapters, contract tests); Other systems (the
export list); When to leave it alone · **Related:** `16-relay-wiring.md` (the export list);
resolves `open-questions.md` C

## Context

In `domain.md`, shop's service receives billing's `BillingService` as a driven port and calls it
in-process; shop's default suite needs a fake of it. The Tests section predates systems, products
and the conformist / anti-corruption-layer split. Its intent: the default suite runs on fakes and
stays fast; integration tests target only this system's driven adapters.

## Problem

- "Adapters are integration-tested by design" covers driving adapters too, since controllers are
  adapters by Terms. An agent integration-tests every controller, webhook and hook.
- The contract suite's second run is "against the real adapter". Under conformist, shop owns no
  adapter for `BillingService`, so the run points nowhere: an agent skips it, or builds billing
  into the default suite.
- The export list is closed. An agent flags a fake billing exports as an import past the exports,
  or merges two consumers' fakes into one configurable fake for DRY.

## Resolution

Tests:

> **Test services and driving adapters against fakes.** Each receives ports, so a test hands it
> fakes and asserts what it *did*: …

> **Driven adapters are integration-tested by design.** A driven adapter's entire job is to talk
> to something external, …

Contract tests, after "against the real adapter":

> For another system's driving port, the receiving system writes the suite, whether the fake is
> its own or one the other system exports, and runs it the second time against that system's open
> host service.

Export list:

> - where it exports one, a fake of its driving ports, for other systems' tests, from an entry
>   production does not load;

When to leave it alone:

> - **Several systems each faking the same port can be correct.** By default, each system writes
>   its own fake. One fake that the providing system exports fits only where its consumers need
>   the same things of it; a fake that needs configuration per consumer has outgrown that.

## Grounding

- Cockburn, *Hexagonal Architecture*: a test adapter substitutes for a secondary actor
  (verified); ownership is not assigned.
- Fallback: Richardson, *Microservices Patterns* ch. 10: consumer-driven contract tests; the
  consumer writes what it relies on *(from memory)*.
- Not a listed source: Freeman & Pryce, *Growing Object-Oriented Software*, "only mock types you
  own" *(from memory)*; leans toward a provider's fake.

## Done when

The clauses pass the four tests; the sweep finds no sentence that sends driving adapters to
integration or leaves a conformist port's second run without a target; presented for approval.

## Decision

**The default suite covers the domain, services and driving adapters; integration covers this
system's driven adapters.** A driving adapter calls a driving port, and assembly hands it the
service, so a test hands it a fake service, as it hands a service fake driven ports. Only a
driven adapter exists to reach something external. Reworded, not added: it follows from Terms,
and "Adapters" hid it.

**The suite stays with the consumer, not with the fake.** C applies to conformist ports only;
behind an anti-corruption layer the port is the consumer's own. A conformed port's fake is the
consumer's own or one the provider exports; either way the consumer writes the contract suite,
runs it against that fake, and the second time against the provider's open host service. That
run is integration through the provider's adapters, by the existing definition, so no sentence
says so. The provider runs no suite on a fake it exports; each consumer's second run keeps it
honest for what that consumer relies on. The suite is not exported.

**Separate fakes can be correct; DRY is no reason to share.** By default each consumer writes its
own. A provider's exported fake fits while its consumers need the same things of it; once each
needs different ones, it grows configuration and arguments until it fits none. Any combination —
one or several consumers, own fakes or the exported one — is valid. The bullet says "can be
correct", not "is correct": separate fakes are not the goal either. The default is stated there,
once, not in Tests, whose sentence stays neutral.

"An entry production does not load" is coined.

**Considered options**

- Consumer only: a closed export list rules out a provider's fake that works.
- Provider always: required structure; drifts into configuration once consumers differ.
- The suite goes with the fake (the provider verifies its exported fake): the consumer's needs
  are what the suite asserts.
- Consumer-driven contracts run in the provider's pipeline: in-process, the consumer reaches the
  provider anyway.
- "Separate fakes are correct": reads as a goal; an agent splits a shared fake that works.
- The default left unsaid as derived: the bullet needs it to anchor the exception.
