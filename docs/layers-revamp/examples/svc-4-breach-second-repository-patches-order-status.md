---
breaches: [SVC-4]
satisfies: [ARR-1, TX-2]
situation: shop marks the order paid on PaymentSucceeded
finding: adversarial
---

# A second repository over the Order writes the status column

```ts
// shop/domain/ports/order-status-repository.ts  (a repository of the Order aggregate)
export interface OrderStatusRepository {
    markPaid(orderId: string, paymentId: string, paidAt: Date, tx: Transaction): Promise<void>
}

// shop/service/mark-order-paid.ts
export const createMarkOrderPaid =
    ({ orderStatus, outbox, transactions }: MarkOrderPaidDeps): MarkOrderPaid =>
    async ({ orderId, paymentId, paidAt }) =>
        transactions.run(async (tx) => {
            await orderStatus.markPaid(orderId, paymentId, paidAt, tx)      // through a repository, in the tx
            await outbox.write(orderPaid({ orderId, paymentId, paidAt }), tx)
        })

// shop/adapters/drizzle/order-status-repository.ts
export const createDrizzleOrderStatusRepository = (): OrderStatusRepository => ({
    markPaid: async (orderId, paymentId, paidAt, tx) => {
        await asDrizzleTx(tx).update(orders).set({ status: "paid", paymentId, paidAt }).where(eq(orders.id, orderId))
    },
})
```

The write goes through a repository of the aggregate the record belongs to, inside the handed transaction, with no store name in the service: Statement, ARR-1 and TX-2 are all met. The Why's harm is untouched, because the repository never loads the aggregate and the domain's `markPaid` is never asked: a cancelled order whose webhook arrives late becomes paid, the exact case `svc-4-breach-mark-paid-updates-column.md` shows, now one file to the right. The glossary allows this by saying a repository is "over exactly one aggregate" without saying one aggregate has one repository that "loads it and saves it whole"; the Statement would catch it as "the write MUST be the aggregate's repository saving the aggregate the domain returned".
