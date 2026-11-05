# Brief challenge

Each section is ordered by how much the architecture would change, biggest first.

## 1. Implementation leaks

- **B-1** "Stock an order holds is not sold to another order"
  "Holds" implies a reservation taken when the order is placed. The need is no overselling. When stock gets committed (cart, order, payment) is a business decision: see B-8.
- **B-2** "Scheduled dunning sends reminders"
  "Scheduled" implies a batch job. The need is a timing rule (reminder X days after due date), which the brief doesn't give: see B-14.
- **B-3** "tracks each customer's dunning stage"
  This implies a stored stage per customer. The need is to know whether a customer is in dunning, which could also be derived from their overdue invoices.
- **B-4** "Each order line carries the product's price, sku and tax class at the time of the order"
  This implies copying values onto the line. The need is that later product edits don't change existing orders.
- **B-5** "an admin dashboard over orders, invoices and shipments"
  This names a UI artifact. The need is that operators can see (and maybe act on, see B-29) orders, invoices and shipments, perhaps inside Payload.
- **B-6** "logs and traces throughout"
  This names the telemetry form. The need is that an operator can follow one request end to end.

## 2. Missing business rules

- **B-7** Stock source of truth. Editors only read stock, so who sets it, and how do incoming goods add to it?
  a) The 3PL reports stock levels and the shop mirrors them. b) Operators enter stock in the shop and the 3PL only ships. c) The shop keeps its own count and reconciles it against the 3PL.
- **B-8** When is stock taken, and for how long? With card, the order exists before payment, because `client_secret` comes back in the checkout response.
  a) At order placement, until the payment deadline. b) Only on successful payment, so overselling at payment time is possible. c) At placement, with a short card hold of N minutes.
- **B-9** A card payment succeeds after its order was already cancelled for missing the deadline.
  a) Refund it automatically. b) Reinstate the order if stock is available, otherwise refund. c) Flag it for an operator.
- **B-10** Customer identity. Dunning stage and "customer in dunning" both need one.
  a) Accounts with login. b) Guest checkout keyed by email. c) Both, linked by email.
- **B-11** Invoice-pay order lifecycle.
  a) Invoice at placement, ship at once, due N days after invoice date. b) Invoice at shipment (3PL webhook), due N days after shipment. c) Invoice at placement, due N days after shipment.
- **B-12** Bank matching edge cases: partial payment, overpayment, one transfer for several invoices, transfer for a cancelled order's invoice, unmatched transfers.
  a) Auto-match only an exact reference plus amount; everything else goes to manual assignment by ops. b) Also auto-apply partial payments and track the open balance. c) Auto-match by amount and customer even without a reference.
- **B-13** The 3PL ships less than ordered, or can't ship (stock discrepancy).
  a) Refund the missing lines with a credit note. b) Backorder and ship later. c) Cancel and refund the whole order.
- **B-14** Dunning rules: number of stages, intervals, fees, what happens after the last stage, when a customer leaves dunning.
  a) N reminders at fixed intervals, then hand to ops manually; out once all overdue invoices are paid. b) Reminders with fees per stage. c) After the last stage, block the customer's account or checkout.
- **B-15** Refund scope and trigger.
  a) Full refund only, triggered by ops. b) Partial or per-line refunds by ops. c) Customer-requested refunds approved by ops. Also: does a refund put the stock back?
- **B-16** Refund of an order paid by bank transfer. The brief covers card only.
  a) Never. b) Ops transfer the money manually, the system issues the credit note. c) Through the bank API.
- **B-17** A dispute opens on a card charge.
  a) Hold shipping if not yet shipped; on a lost dispute, issue a credit note. b) Record it only; invoice and order stay unchanged. c) Ops decide case by case. Also: what if a refund is pending when the dispute opens?
- **B-18** Cancellation other than missing the deadline (by customer or ops), including a paid order not yet shipped.
  a) None. b) Ops can cancel before shipping: refund plus credit note. c) The customer can cancel until the order is handed to the 3PL.
