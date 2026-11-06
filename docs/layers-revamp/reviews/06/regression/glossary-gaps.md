Base 871bf84, head 088b79a.
Changed: glossary adds Idempotency key, Business process, Business process step, and rewords Saga, Choreography, Orchestration and Reconciliation over them. P9 s1 and s2 say "idempotency key". P8 "a later step" becomes "a later use case". P15 "held on it" becomes "waiting synchronously for its response". P17's heading (world and rules), Scope and Statement say "business process" and "business process step". P12 s2 drops "nor any shared kernel". Whys of P12, P15 and P16 change.

## Previous findings

- PK-2: resolved. No binding text says "a shared kernel both share" any more, so it no longer matters whether the kernel is the package or each module. A published language still cannot reach a kernel. A sharer's is refused by P13 s3: the kernel is part of the sharer's domain, so it is "of their system" outside the published language. A non-sharer's is refused by P13 s1: the kernel is on no offer. Running common-library code that imports the kernel changes nothing, since that code is judged as if written in the published language.
- R05-16 (claim key per consumer): unchanged. s1 drops "under a key", so it no longer hints at a composite key. But "the use case MUST tell a repeat ... claimed there" still makes the claim the use case's own. Keying by the id alone would visibly skip a second handler of the same message, so no implementer would build it. Both builds use `(handler, message_id)` or `(use_case, key)` and still comply.
- R05-24 (Driving adapter count): out of scope. The Driving adapter entry is untouched.
- R05-29 (P15 Why: deadline reconciliation permitted or expected): unchanged. The Why sentence is the same. The new s1 wording is about the caller, and the reconciliation is started by the clock or a message.
- R05-31 (words used but not in the glossary): partly resolved. *step*, *work spanning systems* and the P9 *key* are now glossary terms, and no bare "step" is left in any Scope or Statement. *part* (P17), *claim* (P9), *envelope*, *export path*, *dead-letter queue*, *sweep*, *contract*, *way in* and the others in Impl N15 remain unglossed.
- R05-5, R05-10, R05-12, R05-15 (P17, P15 and P9 neighbours): unchanged. Their clauses (P17 s2, P15 s2, P9 "or by the records it writes there") read as before. P8 "a later use case" builds as "a later step" did, a resubmitted checkout or the reconciliation included.

## Previous builds

- Fresh A: no change. Stripe keys `pi:`, `cancel:` and `refund:<cardRefundId>` are idempotency keys under the new definition. Two use cases (`onOrderCancelled` and `applyStripeEvent`) derive the same full-refund id, so "whichever use case makes it" holds. If the 3PL tells no repeat by client reference, the reference is now plainly no idempotency key and s4 applies; the lookup under the row lock prevents the repeat, which the brief's rule allows (D17). P15 `placeOrder` to `openCardPayment` is a synchronous wait. All of its P17 parts are parts of business processes, with none newly in or out. Published languages stay kernel-free (S15).
- Fresh B: no change. It still breaches through `published-closed` admitting the kernel. P12 s2 no longer names this, but P13 s3 refuses it as before. Its P9 keys comply: `payment:<paymentId>`, `refund:<refundId>` "whether shop or billing asked" (S11), `orderRef` unique at the 3PL, and PUT by sku. `PlaceOrder` and `PayOrder` repeat `openCardPayment` under one `orderRef`. Its mixed orchestration and choreography saga is still under P17's Scope. S20 holds.

## Newly broken

None. Checked:
- The Idempotency key definition says "what a call carries". This fits s1's incoming call (cart id, operator form key) and s2's outside changes, since each is a call: Stripe key, 3PL reference, PUT by sku.
- "Whichever use case makes it" loses nothing against "whichever message or step". Payment's step reopening the intent is a use case and must carry the key derived from the `Payment`. A new message asking for the same change is "every attempt at the change".
- "Business process spanning systems" against "work spanning systems": every cross-system flow in both builds serves a brief case (order, article listing, refund, transfer, mail, stock), so nothing new falls in or out. Business processes run in one system stay outside, as before.
- P15 "waiting synchronously for its response": every caller the builds hold (checkout's call to payment) waits synchronously.
- Dropping the P12 kernel clause: see PK-2. No route left from a published language to a kernel.

## Noticed

- P17 s4 "reach the system that decided it": base said "decided the step". "it" could be read as the refusal, which makes the clause vacuous, since the refuser has its own refusal. "its outcome" points to the step, and that is the sensible reading. Restoring "the step" costs nothing.
- P9 s3 "Where neither an idempotency key nor its records tell a repeat": by the glossary a message's id is no idempotency key. Read literally, s3 then covers a use case called for a message that has an id. The glossary's "A message's id does this for the message" and the world's Except ("nothing it carries") close it, but "a key" or "the message's id or an idempotency key" would state it outright.
- P17 "completing the business process": business process now names the whole case (placed, paid, shipped, invoiced). A choreography participant cannot complete that. It reads "completing its part", the same scale gap "the work" had.
- P15 "waiting synchronously" is a little narrower than "held on". A caller that awaits the answer asynchronously, by polling, is no longer covered. No build has one.
