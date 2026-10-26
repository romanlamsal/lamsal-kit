# Teeladen — the review domain

A made-up online tea shop, the fixture the rules are tested against. Every system carries at
least one situation the rules have to place. This file holds situations, never rulings: where a
rule places one is in the rules and the examples, not here.

## Systems

| system | kind | owns | stored in |
| --- | --- | --- | --- |
| **catalog** | external system: Payload CMS | editorial content of a product page: copy, images, slug | shared Postgres, Payload's tables |
| **shop** | system | Cart, Order, the commercial fields of a product: price, sku, tax class | shared Postgres via Drizzle; price, sku and tax class also on Payload's `products` document |
| **payment** | system | Payment, Refund | shared Postgres |
| **billing** | system | Invoice, dunning stage, gapless invoice numbers | shared Postgres |
| **fulfillment** | system | Stock, Reservation, Shipment | shared Postgres; runs in its own worker process |
| **common library** | plumbing | pino logger, OpenTelemetry tracer exporting to Jaeger, outbox relay, transaction port with an ambient unit of work in `AsyncLocalStorage` | – |
| **shared kernel** | model | `Money`, `Sku` | – |

External systems: Stripe (payment), a 3PL warehouse API (fulfillment), a bank API (billing). Also
used: a mail provider (shop, billing).

## Edge cases per system

- **catalog (Payload)**
  - Driving side: `beforeChange` and `afterChange` hooks call shop services; editors act in
    Payload's admin UI; Payload's own auth supplies `req.user`.
  - Driven side: shop reads content and writes price and sku through Payload's Local API.
  - One `products` document carries fields two systems write: editors write copy, shop writes
    price.
  - Payload has its own transactions (`req.transactionID`); a hook may run inside one.
  - Shop's own write through the Local API fires shop's own `afterChange` hook again.
  - Payload's collection config re-declares fields the shop domain's schema already declares.
  - Payload's config needs the hooks, the hooks need services, the services need the Payload
    instance: a cycle.
  - Payload's before-write hook may change the record it saves, so a hook can embed data in the
    document it is about to save.
- **shop**
  - Checkout must return a Stripe `client_secret` in the same request; payment creates it.
  - Checkout also offers pay-by-invoice: no Stripe payment, the customer pays by bank transfer
    after the order ships.
  - One use case writes Drizzle tables and Payload documents: two store clients, one database.
  - Sends an order-confirmation mail once the order commits.
  - Calls billing's open host service in-process while holding its own ambient transaction.
- **payment**
  - Stripe is behind an anti-corruption layer on the way out.
  - Creates a Stripe PaymentIntent when shop's checkout calls it, and returns its `client_secret`
    in the same call.
  - Stripe webhooks arrive at least once, out of order, in Stripe's terms.
- **billing**
  - Creates an invoice on shop's `OrderPaid` message, or on `OrderPlaced` for an order paid by
    invoice.
  - Each invoice line needs its VAT rate, which follows from the product's tax class: 7% for tea,
    19% for accessories.
  - The bank API reports incoming transfers in the bank's terms; billing matches them to open
    invoices. Some match none: a wrong reference, an amount short.
  - Scheduled dunning runs over unpaid invoices.
- **fulfillment**
  - Reserves stock on `OrderPlaced`; releases it on `OrderCancelled`.
  - `OrderPaid` or `OrderCancelled` can arrive before `OrderPlaced`; a dropped cancel leaves
    stock reserved for a dead order.
  - 3PL webhooks report shipments in the 3PL's terms.
  - The 3PL's article master needs each SKU before it ships one; fulfillment registers each new
    SKU there.
  - Its worker process has its own entry point and its own assembly.
- **common library**
  - OpenTelemetry keeps its own ambient context and returns a no-op span when it is empty.
  - Auto-instrumentation must load before any other import.
  - Request id and trace context should cross system boundaries; the transaction must not.

## The checkout saga

1. shop places the order and publishes `OrderPlaced`; fulfillment reserves the stock.
2. shop calls payment, which creates a Stripe PaymentIntent; shop returns its `client_secret` to
   the browser.
3. Stripe's webhook reaches payment, which publishes `PaymentSucceeded` or `PaymentFailed`.
4. On success, shop marks the order paid and publishes `OrderPaid`; billing issues the invoice,
   fulfillment ships.
5. shop's Order holds the payment deadline. On `PaymentFailed`, or once the deadline passes, shop
   cancels the order and publishes `OrderCancelled`; fulfillment releases the reservation.
6. Paid by invoice: `OrderPlaced` says so. Billing invoices it and fulfillment ships it on that
   message, and shop's deadline does not apply. Billing matches the bank transfer and publishes
   `InvoicePaid`. Shop marks the order paid and publishes `OrderPaid`, which billing and
   fulfillment have already acted on for this order.

## Cross-cutting reads

- An admin dashboard joins orders, invoices and shipments in the one Postgres.
- A Payload edit should revalidate the cached shop page.
- `/health` pings the database; `/metrics` is scraped.
