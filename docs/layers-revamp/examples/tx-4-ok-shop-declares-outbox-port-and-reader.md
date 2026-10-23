---
breaches: []
satisfies: [TX-4]
situation: shop publishes OrderPlaced, OrderPaid, OrderCancelled and keeps SendOrderConfirmation private
---

# Shop's outbox: port in shop's domain, Drizzle adapter and outbox reader in shop's driven side

```ts
// shop/domain/ports/outbox.ts
export const shopMessageSchema = z.discriminatedUnion("type", [
  orderPlacedSchema, orderPaidSchema, orderCancelledSchema, sendOrderConfirmationSchema,
])
export type ShopMessage = z.infer<typeof shopMessageSchema>
export interface ShopOutbox { write(message: ShopMessage, tx: Transaction): Promise<void> }

// shop/driven/drizzle/outbox.ts
export const createDrizzleShopOutbox = (): ShopOutbox => ({
  write: async (message, tx) => {
    await asDrizzle(tx).insert(shopOutbox).values({ id: message.id, type: message.type, payload: message })
  },
})
export const createShopOutboxReader = (db: Db): OutboxReader => ({   // OutboxReader: the relay's type, common library
  pending: async (limit) =>
    (await db.select().from(shopOutbox).where(isNull(shopOutbox.deliveredAt)).limit(limit)).map(toEnvelope),
  markDelivered: async (ids) => {
    await db.update(shopOutbox).set({ deliveredAt: new Date() }).where(inArray(shopOutbox.id, ids))
  },
})

// shop/system-builder.ts
export const buildShopWorker = ({ db, transaction }: Config) => ({
  handlers: buildShopHandlers(/* ... */),
  outboxReaders: [createShopOutboxReader(db)],   // assembly hands these to the relay
})
```

The outbox port is a driven port shop declares in its domain, typed by shop's own message schemas; the
table, the adapter and the outbox reader are shop's. The messages are shop's records: their shape is a
domain schema, they are written in shop's transactions, and the relay learns of them only through the
reader shop's system builder returns. The relay imports nothing of shop (ASM-5) and shop imports
nothing of the relay but the reader's type.
