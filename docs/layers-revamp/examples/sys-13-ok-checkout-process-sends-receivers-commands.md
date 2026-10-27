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

// shop/domain/checkout-process.ts — the process manager: its state is where the checkout stands,
// its business rules decide the next command
import { reserveStock } from "@teeladen/fulfillment/published"
import { createPayment } from "@teeladen/payment/published"

export const start = (orderId: string, lines: Line[], total: Money): Next => ({
  process: { orderId, total, stage: "reserving" },
  messages: [reserveStock({ orderId, lines })],
})
export const whenStockReserved = (process: Process): Next => ({
  process: { ...process, stage: "paying" },
  messages: [createPayment({ orderId: process.orderId, amount: process.total })],
})

// shop/service/checkout-process.ts — the use cases: load, ask the domain, save, write

export const createCheckoutProcess =
  ({ transaction, processes, outbox }: Deps): CheckoutProcess => ({
    onOrderPlaced: ({ orderId, lines, total }) =>
      transaction.run(async (tx) => {
        const next = start(orderId, lines, total)                         // domain: reserve the stock first
        await processes.save(next, tx)
        for (const message of next.messages) await outbox.write(message, tx)   // fulfillment's ReserveStock
      }),
    onStockReserved: ({ orderId }) =>
      transaction.run(async (tx) => {
        const process = await processes.byOrderId(orderId, tx)
        const next = whenStockReserved(process)                           // domain: payment next
        await processes.save(next, tx)
        for (const message of next.messages) await outbox.write(message, tx)   // payment's CreatePayment
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
here, so its domain imports them (DOM-1). Each step writes the commands its process manager
decided in the transaction that records where the process stands. A refused reservation is an
event fulfillment publishes, and shop's domain decides what follows. Whether the saga is
orchestrated like this or choreographed, as the fixture's five steps read, the rules do not say.
