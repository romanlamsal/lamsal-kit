---
breaches: [DOM-3]
satisfies: []
situation: shop's checkout server action validates the shipping address with its own schema
---

# Server action declares a second address schema

```ts
// app/checkout/actions.ts  (driving adapter)
import { z } from "zod"

const checkoutFormSchema = z.object({
    cartId: z.string(),
    street: z.string().min(1),
    postalCode: z.string().min(4),
    country: z.string().length(2),
})

export async function placeOrderAction(form: FormData) {
    const parsed = checkoutFormSchema.parse(Object.fromEntries(form))
    return shopServices().placeOrder({
        cartId: parsed.cartId,
        shippingAddress: {
            street: parsed.street,
            postalCode: parsed.postalCode,
            country: parsed.country,
        },
    })
}

// shop/domain/order.ts, meanwhile
export const addressSchema = z.object({
    street: z.string().min(1),
    postalCode: z.string().regex(/^\d{5}$/),
    country: z.enum(["DE", "AT"]),
})
```

The form's fields are flat, so the developer writes a flat schema beside the action and maps it onto the domain's shape. Now the address rule exists twice: the action accepts `country: "FR"` and a four-digit postal code, the domain rejects them, and the user sees a server error instead of a field error. When `country` gains `CH` in the domain, nothing in the action changes and nothing tells anyone it should. The adapter flattens the form, then parses `placeOrderInputSchema`.
