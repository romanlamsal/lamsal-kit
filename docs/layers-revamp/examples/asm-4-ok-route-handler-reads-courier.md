---
breaches: []
satisfies: [ASM-4, DRV-3, DRV-6]
situation: Next.js route handler for checkout, constructed by the framework, not by assembly
---

# The checkout route reads shop's open host service from the courier when it runs

```ts
// apps/web/app/api/checkout/route.ts — Next.js discovers and calls this; assembly never sees it
import { courier } from "@teeladen/common"
import { CheckoutInput } from "@teeladen/shop/language"

export async function POST(request: Request) {
  const { shop } = courier.read()                              // per call, after register() filled it
  const parsed = CheckoutInput.safeParse(await request.json())
  if (!parsed.success) return Response.json({ errors: parsed.error.issues }, { status: 400 })

  const result = await shop.checkout(parsed.data)              // one call, one service
  return Response.json({ orderId: result.orderId, clientSecret: result.clientSecret })
}

// apps/web/test/api/checkout.route.test.ts
it("should return the client secret checkout returns", async () => {
  // given
  const shop = fakeShop({ checkout: async () => ({ orderId: "o-1", clientSecret: "pi_secret" }) })
  courier.fill({ shop })
  // when
  const res = await POST(new Request("http://t/api/checkout", { method: "POST", body: JSON.stringify({ cartId: "c-1" }) }))
  // then
  expect(await res.json()).toEqual({ orderId: "o-1", clientSecret: "pi_secret" })
})
```

The route is a driving adapter Next.js constructs; no caller exists to hand it `shop`, so it is
the one kind of code that may read the courier. It reads inside `POST`, so the module can be
discovered before `register()` runs and still gets the instance assembly produced, and the test
fills the courier with a fake and the same module under test gets the fake. Everything the route
depends on remains visible in assembly, where the courier is filled.
