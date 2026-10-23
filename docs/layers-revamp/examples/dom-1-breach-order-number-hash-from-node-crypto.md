---
breaches: [DOM-1]
satisfies: []
situation: shop derives a customer-facing order number from the order id
finding: adversarial
---

# The domain hashes the order id with `node:crypto`, which computes from its arguments

```ts
// shop/domain/order-number.ts
import { createHash } from "node:crypto"          // pure: same input, same output, reaches nothing
import { Buffer } from "node:buffer"

export const orderNumber = (orderId: string, placedAt: Date): string => {
    const digest = createHash("sha256")
        .update(orderId)
        .update(placedAt.toISOString())
        .digest()
    const short = Buffer.from(digest.subarray(0, 5)).toString("base64url").toUpperCase()
    return `TEE-${placedAt.getUTCFullYear()}-${short}`
}

// app/checkout/confirmation.tsx  (browser bundle, renders the number optimistically)
import { orderNumber } from "@teeladen/shop"
```

`createHash` and `Buffer` compute from their arguments and reach nothing outside the process, so the import is "a library that computes from its arguments" and the Statement is met word for word. The Why's second question, does it exist on every runtime, is the one that fails: the confirmation page imports the domain for the number and the browser bundle has no `node:crypto`, so the schema import that sits beside it fails to load as well. The Statement names only the Why's first test; "a library that computes from its arguments and loads on every runtime the domain is imported into" would have caught it.
