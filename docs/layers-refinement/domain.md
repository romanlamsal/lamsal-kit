# Teeladen — the review domain

A made-up online tea shop, built to stress `registry/docs/agents/layers.md`. Every system carries
at least one edge case the document has to place. Tickets refer to it by system name.

## Systems

| system | kind | owns | stored in |
| --- | --- | --- | --- |
| **catalog** | product: Payload CMS | editorial content of a product page: copy, images, slug | shared Postgres, Payload's tables |
| **shop** | system | Cart, Order, the commercial fields of a product: price, sku | shared Postgres via Drizzle; price and sku also on Payload's `products` document |
| **payment** | system | Payment, Refund | shared Postgres |
| **billing** | system | Invoice, dunning stage, gapless invoice numbers | shared Postgres |
| **fulfillment** | system | Stock, Reservation, Shipment | shared Postgres; runs in its own worker process |
| **common library** | plumbing | pino logger, OpenTelemetry tracer exporting to Jaeger, outbox relay, transaction port with an ambient unit of work in `AsyncLocalStorage` | – |
| **shared kernel** | model | `Money`, `Sku` | – |

Third parties: Stripe (payment), a 3PL warehouse API (fulfillment), a mail provider (shop,
billing).

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
- **shop**
  - Checkout must return a Stripe `client_secret` in the same request.
  - One use case writes Drizzle tables and Payload documents: two store clients, one database.
  - Sends an order-confirmation mail once the order commits.
  - Calls billing's open host service in-process while holding its own ambient transaction.
- **payment**
  - Stripe is behind an anti-corruption layer on the way out.
  - Stripe webhooks arrive at least once, out of order, in Stripe's terms.
- **billing**
  - Creates an invoice on shop's `OrderPaid` message.
  - Scheduled dunning runs.
- **fulfillment**
  - Reserves stock on checkout; releases it when payment fails or times out.
  - 3PL webhooks report shipments in the 3PL's terms.
  - Its worker process has its own entry point and its own assembly.
- **common library**
  - OpenTelemetry keeps its own ambient context and returns a no-op span when it is empty.
  - Auto-instrumentation must load before any other import.
  - Request id and trace context should cross system boundaries; the transaction must not.

## The checkout saga

1. shop places the order and writes `ReserveStock` to its outbox.
2. shop creates a Stripe PaymentIntent and returns its `client_secret` to the browser.
3. Stripe's webhook reaches payment, which publishes `PaymentSucceeded` or `PaymentFailed`.
4. On success, shop marks the order paid and publishes `OrderPaid`; billing issues the invoice,
   fulfillment ships.
5. On failure or timeout, fulfillment releases the reservation and shop cancels the order.

## Cross-cutting reads

- An admin dashboard joins orders, invoices and shipments in the one Postgres.
- A Payload edit should revalidate the cached shop page.
- `/health` pings the database; `/metrics` is scraped.
