---
breaches: [TST-3]
satisfies: []
situation: fulfillment's early-cancel rule tested through the OrderCancelled handler and service with fakes for every port
---

# The early-cancel rule tested through the handler

```ts
// fulfillment/test/handlers/on-order-cancelled.test.ts
import { onOrderCancelled } from "../../src/handlers/on-order-cancelled"
import { createReleaseReservation } from "../../src/service/release-reservation"
import { FakeReservationRepository, FakeCancelledOrders, FakeFulfillmentOutbox, FakeTransactionPort, FakeHandledMessages } from "../fakes"

it("should remember the cancel when no reservation exists yet", async () => {
  // given
  const tx = new FakeTransactionPort()
  const reservations = new FakeReservationRepository(tx, [])
  const cancelled = new FakeCancelledOrders(tx)
  const outbox = new FakeFulfillmentOutbox(tx)
  const handled = new FakeHandledMessages(tx)
  const handler = onOrderCancelled(createReleaseReservation({ tx, reservations, cancelled, outbox, handled }))

  // when
  await handler({ id: "m-7", name: "OrderCancelled", payload: { orderId: "o-1" }, occurredAt: "2026-10-23T10:00:00Z" })

  // then
  expect(cancelled.committed()).toEqual([{ orderId: "o-1" }])
})
```

The rule under test is `applyOrderCancelled`'s second branch, and reaching it costs five fakes, a
message envelope and a service. When this test goes red, the cause is the rule, the service's
transaction handling, the dedup against `handled`, or a fake that drifted, and the first thing the
author does is add logging to find out which. The rule's other cases, cancel after placement, paid
before placed, cancel delivered twice, each cost the same setup again, so fewer of them get
written and the enumeration that belongs in a `it.each` table never happens.
