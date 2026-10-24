---
breaches: []
satisfies: [TX-1, DRV-1, TX-5, TX-6]
situation: billing creates an invoice on shop's OrderPaid message
---

# Billing's handler makes one service call per message; the service opens that message's transaction

```ts
// billing/driving/handlers.ts
import type { OrderPaid } from "@teeladen/shop/published"   // conformist: shop's schema, untranslated

export const buildBillingHandlers = ({ issueInvoice }: BillingServices) => ({
  OrderPaid: async (message: OrderPaid) => {
    await issueInvoice(message)          // one message, one call; the bus retries this message alone
  },
})

// billing/service/issue-invoice.ts
export const createIssueInvoice =
  ({ transaction, handled, invoices, numbers, outbox }: Deps): IssueInvoice =>
  async (message) =>
    transaction.run(async (tx) => {                        // this message's transaction, nobody else's
      if (!(await handled.claim(message.id, tx))) return
      const number = await numbers.next(tx)                 // gapless: allocated and spent in one commit
      const invoice = issueInvoice(message, number)
      await invoices.save(invoice, tx)
      await outbox.write(invoiceIssued(invoice), tx)
    })
```

Each delivered `OrderPaid` gets a transaction that holds only its own writes: the claim, the invoice
number, the Invoice, the `InvoiceIssued` message. A failure rolls back exactly that message's work, the
number allocation included so the sequence stays gapless, and redelivery repeats exactly that message.
The transaction that wrote `OrderPaid` committed in shop's process long before and is not joined; the
bus's other messages in flight are untouched.
