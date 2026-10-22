# Layers — examples

Illustrations for the rules in `layers-revised.md`, by rule id. Snippets are pseudo-code; file
names are the codebase's.

## SVC-1 — a service is a factory

```
// service/order.ts
export const createOrderService = (deps: {
  orders: OrderRepository        // driven port, from the domain
  invoices: InvoiceRepository    // driven port, from the domain
  outbox: Outbox                 // driven port, from the domain
  tx: TransactionRunner          // driven port, from the common library
}): OrderService => ({ ... })    // driving port, declared here
```

## SVC-4 — a service writes no table itself

```
// service/order.ts — the fault
ctx.insert(invoices).values({ orderId, total })

// the fix: one call into the owning repository
invoices.createForOrder(ctx, { orderId, total })
```

## DOM-3 — one rule, decided once

```
// domain/invoice.ts — settling also clears dunning, decided once
export const settledPatch = (at) => ({ status: "settled", settledAt: at, dunningStage: 0 })
```

## DRV-1 — a use case grown inside a driving adapter

```
// controller, a driving adapter — the fault
await tx.run(async (ctx) => { /* seven writes, four aggregates */ })

// the fix
await orderService.acceptQuote(orderId)
```

## DRV-2 — the three faults of a repeating caller

- *Same thing again:* a relay replays its whole outbox, and every change is applied twice.
- *Out of order:* `OrderCancelled` arrives before `OrderPlaced`, is taken for a duplicate, and the
  cancellation is lost.
- *Stops delivering:* the adapter throws on an early delivery, and the caller never sends it again.

## ASM-2 — building a dependency instead of receiving it

```
// service/order.ts — the fault
const orders = createPostgresOrderRepository(db)

// the fix: it arrives as an argument, and assembly decides which one
export const createOrderService = ({ orders }: { orders: OrderRepository }) => ...
```

## TX-1, TX-2 — two aggregates, one transaction

```
// service: two aggregates, one transaction
await tx.run(async (ctx) => {
  await orders.markSettled(ctx, orderId)
  await invoices.clearDunning(ctx, orderId)
})
```

## TX-2 — one transaction quietly became several

```
// the fault
for (const line of lines) await tx.run((ctx) => orderLines.insert(ctx, line))

// the fix
await tx.run((ctx) => orderLines.insertMany(ctx, lines))
```

## TX-5 — a message schema change breaks a message in flight

```
// domain/order.ts — OrderPaid, the fault
- total: Money
+ amount: Money   // an OrderPaid still in the outbox has no amount
```

## SYS-1 — a system's export paths

```
// pricing's export paths
// published language and port types: loads only the domain
export type { Pricing } from "./service/pricing.port"
export { Quote, PriceList, PriceListChanged } from "./domain/quote"

// builds the open host service: for a root or another system's build function
export const createPricing = (config: PricingConfig): Pricing => ...
```

## SYS-5 — a translation that changes nothing

```
// adapters/pricing.ts — the fault: a translation that changes nothing
quote: async (cart) => {
  const { total, currency } = await pricing.quote(cart)
  return { total, currency }
}

// the fix: conform, and the service receives the pricing system's driving port
export const createOrderService = ({ pricing }: { pricing: Pricing }) => ...
```

## TST-6 — one contract suite, two runs

```
describeContract("OrderRepository", () => createFakeOrderRepository())
describeContract("OrderRepository", () => createPostgresOrderRepository(testDb))
```
