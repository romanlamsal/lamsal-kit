# Review 05, findings as a checklist

Three readers over the property-rules distilled set: `dist-implementer.md`, `dist-fresh-a.md`,
`dist-fresh-b.md`. One line each, stable id. The regression reader marks each after a change:
`resolved`, `unchanged`, `newly broken`, `out of scope`.

## Review 04, state now

- R04-1 to R04-4 tensions: not re-found.
- R04-5 to R04-8 Statement/Why: not re-found.
- R04-9 to R04-11 purpose not told: not re-found.
- R04-12 product owner: Whys agree; split two to one stands (C4); see R05-1.
- R04-13 P12 record: not re-found.
- R04-14 poll: re-found as R05-6.
- R04-15 sandbox: re-found, unchanged (Impl S1).
- R04-16 deadline field: not re-found as a question; R05-13 extends it.
- R04-17 first result replayed: not re-found.
- R04-18 runtimes: re-found, unchanged, `Intl` added (R05-18).
- R04-19 fakes by type: not re-found.
- R04-20 Store "can carry": re-found (Impl S10).
- R04-21 P8 "beside": not re-found; R05-5 instead.
- R04-22 "the same for every candidate": re-found as R05-14.
- R04-23 P15 for a read: re-found in a new shape, R05-10.
- R04-24 P18 overrides: re-found against the new text, R05-25.
- R04-25, R04-26, R04-28, R04-29: not re-found.
- R04-27 P11 s2 published language: new shape, R05-27.
- R04-30 Courier: re-found (Fresh A S6, Fresh B S3).
- R04-31 to R04-33 hygiene: resolved.
- R04-34, R04-35, R04-37 to R04-40 fixture: re-found, frozen (issue 21). R04-36 not raised.
- R04-41: C2, C8, C9 now split (R05-33). R04-42 as R04-12. R04-43 no sync hold, 3 of 3.

## Tensions

- R05-1 Impl T1: P2 Why "has to be asked … the record is that system's" makes the fixture's sku
  veto a second owner (P2, P3, P10) (`p2-breach-sku-veto-asks-shop`).
- R05-2 Impl T2: P7 one aggregate against gapless numbers; series aggregate by message (Impl,
  Fresh B D14) or unique key (Fresh A D13) (`p7-breach-gapless-invoice-number`).
- R05-3 Impl T3: P7 × P10, one order reserving several skus; locks or one message per line;
  Fresh A D6, D7 sidesteps (`p7-breach-multi-sku-reservation`).
- R05-4 Impl T4: P7 × P10, the cart still full after the order; both Fresh make the cart a stage of
  `Order` (A D5, B D4) (`p7-breach-cart-cleared-with-order`).
- R05-5 Impl T5: P17 s2 × P7, P8, a PaymentIntent with no aggregate holding its moment when
  payment's commit fails (`p17-breach-intent-before-payment-record`; N8).

## Statement and Why disagree

- R05-6 P4 "one acting call per call or message" vs Why's one per polled item (Impl D1; R04-14).
- R05-7 P2 Why "no statement of the rule" vs P13's MAY (Impl D2).
- R05-8 P14 "its writer … parse with" vs external writers (Impl D3, S8).
- R05-9 P8 "MUST make the change" vs a change the outside refuses (Impl D4, S5).
- R05-10 P15 s2 "MUST ask for by a message" vs the tentative call by call (Impl D6; Fresh A S3,
  S13).
- R05-11 P11 read channels vs data handed over in a command (Impl D7).
- R05-12 P7 "the record of the message" vs P9 "or by the records"; three readings (Impl D5, S3;
  Fresh A S12; Fresh B S6).

## Purpose not told

- R05-13 P16 ambient ban where no in-process call crosses systems (Impl 1).
- R05-14 P2 "the same for every candidate" (Impl 2; R04-22).

## Readings two or three of three took

- R05-15 P17 "holds something until the answer comes": fulfillment's stock hold has a deadline
  (Fresh A S8, Fresh B S7).
- R05-16 P9 key per consumer, `(consumer, message_id)` (Fresh A S10, Fresh B S9).
- R05-17 P6 Why "fake commits nothing": the fake rolls back (Fresh A S11, Fresh B S10).
- R05-18 P1 "every runtime": `Intl` with time zones (Fresh A S5, Fresh B S11, Impl S17).
- R05-19 P11 stock in Payload's admin through fulfillment's open host service (Fresh A S9, Fresh B
  D7, Impl S18).
- R05-20 Revalidate route: no layer, the far side of a driven adapter; no glossary name (Impl N7,
  Fresh A D31, Fresh B S19).

## Readings that split or hung

- R05-21 P10 "data whose change fails no transaction of this store" (Fresh A S4, Impl S21).
- R05-22 P13 "Code of another system" for Payload config importing a hook (Impl S18, Fresh B S13).
- R05-23 P5 "way in … which is no export": driving export paths (Fresh A S7).
- R05-24 Glossary Driving adapter count (Fresh A S14).
- R05-25 P18 "one thing", private messages (Impl S11, Fresh B S16; R04-24).
- R05-26 P3 kernel schema and `vatRate` (Fresh B S15, Impl S7).
- R05-27 Assumptions' generated published language vs P13 s3 "MUST NOT be generated" (Impl N13).
- R05-28 P12 adapter tests importing the upstream's fake (Impl S20).
- R05-29 P15 Why's deadline reconciliation: permitted or expected (Fresh B S8).

## Hygiene

- R05-30 P5 Glossary notes leaked into the distilled set: blank line in the field
  (`property-rules.md` l.568); Fresh B S4.
- R05-31 Words used, not in the glossary (Impl N15).
- R05-32 Outbox port typed by an upstream's commands; P2/P13 wording on `ReserveStock` (Impl N25).

## Choices

- R05-33 C2 (Fresh A orchestrates), C8 (after payment's commit vs inside shop's open transaction),
  C9 (Fresh B card payments in shop) now differ; answers R04-41.

## Fixture

- R05-34 Short stock at `OrderPlaced` unsaid (Impl N9); no shipping address (N19); 3PL article
  master holds fulfillment's fields (N10).
