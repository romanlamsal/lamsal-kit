---
breaches: [TST-11]
satisfies: []
situation: shop exports one configurable FakeOrderQueries that billing and fulfillment both import for their tests
finding: adversarial
---

# Shop's exported fake grows a switch per downstream

```ts
// shop/src/testing/fake-order-queries.ts — exported on @teeladen/shop/testing for every downstream
export type FakeOrderQueriesOptions = {
  withBillingAddress?: boolean        // billing wants it, fulfillment's fixtures do not have one
  withShippingAddress?: boolean       // fulfillment wants it
  linesAs?: "priced" | "quantities"   // billing needs unit prices, fulfillment only sku and qty
  paidOnly?: boolean                  // billing's tests seed paid orders only
}

export class FakeOrderQueries implements OrderQueries {
  constructor(private readonly opts: FakeOrderQueriesOptions, private readonly seed: readonly OrderView[]) {}
  async findById(id: string): Promise<OrderView | null> {
    const order = this.seed.find((o) => o.id === id) ?? null
    if (!order) return null
    return {
      ...order,
      billingAddress: this.opts.withBillingAddress ? order.billingAddress : undefined,
      shippingAddress: this.opts.withShippingAddress ? order.shippingAddress : undefined,
      lines: this.opts.linesAs === "quantities" ? order.lines.map(({ sku, qty }) => ({ sku, qty })) : order.lines,
    }
  }
  async listOpen(): Promise<OrderView[]> { return this.opts.paidOnly ? [] : this.seed }
}

// billing/test/service/issue-invoice.test.ts
const orders = new FakeOrderQueries({ withBillingAddress: true, linesAs: "priced", paidOnly: true }, [paidOrder("o-1")])
// fulfillment/test/handlers/on-order-paid.test.ts
const orders = new FakeOrderQueries({ withShippingAddress: true, linesAs: "quantities" }, [paidOrder("o-1")])
```

The fake is one class with a mode per downstream, and every option exists because one downstream's
tests wanted something the other's did not. Billing's test suite now depends on shop's test code:
a fulfillment-motivated change to `linesAs` reshapes what billing's fakes return and billing's
tests go red for a reason billing never asked about. The returned `OrderView` with `undefined`
addresses is a shape the real `OrderQueries` never produces, so billing's service grows a `??`
that production does not need.

Billing and fulfillment use one fake of the port, exported by shop, so TST-11's Statement is
satisfied. The switches are the harm its Why names: each mode is a second implementation inside
one class, and the shapes they return are ones the real port never produces. Scenarios as seed
data, `paidOrder({ billingAddress })`, would carry what each downstream needs without a mode.
