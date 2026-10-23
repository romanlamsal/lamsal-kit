---
breaches: [SYS-2]
satisfies: [SYS-10, DOM-3]
situation: shop declares its published language; billing and fulfillment import it
finding: adversarial
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

// packages/billing/domain/invoice.ts  (billing conforms, SYS-5, and reaches for what is there)
import { couponSchema, paymentDeadlineSchema } from "@teeladen/shop"

export const invoiceSchema = z.object({
    orderId: z.string(),
    appliedCoupon: couponSchema.optional(),              // shop's internal coupon shape, now billing's contract
    dueBy: paymentDeadlineSchema,                        // shop's internal deadline rule, now billing's contract
})
```

The published language is the domain's own schemas re-exported, with the published messages in and the private message schemas out, so the Statement is satisfied word for word, and the path loads the domain only. The Why's harm turns up on the schemas the Statement did not mention: `couponSchema` and `paymentDeadlineSchema` are shop's internal model, no driving port takes or returns them, and once billing parses with them a change to shop's discount rule is a change to billing's invoice, the "contract the system did not mean to give" that the Why names for private messages only. The glossary's published language is "the schemas, types and errors its driving ports take, return and raise, and its published messages"; "It MUST be those of the domain's own schemas its driving ports take, return and raise, re-exported, the published messages included" would have kept the re-export to that set.
