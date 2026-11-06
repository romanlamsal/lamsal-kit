# 13 — Why to Scope or Statement

**Status:** closed

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
Answered by issue 12: TX-36, a MAY to ask for a tentative operation by a call; both Whys lost the
sentence.

TX-22's Why also rules: "Where the owner takes no key, a repeat stays possible, which a business
rule has to allow". The sentence is this issue's; what to rule is issue 15's.

### The one MAY, ASM-7

The README has a MAY's Relies on name the rule it excepts; the distiller drops Relies on, and its
preamble says only "a permission where another rule would forbid". The distilled Contradiction
reader therefore read ASM-7 as excepting DOM-1 and SYS-14 too, under which
`sys-14-breach-money-imports-common-logger` is no breach. The raw Contradiction reader read it as
permitting the import and not the call: a service recording spans through no port breaches SVC-7
where the tracer's export is Outside. Decide what ASM-7 excepts and how far it reaches, and have
the Statement say it; or have the distiller keep a MAY's Relies on, decided here as well. Since
issue 12, P5 reads "only through ports assembly hands it": a ready-made logger stands against the
property too, not only against SVC-7.

### Rules whose purpose Scope and Statement do not tell

The distilled Adversarial guessed at: every TST rule (issue 12, a property on tests), SVC-1,
ASM-1, ASM-10, ASM-5, ASM-6, DRV-1, DRV-6, SYS-10, TX-33. For each, the Scope says what it
protects, or the Statement is sharpened until it refuses the harm. Issue 12 gave tests no
property: the TST rules are preference, and their Scopes need not name what they protect.

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

### Whys that rule about a repository's ADRs

TX-24's and TX-29's Whys say what "A deviation's ADR names". The README's Strength no longer
speaks of ADRs: how a repository deviates is its own. The sentences go; what they protected moves
as above where a Scope or Statement needs it.

### Elsewhere

P5's and P1's Whys: issue 12. Lists, the import lists and the Scopes that illustrate after a
colon among them: issue 14.

## Decision

The method, settled with the requester before any edit:

- The list above, plus a sweep of every Why for sentences that rule, with or without a modal verb.
  Each meets the distilled reader's test: a sentence whose breach Scope and Statement already
  refuse stays a reason; one only the Why closes moves.
- Where it lands. Scope, where it changes where a rule holds; the Statement of the same rule, where
  subject and modal are the same; a new rule, where either differs, or where a Scope or Statement
  would branch through ORs that widen it much. Which rule receives the fix is free, so long as no
  breach stays closed by a Why alone.
- Statements explicit, not short: what they rule against and the condition the harm comes through.
  One modal, no instances.
- The Why keeps the reason and the harm, citing the rule that now carries the ruling. Sentences on a
  repository's ADRs go.
- Where issue 14 touches the same place, issue 14 decides. Gaps no Why closes are issue 15's.

By rule:

- **ASM-7.** Scope: a service or an adapter uses plumbing of the common library whose output
  changes neither how a use case acts nor what it answers; no list. Statement: it MAY import a
  ready-made instance instead of receiving one from its caller, and call it through no port of its
  system. What it excepts, ASM-2's receiving and SVC-7's port, is in the Statement without ids; the
  domain, a shared kernel and a published language are outside the Scope, so DOM-1 and SYS-14
  stand. The distiller unchanged. "Plumbing" is common language, as the glossary's Common library
  uses it.
- **P5**, the world tier: *Except:* plumbing of the common library reached by a service or an
  adapter, whose output changes neither how a use case acts nor what it answers. Bound to services
  and adapters, so DOM-1's and SYS-14's refusals keep P5 behind them. Read against every rule: no
  Scope or Statement changes beyond ASM-7's. Settles issue 12's Consequences line on ASM-7 against
  P5.
- **Purpose untold.** SVC-1, ASM-1, ASM-10, ASM-6, DRV-1, SYS-10: their Statements refuse every
  breach their Whys describe; the purpose stays in the Why. TST rules: preference (issue 12). DRV-6,
  ASM-5, TX-33: sharpened below.
- **DRV-6.** It MUST read it each time it runs, not when its module loads. The memoized read
  breaches.
- **ASM-5.** Scope: a module of the common library reaches a system's code or data. Statement: it
  MUST reach it through what assembly hands it, not by importing, naming or addressing it itself.
  The relay listing outbox tables by name breaches.
- **TX-33** stays on published commands. **TX-39**, new: a handler subscribed to a private message
  MUST be a handler of the system that wrote it. Split rather than one Scope over both, which would
  branch on the kind of message.
