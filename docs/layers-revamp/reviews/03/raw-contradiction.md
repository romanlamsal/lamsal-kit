# Contradiction review, raw set

## Summary

- Pairs found: **0**. No fixture situation was found where two MUST/MUST NOT Statements both hold for
  the same code, neither Scope is narrower, no MAY lifts one, and every code meets one and breaches
  the other. Every candidate has compliant code, a narrower Scope, a MAY, or a Scope that the
  compliant code steps out of.
- Candidates rejected: **42** (c1–c42).
- Closest call: **c8, TX-37 × TX-34 (and SVC-2) on payment's handling of shop's `RefundPayment`.**
  If `RefundPayment` asks for the money to go back at Stripe, which payment's transaction does not
  commit, TX-37 forbids payment to decide by its business rules, so it may not apply "a disputed
  charge is not refunded". It may refuse only by breaching TX-37, and once refused TX-34 requires
  the refusal event. Both Statements are met only by code that never refuses, which drops the
  fixture's dispute rule. Or the message is read as asking for payment's own Refund record, as
  `tx-34-ok` does. The pair escapes because TX-34's Scope ("refuses it") is conditional, not because
  the rules agree. Runner-up: **c4, TX-1 × TX-25**. One Postgres is one store under the glossary,
  so the broad reading of "each call into its store" makes an in-process call to billing's open host
  service a call into shop's store. Answering use cases get around it.
- Main side results: under glossary *Reach* + *Port*, the closed lists of SVC-6 and DRV-8 forbid every
  call made through a port (N1). TX-37's "MUST make the change" cannot be met when the external
  system refuses (N3). Five examples marked `ok` breach TX-1 (they load outside the transaction),
  and two breach TX-28 (N16).

## Findings

None. Each pair that looked like one is listed under Candidates rejected with the code that meets
both Statements, or the Scope or MAY that resolves it. Examples that satisfy one rule and breach
another are defects, not contradictions, and are listed in N16.

## Candidates rejected

**c1. SVC-6 × TX-1 / SVC-4. Shop's place-order service.** Glossary *Reach* says a module reaches
"what running it reads or calls, however the code got hold of it". *Port* says "an interface, never
the code behind it". So `orders.save(order, tx)` reaches the Drizzle adapter, and through it
Postgres. Neither is on SVC-6's list, and SVC-4 forces the call. TX-1 forces open and commit on the
store. Resolved by the narrower Scope: every use case that writes reaches past the service layer, so
for this code TX-1's Scope ("a use case writes") and SVC-4's ("writes a record of an aggregate") lie
inside SVC-6's ("the service layer reaches past itself") and govern. Code that meets them:
`tx-1-ok-place-order-service-holds-transaction`. The cost is in N1.

**c2. SVC-6 × SVC-7. Shop's order-overview answering use case through `OrderOverviewQuery`.** The
service reaches the adapter and Postgres, which are not on SVC-6's list. For service code,
"a service reaches the outside" lies inside "the service layer reaches past itself", so SVC-7
governs here. Code: `svc-7-ok-order-overview-through-query-port`.

**c3. DRV-8 × SVC-7. The checkout route calls `shop.checkout`.** Running the route calls the service
behind the driving port, and the service is not on DRV-8's list ("a driving port", and a port is
never the code behind it). The service then reaches Postgres and Stripe, so the route reaches the
outside, and SVC-7's Scope, narrower for this code, governs: through a port of its system, which is
the driving port. Code: `asm-4-ok-route-handler-reads-courier`. Where nothing behind the call
reaches outside, no narrower rule mandates the call and DRV-8 alone forbids it (N1).

