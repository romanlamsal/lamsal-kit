---
breaches: [SYS-2, SYS-10]
satisfies: []
situation: shop declares its published language; billing and fulfillment import it
---

# Shop's published language is every domain schema, re-exported

```ts
// packages/shop/domain/schemas/index.ts
export * from "./order"            // orderSchema, orderLineSchema, paymentDeadlineSchema
export * from "./cart"             // cartSchema, cartLineSchema, cartMergeSchema
export * from "./pricing"          // priceListSchema, discountRuleSchema, couponSchema
export * from "./messages/published"   // orderPlacedSchema, orderPaidSchema, orderCancelledSchema

// packages/shop/index.ts  (published language: the domain's own schemas, re-exported; private messages excluded)
export * from "./domain/schemas"
export type { PlaceOrder, Checkout, CancelOrder } from "./service/ports"

// packages/billing/domain/invoice.ts  (billing conforms, and reaches for what is there)
import { couponSchema, paymentDeadlineSchema } from "@teeladen/shop"

export const invoiceSchema = z.object({
    orderId: z.string(),
    appliedCoupon: couponSchema.optional(),              // shop's internal coupon shape, now billing's contract
    dueBy: paymentDeadlineSchema,                        // shop's internal deadline rule, now billing's contract
})
```

The published language is the domain's own schemas re-exported, so the modules that declare it
import the domain wholesale, and the path loads every domain module behind it (SYS-10). The harm
lands on schemas nobody meant to offer: `couponSchema` and `paymentDeadlineSchema` are shop's
internal model, no driving port takes or returns them, and once billing parses with them a change
to shop's discount rule is a change to billing's invoice.
