Base 1892b7e, head working tree (uncommitted).

Changed: P2 Why (third "looks like a second statement" item), P7 Statement, Why, Provenance, P10 Why,
Provenance. Glossary and world unchanged.

## Checklist

- R05-1: resolved — P2's Why no longer makes the asked system an owner. The fixture's veto placed as catalog's rule in catalog's configuration, with shop's hook only answering `openOrdersCarrying` about shop's orders, leaves catalog the one Owner (P3) and reads through shop's open host service (P11). P10 does not reach an external system's configuration (Assumptions). Impl's placement, with `count > 0 → throw` inside shop's hook, still breaches P3: "a second owner's rule".
- R05-2: resolved — P7 now admits the series and the invoice saved in one transaction, because the gapless rule ties them (the Why's ticket-number case). P10 s3 accepts that issuances fail each other.
- R05-3: resolved — P7 now admits each sku's `Stock` saved together with the `Reservation` where fulfillment's domain states the rule tying an order's holds to each sku's stock (the Why's three-flights case), each save version-compared (P10 s1). The plain-read snippet still breaches P10 s1.
- R05-4: resolved — P7 now admits `Order` inserted and `Cart` emptied in one transaction where shop's domain states the tie (the Why's basket case). The world's "order placed, cart still full" is no longer produced by the rule.
- R05-5: unchanged — the loosening admits several of payment's own aggregates, not Stripe's intent. P17 s2 still finds no aggregate when payment's commit fails after `openIntent`.
- R05-6: out of scope — P4 untouched.
- R05-7: out of scope — the P2 Why edit is in the external-configuration item, not the published-language item that P13's MAY meets.
- R05-8: out of scope — P14 untouched.
- R05-9: out of scope — P8 untouched.
- R05-10: unchanged — P7's Why now defers to P8 and P15 for how a tentative operation is asked of another system. P7 Statement's "what else its goal needs MUST be asked for by such a message", like P15 s2, still reads against the call when read alone.
- R05-11: out of scope — P11 untouched.
- R05-12: out of scope — P7's "the record of the message it is called for" clause is unchanged.
- R05-13: out of scope — P16 untouched.
- R05-14: out of scope — P2 Statement untouched.
- R05-15: out of scope — P17 untouched.
- R05-16: out of scope — P9 untouched.
- R05-17: out of scope — P6 untouched.
- R05-18: out of scope — P1 untouched.
- R05-19: out of scope — the new P2 sentence on "a hook of the owner" concerns writes; the stock field is a read (P11).
- R05-20: out of scope — no layer or glossary term touched.
- R05-21: unchanged — P10 Why now says "a business rule across aggregates the use case does not save together". That is the same reach as before, so P10 s2 still splits as it did.
- R05-22: out of scope — P13 untouched.
- R05-23: out of scope — P5 untouched.
- R05-24: out of scope — the glossary's Driving adapter is untouched.
- R05-25: out of scope — P18 untouched.
- R05-26: out of scope — P3 untouched.
- R05-27: out of scope — Assumptions and P13 untouched.
- R05-28: out of scope — P12 untouched.
- R05-29: out of scope — P15 untouched.
- R05-30: out of scope — P5 and its Glossary notes are untouched by this diff.
- R05-31: unchanged — P7 Statement now hangs on "ties" (already in P10's), and no glossary entry was added for it.
- R05-32: out of scope — the P2 Why paragraph on `ReserveStock` is untouched.
- R05-33: unchanged — C8 (the tentative call after payment's commit or inside shop's open transaction) is not settled by P7's Why deferring to P8 and P15.
- R05-34: out of scope — fixture gaps; nothing touched.

## Previous builds

### P7

- billing, `p7-breach-gapless-invoice-number`, "Natural code" (`issue-invoice.ts`, `series.save` +
  `invoiceable.save`): now complies with P7, since the gapless rule ties the two, provided billing's
  domain states the rule (the Impl's `assignNumber` docstring does). Both saves are version-compared
  (P10 s1). Complying code (`InvoiceSeries` → `InvoiceNumberAssigned` → draft invoice): still
  complies, since one aggregate per use case stays allowed. Fresh A D13 (unique `(year, seq)`, one
  save) and Fresh B D14 (`NumberSeries` by message) still comply.
- fulfillment, `p7-breach-multi-sku-reservation`, "Natural code": the variant that saves a `Stock`
  per sku now complies with P7 where fulfillment's domain states the tie; it needs no lock
  discipline (S6). The snippet shown (`s.stock.levels` plain read, `reservations.insert`) still
  breaches P10 s1: unchanged. Complying A (`lockLevels` FOR UPDATE) and B (per-line `ReserveLine`)
  still comply. Fresh A D6/D7 still comply.
- shop, `p7-breach-cart-cleared-with-order`, "Natural code" (`orders.insert` + `carts.save(emptied)`):
  now complies with P7 where shop's domain states the tie, with the cart read in the transaction and
  version-compared (P10 s1). Complying code (`ClearCart` message, `clearOrderedLines`, `cart-view`)
  still complies: P7 admits saving tied aggregates together but does not require it, and shop's
  stated rule accepts the stale cart (P10 s2). The two are alternatives by which rule shop states.
  Fresh A D5 and Fresh B D4 (cart as a stage of `Order`) still comply.
- payment, `p17-breach-intent-before-payment-record`, "Natural code" (`openIntent` then
  `payments.insert` in one transaction): still breaches P17 s2 when the commit fails. Complying code
  (commit `Payment` with `expiresAt`, then `openIntent` after the commit): still complies.
- Impl S19 (Refund inside `Payment`) still complies. Reading (a), Refund as its own aggregate, can
  now save with `Payment` where the dispute rule ties them, instead of needing a stale rule.
- `p7-ok-shop-write-scope`, `p7-ok-transfer-match-saves-one-aggregate`,
  `p7-ok-dunning-run-writes-one-message-per-customer`: still comply.

### P2 (Why only)

- shop, `p2-breach-sku-veto-asks-shop`, "The fixture as written" (`payload-sku-guard.ts`): still
  breaches P3, and P2 too, since the decision sits in a driving adapter. Its
  `if (count > 0) throw` decides catalog's record from shop's code, which the new Why names "a
  second owner's rule, which P3 refuses". The P10 charge falls: the veto is catalog's rule, and P10
  does not reach an external system's configuration (Assumptions). One placement newly complies and
  keeps both the veto and catalog's ownership: the comparison sits in catalog's `products.ts`
  `beforeChange`, and shop's hook only returns `openOrdersCarrying`'s count (P2, P3, P4, P11, P16
  hold). That is the fixture's own wording ("catalog's beforeChange asks shop … and refuses").
- Option A (sku snapshot, no veto): still complies, because the "asked only to protect records of
  its own … is not asked" sentence is kept.
- Option B (sku moved to shop, `payload-sku-request.ts` → `request-sku-change.ts`): still complies,
  and is what "a system that takes a write the owner's rule decides, in a hook of the owner, is one
  of the owner's ways in" describes.

### P10 (Why, Provenance only)

Nothing in the builds changes beyond what P7 carries.

## Newly broken

None. Checked:

- Aggregates of two systems: still refused, by P7 Scope ("its own system's records") and P16 s1.
- A tie no domain states: refused by P2 Statement (every business rule stated in its domain). A tie
  the business does not hold is refused by P7 itself and by P10 s3.
- "Everything is tied": a false invariant written into the domain is refused by P7 and P10 s3
  together. That is the same test that already judged an aggregate drawn wide (P10 Why, `Product`),
  so there is no new case.
- A statistic saved with the order: refused by P10 s3 and the P7 Why.
- Intra-system tentative operation (Impl T3 option B, T2 draft invoice): P7 permits saving tied
  aggregates together and does not require it, so these still comply.

## Noticed

- "Tie" has no glossary entry, and P7 and P10 hang on it. The Why reads it as "needs records changed
  at once". A looser reading ("every booking is invoiced") would admit the booking-plus-invoice save
  that the Why sends by message.
- A tentative operation within one system (glossary: "to another aggregate") has no rule for how it
  ends: P17 Scope is work spanning systems. Before, P7's Why only pointed at P17.
- P2 Why: "asked only to protect records of its own … is not asked" and the timetable asking bookings
  both fit the sku veto. Which one applies turns on whose rule the veto is.
- P7 Why: "Two cases look like a tie", then it rules the second ("must not commit before another
  agrees") a tie within the system.
