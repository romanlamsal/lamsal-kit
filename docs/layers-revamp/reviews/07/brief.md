# Product brief

Small German online tea shop, B2C. Delivery to Germany only. Prices in EUR, gross incl. VAT. Shipping free.

## Fixed constraints

- TypeScript on Node 24 or later. One Postgres instance.
- Payload CMS for editors. Stripe for card payment. A 3PL warehouse API with webhooks. A bank API
  that reports incoming transfers. A mail provider.

## Catalog

- Editors maintain products in the CMS admin UI: copy, images, slug, price, sku, tax class. A price
  is above zero, a sku unique and fixed once saved. Editors also see each product's current stock
  there, read-only (available stock, see Stock).
- Tax classes: tea 7% VAT, accessories 19%.
- A product's sku goes into the 3PL's article master when the product is first saved. A product is
  for sale only once its sku is there; editors see whether it is.
- The shop shows each product as last saved within a minute. No draft or publish step.

## Customers

- Guest checkout only. A customer is identified by email address; all orders under one email are
  one customer.

## Cart and checkout

- Customers browse, fill a cart and check out with an email and a German delivery address.
- Cart and checkout show current prices. If a cart price changed since the customer last saw it,
  checkout shows the new price and the customer confirms it before the order is placed.
- An order is placed only if every line is within available stock. Otherwise nothing is placed and
  checkout names the short lines with their available quantity.
- An order keeps the price, sku and tax class each line was placed with; later product edits never
  change it.
- Pay by card or by invoice (bank transfer after delivery). Invoice is not offered to a customer in
  dunning.

## Card payment

- Stripe card payment; the browser needs the PaymentIntent's `client_secret` in the checkout
  response.
- A card order must be paid within 30 minutes of placement; a declined card may be retried on the
  same order within that time. Unpaid then, the order is cancelled and its stock is free again.
- A payment succeeding after its order was cancelled is refunded in full at once.
- Invoice orders have no payment deadline before shipping; unpaid invoices go to dunning, never to
  cancellation.

## Stock

- The 3PL's stock is authoritative. It reports each sku's stock free to ship: received goods and
  returns included, orders already passed to it excluded.
- Available stock is that, less what placed orders not yet passed to the 3PL and not cancelled
  take. No unit is sold to two orders.

## Fulfilment

- A card order goes to the 3PL once paid, an invoice order once placed. The 3PL ships each order in
  one go and reports by webhook per line what it shipped.
- Lines or quantities the 3PL can't ship are dropped from the order, card orders refunded for them.
  An order of which nothing ships is cancelled.
- No other cancellation: a placed order is changed or cancelled neither by customer nor operator.
  A customer who changes their mind returns the goods for a refund.

## Invoices and credit notes

- Each order gets one invoice when the 3PL reports it shipped, over the shipped quantities only. A
  cancelled order never has one.
- Each invoice line takes its tax class from the order line and that class's VAT rate. Invoices
  show net, VAT per rate and gross.
- Invoices are never changed or deleted; every correction after invoicing is a credit note, one per
  refund. Refunds before invoicing (late payment, unshippable lines) need none.
- Invoices and credit notes have separate number series, each gapless per calendar year.
- A card order's invoice shows it paid. An invoice order's invoice is due 14 days after its date.
- An invoice's open amount is its total less its credit notes and payments; at zero it is paid.

## Bank transfers

- A transfer whose reference names one invoice number and whose amount equals that invoice's open
  amount pays it automatically.
- Every other transfer (partial, overpaid, several invoices, no or unknown reference) goes to
  operators, who assign it to one or more invoices or pay it back by hand. A partly paid invoice
  stays open for the rest; operators pay back a surplus by hand.

## Dunning

- Dunning runs per invoice, without fees. Unpaid 7 days after the due date: first reminder; 14 days
  later: second; 14 days later: final. Unpaid 14 days after the final reminder: handed to operators,
  no further reminders.
- A customer is in dunning while any of their invoices is past due and unpaid.

## Refunds and disputes

- Operators refund a shipped order in full or by line and quantity; customers ask by mail. A refund
  doesn't change stock; returned goods count again once the 3PL reports them.
- Card orders are refunded through Stripe. For invoice orders, a refund first lowers the open
  amount; money already paid operators transfer back by hand, and record it.
- A disputed charge gets no further refund; refunds made before the dispute stand. Operators handle
  the dispute in Stripe. Shipping is unaffected. A lost dispute counts as a refund of its amount.

## Customer mails

- Order confirmation: card orders once paid, invoice orders once placed.
- Mails for every cancellation, dropped line and refund.
- Invoice, credit note and each reminder mailed as PDF.

## Operations

- Operators see orders, invoices, credit notes, shipments and transfers, and act on them: assign
  transfers, refund, record paybacks, take over invoices after dunning.
- An outage of the 3PL, mail provider or bank API delays, never loses, an order passed to the 3PL,
  a mail or a reported transfer. Operators see what is delayed. A rare duplicate mail is
  acceptable; a duplicate shipment, refund or payment booking is not.
- An operator can follow one checkout end to end, including all that follows from it later:
  payment, mails, 3PL, shipment, invoice, transfer matching, reminders.
