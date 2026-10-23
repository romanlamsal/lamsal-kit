---
breaches: []
satisfies: [DRV-6, DRV-3]
situation: Next.js loads shop's server action module while assembly may still be running
---

# Courier read inside the function body

```ts
// app/orders/[id]/actions.ts  (driving adapter the framework constructs)
"use server"

import { shopServices } from "@teeladen/shop/courier-key"
import { cancelOrderInputSchema } from "@teeladen/shop"

export async function cancelOrderAction(raw: unknown) {
    const { cancelOrder } = shopServices()        // read now, with this request
    const input = cancelOrderInputSchema.parse(raw)
    return cancelOrder({ ...input, now: new Date() })
}

// shop/test/actions/cancel-order.test.ts
it("should hand the parsed input to cancelOrder", async () => {
    // given
    const cancelOrder = vi.fn<CancelOrder>().mockResolvedValue(cancelledOrder)
    provide(shopServicesKey, fakeShopServices({ cancelOrder }))
    // when
    await cancelOrderAction({ orderId: "o-1", requestedBy: { kind: "system" } })
    // then
    expect(cancelOrder).toHaveBeenCalledWith(expect.objectContaining({ orderId: "o-1" }))
})
```

The module imports only the courier accessor and a schema; the read happens when the action runs, by which time assembly has filled the courier. The test fills it with a fake first and the action picks that up, because it holds nothing from load time.
