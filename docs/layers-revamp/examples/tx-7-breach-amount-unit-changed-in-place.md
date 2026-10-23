---
breaches: [TX-7]
satisfies: []
situation: billing creates an invoice on shop's OrderPaid; shop's Money moves from cents to a decimal string
finding: adversarial
---

# `OrderPaid.amount` keeps its name and type and changes what it means

```ts
// shop/domain/messages.ts — before
export const orderPaidSchema = z.object({
    id: z.string(), type: z.literal("OrderPaid"), orderId: z.string(),
    amount: z.number().int(),                 // minor units: 1999 is 19.99 EUR
    currency: z.literal("EUR"),
})

// shop/domain/messages.ts — after: no field renamed, removed, made required or narrowed
export const orderPaidSchema = z.object({
    id: z.string(), type: z.literal("OrderPaid"), orderId: z.string(),
    amount: z.number(),                       // major units now: 19.99; widened from int to number
    currency: z.literal("EUR"),
})

// billing/service/issue-invoice.ts  (new code, reading a message written before the deploy)
const invoice = issueInvoice(order, Money.fromMajor(message.amount, message.currency))   // 1999.00 EUR
```

Every old message parses under the new schema and every new message under the old: `amount` is still a number, nothing was renamed, removed, required or narrowed, so the Statement is satisfied as written, and readability, which the Statement names, holds in both directions. The Why's harm is exact: the message in the outbox written before the deploy is handled after it, and billing issues a gapless invoice over 1999 euros that cannot be deleted, with no runtime error, because "readable" is not "means the same". "No field renamed, removed, made required, narrowed, or given another meaning: a new meaning is a new field" is the missing clause.
