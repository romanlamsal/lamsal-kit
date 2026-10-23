---
breaches: [ASM-8, ASM-1]
satisfies: []
situation: checkout route fills the courier on the first request after a cold start; Payload hooks read the same courier
---

# The checkout route builds shop itself when it finds the courier empty

```ts
// apps/web/app/api/checkout/route.ts
import { courier, createTransactionPort } from "@teeladen/common"

async function shopFromCourier(): Promise<ShopOpenHostService> {
  const found = courier.tryRead()
  if (found) return found.shop
  // cold start: nobody has built anything yet, so build what this route needs and remember it
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const tx = createTransactionPort(pool)
  const payload = await getPayload({ config })
  const billing = buildBilling({ tx })
  const payment = buildPayment({ tx, stripe: { secretKey: process.env.STRIPE_SECRET_KEY } })
  const shop = buildShop({ tx, catalog: createPayloadCatalog(payload), billing: billing.invoicing, payment: payment.payments })
  courier.fill({ shop, billing, payment })
  return shop
}

export async function POST(request: Request) {
  const shop = await shopFromCourier()
  const input = CheckoutInput.parse(await request.json())
  return Response.json(await shop.checkout(input))
}
```

The courier is filled late and by a driving adapter. An editor who saves a product after a deploy,
before anyone checks out, fires shop's `afterChange` hook, which reads an empty courier and fails
the save. Two checkouts racing on a cold start both see the courier empty and both build: two pools,
two payment instances, and the second `fill` replaces what the first request is still using. The
route is now a second assembly, so the graph of what shop depends on is written here and again in
whatever fills the courier for the dunning scheduled task, and the two drift.
