---
breaches: [TST-4]
satisfies: []
situation: default-suite test of shop's checkout wired to a local Postgres and Stripe's test mode "because the fake does not test the real queries"
---

# Checkout tested with the real Drizzle repositories and payment against Stripe test mode

```ts
// shop/test/service/checkout.test.ts
import { Pool } from "pg"
import { createTransactionPort } from "@teeladen/common"
import { buildPayment } from "@teeladen/payment"
import { createCheckout } from "../../src/service/checkout"
import { createOrderRepository, createCartRepository, createShopOutbox } from "../../src/adapters/drizzle"

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgres://localhost/teeladen_test" })
const tx = createTransactionPort(pool)
const payment = buildPayment({ tx, stripe: { secretKey: process.env.STRIPE_TEST_KEY! } })

beforeEach(() => pool.query("truncate orders, order_lines, carts, shop_outbox"))

it("should place the order", async () => {
  // given
  await seedCart(pool, "cart-1", [{ sku: "TEA-00001", qty: 2, unitPrice: 450 }])
  const checkout = createCheckout({ tx, orders: createOrderRepository(tx), carts: createCartRepository(tx), outbox: createShopOutbox(tx), payment: payment.payments })
  // when
  const result = await checkout({ cartId: "cart-1" })
  // then
  expect((await pool.query("select total from orders where id = $1", [result.orderId])).rows[0].total).toBe(900)
})
```

This test sits in the suite that runs on every save, and it needs a Postgres on `localhost`, a
Stripe test key in the environment and the network to Stripe: on a laptop without them it fails
before it asserts, and from then on `--exclude` grows and the suite runs on CI only. It also
creates a real PaymentIntent on every run, so the test of a shop use case is now gated by a third
party's uptime. The doubt about the fake is real and is answered by the contract suite's run
against the real adapter, not by making every service test an integration test.
