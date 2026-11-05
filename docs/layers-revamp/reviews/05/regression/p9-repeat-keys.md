Base ec52645, head 287b402.

Changed: the-world P9 heading ("of this system"), new *Except* (a repeat nothing it carries or left tells from a new request, where a business rule allows what follows); rule P9 heading, Scope (clause 2 now "called through a driving adapter that a caller outside its process reaches"), s2 (key "names the change, the same on every attempt at it by whichever message or step": id of what the change is about, derived from the committed record, or the message's/call's "where it alone asks"), s3 (widened: "where neither a key nor its records tell a repeat, or no such key reaches"), Why.

## Previous regression

- CP-1: resolved — the Except and s3 make a keyless retry a repeat, clause 2 reaches it by the browser route (decidable); Impl `checkout` resubmitted breaches either way (s1 by `latestForCart`, or s3 with no rule allowing a second `Order`), Fresh B `setCartLine(cartId: null)` breaches either way (s1, or s3 with no acceptance in `repeat-policies.ts`); Fresh A `register` `emailTaken` now hangs on Newly broken 1.
- CP-2: resolved — s2's key is the same "on every attempt at it by whichever message or step", the message's only "where it alone asks for the change": `reopen:${messageId}` breaches; whether reopening is the same change as opening is the domain's to say.
- CP-3: resolved — heading in rule and world back to "this system"; the mail provider's records are not this system's, s3 accepts the repeat.
- GSC-2: partly resolved — Fresh B's `${orderId}:${cartVersion}` is now "the id of what the change is about" (cart is the `Order`), complies s2; P8 s1 breach (inside the open transaction) unchanged.
- PK-2: out of scope — P13.

## Checklist

- R05-5: unchanged — `intent:${paymentId}` still complies s2 (derived from the committed `Payment`, the id of what the change is about).
- R05-6: out of scope — P9 clause 1 (polled items) untouched; P4 untouched.
- R05-9: out of scope — P8 untouched.
- R05-12: unchanged — s1 "or by the records it writes there" untouched; s3 adds "its records", P7's "the record of the message" untouched.
- R05-16: unchanged — s1 "claimed there under a key the store refuses twice" untouched; s2's key is for the outside system, not the consumer.
- R05-24: unchanged — Scope now rests on Driving adapter; either count reading (per transport, per entry) puts the same use cases in.
- R05-31: unchanged — "the call's key" still no term; adds "attempt", "step" (s2).
- R05-33: unchanged — C8 settled by P8 s1; Fresh B's key now complies s2, its placement still breaches P8 s1.
- Others: out of scope — P9 only.

## Examples in the affected set

- p9-ok-stripe-webhook-claimed-in-transaction: holds — P9 Scope clause 1 (and clause 2, Stripe outside), s1 claim in the transaction.
- p9-ok-bank-poll-hands-on-transfer-ids: holds — P9 clause 1, polled item as message under the bank's id.
- p9-ok-article-registration-asks-before-create: holds — P9 s3 "no such key reaches the system that makes a change", `articleRepeat` rule; two messages ask the change, no key, so s2's "alone" not reached.

## Previous builds

### Impl

- In, unchanged: handlers, webhook, bank poll (clause 1); executors' keys (`cancel:${paymentId}`, `refund.id` with ask-first, expiry id per payment) comply s2 ("id of what the change is about"); confirmation mail `accepted` complies s3, heading split gone (CP-3).
- `checkout` by server function: in (clause 2, browser outside); a resubmit places a second `Order`: breach s1 (records tell via `latestForCart`/`cartVersion`) or s3 (no rule allows it). Was split.
- payment `startPayment`, called in-process by shop (one `web` process): out under the direct reading of "called through a driving adapter" (no driving adapter between shop's driven adapter and payment's port), in under the transitive one. `byOrderReference` no longer required; without it, `unique order_reference` makes the repeat throw: Newly broken 2.
- payment → Stripe after the commit, `intent:${paymentId}`: complies s2.
- billing `currentDunningStage` in-process: answering, out.

### Fresh A

- `placeOrder` `orderAlreadyPlaced`, `requestRefund` (/ops) `refundAlreadyRequested` on a repeat: in (clause 2); breach s1 as at ec52645, unless s3 lifts s1 (Newly broken 1).
- `register` `emailTaken`: Newly broken 1.
- payment `PaymentIntents.open` in-process, `alreadyPaid` on a repeat: breach at ec52645 (clause 2); now out under the direct reading (Newly broken 2).
- Keys `refund:<refundId>`, `cancel:<paymentId>`, `externalReference = fulfillmentId`, `open:<orderRef>`: comply s2. Postmark `accepted`: complies s3; CP-3 gone.

### Fresh B