**c4. TX-1 × TX-25. Pay-by-invoice "not to a customer billing has put into dunning". The fixture's
"calls billing's open host service in-process while holding its own transaction".** Shop and billing
share one Postgres. Glossary *Store*: "Two clients are one store when one transaction can carry the
writes of both", so the two are one store. Broad reading: billing's read is "a call into its store",
so TX-1 wants shop's transaction handed to it, and TX-25 forbids billing's driving port to take one.
A replica is out where the business rule does not accept lag (TX-27). Code that meets TX-1, TX-25,
TX-27, DRV-1 and SVC-2:
```ts
// app/checkout/actions.ts — server action (driving adapter)
export async function checkoutAction(form: FormData) {
  const { dunningOf, checkout } = shopServices()                       // courier, read per run
  const input = checkoutInputSchema.parse(Object.fromEntries(form))
  const dunning = await dunningOf({ customerId: input.customerId })     // answering use case: shop's driven port -> billing's OHS, no transaction
  return checkout({ ...input, dunning })                                // the one acting call; shop's domain: mayPayByInvoice(dunning)
}
```
The read sits in an answering use case, so TX-1 is out of Scope there. The acting use case hands its
transaction to each of its own store calls. Billing's port takes none. SVC-2 is silent because
billing's data is not "what this system has stored". Narrow reading of TX-1 (picked, N6): billing's
OHS is no call into shop's store, and the call can sit inside checkout directly.

**c5. TX-1 × TX-25. Checkout needs payment's `client_secret` in the same request.** If payment
recorded the intent, the same broad-reading problem as c4 arises. Code: `tx-3-ok-checkout-requests-checkout-session`
with `tx-22-ok-payment-requests-checkout-session`. Payment writes nothing on the request, so no call
reaches the store. TX-30 for the session is met by a business rule that accepts an unpaid session
lapsing at the order's deadline.

**c6. TX-22 × TX-37. Fulfillment's use case for its private `BookShipment` calls the 3PL.** If
"decides a change" covers the use case that makes the call, TX-22 says "not make the change itself"
and TX-37 says "MUST make the change". "Decide" is undefined (N5). Read as "decide whether to make
it", code that complies with TX-37 decides nothing, so TX-22's Scope does not hold for it. Code:
c28.

**c7. TX-37 × TX-5. A redelivered `BookShipment` after the 3PL's key has expired.** TX-5 wants
idempotence. Skipping because "already booked" decides by the state of its records, which TX-37
forbids. Code that meets both:
```ts
// fulfillment/service/book-shipment.ts — called for the private BookShipment
async ({ shipmentId, lines, address }) => {
  const booking = await warehouse.book({ lines, address }, { idempotencyKey: shipmentId })  // decides nothing
  await transaction.run(async (tx) => {
    const shipment = await shipments.byId(shipmentId, tx)
    await shipments.save(recordBooking(shipment, booking.ref), tx)                         // domain sets ref once: keeps the first ref, a repeat is no change
  })
}
```
"Records" are what a store holds, and the 3PL is no store under the Assumptions' transaction, so
TX-5 counts shop's own records, which a repeat leaves unchanged (N4). `recordBooking` keeping the
first ref is the record's shape, not a decision whether to book.

**c8. TX-37 × TX-34 (× SVC-2). Shop sends payment's `RefundPayment`, and the charge is disputed.
CLOSEST CALL.** Reading A: `RefundPayment` asks for the money back at Stripe, which payment's
transaction does not commit. Then TX-37's Scope holds and payment "MUST make the change … without
deciding again … by the business rules of its system". Refusing by the dispute rule breaches TX-37,
and once it refuses, TX-34 requires `RefundRefused`. The code that meets both refuses nothing:
```ts
// payment/service/refund-payment.ts — reading A
(command) => stripeRefunds.create({ paymentRef: command.paymentRef, amount: command.amount }, { idempotencyKey: command.refundId })
```
TX-34's Scope ("refuses it") never holds, and SVC-2 is silent because nothing decides. The
fixture's "a disputed charge is not refunded" is then applied nowhere in payment. No Statement
requires a stated business rule to be applied. Reading B (`tx-34-ok`): the command asks for
payment's Refund record, which its transaction commits. TX-37 is out of Scope, payment decides and
publishes the refusal, and Stripe is reached through the private `StripeRefundRequested` (TX-22).
Both readings have compliant code. The rules do not say which change a command "asks for".

