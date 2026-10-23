---
breaches: []
satisfies: [TST-8, TST-6]
situation: payment's StripeGateway driven port has a fake and a real adapter against Stripe's test mode
---

# The contract suite picks the fake or the real Stripe adapter from an environment flag

```ts
// payment/test/contracts/stripe-gateway.contract.test.ts
import { stripeGatewayContract } from "./stripe-gateway.contract"
import { FakeStripeGateway } from "../fakes/fake-stripe-gateway"
import { createStripeGateway } from "../../src/adapters/stripe-gateway"

const real = process.env.TEELADEN_INTEGRATION === "1"

const implementations = [
  { name: "fake", open: async () => new FakeStripeGateway() },
  ...(real
    ? [{ name: "stripe test mode", open: async () => createStripeGateway({ secretKey: requireEnv("STRIPE_TEST_KEY") }) }]
    : []),
]

describe.each(implementations)("StripeGateway: $name", ({ open }) => stripeGatewayContract(open))

// package.json
// "test":             "vitest run",
// "test:integration": "TEELADEN_INTEGRATION=1 vitest run"
```

`pnpm test` runs the contract against the fake and nothing else; `pnpm test:integration` runs the
same file again with the real adapter in the list, and CI runs the second on a schedule and before
a release. When a webhook test fails and someone doubts the fake's idea of a `payment_intent`,
reaching for the real thing is one command, so it gets reached for, and a fake that drifted from
Stripe's actual response shape fails the same `it` the fake passed. No import changes hands
between the two runs.
