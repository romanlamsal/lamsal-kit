---
breaches: []
satisfies: [SYS-13, TX-3, TX-6, TX-35]
situation: the checkout saga, orchestrated by a process manager in shop instead of choreographed
---

# Shop's checkout process sends each receiver the command its published language declares

```ts
// fulfillment/published/commands.ts  — fulfillment's published language declares what it takes
export const reserveStockSchema = z.object({
  id: z.string().uuid(), type: z.literal("ReserveStock"),
  orderId: z.string(), lines: z.array(z.object({ sku: skuSchema, quantity: z.number().int().positive() })),
})

// shop/service/checkout-process.ts — a process manager: its state is where the checkout stands
import { reserveStock, releaseStock } from "@teeladen/fulfillment/published"
import { createPayment } from "@teeladen/payment/published"

export const createCheckoutProcess =
  ({ transaction, processes, outbox }: Deps): CheckoutProcess => ({
    onOrderPlaced: ({ orderId, lines }) =>
      transaction.run(async (tx) => {
        await processes.save(started(orderId), tx)
        await outbox.write(reserveStock({ orderId, lines }), tx)          // fulfillment's command
      }),
    onStockReserved: ({ orderId }) =>
      transaction.run(async (tx) => {
        const process = await processes.byOrderId(orderId, tx)
        await processes.save(reserved(process), tx)
        await outbox.write(createPayment({ orderId, amount: process.total }), tx)   // payment's command
      }),
    onStockReservationRefused: ({ orderId }) =>
      transaction.run(async (tx) => {
        const process = await processes.byOrderId(orderId, tx)
        const next = whenReservationRefused(process)                      // domain: cancel the order
        await processes.save(next, tx)
        for (const message of next.messages) await outbox.write(message, tx)
      }),
  })
```

Shop imports each command from its receiver's export path, as a downstream imports a driving port
type: fulfillment declares `ReserveStock` and changes it on its own terms. Shop conforms to both
here, so its service imports them (SVC-6). Each step writes the
command in the transaction that records where the process stands. A refused reservation is an event
fulfillment publishes, and shop's domain decides what follows. Whether the saga is orchestrated like
this or choreographed, as the fixture's five steps read, the rules do not say; it is a repository's
choice (Assumptions).