**c9. TX-37 × TX-30. The `BookShipment` use case waits on the 3PL, and no answer comes.** TX-30
wants a business rule to decide, and TX-37 forbids the use case to decide by one. Code: the use
case only fails (TX-38). The deadline sits on the Shipment aggregate, and a scheduled
reconciliation use case, called for no message, applies the rule
(`if (isOverdue(shipment, now)) …`). The rule lives in the domain and acts outside TX-37's Scope.

**c10. TX-37 × TX-38. Stripe refuses the refund that `StripeRefundRequested` asks for, or the 3PL
refuses a SKU not yet in its article master.** TX-38 can be met (fail, commit nothing). TX-37 cannot
be met by any code, because no code makes a change the external system refuses. That makes it a
single rule with no satisfying code, not a pair (N3).

**c11. TX-28 × TX-22 / TX-37 / TX-30. Payload's `afterChange` asks shop to revalidate the page.**
Code that meets all four:
```ts
// shop hook (afterChange): records a tentative operation only
(input) => transaction.run((tx) => pending.save(pendingRevalidation({ ...input, dueBy: addMinutes(input.at, 10) }), tx))
// scheduled use case, called for no message: decides
async () => transaction.run(async (tx) => {
  for (const p of await pending.open(tx)) {
    const committed = await catalogVersions.of(p.productId)                 // driven port
    const next = settle(p, committed, clock.now())                          // domain: confirm | give up (TX-30) | wait
    await pending.save(next.pending, tx)
    if (next.revalidate) await outbox.write(revalidatePage(p), tx)          // TX-22: asks, does not make
  }
})
// handler of RevalidatePage: TX-37, decides nothing
(m) => pages.revalidate(`/products/${m.slug}`)
```
TX-29's catalog outbox avoids the wait altogether. `tx-28-ok-after-change-hook-records-revalidation-request`
breaches TX-37 and TX-22 (N16).

**c12. TX-28 × TX-5. If the `afterChange` call counts as a delivered message, the recorded
tentative operation must be idempotent.** Code: id = `${productId}:${updatedAt}`, written insert on
conflict do nothing. Besides, glossary *Message* has an id and the hook call has none, so TX-5's
Scope does not hold (N8).

**c13. TX-28 × DOM-7 × SVC-2. Catalog's `beforeChange` sku veto.** Shop's use case writes nothing
(TX-28 ✓). If the rule is shop's (DOM-7's Why), shop's domain states `skuMayChange(openOrders)` and
the answering use case returns it. If it is catalog's (`tx-28-ok`), it sits in catalog's config. In
neither case does a service of shop act, so SVC-2's "the service that acts" has no referent and the
Statement asks nothing. Code: `tx-28-ok-before-change-hook-vetoes-sku-change`.

**c14. DOM-7 × SYS-12. Same veto, read as shop's rule.** Glossary *Owner* is the system whose
business rules decide what a record holds. Read so, shop co-owns the sku, and SYS-12 forbids the
admin edit the fixture describes. Code: an editor changes the sku through shop's driving adapter,
`sys-12-ok`-style, or the rule is read as catalog's (c13). No pair (N14).

**c15. ASM-2 × DRV-3 / ASM-4. Payload's config needs shop's hooks, the hooks need services, the
services need Payload.** The hook factory needs a port implementation that does not exist yet.
Code: `sys-1-ok-shop-hooks-via-builder`. The factory receives a courier from its caller, ASM-2 ✓, and
the hook reads it at run time. DRV-3's Scope ("cannot hand what it calls when it constructs it") is
the narrower one.

