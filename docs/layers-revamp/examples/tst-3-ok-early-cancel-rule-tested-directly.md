---
breaches: []
satisfies: [TST-3, TST-7]
situation: fulfillment's rule for OrderCancelled arriving before OrderPlaced
---

# The early-cancel rule is a domain function; the test calls it

```ts
// fulfillment/src/domain/reservation.ts
export type CancelOutcome = { kind: "release"; reservation: Reservation } | { kind: "remember-cancel"; orderId: string }

export const applyOrderCancelled = (existing: Reservation | null, event: { orderId: string }): CancelOutcome =>
  existing ? { kind: "release", reservation: { ...existing, status: "released" } } : { kind: "remember-cancel", orderId: event.orderId }

export const applyOrderPlaced = (stock: Stock, cancelledBefore: ReadonlySet<string>, event: OrderPlaced): Reservation | null =>
  cancelledBefore.has(event.orderId) ? null : reserve(stock, event)

// fulfillment/test/domain/reservation.test.ts
import { applyOrderCancelled, applyOrderPlaced } from "../../src/domain/reservation"

it.each([
  { existing: null, expected: { kind: "remember-cancel", orderId: "o-1" } },
  { existing: reservation("o-1", "active"), expected: { kind: "release", reservation: reservation("o-1", "released") } },
] as const)("should produce $expected.kind when OrderCancelled arrives with existing=$existing", ({ existing, expected }) => {
  // given
  const event = { orderId: "o-1" }
  // when
  const outcome = applyOrderCancelled(existing, event)
  // then
  expect(outcome).toEqual(expected)
})
```

The rule that decides what a cancel before a placement means is one pure function with no port
behind it, so the test builds two values, calls once and asserts once, and a red run names the
rule and nothing else. The handler that will call `applyOrderCancelled` gets a test of its own for
what it stores and what it writes to the outbox; the rule's cases, and there are more than two
once `OrderPaid` arrives early as well, are enumerated here where adding one costs a table row.
