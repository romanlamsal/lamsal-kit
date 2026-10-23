---
breaches: []
satisfies: [DRV-1, SYS-11]
situation: Stripe's webhook reaches payment, at least once, out of order, in Stripe's terms
---

# Stripe webhook handler translates, then makes one call

```ts
// payment/adapters/stripe/webhook-route.ts  (driving adapter the framework calls)
import { toPaymentResult, verifySignature } from "./translate"   // anti-corruption layer, Stripe -> payment's terms

export async function POST(req: Request) {
    const { recordPaymentResult } = paymentServices()
    const { stripeWebhookSecret } = paymentServices().config     // assembly produced it

    const event = verifySignature(await req.text(), req.headers.get("stripe-signature") ?? "", stripeWebhookSecret)
    if (!event) return new Response("bad signature", { status: 400 })

    const result = toPaymentResult(event)           // null for event types payment ignores
    if (!result) return new Response("ignored", { status: 200 })

    await recordPaymentResult({
        eventId: event.id,                          // for TX-5's once-per-id
        paymentIntentId: result.paymentIntentId,
        outcome: result.outcome,                     // "succeeded" | "failed"
        occurredAt: result.occurredAt,
    })
    return new Response("ok", { status: 200 })
}
```

Everything before the call is preparing it: checking the signature, translating `payment_intent.succeeded` into payment's own `outcome`, dropping event types payment does not care about. Then one call to one service. Whether this event is a repeat, whether it arrived after a later one, whether the Payment is still in a state that accepts it, is decided by `recordPaymentResult` with what payment has stored (SVC-2), inside its transaction, and a second way in, a replay CLI, gets the same decisions for free.