**c16. ASM-8 × ASM-2. Payload runs a collection hook inside `getPayload()`, for example a seed in
`onInit`.** Shop's services need the Payload instance, so the courier seems fillable only after
`getPayload`. Code: assembly hands shop's builder a forwarding `CatalogPort` and binds it once
Payload exists.
```ts
let payload: Payload | undefined
const catalog: CatalogPort = { byId: (id) => payloadCatalog(required(payload)).byId(id) }   // received from the caller, ASM-2 ✓
courier.fill(buildShop({ tx, catalog, ... }))                                               // before any hook runs, ASM-8 ✓
payload = await getPayload({ config })
```
No driven adapter reads the courier (ASM-4 ✓). The fixture does not say Payload runs hooks on init
anyway.

**c17. SYS-9 × ASM-1. Catalog's static `payload.config.ts` needs shop's hooks.** Code: the config
imports `buildShopHooks` from `@teeladen/shop/build`, which is offer (SYS-9 ✓), and passes the
common library's per-process courier. No port meets an implementation there, so it is no second
assembly (ASM-1 ✓).

**c18. ASM-2 × ASM-4. Mutual in-process upstreams: shop's `InvoiceLookup` → billing (asm-2-ok),
billing's `OrderQueries` → shop (tst-11, tst-7-ok).** Each builder must receive the other's service.
Code: as c16, a forwarding implementation object, received at construction and bound later in
assembly. No courier is involved. Upstream/downstream is undefined here (N12).

**c19. ASM-2 × ASM-10. A configuration value that is the same in every instance, process and
test.** Both Scopes hold and neither is narrower, but ASM-10 is a SHOULD. Receiving the value meets
ASM-2 and departs from a SHOULD, which is allowed.

**c20. ASM-3 × ASM-7. Request id and trace context "should cross system boundaries".** If "how the
use case acts" covers what it records (ASM-3's Why, audit column), the outbox adapter's ambient
`traceHeaders()` in the record breaches ASM-3. Code: the driving adapter, outside ASM-3's Scope,
reads the active context and passes `trace` through the driving port, and the service hands it to
`outbox.write(message, trace, tx)`. ASM-7 is a MAY and need not be used.

**c21. ASM-9 × TX-2. Payload's transaction (`req.transactionID`).** It travels as an argument in
`req`, so it is not ambient. The adapter narrows the handed `Transaction` (`svc-6-ok-opaque-transaction`).

**c22. DRV-1 × TX-1 / DRV-7. The bus hands billing a batch of `OrderPaid`.** One call with N
messages allows one acting call. Code: one use case over the batch in one transaction (DRV-1's Why,
Dahan), or the bus configured to call once per message. Both comply. The batch's poison-message
harm breaks no Statement.

**c23. DRV-1 × SVC-3. Checkout needs the order placed and the cart cleared, and both are use
cases.** Code: `svc-3-ok-place-order-writes-cart-itself`. One acting service writes both through
repositories.

**c24. TX-3 / TX-22 × synchronous `client_secret`.** TX-36's MAY lifts both. Its Relies on names
them.

**c25. TX-19 × TX-37. `BookShipment` and `CancelBooking` arrive in either order.** Code:
`BookShipment` books with key `shipmentId` regardless (TX-37). `CancelBooking` needs the booking ref.
When none is recorded yet it fails (TX-38), never reading "not found" as done, and succeeds after
`BookShipment` lands. The end state is the same in either order.

**c26. TX-19 × TX-35. Stripe reports a failed attempt, then a success on the same PaymentIntent, and
shop sees `PaymentFailed` and `PaymentSucceeded` in either order (step 5 cancels on
`PaymentFailed`).** Code: payment's domain publishes `PaymentFailed` only for a final failure (the
intent cancelled or expired), after which no success can follow. Shop's result is then
order-independent, and step 5 holds as written.

