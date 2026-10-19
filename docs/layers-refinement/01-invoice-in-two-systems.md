# Invoice belongs to two systems in the examples

**Status:** applied, uncommitted · **Kind:** contradiction · **Touches:** Other systems (the
open host service example, "One system's driving port is the other's driven port")

## Context

In `domain.md`, billing owns Invoice; shop owns Order. Settling an order touches both.

## Problem

The examples put Invoice in two systems at once:

- `createOrderService` receives `invoices: InvoiceRepository`; the transaction snippet runs
  `orders.markSettled` and `invoices.clearDunning` in one `tx.run`; question 1's fix is
  `invoices.createForOrder(ctx, …)`. Invoice is a repository of the order's system.
- The open host service example was "billing's entries", exporting `Invoice` and
  `BillingService`. Invoice is another system's.

An agent copying the transaction snippet writes another system's table inside its own
transaction. It should write a message to its outbox (Transactions, rule 1).

## Resolution

Rename the open host service example to the pricing system, which question 8 already conforms to:

```
// pricing's entries — file names are the codebase's
// published language and port types: loads only the domain
export type { Pricing } from "./service/pricing.port"
export { Quote, PriceList } from "./domain/quote"

// builds the open host service: for another system's assembly
export const createPricing = (config: PricingConfig): Pricing => ...
```

and "To B, `Pricing` is the way in". Order and Invoice now share one system in every example;
`Pricing` matches question 8's `{ pricing }: { pricing: Pricing }` and `pricing.quote(cart)`.

## Grounding

Internal consistency only; no source involved. The derivation test holds: the rules were right,
the examples hid them.

## Done when

Approved and committed. No sibling doc names `BillingService` (grep confirmed).