- **B-19** Sku registration in the 3PL article master: when it happens, and what if it fails.
  a) Register on product save; the product can't be sold until registered. b) Register on save; orders wait until the sku is registered. c) Register at first order.
- **B-20** Failure of the 3PL, mail provider or bank API: is delivery guaranteed, and are duplicates acceptable (for example two confirmation mails)?
  a) Retry until success, duplicates tolerated. b) Retry until success, exactly once to the customer. c) Best effort, with failures shown to ops.
- **B-21** Insufficient stock at checkout.
  a) Reject the whole order. b) Place it with the available quantity. c) Allow backorder.
- **B-22** A price changes between cart and checkout.
  a) Charge the current price and tell the customer. b) Honour the cart-time price. c) Block checkout until the customer confirms the new price.
- **B-23** Prices gross or net; shipping costs and their tax class; delivery countries (VAT beyond 7%/19%).
  a) Gross prices, free shipping, Germany only. b) Gross prices plus a shipping fee taxed at 19%, EU countries. c) Net prices plus VAT.
- **B-24** Card payment declined.
  a) The customer retries on the same order until the deadline. b) The order is cancelled at once and stock released. c) A new checkout is needed and the old order is left to expire.
- **B-25** Invoice, credit note and reminder delivery to the customer.
  a) Mailed as a PDF. b) Download only. c) Both.

## 3. Ambiguities

- **B-26** "An order-confirmation mail goes out once the order is placed"
  Card orders: "placed" can mean (1) checkout submitted, before payment, or (2) payment succeeded.
- **B-27** "The shop shows each product as its editor last saved it"
  It can mean (1) immediately, with no draft or publish step and no stale cache, or (2) eventually, with publish via Payload drafts allowed. It's also unclear whether open carts are repriced.
- **B-28** "current stock"
  It can mean (1) physical stock at the 3PL or (2) available stock, net of what open orders hold.
- **B-29** "an admin dashboard over orders, invoices and shipments"
  It can mean (1) read-only views or (2) views with actions (refund, manual match, cancel). Where it lives is also open: (1) inside Payload or (2) a separate app.
- **B-30** "invoice numbers are gapless"
  Scope can be (1) one series shared with credit notes or (2) separate series; and (1) per year or (2) forever.
- **B-31** "each line carries its VAT rate by tax class"
  The rate can come from (1) the order line's tax class at order time or (2) the product's tax class at invoice time, which matters if the invoice is issued at shipment.
- **B-32** "Pay by invoice is not offered to a customer in dunning"
  "In dunning" can start at (1) the first overdue invoice or (2) the first reminder sent.
- **B-33** "a request traceable across everything it touches"
  It can cover (1) synchronous calls only or (2) async follow-ons too: webhooks, scheduled jobs, mails triggered later.
- **B-34** "Incoming bank transfers are matched to open invoices"
  Matching can be (1) automatic only or (2) automatic plus manual by ops.

## 4. Contradictions / tensions

- **B-35** "Paid orders ship through the 3PL" vs "paying by bank transfer after the goods ship"
  Invoice-pay orders aren't paid before shipping, so read literally they never ship.
- **B-36** "An order unpaid at its payment deadline is cancelled" vs pay-after-shipping plus "dunning sends reminders over unpaid invoices"
  Overdue shipped invoice orders would be cancelled, which kills dunning and re-sells stock that already shipped ("a cancelled order's stock is sold again"). Does the deadline rule apply to card only?
- **B-37** "tracks each customer's dunning stage" vs "reminders over unpaid invoices"
  Two overdue invoices can be at different stages, so it's unclear whether the stage belongs to the customer or to each invoice.
- **B-38** Editable unique sku vs "Each order line carries the product's … sku" vs the 3PL needing each sku registered
  Renaming a sku leaves open orders pointing at an old, maybe unregistered sku. Is a sku immutable once saved?
