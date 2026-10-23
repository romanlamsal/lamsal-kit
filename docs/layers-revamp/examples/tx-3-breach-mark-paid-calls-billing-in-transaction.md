---
breaches: [TX-3]
satisfies: []
situation: shop calls billing's open host service in-process while holding its own transaction
---

# Mark-order-paid issues the invoice by calling billing inside shop's transaction

```ts
// shop/service/mark-order-paid.ts
type Deps = { transaction: TransactionPort; orders: OrderRepository; billing: InvoiceIssuing }
// InvoiceIssuing is shop's driven port; assembly hands in billing's issueInvoice service (in-process)

export const createMarkOrderPaid =
  ({ transaction, orders, billing }: Deps): MarkOrderPaid =>
  async ({ orderId, paymentId }) =>
    transaction.run(async (tx) => {
      const order = await orders.byId(orderId, tx)
      if (!order) throw new OrderNotFound(orderId)
      const paid = markPaid(order, paymentId)
      await orders.save(paid, tx)
      // one Postgres, billing runs in-process and its repositories join our ambient unit of work:
      // the invoice and the paid mark commit together. No message, no eventual anything.
      await billing.issueInvoice({
        orderId: order.id,
        customerId: order.customerId,
        lines: order.lines.map((l) => ({ sku: l.sku, net: l.unitPrice, quantity: l.quantity })),
        vatRate: order.vatRate,
      })
    })
```

Invoices are billing's aggregate; here shop's use case creates one from inside shop's transaction. The
gapless invoice number billing allocates is now taken and released by shop's commit and rollback, so a
retry of `PaymentSucceeded` after billing threw leaves a gap billing's rules never decided. Billing's
model, net lines and a VAT rate, is spelled out in shop's service, and the moment billing moves to its
own process the "atomic" call becomes two commits with nothing between them, invisible in this code. The
published `OrderPaid` message, handled by billing in a transaction of its own, is what TX-3 asks for.
