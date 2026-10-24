---
breaches: [TST-11]
satisfies: []
situation: shop's OrderQueries driving port is called by billing (invoice address, lines) and by fulfillment (shipping address)
---

# Billing and fulfillment each write their own fake of `OrderQueries`

```ts
// billing/test/fakes/fake-order-queries.ts
import type { OrderQueries, OrderView } from "@teeladen/shop/language"

export class FakeOrderQueries implements Pick<OrderQueries, "findById"> {
  private readonly orders = new Map<string, OrderView>()
  constructor(seed: readonly OrderView[] = []) { for (const o of seed) this.orders.set(o.id, o) }
  async findById(id: string): Promise<OrderView | null> { return this.orders.get(id) ?? null }
}

// billing/test/service/issue-invoice.test.ts
it("should put the order's billing address on the invoice", async () => {
  // given
  const orders = new FakeOrderQueries([paidOrder({ id: "o-1", billingAddress: berlin })])
  const issueInvoice = createIssueInvoice({ ...fakeBillingPorts(), orders })
  // when
  await issueInvoice({ orderId: "o-1" })
  // then
  expect(invoices.committed()[0]?.address).toEqual(berlin)
})

// fulfillment/test/fakes/fake-order-queries.ts — fulfillment's own, fakes shipping address and lines, nothing else
```

Billing's fake implements the one method billing calls, and fulfillment's does the same for its
own tests: two fakes of one port, each an idea of how shop answers. When shop starts returning
`null` for an order that was merged into another, billing's fake still returns the merged order
and fulfillment's returns `null` for a different reason, and both suites stay green. Each fake
would have to pass the contract suite against shop's real service (TST-6) to catch it, twice. One
fake exported by shop, its scenarios seeded as data by each test, passes that suite once.
