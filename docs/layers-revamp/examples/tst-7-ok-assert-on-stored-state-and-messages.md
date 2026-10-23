---
breaches: []
satisfies: [TST-7, TST-4]
situation: billing's invoice creation on shop's OrderPaid message
---

# The invoicing test asserts what was stored and what was written to the outbox

```ts
// billing/test/service/issue-invoice.test.ts
import { createIssueInvoice } from "../../src/service/issue-invoice"
import { FakeInvoiceRepository, FakeInvoiceNumbers, FakeBillingOutbox, FakeTransactionPort } from "../fakes"

it("should issue a numbered invoice and publish InvoiceIssued", async () => {
  // given
  const tx = new FakeTransactionPort()
  const invoices = new FakeInvoiceRepository(tx)
  const numbers = new FakeInvoiceNumbers(tx, { next: 2026_0001 })
  const outbox = new FakeBillingOutbox(tx)
  const orders: OrderQueries = { findById: async () => paidOrder({ id: "o-1", total: eur(900), billingAddress: berlin }) }
  const issueInvoice = createIssueInvoice({ tx, invoices, numbers, outbox, orders, clock: fixedClock("2026-10-23") })

  // when
  await issueInvoice({ orderId: "o-1" })

  // then
  expect({ stored: invoices.committed().map(({ number, total, orderId }) => ({ number, total, orderId })), published: outbox.committed().map((m) => m.name) })
    .toEqual({ stored: [{ number: 2026_0001, total: eur(900), orderId: "o-1" }], published: ["InvoiceIssued"] })
})
```

The test names what went in, a paid order and the next invoice number, and what came out, the
invoice the repository holds after commit and the message in the outbox. Whether the service
fetches the number before or after loading the order, or whether `renderInvoice` is one function
or three, is not in the assertion, so the service can be rewritten and the test stays green as long
as billing still issues `2026_0001` for `o-1` and tells the world about it.
