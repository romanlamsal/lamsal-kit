---
breaches: [TX-8, DRV-1]
satisfies: []
situation: billing creates invoices on shop's OrderPaid messages, delivered in batches
---

# One transaction for the whole batch of OrderPaid messages

```ts
// billing/driving/handlers.ts
export const buildBillingHandlers = ({ transaction, issueInvoice }: BillingServices & { transaction: TransactionPort }) => ({
  // the bus hands us up to 100 at once; one commit instead of 100 is cheaper and the number sequence lock is taken once
  OrderPaidBatch: async (messages: OrderPaid[]) => {
    await transaction.run(async (tx) => {
      for (const message of messages) {
        await issueInvoice(message, tx)      // service joins the handler's transaction
      }
    })
  },
})

// billing/service/issue-invoice.ts
export const createIssueInvoice =
  ({ handled, invoices, numbers, outbox }: Deps): IssueInvoice =>
  async (message, tx) => {
    if (!(await handled.claim(message.id, tx))) return
    const number = await numbers.next(tx)
    const invoice = issueInvoice(message, number)
    await invoices.save(invoice, tx)
    await outbox.write(invoiceIssued(invoice), tx)
  }
```

One `OrderPaid` for a customer billing cannot invoice, a missing VAT id say, throws, and the ninety-nine
invoices beside it roll back with their claims and numbers. The bus redelivers the batch, the same
message throws again, and billing issues no invoice until someone fixes one order; every batch that
message lands in dies with it. Had the first ninety committed before the throw, the rolled-back claims
would let redelivery issue them again (TX-5). The handler holds a transaction and makes a hundred service
calls, which is a use case written into a driving adapter.