- **SVC-4.** It MUST write the record by saving the whole aggregate through its repository, not by
  writing a part. The repository's `addLine` breaches.
- **DRV-1.** No change: since issue 12 an answering use case changes nothing, so the call that has
  payment create a PaymentIntent is an acting call and breaches by the letter.
- **DRV-7.** The Why's "a hook acknowledges by its answer" into the Statement: no acknowledgement,
  to the bus or by the answer to the external system that delivered the message, unless the use case
  has succeeded.
- **TX-38**, new, from TX-34's Why: a use case called for a delivered message that cannot complete,
  stopped by no business rule of its system, MUST fail, committing nothing, and not commit the stop
  as an outcome. The conflict committed as a refusal breaches. TX-34's Why cites it.
- **TX-34.** The Why's "the receiver's, in its published language, naming no sender" into the
  Statement.
- **TX-22.** TX-1's Why's "a write to a second store goes to a handler through the outbox" moves
  here. Scope: a use case decides a change the transaction it runs in does not commit, of something
  no other system of this codebase owns; a second store of this system and its data kept by an
  external system are in, the Scope's list is out. Statement: it MUST write a message asking for
  the change to its outbox, and not make it. "On behalf of its owner" goes from the Statement: the
  owner can be this system. The fulfillment stock mirrored into Payload breaches.
- **TX-37**, new, from TX-22's Why: a use case called for a message that asks for a change its
  transaction does not commit MUST make it without deciding again whether to. Book-and-mark in one
  attempt breaches. TX-22's Scope reading "decides" takes this use case out of it.
- **TX-25.** It MUST NOT take a transaction, nor anything else that reaches a store, whatever type
  it is declared as. The port taking `Database` breaches.
- **TX-31.** The key is the same on every message asking for that change, not only on every
  delivery of one message. The message id resent by a reconciliation breaches.
- **TX-21.** It keeps the message through any stop of a process. The in-memory bus breaches; TX-20
  unchanged.
- **SYS-2.** The modules MUST NOT import the domain, nor be generated from it. The generator
  breaches.
- **SYS-15**, new, from SYS-1's Why: an exported fake of the open host service MUST be on a path of
  its own that no code running in a process of the deployed application imports.
- **TST-5.** The test talks to the real thing, set up the way production sets it up, not to a double
  nor a real one the adapter's own definitions set up. `pushSchema` from the adapter's tables
  breaches.
- **TST-6.** The suite asserts each behavior of the fake a service's test relies on. The omitted
  stale save breaches.
- **ADRs.** TX-24's sentence goes; its Why keeps that other means hold the data still too. TX-29's
  goes; a deviation leaves the hook under TX-28 and TX-30. Nothing moves.
- **Sweep, reworded to reasons:** DOM-3 ("where everything that builds the record parses"), TX-1
  (an answering use case falls outside the Scope; "where the transaction is a required parameter").
  Other Why sentences that rule were checked and stay: their breaches Scope and Statement refuse.
- **Deferred.** SVC-6's Drizzle transaction type and ASM-3's domain reading `TZ`: issue 14, whose
  reach Statements refuse them. TX-22's "where the owner takes no key" sentence is gone; issue 15
  rules.
- **Relies on.** Lines naming a changed rule updated: TX-23 on SVC-4, ASM-8 on DRV-6, TX-36 on
  TX-22, TX-12 and SYS-10 on SYS-2, TST-4 on TST-5. TX-22's lines on TX-5 and TX-31 move to TX-37,
  TX-31's with "by default". New lines: SVC-4 on TX-23, TX-21 on TX-20, TX-22 on TX-37, TX-34 on
  TX-38.

## Consequences

- To issue 14: ASM-7's and TX-22's Scopes carry no list since this issue. SVC-6 and ASM-3 wait on
  its reach Statements.
- To issue 15: TX-22's "no key" sentence is gone; the gap stands. Raw Contradiction N8, TX-22's
  Scope holding for the handler's own use case: settled by TX-37. DRV-7's "succeeded" for a
  conflict: settled by TX-38; the word itself stays issue 15's.
- To issue 16: the Relies-on lines of TX-37, TX-38, TX-39 and SYS-15 are new; TX-22's TX-6 line
  still drops "it makes".
- To issue 19: TX-37, TX-38, TX-39 and SYS-15 have `*Examples:* —`. The raw Adversarial's breaches
  above are candidates for each sharpened rule. `asm-7-ok-logger-and-tracer-imported-ready-made`
  is read against the new Scope.
