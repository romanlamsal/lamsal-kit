# Open questions

Decisions the sources do not settle. Each is the author's call: grill it (`/grilling`) before
drafting, then turn the answer into a ticket like the others. The recommendation is the
reviewer's, not a decision.

## A. A change at another system whose result the use case needs now

**Status:** closed (bef2a8d), resolved into `12-side-effects-through-outbox.md`

**Context.** In `domain.md`, checkout creates a Stripe PaymentIntent and must return its
`client_secret` in the same request.

**Question.** Transactions, rule 1 requires the outbox for any change to another system's data
(ticket 12 extends that to third parties). The outbox answers after the request is gone. What
does a use case do when it needs the other system's answer now?

**Options.**

1. Call the other system outside the transaction, with an idempotency key the use case owns,
   then record the result in a transaction. A failure between the two is repaired by the saga or
   by reconciliation.
2. Split it into two use cases: commit a pending order and an outbox message; the relay creates
   the PaymentIntent; the browser receives the secret asynchronously (poll or push).
3. An explicit exception to rule 1: a synchronous call is allowed when the caller needs its
   answer, and stays outside the transaction.

**Why unresolved.** All four sources treat cross-system change as asynchronous (outbox, saga) or
are silent (Cockburn). None addresses a synchronous answer from a side effect. Each option moves
cost: 1 and 3 add a failure window, 2 adds UX latency and moving parts.

**Recommendation.** 1, worded as the rule's exception, because the idempotency key makes the
retry safe and the saga already exists for the failure window.

**Blocks.** Ticket 12 (same sentence); check ticket 11 for a synchronous saga step.

## B. Where the outbox's handler wiring lives

**Status:** ready, resolved into `16-relay-wiring.md`

**Context.** In `domain.md`, shop's outbox carries `OrderPaid` to billing and fulfillment.

**Question.** The outbox bullet says "The receiver decides which messages it handles; handing each
receiver's handler to the relay is wired once, above the systems" (ticket 11). Other systems says
"Until one of these holds, a root is ceremony", and none of the three escalation reasons is
"systems exchange messages". Where are the handlers handed to the relay?

**Options.**

1. In the assembly that builds both systems: under the default, the consumer's. Reword "above the
   systems" to that.
2. A fourth escalation reason: systems exchanging messages get a composition root.

**Why unresolved.** The sources say nothing about composition roots or relay wiring; this is the
document's own construct. It trades the minimal-ceremony default against wiring in one place.
Option 1 gets awkward when the receiver is not built by the sender's assembly (fulfillment in
its own process).

**Recommendation.** 1, because it keeps the default and still names one place; the separate
process falls under "One module per process" (ticket 08).

## C. Who owns the fake of another system's driving port

**Status:** ready

**Context.** In `domain.md`, shop's service receives billing's `BillingService` as a driven
port; shop's default suite needs a fake of it.

**Question.** Does the consumer write the fake and its contract suite, or does the provider
export a fake?

**Options.**

1. The consumer writes both, per Tests ("one suite per driven port … run it twice"). The second
   run uses billing in-process. This follows from the current text; each consumer repeats the
   fake.
2. The provider exports a fake and its contract suite from a test-only entry: another item in
   Other systems' export list.

**Why unresolved.** Cockburn only says to substitute a test adapter for a secondary actor
(verified); the books do not assign ownership. It trades duplicated, drifting fakes against a
wider export surface. Also unsettled: is the second run an integration
test? Billing in-process is not an external dependency, but its own adapters may hit the
database.

**Recommendation.** 1 until a second consumer exists, then 2.

## D. A hook fires on this system's own write

**Status:** ready

**Context.** In `domain.md`, shop writes price through Payload's Local API, and Payload runs
shop's own `afterChange` hook for that write.

**Question.** Should `layers.md` say how a hook treats changes this system made through the
product?

**Options.**

1. A clause in the Products hooks bullet: a hook acts on changes the product's users made; this
   system's own writes were handled by the use case that made them.
2. Nothing: the mechanism (Payload's `context` flag, ORM hook guards) is per product, and belongs
   to the repository.

**Why unresolved.** No source speaks to it, and it sits on the edge of the generality test: it
holds for any product with hooks, ORM hooks or database triggers, but each detects the origin
differently.

**Recommendation.** 1, worded without a mechanism.
