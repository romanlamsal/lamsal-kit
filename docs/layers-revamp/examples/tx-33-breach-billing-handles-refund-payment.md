---
breaches: [TX-33]
satisfies: [TX-5, SYS-13]
situation: billing issues a credit note for each refund; payment refunds when shop asks, but not a disputed charge
---

# Billing subscribes to payment's `RefundPayment` and issues the credit note on the request

```ts
// apps/worker/assembly.ts
bus.subscribe("RefundPayment", payment.handlers.RefundPayment)
bus.subscribe("RefundPayment", billing.handlers.RefundPayment)          // billing listens to payment's command

// billing/service/issue-credit-note.ts
export const createIssueCreditNote = ({ transaction, handled, invoices, creditNotes }: Deps): IssueCreditNote =>
  (command: RefundPayment) =>
    transaction.run(async (tx) => {
      if (!(await handled.claim(command.id, tx))) return
      const invoice = await invoices.byOrderId(command.orderId, tx)
      await creditNotes.save(creditNoteFor(invoice, command.amount), tx)
    })
```

Shop asks payment to refund an order's payment. The customer has disputed the charge at Stripe, so
payment refuses. Billing has already issued a credit note for money that never went back: the books
say the customer was refunded, and the gapless credit note number is spent. Billing acted on a request
as if it were done. When payment adds a `reason` the refund needs, billing's handler breaks on a
change made for payment's use case.