- `placeOrder` `cart-closed`, `requestRefund` `refund-exists` on a repeat: breach s1 as at ec52645, unless s3 lifts s1 (Newly broken 1).
- `setCartLine(cartId: null)`: newly breach under both readings (s1 cannot tell; s3 finds no acceptance). Was split.
- `placeOrder` → Stripe `${orderId}:${cartVersion}`: now complies s2 (was GSC-2's s2 breach); P8 s1 breach unchanged.
- Executors (`refundId`, `cancel:<orderId>`), consignment look-up race accepted, mail accepted: comply.
- `stockFieldHook` called by Payload in-process: answering, out. No in-process acting call between systems.

### Watch items

- "A caller outside its process": decidable for routes, server actions, hooks over HTTP, bus handlers (bus outside); not for a scheduled task (is the clock, "the operating system", a caller?), nor for an in-process external system's hook (Payload in our process) whose own outside caller retries.
- "Called through": direct or by Reach (transitive) splits every in-process callee (Newly broken 2); answering use cases stay out either way ("an acting use case").
- s2 "where it alone asks for the change": decidable by finding every writer of a message or caller asking the same change; "the same change" is the domain's (reopen vs open); no build keys by a message id another message shares.
- Natural key (email) satisfies s1 "by the records" where the use case compares what the first committed with the request (Why's `register`); whether it must compare is Newly broken 1.
- World *Except*: matches s3; no hole beyond s3's own (Newly broken 1).

## Newly broken

### 1. p9-split-s3-lifts-s1.md
```yaml
breaches: []        # s3 lifts s1 where nothing tells; [P9] (s1) if s3 only adds to s1
satisfies: [P7, P10]
situation: a browser retries registration after a timeout; the driving port takes no key
finding: regression
```
```ts
// packages/shop/src/service/register.ts (Fresh A)
export const makeRegister = (d: { tx: ShopTransactions; customers: Customers; ids: Ids }) => async (input: { email: Email; name: string; address: Address }) =>
  d.tx.run(async (tx) => {
    if (await d.customers.byEmail(tx, input.email)) return { ok: false, refusal: "emailTaken" } as const; // the retry lands here
    const id = d.ids.customerId();
    await d.customers.save(tx, newCustomer(id, input));
    return { ok: true, customerId: id } as const;
  });
```
s1: "MUST tell a repeat ... by the call's key ... or by the records". s3: "Where neither a key nor its records tell a repeat ... and the change made twice ends otherwise than made once, ... a business rule". Reading A: s3 adds to s1, which still binds: the records could tell (same email, same name), so the refused retry breaches "succeed"; and where records cannot tell (Fresh B `setCartLine(cartId: null)`), s1 is unsatisfiable without a key, whatever rule accepts the second cart (the Why's own case). Reading B: s3 lifts s1 where nothing tells, "tell" as built: this code reads "taken", not "repeat", so nothing tells; the refusal leaves records as once, so s3's "ends otherwise" is false and no clause binds: complies, and the retry fails where the first succeeded, which the world's Except allows only "where a business rule allows". Same split: Fresh A `refundAlreadyRequested`, Fresh B `refund-exists`. At ec52645 s3 spoke only of keys reaching another system; s1 had no escape.

### 2. p9-split-in-process-callee-out-of-scope.md
```yaml
breaches: []        # direct reading; [P9] if "called through" is by Reach
satisfies: [P8, P15, P7]
situation: shop's later step repeats its call to payment, in the same process, after a stop
finding: regression
```
```ts
// packages/payment/src/service/start-payment.ts — called in-process by shop's driven adapter
export const makeStartPayment = (d: { tx: PaymentTransactions; ids: IdGenerator; clock: Clock }) =>
  async (input: { orderReference: string; amount: Money }) => d.tx.run(async (s) => {
    const opened = openPayment({ id: d.ids.next(), orderReference: input.orderReference, amount: input.amount, now: d.clock.now() });
    await s.payments.insert(opened);                 // unique order_reference: shop's repeat throws here
    return opened;
  });
// packages/shop/src/service/start-order-payment.ts — later step after shop's commit (P8), called for a message
await d.payments.start({ orderReference: order.id, amount: orderTotal(order) }); // s2: key from the committed Order
```
Scope clause 2: "called through a driving adapter that a caller outside its process reaches". Direct reading: payment's port is called by shop's driven adapter, no driving adapter between: out of Scope; shop complies s2 (its key reaches payment), "by that key that system answers a repeat" is no MUST on payment; the repeat fails where the first succeeded, and the later step parks. By Reach (transitive): the bus reaches shop's handler, which reaches payment: in, breach s1. The Why's ground, "a caller in the same process knows whether its call returned", fails after a stop (F4): the later step runs in a new process. Same: Impl `startPayment` (in-process, `web`), Fresh A `PaymentIntents.open` (`alreadyPaid`), a Payload hook in our process whose editor retries. At ec52645 in ("a call its caller may repeat").

## Noticed

- s3's "prevented": where nothing tells the repeat, only a key prevents it; no clause puts the key on the driving port (Why: "checkout takes the cart's id").
- Scheduled task: whether the clock is "a caller outside its process" decides whether a tick-driven acting use case is in clause 2.
- s2 "the id of what the change is about" for a second partial refund: the order's id names the subject, not the change; only "names the change" refuses it.
