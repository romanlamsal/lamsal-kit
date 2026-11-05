Base 287b402, head e5da5fa.

Changed: rule P9 Scope (every acting use case "called by a call or for a message"; clause "through a driving adapter that a caller outside its process reaches" and clause "a use case calls another system after its commit" gone), s3 split into (a) "where neither a key nor its records tell a repeat, what the repeat does MUST be what a business rule allows" (no "ends otherwise" condition) and (b) keyless change outside, condition kept; Why.

Requester's note: PR-1's remaining split and Newly broken 1 rest on "tell" read as "the code as
built checks", which a well-meaning implementer does not take (the Statement says MUST tell; a
record the use case could read tells). Adversarial reading, not a finding: under the cooperative
reading both are builds breaching s1. PR-1 resolved; Newly broken 1 dropped.

## Previous regression

- PR-1: unchanged — s3(a) drops "ends otherwise than made once", so a refusal no longer escapes on that ground, but "neither a key nor its records tell" still splits can/does: Fresh A `register` `emailTaken` breaches s1 if matching email and name can tell, complies if "tell" is as built and `emailTaken` is the rule allowing the refusal (world's Except says the record left tells); Impl `checkout` and Fresh B `setCartLine(cartId: null)` breach either way, as at 287b402.
- PR-2: resolved — Scope reaches every acting use case, the in-process callee included: the throwing `startPayment` breaches (s1 if the `Payment` by `order_reference` can tell, s3(a) if not, no rule allows the throw), Impl's `byOrderReference` complies, Fresh A `open` `alreadyPaid` now hangs on PR-1.

## Checklist

- R05-5: unchanged — s2 untouched; `intent:${paymentId}` complies.
- R05-6: out of scope — polled-item clause and P4 untouched.
- R05-9: out of scope — P8 untouched.
- R05-12: unchanged — s1 "or by the records it writes there" untouched; s3(a) "its records" adds no record kind; P7 untouched.
- R05-16: unchanged — s1 claim key untouched, still silent on the consumer.
- R05-24: unchanged — glossary untouched; P9 Scope no longer rests on the driving adapter count (clause 2 gone).
- R05-31: unchanged — "the call's key" still no term; "called by a call" adds none.
- R05-33: unchanged — C8 is P8's; Fresh B key still complies s2.
- Others: out of scope — P9 only.

## Examples in the affected set

- p9-ok-stripe-webhook-claimed-in-transaction: holds — in by "a hook was called with it"; s1 claim in the transaction.
- p9-ok-bank-poll-hands-on-transfer-ids: holds — in by "a driving adapter asked another system for it"; s1 by the bank's id.
- p9-ok-article-registration-asks-before-create: holds — s1 by records (`registered && sameMasterData`); s3(b) `articleRepeat` for the keyless 3PL.

## Previous builds

### Impl

- Newly in: payment `startPayment` (in-process from shop): complies s1 by `byOrderReference`.
- Newly in: scheduled tasks' acting calls `requestPaymentExpiries`, `releaseExpiredHolds`, `retryUnbooked`, `startDunningRun({ runId })` (key unclaimed), shop's expiry sweep: a retried tick told by nothing written: Newly broken 1. `p17-ok-payment-expiry-outlives-stripe-retries`, `p17-ok-reservation-hold-ends-without-shop`, the dunning example claim P9 or neighbours of it.
- `checkout` resubmitted: breach either reading (s1 by `latestForCart`; s3(a), no rule allows a second `Order`), unchanged.
- Executors' keys comply s2; confirmation mail `accepted` complies s3(b); `currentDunningStage` answering, out. Unchanged.

### Fresh A

- Newly in: `PaymentIntents.open` in-process, `alreadyPaid` on a repeat: PR-1 split (was out under 287b402's direct reading).
- Newly in: `noticePassedPaymentDeadlines`, `noticeLapsedIntents`, `noticePassedFulfillmentDeadlines`, `noticeDunningDue` (no tick id, `run()` takes none): Newly broken 1.
- CLI `StockCounting.record`, `assignTransfer`: now in without the caller question; `alreadyAssigned` on a repeat hangs on PR-1.
- `register`, `placeOrder` `orderAlreadyPlaced`, `requestRefund` `refundAlreadyRequested`: PR-1 split, unchanged. Keys and Postmark `accepted`: comply.

### Fresh B

- Newly in: `startDunningRun` per tick, claimed under `dunning-run:<date>`: complies s1. Bank poll's acting call: per-item ids `bank:<transferId>`, as at 287b402.
- `setCartLine(cartId: null)`: breach either reading, unchanged. `placeOrder` `cart-closed`, `requestRefund` `refund-exists`: PR-1 split.
- `stockFieldHook` answering, out. No in-process acting call between systems.

## Newly broken

### 1. p9-split-sweep-tick-repeat.md
```yaml
breaches: []        # "tell" as built and the expiry rule read as allowing the repeat; [P9] (s1) if the outbox rows can tell, or (s3a) if no rule allows it
satisfies: [P7, P17, P4]
situation: pg-boss runs a payment-expiry tick again after the worker stopped past its commit
finding: regression
```
```ts
// packages/payment/src/service/request-payment-expiries.ts (Impl) — the scheduled task's one acting call
export const makeRequestPaymentExpiries = (d: { tx: PaymentTransactions; clock: Clock }) =>
  async () => d.tx.run(async (s) => {
    const due = await s.payments.expiredBefore(d.clock.now(), 500);                 // the retried tick finds the same payments
    await s.outbox.add(...due.map((id) => expirePaymentMessage(`expire:${id}`, id))); // written again
  });
```
Scope: "an acting use case, called by a call". s1: "MUST tell a repeat ... by ... the call's key ... or by the records it writes there". s3(a): "Where neither a key nor its records tell a repeat, what the repeat does MUST be what a business rule of its system allows." The tick carries no key; the outbox rows `expire:${id}` it wrote could tell, and the code reads none. Can-tell: breach s1. Does-tell: s3(a), the repeat writes the rows again (or fails on their id); no rule names it, but `expire` decides by the aggregate whatever arrives: allowed or not is unsaid. A repeated tick and the next tick do the same here. Same: Impl `releaseExpiredHolds`, `retryUnbooked`, shop expiry sweep, `startDunningRun({ runId })` (key there, unclaimed: s1 if a key present must be claimed); Fresh A's four `notice*`. Fresh B claims the tick: complies. At 287b402 in only if the clock is "a caller outside its process" (watch item, undecided).

## Noticed

- Scope's "or a use case calls another system after its commit (P8)" gone; still covered, such a use case is acting.
- A refusal of a non-repeat (same email, other name) is not P9's: the Statement binds repeats only.
- Tests and one-shot CLI calls: no example breaks; the duty sits on the use case, as P4 has it.
- "whether the bus delivered it, a hook ..., or a driving adapter asked" lists message routes only; "called by a call" covers the rest.
