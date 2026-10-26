---
breaches: []
satisfies: [TST-4, TST-7]
situation: default-suite test of shop's checkout, whose real adapters reach Postgres and payment's Stripe-backed service
---

# Checkout tested against fake repositories, a fake `TransactionPort` and a fake PaymentIntents

```ts
// shop/test/service/checkout.test.ts
import { createCheckout } from "../../src/service/checkout"
import { FakeOrderRepository, FakeCartRepository, FakeShopOutbox, FakeTransactionPort } from "../fakes"

it("should place the order and write OrderPlaced in the same transaction", async () => {
  // given
  const tx = new FakeTransactionPort()
  const orders = new FakeOrderRepository(tx)
  const carts = new FakeCartRepository(tx, [cartWith({ sku: "TEA-00001", qty: 2, unitPrice: eur(450) })])
  const outbox = new FakeShopOutbox(tx)
  const payment: PaymentIntents = { createIntent: async ({ orderId }) => ({ intentId: `pi_${orderId}`, clientSecret: "secret" }) }
  const checkout = createCheckout({ tx, orders, carts, outbox, payment })

  // when
  const result = await checkout({ cartId: "cart-1" })

  // then
  expect({ order: orders.committed()[0]?.total, messages: outbox.committed().map((m) => m.name), secret: result.clientSecret })
    .toEqual({ order: eur(900), messages: ["OrderPlaced"], secret: "secret" })
})
```

Every port whose real adapter talks to something external, the three Drizzle adapters over
Postgres and payment's service in front of Stripe, is a fake here, so the test runs in
milliseconds with no database and no network, and it can run on every save. The fakes share a fake
`TransactionPort` that exposes what was committed, so the assertion is on stored state and on the
return value. The real adapters are tested where they belong, in the contract suite's integration
run.
