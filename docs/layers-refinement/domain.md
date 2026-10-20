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
  - Checkout must return a Stripe `client_secret` in the same request; payment creates it.
  - One use case writes Drizzle tables and Payload documents: two store clients, one database.
  - Sends an order-confirmation mail once the order commits.
  - Calls billing's open host service in-process while holding its own ambient transaction.
- **payment**
  - Stripe is behind an anti-corruption layer on the way out.
  - Creates a Stripe PaymentIntent when shop's checkout calls it, and returns its `client_secret`
    in the same call.
  - Stripe webhooks arrive at least once, out of order, in Stripe's terms.
- **billing**
  - Creates an invoice on shop's `OrderPaid` message.
  - Scheduled dunning runs.
- **fulfillment**
  - Reserves stock on `OrderPlaced`; releases it on `OrderCancelled`.
  - `OrderPaid` or `OrderCancelled` can arrive before `OrderPlaced`; a dropped cancel leaves
    stock reserved for a dead order.
  - 3PL webhooks report shipments in the 3PL's terms.
  - Its worker process has its own entry point and its own assembly.
- **common library**
  - OpenTelemetry keeps its own ambient context and returns a no-op span when it is empty.
  - Auto-instrumentation must load before any other import.
  - Request id and trace context should cross system boundaries; the transaction must not.

## Placed as a fault

Edge cases above that `layers.md` now places as something the codebase must not do. A ticket
that meets one does not re-litigate it; it reopens the ticket named.

- The common library's ambient unit of work in `AsyncLocalStorage`: the transaction context is
  passed, never ambient (ticket 15).
- Shop calling billing's open host service inside its own `tx.run`: the call moves outside the
  transaction; billing's driving port takes no context (ticket 15).
- The admin dashboard joining orders, invoices and shipments in one repository: a read across
  systems goes through each owner's open host service or a copy (ticket 06).
- Payload's `afterChange` hook calling shop services directly on shop's own write: the hook does
  nothing when this system is the caller (ticket 18).
- A service of one system calling another service of the same system: a second transaction;
  repositories in one `run`, or the outbox (review 01, R01-11).
- An editor changing shop's price in Payload admin: a field another system owns is read-only in
  the product; a change comes through an action that calls shop's service (review 01, R01-53).
- Shop's price adapter over Payload's Local API placed as anything but a driven adapter: it is
  one, and imports Payload's instance as any driven adapter imports what its port's
  implementation needs; there is no repository layer to fit it into (ticket 19).

## The checkout saga

1. shop places the order and publishes `OrderPlaced`; fulfillment reserves the stock.
2. shop calls payment, which creates a Stripe PaymentIntent; shop returns its `client_secret` to
   the browser.
3. Stripe's webhook reaches payment, which publishes `PaymentSucceeded` or `PaymentFailed`.
4. On success, shop marks the order paid and publishes `OrderPaid`; billing issues the invoice,
   fulfillment ships.
5. shop's Order holds the payment deadline. On `PaymentFailed`, or once the deadline passes, shop
   cancels the order and publishes `OrderCancelled`; fulfillment releases the reservation.

## Cross-cutting reads

- An admin dashboard joins orders, invoices and shipments in the one Postgres.
- A Payload edit should revalidate the cached shop page.
- `/health` pings the database; `/metrics` is scraped.
