---
breaches: [TST-8]
satisfies: []
situation: payment's StripeGateway contract suite switched to the real adapter by uncommenting an import
---

# Switching to Stripe's test mode means editing the test file

```ts
// payment/test/contracts/stripe-gateway.contract.test.ts
import { stripeGatewayContract } from "./stripe-gateway.contract"
import { FakeStripeGateway } from "../fakes/fake-stripe-gateway"
// import { createStripeGateway } from "../../src/adapters/stripe-gateway"

// To run against Stripe test mode: comment the fake, uncomment the real one, export STRIPE_TEST_KEY.
// Do not commit with the real one active, the default suite has no network.
const open = async () => new FakeStripeGateway()
// const open = async () => createStripeGateway({ secretKey: process.env.STRIPE_TEST_KEY! })

describe("StripeGateway", () => stripeGatewayContract(open))
```

The real run exists in a comment. Nobody runs it before a release, because doing so means editing a
file, remembering to edit it back, and once or twice committing it edited; after the second
accidental commit breaks the default suite on CI, the comment is deleted "for now". From then on
the fake's `PaymentIntent` keeps the field Stripe renamed two API versions ago, every payment
service test passes against it, and the first `PaymentSucceeded` webhook in production that the
handler cannot parse is how the drift is found.
