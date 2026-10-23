---
breaches: []
satisfies: [TST-9]
situation: shop's OrderQueries driving port is called by billing (invoice address, lines) and by fulfillment (shipping address)
---

# Billing fakes the two methods of `OrderQueries` it uses, in its own test folder

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

Billing's fake implements the one method billing calls, holds the fields billing reads, and lives
in billing's test folder: when fulfillment's tests need `findById` to answer with a shipping
address and reservation-relevant lines, fulfillment's fake does that, and neither system's test
suite depends on the other's test code or on a fake shop maintains. The port's types still come
from shop's published language, so a field shop renames fails to compile in both fakes, which is
the coupling that is wanted.
