# 13 — Why to Scope or Statement

**Status:** open

## Context

The distilled output keeps of a rule its Scope, Statement and Examples. The README has a Why
contain no ruling: a Why that rules is a Statement in hiding. The full review (spec 02) ran the
readers once with the Whys and Relies-on lines and once without, and where the two sets differ, a
ruling lives in a Why. Order: `specs/02-review-findings.md`, step 4.

Settled when it was opened:

- A move, not a copy: the ruling sentence leaves the Why for the Scope, where it narrows the
  situation, or the Statement; the Why keeps the reason. One ruling per rule: a second ruling
  found in a Why is a new rule.
- The test for a candidate is the distilled reader's: could it refuse the breach, or build the
  situation, from Scope and Statement alone.
- Every Relies-on line naming a changed rule is read in the same issue (README, Working here 4).

## Problem

### Tentative operations, TX-3 and TX-22

TX-3's Why: "A tentative operation changes nothing (glossary), so asking for one falls outside
the Scope, from any system; confirming it does not." TX-22's Why: "A request designed as a
tentative operation changes nothing (glossary) and falls outside the Scope". The distilled
Implementer, reading the Scopes, could not comply twice: payment cannot create the PaymentIntent
through its outbox and return the `client_secret` in the same call, and shop's checkout cannot
call payment inside TX-3. The raw readers got through on the Why. The Scopes carry it.

TX-22's Why also rules: "Where the owner takes no key, a repeat stays possible, which a business
rule has to allow". The sentence is this issue's; what to rule is issue 15's.

### The one MAY, ASM-7

The README has a MAY's Relies on name the rule it excepts; the distiller drops Relies on, and its
preamble says only "a permission where another rule would forbid". The distilled Contradiction
reader therefore read ASM-7 as excepting DOM-1 and SYS-14 too, under which
`sys-14-breach-money-imports-common-logger` is no breach. The raw Contradiction reader read it as
permitting the import and not the call: a service recording spans through no port breaches SVC-7
where the tracer's export is Outside. Decide what ASM-7 excepts and how far it reaches, and have
the Statement say it; or have the distiller keep a MAY's Relies on, decided here as well.

### Rules whose purpose Scope and Statement do not tell

The distilled Adversarial guessed at: every TST rule (issue 12, a property on tests), SVC-1,
ASM-1, ASM-10, ASM-5, ASM-6, DRV-1, DRV-6, SYS-10, TX-33. For each, the Scope says what it
protects, or the Statement is sharpened until it refuses the harm.

### Breaches the raw Adversarial found and the distilled could not

Each satisfies the Statement; the harm was visible with the Why only. For each: does Scope and
Statement refuse it; if not, the ruling moves.

- SVC-6: Drizzle's transaction type, through the common library, in every port signature (issue
  14 once the list is a reach).
- SVC-4: a repository method writes a part of the aggregate, no version.
- DRV-1: an acting call, then a failing answering call.
- DRV-6: a courier read memoized on first run.
- DRV-7: a conflict committed as a refusal and acknowledged.
- ASM-3: the domain reads `TZ`.
- ASM-5: the relay lists outbox tables by name.
- TX-2: a write to a second store.
- TX-25: a port takes `Database`; a transaction is one.
- TX-22: book the 3PL and mark the reservation in one attempt.
- TX-31: a resent message with a new id; the 3PL books twice.
- TX-20, TX-21: an in-memory bus.
- TX-33: billing subscribes to payment's private message; outside the Scope, the harm happens.
- SYS-2: a generator copies the domain's enum, no import.
- TST-5: `pushSchema` from the adapter's tables.
- TST-6: the contract suite omits the stale save.

### Elsewhere

P5's and P1's Whys: issue 12. The import lists: issue 14.

## Decision

—

## Consequences

—