- **B-39** "invoice numbers are gapless" vs cancellation
  If an invoice-pay order is invoiced at placement and later cancelled, its invoice can't be deleted. Only "a credit note per refund" is defined, and no money was refunded.

## Resolution

- **B-1** Rule is no unit sold to two orders; stock taken at placement (see B-8). "Holds" dropped.
- **B-2** Timing rule given (B-14); "scheduled" dropped.
- **B-3** Dunning per invoice; customer "in dunning" derived from overdue invoices.
- **B-4** Stated as need: later product edits never change an existing order.
- **B-5** Stated as need: operators see and act on orders, invoices, credit notes, shipments, transfers.
- **B-6** Stated as need: operator follows one checkout end to end.
- **B-7** a) 3PL authoritative, reports stock free to ship (received goods, returns included).
- **B-8** a) At placement; card orders until paid or 30 min deadline, invoice orders until passed to 3PL.
- **B-9** a) Refund in full at once, mail customer; no invoice, no credit note.
- **B-10** b) Guest checkout only, customer = email address.
- **B-11** b) Invoice at shipment report, due 14 days after invoice date; invoice order passed to 3PL at placement.
- **B-12** a) Auto only exact invoice number in reference + exact open amount; rest manual by ops; partial leaves rest open; surplus paid back by hand.
- **B-13** a) Unshipped lines dropped, card refunded, invoice over shipped only; nothing shipped: order cancelled. No backorder.
- **B-14** a) Three reminders, no fees: due+7, +14, +14; then +14 handed to ops. Out when no invoice overdue. No checkout block beyond no-invoice-pay.
- **B-15** b) Ops only, full or per line/quantity, shipped orders only; customers ask by mail. Refund doesn't touch stock; returns count via 3PL report.
- **B-16** b) Refund lowers open amount first; paid money returned by ops by hand, recorded; credit note issued.
- **B-17** b) Record only, shipping unaffected, no further refund; earlier refunds stand; lost dispute counts as refund (credit note if invoiced).
- **B-18** a) None besides card deadline and unshippable; change of mind = return + refund.
- **B-19** a) Sku to article master on first save; not for sale until there; editors see status.
- **B-20** Outage delays, never loses; rare duplicate mail ok, no duplicate shipment/refund/payment booking; ops see delays.
- **B-21** a) Reject whole order, name short lines with available qty.
- **B-22** c) Current price; customer confirms changed price before placement. Carts show current prices.
- **B-23** a) Gross prices, free shipping, Germany only.
- **B-24** a) Retry on same order within 30 min deadline.
- **B-25** a) Mailed as PDF; no accounts, so no download.
- **B-26** Card: once paid; invoice: once placed.
- **B-27** (2)-ish: visible within a minute, no draft/publish step; checkout always uses current price; carts repriced.
- **B-28** (2) Available stock (3PL free-to-ship less orders not yet passed to it).
- **B-29** (2) Views with actions. Where they live: left open: same capabilities either inside Payload or separate; drafter may choose.
- **B-30** (2)+(1): separate series for invoices and credit notes, each gapless per calendar year.
- **B-31** (1) Order line's tax class at order time, that class's rate.
- **B-32** (1) From first invoice past due and unpaid.
- **B-33** (2) Includes later follow-ons: payment, mails, 3PL, shipment, invoice, matching, reminders.
- **B-34** (2) Automatic plus manual by ops.
- **B-35** Card orders ship once paid; invoice orders ship once placed, paid after.
- **B-36** Payment deadline card only (30 min); unpaid invoices go to dunning, never cancellation.
- **B-37** Stage per invoice; customer state derived.
- **B-38** Sku fixed once saved.
- **B-39** Invoice issued only at shipment; shipped orders never cancelled; invoices never changed or deleted, corrections by credit note.
