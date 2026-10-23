---
breaches: [DRV-6]
satisfies: [DRV-3, ASM-4]
situation: Next.js server action for checkout, constructed by the framework
finding: adversarial
---

# The server action reads the courier when it runs, once, and keeps what it read

```ts
// app/checkout/actions.ts  (driving adapter Next.js constructs)
"use server"
import { courier } from "@teeladen/common"
import type { ShopOpenHostService } from "@teeladen/shop"

let shop: ShopOpenHostService | undefined          // module scope: "read it once, it never changes"

const shopServices = (): ShopOpenHostService => {
    shop ??= courier.read().shop                   // read at run time, on the first request
    return shop
}

export async function checkoutAction(form: FormData) {
    const { checkout } = shopServices()
    return checkout(checkoutInputSchema.parse(Object.fromEntries(form)))
}

// app/checkout/actions.test.ts
courier.fill({ shop: fakeShop({ checkout: async () => ({ orderId: "o-2", clientSecret: "pi_2" }) }) })
await checkoutAction(form)                         // gets whatever the first test filled, not this fake
```

Nothing runs at module load; the read happens inside the action, when it runs, as the Statement requires. The Why's harm nevertheless arrives in full: the adapter "holds the first instance for the life of the process", so the second test's fake is never seen, and in the dev server a reassembled shop after a hot reload is never seen either. "MUST read on each run and hold nothing between runs" is what the Statement means and does not say.
