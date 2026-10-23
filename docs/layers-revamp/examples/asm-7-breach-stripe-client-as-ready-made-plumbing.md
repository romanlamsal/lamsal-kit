---
breaches: [ASM-7]
satisfies: []
situation: payment calls Stripe from its driven adapter; the Stripe SDK is configured once with the secret key
finding: adversarial
---

# The Stripe client moves into the common library as plumbing "with one configuration for the whole process"

```ts
// common/src/stripe.ts  (plumbing, one configuration per process, like pino)
import Stripe from "stripe"
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2025-01-27.acacia" })

// payment/adapters/stripe/payment-gateway.ts  (driven adapter)
import { stripe } from "@teeladen/common/stripe"      // imported ready-made, as ASM-7 permits for a logger
import type { PaymentGateway } from "../../domain/ports"

export const createStripePaymentGateway = (): PaymentGateway => ({
    createIntent: async ({ amount, currency, orderId }) => {
        const intent = await stripe.paymentIntents.create(
            { amount: amount.minorUnits, currency, metadata: { orderId } },
            { idempotencyKey: orderId },
        )
        return { intentId: intent.id, clientSecret: intent.client_secret ?? "" }
    },
})

// payment/test/service/request-payment.test.ts
vi.mock("@teeladen/common/stripe", () => ({ stripe: { paymentIntents: { create: vi.fn() } } }))
```

The Stripe client is one instance per process, configured once from one key, so it matches the Scope's "plumbing of the common library with one configuration for the whole process" and the Statement's MAY lets the adapter import it ready-made. The Why's line, substitution, is what the Scope does not carry: the gateway's contract suite and payment's service tests have to substitute Stripe, and they do it the way `asm-7-breach-logger-substituted-by-module-mock.md` does, by module mock, which is ASM-2's harm back and a second place where port and implementation meet. A Scope of "plumbing nobody substitutes: a logger, a tracer" makes the Why's test the rule's test, and leaves the Stripe client to DVN-2's factory.
