Base 8ab0943, head ec52645.

Changed: glossary Tentative operation (aggregate or system, message or call); the-world F5 (a call repeats), P8 Why, P9 heading ("delivery or call", "the system it reaches"), P9 Why; rules P8 s1 (call after the commit to another system, from a committed record, repeated or ended by a later step; need and idempotency out), P9 heading, Scope (+ a call its caller may repeat, + a use case calling another system after its commit), Statement (call's key; key "the same on every repeat", the message's, the call's or one derived from the committed record), P13 s2 (+ "or of a shared kernel both share"), s3 (strict again), P15 s1 (+ "or of a caller held on it", "now, to a read or to an act, for what the use case answers or decides before it returns"), s2 (message only); Why/Provenance of P7, P8, P9, P13, P15, P17.

## Previous regression

- GSC-1: resolved — P8 s1 admits shop's call to payment after its commit from the committed `Order`; P15 s1 admits it by shop's `needsPaymentNow` (an act needed now), and payment's Stripe call by "a caller held on it"; the built placements inside `tx.run` / the open transaction still breach P8 s1.
- GSC-2: unchanged — Fresh B's Stripe call inside the open shop transaction still breaches P8 s1 ("after the commit"); its key `${orderId}:${cartVersion}` is from a read, not a committed record (P9 s2); after the commit, keyed by the committed order id, complies.
- GSC-3: resolved — P13 s3 strict again and P13 Why now agrees ("A published language carries none of it"); Impl `OrderPlacedV1`, payment's `published/index.ts`, Fresh A `src/published/**` breach as at 8ab0943, intended; s2 lets the kernel cross between sharers outside a published language.
- TC-1: resolved — catalog's `ProductRevisedV1` reaching `MoneySchema` breaches s3 (strict); s2 refuses the kernel to fulfillment, which shares none.
- PK-1: resolved — s3 no longer turns on the published language's downstreams; `StockLevelV1`'s `Sku` is refused in a published module whoever reads it (intended), and s2 admits it to shop as the kernel's shape.
- PK-2: unchanged — moved from s3 to s2's "a shared kernel both share": shop's message with `Money` and `Sku` to fulfillment importing `/sku` only holds under package-as-kernel, breaches under module-as-kernel.

## Checklist

- R05-1: out of scope — P2, P3, Owner untouched.
- R05-2: out of scope — P7 Statement untouched; P7 Why binds nobody.
- R05-3: out of scope — P7 Statement, P10 untouched.
- R05-4: out of scope — P7 Statement untouched.
- R05-5: resolved — P8 s1 still refuses `openIntent` before payment's commit; the complying code's key `intent:${paymentId}` is now P9 s2's ("derived from the committed record"); P17 s2 bullet 1 reaches the intent asked by call.
- R05-6: out of scope — P4 untouched.
- R05-7: out of scope — P13's MAY, P2 Why untouched.
- R05-8: out of scope — P14 untouched.
- R05-9: out of scope — "deciding nothing again" untouched.
- R05-10: resolved — P15 s1 now admits the dependency for an act a business rule needs now, s2 sends only the rest by message; Why ("For an act, the line is whether what the use case answers or decides hangs on the act's outcome") agrees.
- R05-11: out of scope — P11 untouched.
- R05-12: unchanged — P7's "the record of the message" untouched; P9 s1 adds "the call's key", still "or by the records"; P7 names no call's key.
- R05-13: out of scope — P16 untouched.
- R05-14: out of scope — P2 untouched.
- R05-15: resolved — Tentative operation as at 89f239e; Fresh A `HoldStock` one fulfillment took; Fresh B still on "holds something".
- R05-16: unchanged — P9 s1 "claimed there under a key the store refuses twice" still silent on the consumer in the key.
- R05-17: out of scope — P6 untouched.
- R05-18: out of scope — P1 untouched.
- R05-19: out of scope — P11 untouched.
- R05-20: out of scope — no term or layer touched.
- R05-21: out of scope — P10 untouched.
- R05-22: unchanged — P13 s1 untouched; s3 no longer hangs on it (strict).
- R05-23: out of scope — P5 untouched.
- R05-24: out of scope — Driving adapter untouched.
- R05-25: out of scope — P18 untouched.
- R05-26: out of scope — P3 untouched.
- R05-27: out of scope — "nor be generated" untouched.
- R05-28: out of scope — P12 untouched.
- R05-29: unchanged — P15 Why's deadline reconciliation kept; now under s1's "to a read", still permitted or expected.
- R05-30: out of scope — no P5 Glossary notes in the head's set.
- R05-31: unchanged — "provisional", "intent" still no term; adds "held" (P15 s1), "the call's key" (P9 s1).
- R05-32: out of scope — P13 s2's command clause untouched.
- R05-33: unchanged — C8 settled by P8 s1 (after the commit); C2, C9 differ freely.
- R05-34: out of scope — fixture.

## Examples in the affected set

- p8-ok-payload-outbox-product-changed: holds — P8 s3, s4 untouched.
- p8-ok-confirmation-mail-after-commit: holds — P8 s1 by message; P9 s3 `confirmationRepeat = "accepted"`; P9 heading split (Newly broken 3).
- p8-ok-durable-bus-acks-after-commit: holds — P8 s2 untouched.
- p8-ok-saga-1-order-placed-in-outbox: breach — P13 s3: `OrderPlacedV1` reaches `@teeladen/kernel/money`, `/sku` (as at 8ab0943, intended); P8 holds.
- p8-ok-revalidate-after-listing-commits: holds — P8 s1 by private message.
- p9-ok-stripe-webhook-claimed-in-transaction: holds — P9 Scope clause 1, s1 claim in the transaction.
- p9-ok-bank-poll-hands-on-transfer-ids: holds — P9 s1, polled item as message.
- p9-ok-article-registration-asks-before-create: holds — P9 s3, no key reaches the 3PL, business rule asks first.
- p13-ok-saga-3-payment-events-in-published-language: breach — P13 s3: payment's `published/index.ts` reaches the kernel's `Money`; s2 holds.
- p13-ok-command-declared-by-receiver: breach — P13 s3: `RefundPaymentV1`'s `Money` from the kernel; s2 holds.
- p15-ok-listing-replica-refreshed-on-notice: holds — P15 s1 does not reach a use case called for a message.
- p15-ok-checkout-returns-client-secret: breach — P8 s1: `payments.start` inside `tx.run`; P15 s1 holds (`needsPaymentNow`); resubmit hangs on Newly broken 1.
- p17-breach-intent-before-payment-record: breach — P8 s1 and P17 s2 bullet 1.
- p17-ok-payment-expiry-outlives-stripe-retries: holds — P17 s2, `expiresAt`.
- p17-ok-refund-refused-for-dispute: holds — every rule.
- p17-ok-reservation-hold-ends-without-shop: holds — P17 s2 "holds something".
- p17-ok-saga-5-deadline-in-order: holds — shop's `paymentDueBy` for the tentative operation it asked by call.
- p17-ok-saga-6-invoice-order-is-no-wait: holds — P17 s3.
- p17-ok-saga-7-late-payment-refunded: holds — P17 s1, s4.

## Previous builds

### Impl

- shop `checkout` → payment `startPayment`: inside `tx.run`, before the commit, `orderId` as `orderReference` (uncommitted); browser held, shop's `needsPaymentNow`. P8 s1 breach, unchanged. After the commit: complies (P8 s1; P9 s2 key from the committed `Order`; P15 s1).
- payment `startPayment` → Stripe: after payment's commit, from the committed `Payment`, key `intent:${paymentId}`, expiry ends it. P15 s1: payment's domain holds no now-rule; now complies by "a caller held on it" (shop's). P9 s1 (new obligation, clause 2): `byOrderReference` tells the repeat by records, succeeds: complies.
- Executors (cancel `cancel:${paymentId}`, refund ids), webhook claim, bank poll: P9 s1/s2 comply, unchanged.
- shop → billing `currentDunningStage` inside `tx.run`: answering; P8 not reached; P15 s1 "to a read" by shop's rule. Unchanged.
- `checkout` resubmitted: no key, cart emptied later by `ClearCart`, a second `Order`: hangs on Newly broken 1. Was out of P9's Scope.
- Published languages with the kernel: breach P13 s3, as at 8ab0943 (complied at 89f239e and 3c3960c).

### Fresh A

- shop `placeOrder` → payment `PaymentIntents.open`: inside shop's open transaction; key `orderRef` (caller's `orderId`); browser held, `cardPaysAtCheckout`. P8 s1 breach, unchanged; after the commit complies.
- payment `open` → Stripe: key `open:<orderRef>`; before or after payment's commit unsaid. P15 s1 now by the text (caller held), not by reading B (S13).
- Repeats now in P9's Scope (clause 2): `placeOrder` answers `orderAlreadyPlaced`, `requestRefund` `refundAlreadyRequested`, `open` `alreadyPaid` on a repeat whose first succeeded: breach P9 s1 ("commit nothing and succeed"); records tell each repeat. Newly breach, the Why's own case (resubmitted checkout).
- `register` `emailTaken`, keyless: Newly broken 1.
- Executors keyed from the message (`refund:`, `cancel:`, `externalReference`), Postmark accepted: P9 s2/s3 comply; heading split (Newly broken 3).
- `src/published/**` importing `@teashop/kernel`: breach P13 s3, as at 8ab0943.

### Fresh B

- shop `placeOrder` → Stripe: inside the open transaction, key `${orderId}:${cartVersion}`; browser held, `payment-methods.ts`. P8 s1 breach, unchanged (GSC-2).
- Repeats in P9's Scope: `placeOrder` `cart-closed`, `requestRefund` `refund-exists` on a repeat: breach P9 s1, new. `setCartLine` with `cartId: null`, keyless: Newly broken 1.
- Executors keyed (`refundId`, `cancel:<orderId>`), consignment looked up with race accepted, mail accepted: comply; heading split (Newly broken 3).
- D34 (own `MoneyV1`): complies P13, unchanged. No call between systems of this codebase.

### Watch items

- P8 s1 call after the commit, now open to any use case: P15 s1/s2 refuse it to a use case not called for a message unless a rule needs the act now (confirmation mail by call after the commit: breach s2). A use case called for a message may now call another system after its commit for anything (P15 does not reach it; at 8ab0943 P8's need clause sent it by message); no caller is held and a later step repeats, so no property fails.
- "A caller held on it": decidable from this codebase's call graph (route → service → driven port into the callee's open host service), not from the callee alone: payment's compliance changes when shop drops its rule, with no diff to payment. Not decidable for an external caller.
- "Or decides before it returns" for an act: the act comes after the commit (P8 s1) and the use case commits once (P7), so a decision on the act's outcome is answered, not committed, in that use case; the Why's "the card charged or refused before the order is confirmed" is a later step.
- A call inside the open transaction: acting refused by P8 s1, answering allowed (P8 Why, P16 Why); P15 s1 admits both by need; each in its territory.
- External system without key: P8 s1 no longer asks idempotency; P9 s3 (prevented, corrected, accepted) decides. Loosening at the call after the commit, intended (P8 Why "is P9's").
- Tentative operation by call vs P17: as at 89f239e; asker's (`paymentDueBy`) and taker's (`expiresAt`) moments comply.

## Newly broken

### 1. p9-split-keyless-call-repeat.md
```yaml
breaches: []        # reading A; [P9] under reading B
satisfies: [P7, P10]
situation: a browser retries registration after a timeout; the driving port takes no key
finding: regression
```
```ts
// packages/shop/src/service/register.ts (Fresh A)
export const makeRegister = (d: { tx: ShopTransactions; ids: Ids }) => async (input: { email: Email; name: string; address: Address }) =>
  d.tx.run(async (tx) => {
    if (await d.customers.byEmail(tx, input.email)) return { ok: false, refusal: "emailTaken" } as const; // the retry lands here
    const id = d.ids.customerId();
    await d.customers.save(tx, newCustomer(id, input));
    return { ok: true, customerId: id } as const;
  });
```
P9 Scope now reaches "a call its caller may repeat"; s1 asks the use case to tell a repeat "by the call's key ... or by the records". Reading A: no key, no repeat ("A caller that repeats under a fresh key makes a new request"): complies, and the retry fails where the first succeeded. Reading B: the retry is a repeat (F5 "a call can arrive more than once"): breach, and records cannot tell it from a second person, so only a key the port does not take cures it. Same split: Impl `checkout` resubmitted (second `Order`), Fresh B `setCartLine(cartId: null)`. Which callers "may repeat" no code shows. At 8ab0943 out of Scope.

### 2. p9-split-later-step-keys-by-its-message.md
```yaml
breaches: []        # reading B; [P9] under reading A
satisfies: [P8, P15, P17]
situation: payment's later step repeats the Stripe call startPayment made after its commit
finding: regression
```
```ts
// packages/payment/src/service/reopen-intent.ts — called for payment.private.ReopenIntent (the later step, P8)
export const makeReopenIntent = (d: { payments: PaymentQueries; provider: PaymentProvider }) =>
  async (m: { messageId: string; paymentId: string }) => {
    const p = await d.payments.get(m.paymentId);
    if (p?.status !== "awaiting-customer") return;
    await d.provider.openIntent({ paymentId: p.id, amount: p.amount, idempotencyKey: `reopen:${m.messageId}` }); // startPayment used `intent:${p.id}`
  };
```
P9 s2: "a key the same on every repeat, the message's, the call's or one derived from the committed record". Reading A: every repeat of P8's call, so `reopen:` differs from `intent:` and breaches. Reading B: every repeat of this use case's own change, the message's id: complies, and Stripe opens a second intent for one `Payment`. At 8ab0943 P8 s1 put "idempotent by a record the transaction committed" on the call the later step repeats: refused.

### 3. p9-split-heading-reaches-external-repeat.md
```yaml
breaches: []        # Statement; [P9] if the heading binds
satisfies: [P8, P2]
situation: the confirmation mail executor resends after a stop between send and commit; the provider takes no key
finding: regression
```
```ts
// packages/shop/src/domain/mail.ts (Impl)
export const confirmationRepeat = "accepted" as const;      // the mail provider takes no key
// packages/shop/src/service/send-order-confirmation.ts
await d.mailer.send(orderConfirmation(order, m.locale));      // a redelivery sends again
```
P9 s3 lets a business rule accept the repeat: complies. P9's heading (rule and world) now says "A repeated delivery or call changes no record of the system it reaches": the redelivered executor's call reaches the provider, whose records change twice. At 8ab0943 "no record of this system" held. Fresh A Postmark, Fresh B mail and consignment race the same.

## Noticed

- P7 s2 still rules how other systems are asked ("by such a message, or by the call after the commit that P8 allows"), P8's and P15's question.
- the-world P8 Why "Nothing is asked of another system before the commit" against P16 Why's answering call while the transaction is open.
- Fresh A does not say whether payment's `open` calls Stripe after its commit.
- P15 s2's "it": whether s2 reaches a use case called for a message is unsaid; read so, it refuses executors' calls P15 Why allows.
