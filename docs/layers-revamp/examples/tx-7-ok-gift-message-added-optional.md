---
breaches: []
satisfies: [TX-7]
situation: shop's OrderPlaced gains a gift message; fulfillment's worker is deployed separately
---

# A new optional field on OrderPlaced, with no field renamed, removed or narrowed

```ts
// shop/domain/messages/order-placed.ts
export const orderPlacedSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("OrderPlaced"),
  orderId: orderIdSchema,
  customerId: customerIdSchema,
  placedAt: z.string().datetime(),
  lines: z.array(
    z.object({
      sku: skuSchema,                          // re-used from the domain: narrowing skuSchema is a change to this message
      quantity: z.number().int().positive(),
      unitPrice: moneySchema,
    }),
  ),
  giftMessage: z.string().max(200).optional(),   // added in this change
})
export type OrderPlaced = z.infer<typeof orderPlacedSchema>
```

Fulfillment's worker process restarts on its own schedule, so for a while its handler, on old code,
parses messages new shop code wrote, and new fulfillment code parses `OrderPlaced` rows that waited in
the outbox since before the deploy. The field is optional, so the old rows parse in new code; `z.object`
strips keys it does not know, so the new rows parse in old code, which simply never sees the gift
message. Nothing existing changed name, type or requiredness, and `skuSchema` stayed as it was.
