---
breaches: []
satisfies: [SVC-4, TX-1, TX-6, TX-5]
situation: shop marks the order paid on PaymentSucceeded
---

# `markOrderPaid` saves the Order through its repository

```ts
// shop/domain/order.ts
export const markPaid = (order: Order, paymentId: string, paidAt: Date): Order =>
    orderSchema.parse({ ...order, status: "paid", paymentId, paidAt: paidAt.toISOString() })

export const isPaidBy = (order: Order, paymentId: string): boolean =>
    order.status === "paid" && order.paymentId === paymentId

// shop/service/mark-order-paid.ts
export const createMarkOrderPaid =
    ({ orders, outbox, transactions }: MarkOrderPaidDeps): MarkOrderPaid =>
    async ({ orderId, paymentId, paidAt }) => {
        const order = await orders.findById(orderId)
        if (!order) throw new OrderNotFound(orderId)
        if (isPaidBy(order, paymentId)) return order          // a repeat answers as the first did
        if (order.status !== "placed") throw new NotPayable(orderId)
        const paid = markPaid(order, paymentId, paidAt)
        await transactions.run(async (tx) => {
            await orders.save(paid, tx)
            await outbox.write(orderPaid(paid), tx)
        })
        return paid
    }
```

The service decides, the domain produces the new aggregate, and the repository saves it whole in the transaction it is handed. It looks like a thin pass-through, load, decide, save, and that is the split working: the service names no table and no store client, and if `OrderRepository.save` changes its signature the compile error lands here, not in the `PaymentSucceeded` handler. A redelivered
`PaymentSucceeded` finds the order paid by the same payment and returns it, as the first delivery
did; thrown, it would be delivered again until it parks.