**c27. TX-7 × TX-32. `DunningStageChanged` gains its version.** Code: `version: z.number().int().positive().optional()`.
New code always writes it (TX-32), and both directions stay readable (TX-7).

**c28. SVC-4 × TX-37. Recording the 3PL's booking ref.** `tx-31-ok`'s `recordBooking(shipmentId, ref, tx)`
is a partial write. Code: load the Shipment, apply domain `recordBooking(shipment, ref)`, which
decides nothing, and save it whole (c7). TX-23 can fail the save; TX-38 retries it.

**c29. TX-1 × TX-30. Payment settles overdue payments by asking Stripe.** Code: one use case per
tick (DRV-1). One transaction opened first, `payments.overdue(now, tx)`, Stripe's status read inside
it, saves and messages, commit. A Stripe read inside the transaction breaks no rule.

**c30. DVN-4 × SVC-4 / SVC-7. Billing's service handed as shop's driven port implementation
(`invoices: billing.invoiceForOrder`).** Glossary: driven adapter = "implementations of driven
ports". With "its system" = billing, DVN-4 forbids the service reaching billing's repositories,
which SVC-7 and SVC-4 require. Code: assembly writes a forwarding object
`{ forOrder: (id) => billing.invoiceForOrder({ orderId: id }) }` (asm-2-ok). That object is the
adapter, and billing's service is "the outside" to it.

**c31. DOM-1 × DOM-3. The order id in the domain.** `crypto.randomUUID()` hands its caller what it
did not pass, so it is not *Pure*. Code: the id arrives as an argument (`placeOrder(cart, id, placedAt)`).
`tx-17-ok` and `tx-22-ok` breach DOM-1 (N15).

**c32. SVC-7 × the driving adapters' `new Date()`.** The clock is the outside (the OS).
`svc-7-breach-server-action-raw-sql…` counts it. Code: the service takes a `Clock` driven port, and
the adapter passes no `now`.

