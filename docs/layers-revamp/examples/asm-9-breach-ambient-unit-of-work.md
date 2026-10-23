---
breaches: [ASM-9]
satisfies: []
situation: common library transaction port with ambient unit of work in AsyncLocalStorage; shop calls billing's open host service in-process while holding it
---

# Repositories read the transaction from `AsyncLocalStorage`; billing's reads join shop's transaction unasked

```ts
// common/src/transaction.ts — the fixture's transaction port, ambient unit of work
const uow = new AsyncLocalStorage<PoolClient>()
export const createTransactionPort = (pool: Pool) => ({
  run: <T>(fn: () => Promise<T>): Promise<T> =>
    pool.connect().then((client) => uow.run(client, () => withBeginCommit(client, fn))),
  current: (): PoolClient | undefined => uow.getStore(),
})

// shop/src/adapters/drizzle-order-repository.ts — no transaction in the signature
export const createOrderRepository = (db: Database, tx: TransactionPort): OrderRepository => ({
  async save(order) {
    const conn = tx.current() ? drizzle(tx.current()!) : db       // whatever the caller happened to open
    await conn.insert(orders).values(toRow(order))
  },
})

// shop/src/service/checkout.ts
await deps.tx.run(async () => {
  await deps.orders.save(order)
  await deps.carts.clear(cartId)
  await deps.billing.prepareInvoice({ orderId: order.id })        // billing in-process: its repositories read the same store
})
```

`save(order)` and `prepareInvoice(...)` carry no transaction, and both run in one: billing's
`InvoiceRepository`, written the same way, finds shop's client in the ambient store and reads the
uncommitted order through it, so billing decides what to invoice by data that may roll back a line
later; outside `run`, the same call reads committed data and decides differently. Shop's
transaction has crossed into billing with no signature saying so, the exact crossing the fixture
rules out. A repository method called from a scheduled task that forgot `run` writes with `db` and
autocommits, and no type and no reviewer sees the difference between that call and the one inside.
