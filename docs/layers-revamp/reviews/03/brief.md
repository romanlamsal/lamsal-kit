# Product brief

Online tea shop, in TypeScript on Node. One Postgres instance, Drizzle. Payload CMS. Stripe. A 3PL
warehouse API with webhooks. A bank API that reports incoming transfers. A mail provider. pino,
OpenTelemetry exporting to Jaeger; `AsyncLocalStorage` is available.

What it does:

- Editors maintain products in the CMS admin UI: copy, images, slug, price, sku, tax class. A price
  is above zero, a sku unique. Editors also see each product's current stock there, read-only.
- Customers browse a cached shop page that is revalidated when a product changes, fill a cart and
  check out.
- Checkout pays by card through Stripe, whose `client_secret` the browser needs in the checkout
  response; or by invoice, the customer paying by bank transfer after the goods ship. Pay by
  invoice is not offered to a customer in dunning. Each order line carries the product's price,
  sku and tax class at the time of the order.
- An order-confirmation mail goes out once the order is placed. An order unpaid at its payment
  deadline is cancelled. A card payment can be refunded; a disputed charge is not.
- Invoices: one per paid order, or per order paid by invoice; each line carries its VAT rate by
  tax class, 7% tea, 19% accessories; invoice numbers are gapless. A credit note per refund.
  Incoming bank transfers are matched to open invoices; some match none. Scheduled dunning sends
  reminders over unpaid invoices and tracks each customer's dunning stage.
- Stock is reserved when an order is placed and released when it is cancelled; paid orders ship
  through the 3PL, which reports shipments by webhook and needs each sku registered in its article
  master before shipping it.
- Operations: an admin dashboard over orders, invoices and shipments; `/health` pings the database;
  `/metrics` is scraped; logs and traces throughout, with request id and trace context following
  a request across processes.