**c33. TX-12 × DOM-4. Checkout snapshots catalog's price, sku and tax class.** Code: read through
Payload's Local API, which is catalog's way in (glossary *External system*: "driven through its
API"), as `dvn-4-ok`. Or, if the Local API is not counted as catalog's open host service, from a
replica fed by catalog's `ProductChanged` (TX-29), with TX-27's rule.

**c34. ASM-4 × the `/health` probe.** The probe is no driving adapter, so it may not read the
courier. Code: the common library exports a ready-made pool. Assembly imports it and hands it to the
builders (ASM-2 ✓, since builders receive it), and the probe imports it. Neither the probe nor
assembly is a factory, so ASM-2's Scope does not reach them.

**c35. SYS-2 × DOM-7. The published language restates a domain constraint (`quantity` positive,
the cancel reasons).** Code: published language fields typed loosely
(`z.number()`, `z.string()`), with the constraint stated only in the domain. DOM-3 excludes the
published language by its Why only.

**c36. TST-5 × TST-6. The contract suite's run against the fake.** By glossary a fake implements a
driven port, so it is a driven adapter and TST-5's Scope holds. The "real thing" it talks to is its
in-memory state. Vacuous, met.

**c37. ASM-1 × TST-6 / TST-4. Test processes wire ports to fakes many times.** Tests are tooling
under the Assumptions (N9). Read as inside the rules, a test runner forking one process per file
with one wiring each meets ASM-1, and TST-6's two runs go in two processes behind the flag (TST-8).

**c38. SYS-13 × TX-22.** TX-22's message to this system's own outbox is a private command to
itself, so SYS-13's Scope ("to another system") does not hold.

**c39. TX-33 / TX-39 × TX-29.** Catalog's `ProductChanged` is an event, published. Neither Scope
holds.

**c40. TX-6 × TX-22.** TX-22's message asks for a change; TX-6's Scope is a message about a change
the use case makes. They are disjoint, and TX-1 puts the outbox write in the transaction anyway.

**c41. SYS-12 × TX-1. Fulfillment's stock shown in Payload's admin.** Code: a read-only field
(`access.update: () => false`), with fulfillment mirroring by a private message and a TX-37 use case
over the Local API (TX-22: a second store). Or no copy at all: an admin component calling
fulfillment's open host service.

**c42. SVC-1 × a conformist's use of the upstream's driving port type.** SVC-1's Scope is "declares
a port", and a conformist declares none.

## Relies-on findings

**R1. SVC-6 → ASM-2** "a factory receives port implementations, store clients and other clients of
something outside the process from its caller". **ASM-10 → ASM-2** says the same. ASM-7's MAY lifts
ASM-2 for telemetry, which is a client of something outside the process (its transport or exporter).
ASM-2 guarantees the line only where no MAY lifts it. Both lines say it without that condition.

**R2. SVC-6 → SYS-1** "an upstream exports nothing but its offer". **DOM-1 → SYS-10 / SYS-14**
likewise bound "the published language of an upstream its system conforms to". The Assumptions put
an external system's exports outside the rules, yet SVC-6 lists "the published language of an
external system it conforms to" and DOM-1 admits any conformed upstream's published language. For
catalog (Payload), Stripe, the 3PL and the bank, SYS-1, SYS-10 and SYS-14 guarantee nothing.

**R3. SVC-2 → SYS-1** "a system exports no service, driven port or adapter to other code". SYS-1
bounds what an export path exports. System builders are offer and return services in every
assembly example, and `sys-1-breach-builder-returns-repositories` returns repositories while meeting
SYS-1's Statement. Not guaranteed.

**R4. TX-22 → TX-6** "a message about a change commits in the transaction that commits the change".
**TX-3 → TX-6** says the same. TX-6's Scope is "a message about a change it makes". TX-22's message
asks for a change its transaction does not commit (TX-28's Why: "TX-6 binds a message to a change
the use case makes"), and TX-3's command asks for the owner's change. TX-6 does not cover either.
TX-1 does (the outbox write is a call into its store).

**R5. TX-37 → TX-31** "by default, a use case called for a message passes the external system a key
the message carries". TX-31's Scope requires "an external system that takes an idempotency key".
`tx-22-breach-claim-rolled-back-after-3pl-call` has a 3PL that takes none, while `tx-31-*` has one
that does. The line drops the condition.

**R6. TX-19 → TX-32** "messages of one system of which a later one overrides an earlier carry a
version". TX-32 binds systems of this codebase. Stripe's webhooks, handled by payment under TX-19
(TX-5's Why counts them as messages), carry no such version. The line is guaranteed only for
codebase publishers.

**R7. TST-6 → TST-4** "a service's test hands it fakes for its driven ports". TST-4 is a SHOULD.
SVC-4's line on the same rule says "by default", and this one does not.

**R8. TX-1 → DRV-1** "at most one acting call per call it handles, a message included". DRV-1
guarantees one acting call per call. A batch delivery is one call carrying several messages, so the
line does not yield TX-1's "each message gets a transaction of its own".

**R9. ASM-9 → TX-25** "a driving port takes no transaction". TX-25 binds driving ports a system of
this codebase declares. Payload's Local API, an external system's driving side, takes
`req.transactionID`, and `svc-6-ok-opaque-transaction` hands it shop's transaction. The line is
guaranteed only for codebase systems.

## Notes

**N1. SVC-6 and DRV-8 under glossary Reach and Port.** *Reach*: "what running it reads or calls,
however the code got hold of it". *Port*: "never the code behind it". Running a call through a port
calls the code behind it, so a service calling a repository reaches a driven adapter and the store,
and a route calling its driving port reaches the service. Neither list names these. SVC-2's Relies
on even reads DRV-8 as "reaches no … service of its system", while DRV-8's Why says the adapter
"calls whichever service assembly handed it". Wherever the call reaches the outside, a narrower
Scope (TX-1, SVC-4, SVC-7) governs (c1–c3). Where it does not (a handler whose use case writes
nothing outside, an answering call over in-memory state), no driving adapter that calls its use case
satisfies DRV-8: a single rule with no satisfying code. The reverse cost: if "narrower governs"
displaces the wider rule wholesale, SVC-6 never governs a service that writes or reaches the outside.
`svc-4-breach-mark-paid-updates-column` and `svc-6-breach-drizzle-transaction-in-port` cite SVC-6
exactly there. Undefined: whether "governs" displaces the wider rule wholesale or only where the two
conflict.

**N2. SVC-7 literal: a driving adapter reading its caller.** *Outside* includes those that "drive the
system". Reading the request body, cookies or Stripe's webhook payload reaches the outside, and not
through a port of its system. DRV-8 lists "what calls it", SVC-7 has no such item. No Stripe hook or
route that reads its input satisfies SVC-7 literally.

**N3. TX-37 "MUST make the change".** No code makes a change the external system refuses: Stripe
refusing a refund on a disputed charge, or the 3PL refusing a SKU not yet in its article master. A
single rule with no satisfying code. Reading picked: "attempt it, deciding nothing". Then TX-38
applies if the refusal is "no business rule of its system". For Stripe's dispute refusal, which
mirrors payment's own rule, whether TX-38 holds is undecidable, and TX-37's Why ("records the
owner's answer") points the other way from TX-38's "not commit the stop".

**N4. TX-5 "records".** Picked: a store's records (*Record*). The 3PL and Stripe offer no
transaction (Assumptions), so they are no store, and a double booking there breaches no TX-5.

**N5. "decide" undefined.** It is used in TX-22's Scope, TX-37's Statement, SVC-2, TX-24 and TX-30.
c6 and c8 turn on it.

**N6. "a call into its store" (TX-1) with *Store*.** One shared Postgres is one store for shop,
payment, billing, fulfillment and catalog's tables. Picked: the narrow reading, calls to this
system's own driven ports over the store. The broad reading drives c4 and c5.

**N7. Acting vs answering.** A use case that changes only an external system (payment's
`requestCheckoutSession` changes Stripe, not payment) is neither acting ("changes the system") nor
answering ("changes nothing").

**N8. Hook calls without id.** Glossary *Message*: "It has an id, the same on every delivery". TX-5's
Why ("where the call carries no id") contradicts that. A Payload hook call is then no message, so
TX-5, TX-19 and DRV-7 ("delivered a message") do not reach it.

**N9. Tests vs Tooling.** *Tooling* is "code that runs in no process of the deployed application",
which includes tests. The Assumptions put tooling "outside the layers and the rules", yet TST-4,
TST-5, TST-6 and TST-8 bind tests. *Assembly* is "the only place where port and implementation
meet", while every service test hands fakes.

**N10. A fake is a driven adapter.** Glossary: "Implementations of driven ports". TST-5 and DVN-4
then hold for fakes (c36).

**N11. TST-5 "set up the way production sets it up".** For Stripe, the 3PL, the bank and the mail
provider this means live accounts: a contract run books real parcels and refunds real charges.
Test mode is a real thing set up differently. No rule forbids live side effects.

**N12. Upstream/downstream undefined under mutual dependence.** Shop and billing depend on each
other in-process (asm-2-ok, tst-11, tst-7-ok). Shop handles fulfillment's commands while fulfillment
handles shop's events (sys-13-ok). Glossary: "the one the other depends on".

**N13. P16 gap.** Shop's use case writes a Payload document with its transaction narrowed to
`transactionID` (`svc-6-ok-opaque-transaction`), one transaction across shop and catalog. TX-25 and
ASM-9 bind only this codebase's driving ports.

**N14. Owner of the sku veto.** DOM-7's Why calls catalog's veto of a sku change "this system's",
staying in shop. `tx-28-ok-before-change-hook-vetoes-sku-change` says "the rule is catalog's … no
rule of shop's decides the sku". Read as shop's, *Owner* makes shop co-owner of the sku and SYS-12
forbids the fixture's admin edit.

**N15. Pure and ids.** `crypto.randomUUID()` "hands its caller" a value it did not pass, so it is not
*Pure*. `dom-1-breach-order-id-from-node-crypto` recommends `globalThis.crypto` in the domain.
`tx-17-ok` and `tx-22-ok` call `randomUUID()` in shop's domain.

**N16. Example defects (one rule satisfied, another breached; not contradictions).**
- Load before the transaction opens, breaching TX-1 ("hand it to each call into its store", reads
  included): `svc-4-ok-mark-paid-through-repository`, `svc-3-ok-place-order-writes-cart-itself` and
  `asm-9-ok-transaction-handed-as-argument` (all labeled `satisfies: TX-1`), plus
  `svc-2-ok-cancel-order-decides-itself` and `asm-3-ok-hook-passes-editor`.
- `tx-30-ok-payment-asks-stripe-at-deadline`: `payments.overdue` outside any transaction and one
  transaction per payment, breaching TX-1.
- `tx-31-ok`, `tx-31-breach`: `shipments.recordBooking(id, ref, tx)` is a partial write, breaching
  SVC-4.
- `tx-28-ok-after-change-hook-records-revalidation-request`: the handler decides by
  `givesUpWaiting`, a shop business rule (TX-37), and decides then makes the change itself (TX-22).
- `asm-3-ok-actor-through-driving-port` (`syncPrice` saves on `afterChange`) and
  `asm-3-ok-hook-passes-editor` (publishes `productPageInvalidated` on `afterChange`): beyond a
  tentative operation before Payload commits, breaching TX-28.
- `drv-1-ok-session-through-answering-service`, `drv-3-ok-server-action-reads-courier`,
  `drv-6-ok-server-action-reads-at-run-time` and `asm-3-ok-hook-passes-editor`: `new Date()` in a
  driving adapter, which is SVC-7 by `svc-7-breach-server-action-raw-sql…`'s own reading.
- `asm-3-ok-actor-through-driving-port` (ambient request id written into an audit column) and
  `asm-3-ok-trace-context-crosses-bus-in-envelope` (ambient trace context written into the outbox
  record): ASM-3 if "acts" covers what gets recorded, as ASM-3's Why says.
- `tx-17-ok`, `tx-22-ok`: `randomUUID()` in the domain, breaching DOM-1 (N15).

**N17. Fixture disagreement on the 3PL.** `tx-22-breach-claim-rolled-back-after-3pl-call` says the
3PL "has no idempotency key". `tx-31-ok` and `tx-31-breach` say "the 3PL takes a key". domain.md is
silent.

**N18. DRV-1's Why vs its Statement.** The Why says "a bus that delivers several messages at once
gets one call per message", while the Statement allows one acting call per call handled. The
`drv-1-breach-invoice-batch-in-one-transaction` example (100 service calls) and Dahan's batch read
the two differently.

**N19. DVN-4 omits the system's own published language.** An outbox adapter that validates or
serializes published messages with their schema at runtime reaches it.

**N20. TX-3's "another system of this codebase" leaves out catalog.** Shop writing catalog's price
and sku (`asm-2-ok-payload-adapter-takes-instance`, `svc-6-ok-opaque-transaction`; the fixture has
catalog own both) is ruled by no Statement. That is a P11 gap.

**N21. Undefined or ambiguous words.** "decide" (N5); "governs" (N1); "holds a tentative operation"
(TX-30: does payment hold a session it never recorded?); "asks for a change" (c8); "its system" for
an upstream service acting as a downstream's driven adapter (c30); "narrower" across Scopes with
different subjects (SVC-7 covers driving adapters, SVC-6 does not), judged here per code.
