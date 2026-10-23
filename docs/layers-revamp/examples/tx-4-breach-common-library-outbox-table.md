---
breaches: [TX-4]
satisfies: []
situation: shop, payment and billing all publish messages from the one Postgres
---

# One `outbox` table and one port in the common library, shared by every system

```ts
// common/outbox.ts
export const outbox = pgTable("outbox", {
  id: uuid("id").primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<unknown>().notNull(),
  deliveredAt: timestamp("delivered_at"),
})
export interface Outbox { write(type: string, payload: unknown, tx: Transaction): Promise<void> }
export const createOutbox = (): Outbox => ({
  write: async (type, payload, tx) => { await asDrizzle(tx).insert(outbox).values({ id: randomUUID(), type, payload }) },
})
export const createOutboxReader = (db: Db): OutboxReader => ({ /* reads the one table, every system's rows */ })

// shop/service/place-order.ts
await outbox.write("OrderPlaced", { orderId: order.id, lines: order.lines }, tx)
// payment/service/record-stripe-event.ts
await outbox.write("PaymentSucceeded", { paymentId: payment.id, orderId: payment.orderId }, tx)
```

The messages belong to nobody. `OrderPlaced` is a string and a `payload: unknown`; its shape is in no
domain, so fulfillment parses whatever shop's service happened to pass, and a renamed key is found at
runtime by the handler. The one reader returns shop's and payment's messages alike, so which system's
transaction a message was written in is whatever `tx` was passed: when shop's price change commits in a
Payload transaction (TX-16), there is no outbox that transaction reaches, and the message is written in
some other one. The common library now holds the only place every system's messages are defined, and no
system's rules decide it.
