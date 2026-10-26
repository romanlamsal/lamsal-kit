# Teeladen — the review domain

A made-up online tea shop, the fixture the rules are tested against. Every system carries at
least one situation the rules have to place. This file holds situations, never rulings: where a
rule places one is in the rules and the examples, not here.

## Systems

| system | kind | owns | stored in |
| --- | --- | --- | --- |
| **catalog** | external system: Payload CMS | the product: copy, images, slug, price, sku, tax class | shared Postgres, Payload's tables |
| **shop** | system | Cart, Order | shared Postgres via Drizzle |
| **payment** | system | Payment, Refund | shared Postgres |
| **billing** | system | Invoice, dunning stage, gapless invoice numbers | shared Postgres |
| **fulfillment** | system | Stock, Reservation, Shipment | shared Postgres; runs in its own worker process |
| **common library** | plumbing | pino logger, OpenTelemetry tracer exporting to Jaeger, outbox relay and bus, a Drizzle client factory, a unit of work kept ambient in `AsyncLocalStorage` | – |
| **shared kernel** | model | `Money`, `Sku` | – |

External systems: Stripe (payment), a 3PL warehouse API (fulfillment), a bank API (billing). Also
used: a mail provider (shop, billing).

## Edge cases per system

- **catalog (Payload)**
  - Editors set copy, price, sku and tax class in Payload's admin UI; the business rules for them
    sit in Payload's collection config: a price above zero, a sku unique. Payload's own auth
    supplies `req.user`.
  - Driving side: `afterChange` hooks call shop's services; a `beforeChange` hook asks shop
    whether a sku on an open order may change.
  - Driven side: shop reads the product, price and tax class included, through Payload's Local
    API.
  - Payload has its own transactions (`req.transactionID`); a hook may run inside one. Payload's
    transaction can also write a document to a collection of its own, which the relay can read.
  - Editors see each product's stock in Payload's admin, read-only; fulfillment owns it.
  - Payload's config needs the hooks, the hooks need services, the services need the Payload
    instance: a cycle.
- **shop**
  - Checkout must return a Stripe `client_secret` in the same request; payment creates it.
  - Checkout also offers pay-by-invoice: no Stripe payment, the customer pays by bank transfer
    after the order ships.
  - Checkout copies each line's price, sku and tax class from catalog's product.
  - Sends an order-confirmation mail once the order commits.
  - Calls billing's open host service in-process while holding its own ambient transaction.
- **payment**
  - Stripe is behind an anti-corruption layer on the way out.
  - Creates a Stripe PaymentIntent when shop's checkout calls it, and returns its `client_secret`
    in the same call.
  - Stripe webhooks arrive at least once, out of order, in Stripe's terms. Stripe stops resending
    a webhook after three days.
- **billing**
  - Creates an invoice on shop's `OrderPaid` message, or on `OrderPlaced` for an order paid by
    invoice.
  - Each invoice line needs its VAT rate, which follows from the tax class on the order's line: 7%
    for tea, 19% for accessories.
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
