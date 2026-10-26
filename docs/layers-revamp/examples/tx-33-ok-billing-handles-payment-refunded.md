---
breaches: []
satisfies: [TX-33, TX-17, TX-5]
situation: billing issues a credit note for each refund; payment refunds when shop asks, but not a disputed charge
---

# Payment alone handles `RefundPayment`; billing handles the `PaymentRefunded` event

```ts
// apps/worker/assembly.ts
bus.subscribe("RefundPayment", payment.handlers.RefundPayment)          // payment's command, payment's handler
bus.subscribe("PaymentRefunded", billing.handlers.PaymentRefunded)      // payment's event, anyone may handle it

// payment/service/record-refund.ts — on Stripe's confirmation of the refund
await refunds.save(confirmed(refund), tx)
await outbox.write(paymentRefunded(refund), tx)                         // names no handler

// billing/service/issue-credit-note.ts
(event: PaymentRefunded) =>
  transaction.run(async (tx) => {
    if (!(await handled.claim(event.id, tx))) return
    const invoice = await invoices.byOrderId(event.orderId, tx)
    await creditNotes.save(creditNoteFor(invoice, event.amount), tx)
  })
```

Billing issues the credit note on what happened: Stripe confirmed the refund and payment recorded it.
A refused refund publishes no `PaymentRefunded`, so no credit note follows it. The command stays
payment's to change, and billing reads only payment's event.
