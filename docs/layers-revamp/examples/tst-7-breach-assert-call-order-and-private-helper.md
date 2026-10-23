---
breaches: [TST-7]
satisfies: []
situation: billing's invoice creation tested by spying on repository calls and the domain's renderInvoice
---

# The invoicing test asserts the order of port calls and that `renderInvoice` ran

```ts
// billing/test/service/issue-invoice.test.ts
import * as domain from "../../src/domain/invoice"
import { createIssueInvoice } from "../../src/service/issue-invoice"

it("should fetch the number, render, then save and write the message", async () => {
  // given
  const calls: string[] = []
  const numbers: InvoiceNumbers = { next: vi.fn(async () => { calls.push("numbers.next"); return 2026_0001 }) }
  const invoices: InvoiceRepository = { save: vi.fn(async () => { calls.push("invoices.save") }), findOverdue: vi.fn(async () => []) }
  const outbox: BillingOutbox = { write: vi.fn(async () => { calls.push("outbox.write") }) }
  const render = vi.spyOn(domain, "renderInvoice")
  const issueInvoice = createIssueInvoice({ tx: fakeTx(), invoices, numbers, outbox, orders: fakeOrders(paidOrder("o-1")), clock: fixedClock("2026-10-23") })

  // when
  await issueInvoice({ orderId: "o-1" })

  // then
  expect(render).toHaveBeenCalledTimes(1)
  expect(calls).toEqual(["numbers.next", "invoices.save", "outbox.write"])
})
```

Nothing here says what invoice billing issued. Reordering the service to load the order before
reserving a number, which gapless numbering actually wants so that a missing order does not burn a
number, turns the test red with the behavior intact. Inlining `renderInvoice` into
`Invoice.from(order)` turns it red too. Meanwhile a service that saves an invoice with the wrong
total, or writes `InvoiceIssued` with the wrong `orderId`, keeps the call order and stays green.
After two such red runs the test is skipped, and after the third nobody believes it when it fails
for a reason.
