---
breaches: [ASM-2]
satisfies: []
situation: payment calls Stripe from its driven adapter; the Stripe SDK is configured once with the secret key
---

# The Stripe client moves into the common library as plumbing "with one configuration for the whole process"

```ts
// common/src/stripe.ts  (plumbing, one configuration per process, like pino)
import Stripe from "stripe"
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", { apiVersion: "2025-01-27.acacia" })

// payment/adapters/stripe/payment-gateway.ts  (driven adapter)
import { stripe } from "@teeladen/common/stripe"      // imported ready-made, as ASM-7 permits for a logger
import type { PaymentGateway } from "../../service/ports"

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

The Stripe client is one instance per process, configured once from one key, so it looks like the
logger beside it. ASM-7's Scope is plumbing whose output changes nothing the system does or
returns, and the Stripe client's answers decide whether a payment exists: it is a client of
something outside the process, which ASM-2 has the gateway's factory receive. Imported
ready-made, it is substituted the only way left, by module mock, and the gateway's contract suite
and payment's service tests patch a module instead of handing the factory a fake.
