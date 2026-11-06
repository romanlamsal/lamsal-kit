Base 088b79a, head ba8824e.
Changed: P9 s3 adds "the message's id". P15 Statement: "a caller waiting synchronously for its response" becomes "a caller that waits for its answer, on the open request or by polling for it", and the Why follows. P17 s1: "completing the business process" becomes "completing its part". P17 s4: "decided it" becomes "decided the business process step".

## Previous regression

- P17 s4 "decided it": resolved. It now names the step, as 871bf84 did. Both builds already sent refusals to whoever asked for the step: A's `CardRefundRefused` goes to billing and its 3PL refusal goes to shop as `shipped: 0`; B's `ShipmentRefused` and `CardRefundRefused` go to shop/billing, and `refused` is returned to `openCardPayment`'s caller.
- P9 s3 "neither an idempotency key nor its records": resolved. Under the old wording, a use case called for a message with an id fell under s3 when read literally. Now a message's id that tells the repeat keeps s3 out. A call carries no message, so the new term is empty there and the call reads as before. No new split.
- P17 "completing the business process": resolved. A choreography participant now completes its own part, e.g. A's billing `Refund`, which ends in a credit note. Under orchestration, the orchestrator holds the sequence (glossary), so its part is that sequence. Completing its part means completing what it orchestrates, e.g. B's shop: placed, paid, booked, shipped. Where it holds the whole process, as no build does, that is the whole. Could "completing its part" let a system declare its part done early, e.g. shop at sending `ShipOrder`, to escape the wait clause? No. Scope says the part runs until its last step, and shop's handling of `ShipmentBooked` is a step it takes. The reservation question is still A's S8, older than this change.
- P15 "waiting synchronously" narrower than "held on": resolved. A caller that polls is in again. A caller that asks by message stays out: the use case is then called for a message, so the Statement already excludes it.

## Previous builds

- Fresh A: no change. `placeOrder` awaits `openCardPayment`, a caller waiting on the open request. "Open request" holds whether it means the awaited in-process call or the browser's HTTP request, since both are open while payment calls Stripe. Every P17 part ends by completing its own part, undoing, or accepting. The P9 keys are unchanged, and messages are claimed by id, so they are outside s3.
- Fresh B: no change. `placeOrder`/`payOrder` to `openCardPayment` is the same as A. Its alternative in D16, the browser polling for the secret, is now plainly under the caller clause. Before, it was covered only because each poll was itself a synchronous wait. In both versions the polled use case reads stored records, and the handler that opens the intent is called for a message. Shop orchestrates and billing joins by choreography: each completes its own part.

## Newly broken

None. Checked:
- Polling for what a handler produces (browser polls payment status after Stripe's webhook): the status use case reads shop's record, which the handler wrote, so it depends on no other system answering and P15 is not engaged. If it called Stripe on each poll, the exception would need a business rule that needs Stripe's answer now. The brief has none, and each poll was already a synchronous wait under the base wording, so nothing is newly in. The webhook handler is called for a message and outside the Statement.
- Scheduled bank and stock polls: this system polls another one. It is not a caller polling the use case, so nothing changes.
- Messages whose id differs per delivery: s3 applied before as well.

## Noticed

- P15 "the open request": "request" is in no glossary entry, and an in-process awaited call is called a "call" elsewhere. "On the open call or request" would leave no doubt. No build turns on it.
