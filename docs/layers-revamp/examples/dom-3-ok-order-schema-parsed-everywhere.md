---
breaches: []
satisfies: [DOM-3]
situation: shop's checkout form, server action and optimistic update all build an Order
---

# One `orderSchema`; every builder parses against it

```ts
// shop/domain/order.ts
export const addressSchema = z.object({
    street: z.string().min(1),
    postalCode: z.string().regex(/^\d{5}$/),
    country: z.enum(["DE", "AT"]),
})
export const placeOrderInputSchema = z.object({
    cartId: z.string().uuid(),
    shippingAddress: addressSchema,
})
export type PlaceOrderInput = z.infer<typeof placeOrderInputSchema>

// app/checkout/actions.ts  (driving adapter)
export async function placeOrderAction(form: FormData) {
    const input = placeOrderInputSchema.parse(Object.fromEntries(form))
    return shopServices().placeOrder(input)
}

// app/checkout/CheckoutForm.tsx  (browser)
const form = useForm<PlaceOrderInput>({ resolver: zodResolver(placeOrderInputSchema) })

// shop/service/place-order.ts
const order = placeOrderFromCart(cart, input.shippingAddress, placedAt) // parses orderSchema
```

The address rule, five-digit postal code, two countries, is written once. The browser form, the server action and the service all parse the same schema, so adding `CH` to `country` is one edit, and a renamed field is a compile error in every builder at once. No type is declared beside the schema; `PlaceOrderInput` is inferred.
