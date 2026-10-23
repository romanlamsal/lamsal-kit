---
breaches: [TX-7]
satisfies: []
situation: shop's OrderPlaced is cleaned up during a rename in the shop domain
---

# `customerId` becomes `buyerId` and `quantity` gets a ceiling, in the message schema

```ts
// shop/domain/messages/order-placed.ts
export const orderPlacedSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("OrderPlaced"),
  orderId: orderIdSchema,
  buyerId: customerIdSchema,                      // was customerId; renamed with the Order aggregate's field
  placedAt: z.string().datetime(),
  lines: z.array(
    z.object({
      sku: skuSchema,
      quantity: z.number().int().positive().max(50),   // new business rule, applied to the message too
      unitPrice: moneySchema,
    }),
  ),
})

// fulfillment/driving/handlers.ts  (conformist: parses with shop's published schema)
OrderPlaced: async (raw: unknown) => {
  await reserveStock(orderPlacedSchema.parse(raw))   // throws ZodError on every pre-deploy row
},
```

The compiler is happy: every `message.customerId` in shop and fulfillment was renamed along. The rows
already sitting in `shop_outbox`, and the ones a not-yet-restarted shop process keeps writing, carry
`customerId`, and the new handler's `parse` rejects each of them, forever, because nobody re-sends a
message. The `.max(50)` does the same for any old order with a 60-unit line, which was valid when it was
placed. A handler still on old code meanwhile reads new rows and finds no `customerId` at all.
