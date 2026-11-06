Base 9b01199, head 06e705e.
Changed: P7 Statement drops "and the record of the message it is called for"; glossary Driving adapter drops "There are as many driving adapters as there are ways into the process."; P15 Why "asks" to "may ask".

## Previous findings

- **R05-12, resolved.** The three readings were (a) a handled-message row always (Fresh A 05 S12, `handleOnce` everywhere), (b) whatever record tells the repeat (Impl D5/S3), and (c) where the claim sits relative to an outside call (Fresh B 05 S6). Head P7 names no record of the message. P9 s1 allows "or by the records it writes there", so (a) and (b) both comply: no rule asks for the row and none forbids it. A use case that tells repeats by its records (`refreshListing`, `expireOrder`) now complies with P7 with no claim. Where a build does claim, P9 s1 still ties the claim to the committing transaction ("claimed there"), and P7's "carries every write the use case makes" covers it a second time. (c): both of Fresh B 05's readings keep the claim in the committing transaction, so both comply with P9 s1. Reading B came from P7 asking for the record in the transaction, and head P7 no longer asks. Whether the outside call comes before or after that transaction is a question for P8 and P9 s2 (the key), which did not change.
- **R05-24, resolved.** The count sentence is gone, so the split between one adapter per transport and one per entry no longer rests on any binding text. Every use of the term at head: P4 Scope ("whichever driving adapter"); P4 Statement (one acting call "per call or message it handles": counted per call, not per adapter); P5 Statement ("a driving adapter's way in", courier read "each time it runs"); P9 Scope ("a driving adapter asked another system"); glossary entries Use case, Handler, Hook, Scheduled task, Assembly, Courier. None of them counts adapters, so none loses its footing.
- **R05-29, resolved.** "May ask" makes the deadline reconciliation an example, not a duty. The P15 Statement is unchanged. Deciding on the `Order` alone (Fresh B) and asking Stripe (Fresh A D19) both stand. In both builds the deadline use case is called for a message, so it is outside P15 s1 anyway.

## Previous builds

- **Fresh A, in, unchanged.** Every handler-called use case claims `handled_messages` through `HandledMessages.claim(tx, …)` inside `transactions.run`, so P9 s1 and P7's "every write" still bind the claim. `handled_requests` (operator calls) is covered by P9 s1's "call's idempotency key claimed there". Checkout and invoices tell repeats by records (`orders.cart_id`, `invoices.order_id`), which complied before and after. D19 asks Stripe from the message-called `expireUnpaidCardOrder`. S16 (P4 one acting call) rests on "per call or message", not on the count.
- **Fresh B, in, unchanged.** `Claims.claim(tx, …)` sits in `Transactions.run` (its P7 and P9 sections). S19, one `/api/hooks/3pl` route that routes by event type, picked the "one per transport" reading of the count. The count is gone, the route still "adapts one way in", and P4's one acting call per event holds. The deadline is decided on `Order.payBy` alone, and `ReconcileIntent` asks Stripe from a held message; both stand.

## Newly broken

none

## Noticed

1. P7 Why still lists "the record of handled messages" among the calls that take the transaction. This fits head (a claim, where one is made, is a write) and binds nobody.
2. Glossary "adapts one way in" leaves the grain open (per transport or per entry). No rule rests on it, so no split.
3. Fresh B 05 S6's question of whether the outside call comes before or after the claim's transaction now rests wholly on P8 and P9 s2, which this change did not touch.
