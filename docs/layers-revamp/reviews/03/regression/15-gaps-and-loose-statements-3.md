Base 28801e5, head 9136f42.

Judged on `distill.mjs` run at head (HEAD = 9136f42). Changed: TX-48 and TX-49 new; SVC-2
Relies-on only (line on TX-49); glossary and the-world untouched. "Pre-existing" marks a breach the
change did not cause.

## Checklist

- R03-1: out of scope — resolved at 042da0f; Reach and the reach lists untouched.
- R03-2: out of scope — TX-28, TX-44 untouched.
- R03-3: out of scope — Tentative operation, TX-36 untouched.
- R03-4: out of scope — TX-37, TX-41 untouched.
- R03-5: out of scope — SYS-16 untouched.
- R03-6: out of scope — resolved at 042da0f; SVC-2 gained a line on TX-49, its line on DRV-8 is untouched.
- R03-7: out of scope — TX-37's line on TX-31 untouched.
- R03-8: out of scope — SYS-1, Offer untouched.
- R03-9: out of scope — DOM-1, Pure untouched.
- R03-10: out of scope — SVC-7 untouched.
- R03-11: out of scope — ASM-2 untouched.
- R03-12: out of scope — SYS-9 untouched.
- R03-13: out of scope — TX-1 untouched; TX-49 rules what follows a failed save, not where the load runs.
- R03-14: out of scope — SVC-4 untouched.
- R03-15: out of scope — TX-28 untouched.
- R03-16: out of scope — TX-37 untouched.
- R03-17: out of scope — TX-22, TX-36, TX-3 untouched.
- R03-18: out of scope — ASM-3, TX-15, TX-1, DOM-1, DOM-4 Scopes untouched.
- R03-19: out of scope — SYS-2 untouched; TX-48 hits `tx-7-ok-gift-message-added-optional` on another ground (Newly broken).
- R03-20: out of scope — TX-5 untouched; TX-49 asks the use case to fail on a conflict, which `svc-2-ok` and `sys-13-ok` already do.
- R03-21: out of scope — TX-19 untouched.
- R03-22: out of scope — TX-23 untouched; TX-49's Scope needs a load, a blind upsert has none.
- R03-23: out of scope — DOM-7 untouched.
- R03-24: out of scope — resolved at 28801e5; TX-47 untouched.
- R03-25: out of scope — SVC-6 untouched.
- R03-26: out of scope — TX-24, TX-30, TX-32 untouched.
- R03-27: out of scope — fixture facts.
- R03-28: out of scope — System untouched.
- R03-29: out of scope — ASM-2, System builder untouched.
- R03-30: out of scope — Outside, Pure untouched.
- R03-31: out of scope — catalog's rules untouched.
- R03-32: out of scope — nothing on `PaymentFailed`.
- R03-33: out of scope — Assumptions untouched.
- R03-34: out of scope — Store untouched.
- R03-35: out of scope — resolved at 042da0f; TX-27 untouched, TX-49 binds repository saves, not live answers.
- R03-36: out of scope — Assumptions untouched.
- R03-37: out of scope — DRV-7 untouched.
- R03-38: out of scope — resolved at 042da0f; SVC-2's Scope and Statement untouched.
- R03-39: out of scope — fixture reading.
- R03-40: out of scope — Tentative operation untouched.
- R03-41: out of scope — ASM-3 untouched.
- R03-42: out of scope — Idempotent untouched.
- R03-43: out of scope — Pure untouched.
- R03-44: out of scope — ASM-4 untouched.
- R03-45: out of scope — Assumptions untouched.
- R03-46: out of scope — Double, TST-6 untouched.
- R03-47: out of scope — TX-37, TX-28 untouched.
- R03-48: out of scope — TX-38 untouched.
- R03-49: out of scope — Store untouched.
- R03-50: out of scope — External system untouched.
- R03-51: out of scope — Offer untouched.
- R03-52: out of scope — DOM-1, SYS-14 untouched.
- R03-53: out of scope — Pure untouched.
- R03-54: out of scope — P9 untouched.
- R03-55: out of scope — P15 untouched.
- R03-56: out of scope — P8 untouched.
- R03-57: out of scope — TX-38, TX-45 untouched.
- R03-58: out of scope — resolved at 28801e5; P5 untouched.
- R03-59: out of scope — `choices.md` untouched.

## Previous regression's Newly broken

- TX-7 and `paidByInvoice`: resolved — TX-48: `OrderPlaced` gains `paidByInvoice`, old billing (and old fulfillment) read its absence as "paid by card" and wait for an `OrderPaid`, and the change is an optional field on the old message, not a new message taking over; Scope and Statement alone refuse the body. But the reading that puts an old handler which never parses the field in Scope also puts the gift message in: `tx-7-ok-gift-message-added-optional`, ok in the previous file, now breaches TX-48 (Newly broken).
- SVC-2 and reload-and-save-again: resolved — TX-49: the first `orders.save` fails with `VersionConflict` because the order was paid since the use case loaded it, and the use case catches, reloads and saves instead of failing with it; Scope and Statement alone refuse the body, which now breaches TX-49 rather than SVC-2 (SVC-2 stays met). TX-49 refuses nothing shown as ok: every ok example in reach (`svc-2-ok`, `asm-9-ok` rethrows) and both builds let the failed save propagate.

## Examples in the affected set

No breach file flips. `svc-2-breach-loaded-order-passed-through-port` met SVC-2 at 042da0f and 28801e5 and still does; TX-49 does not reach it (below).

- drv-8-breach-adapter-reads-repository-to-check-owner.md: breach — DRV-8 (driven port reached), SVC-2 (adapter decides); TX-49's Scope fails, no failed save shown.
- svc-2-breach-loaded-order-passed-through-port.md: holds — SVC-2 met as before, not a flip by this change; TX-49's Scope fails: the use case loads nothing, and a failed save throws out of `transactions.run` anyway.
- svc-2-breach-server-action-checks-before-cancel.md: breach — SVC-2, DRV-1; TX-1 load outside the transaction; TX-49 holds, a failed save propagates.
- svc-2-ok-cancel-order-decides-itself.md: breach — TX-1 load outside (R03-13), TX-5 repeat throws (R03-20), pre-existing; SVC-2 and TX-49 hold, a failed save propagates.
- tx-7-breach-amount-unit-changed-in-place.md: breach — TX-7, `amount` changes meaning; TX-48's Scope fails, no field gained.
- tx-7-breach-customer-id-renamed-quantity-narrowed.md: breach — TX-7; TX-48 not reached: the absent `buyerId` fails `parse`, no handler reads it as a fact.
- tx-7-ok-gift-message-added-optional.md: breach — TX-48, newly: the schema gains `giftMessage`, a handler reads its absence as "no note" (old code on every order, new code on every pre-deploy row), and the change is no new message; SYS-2 (R03-19) pre-existing; TX-7 holds.

## Previous builds

- **TX-49** (new). raw `### shop` (`cancel-if-overdue.ts`: "loses to a concurrent paid mark:
  StaleAggregate, retried, then nothing"; the Drizzle order repository throws `StaleAggregate`),
  `### billing` (`sequences.save` "version-checked"), `### fulfillment` (`d.stock.save`
  "version-checked"), `### common library` (`StaleAggregate`; bus "a throw: no settle, retried"):
  no service catches the conflict; complies, as before. dist `### shop` (`cancel-order.ts`: "TX-23:
  fails if a payment saved first"), `### payment` (`refund-payment.ts`: a dispute committed meanwhile
  "fails the save … on redelivery the refund is refused"), `### billing` (`issue-invoice.ts`: "a
  concurrent issue fails; redelivered (TX-38)"): complies. Nothing flips.
- **TX-48** (new). Neither build changes a message schema: raw `### shop` `orderPlacedSchema`
  carries `paymentMethod` from the start, dist `### billing` reads `payBy` on `OrderPlaced` from the
  start. Scope fails; nothing flips.
- **SVC-2** (Relies-on only): nothing.

## Newly broken

### TX-48 against an optional field any handler reads

~~~md
---
breaches: [TX-48]
satisfies: [TX-7]
situation: shop's OrderPlaced gains an optional giftMessage; fulfillment prints the note when there is one
finding: regression
---

# A gift message added optional; fulfillment reads its absence as "no note"

```ts
// shop/published/messages.ts — the change
export const orderPlacedSchema = z.object({ /* fields as before */ giftMessage: z.string().max(200).optional() })

// fulfillment/service/pack-order.ts — new code
const slip = m.giftMessage === undefined ? plainSlip(m) : giftSlip(m, m.giftMessage)   // absent: no note
// fulfillment, old code: z.object strips giftMessage; every parcel ships with a plain slip
```

TX-7 holds: old rows parse in new code, new rows in old code, no field changes meaning. TX-48's
Scope holds: a handler reads the field's absence as a fact, "no note", the new one on every
pre-deploy row and on every order without a note, the old one on every order. What old fulfillment
takes from the absence is false for a gift order just as "card" is for an invoice order; the line
between them, that what the old handler read of the order stayed true, is TX-48's Why only. The
Statement then wants a new message for every optional field a handler reads, `paidByInvoice` and
the gift message alike.
~~~

## Noticed

- `svc-2-breach-loaded-order-passed-through-port`: the use case loads nothing, so TX-23's "exists where it loaded none" fails every save there; the stale-order harm the file names cannot commit.
- TX-48's Scope names a message only; TX-7's also covers a record and an open host service's port schema, where an optional field's absence read as a fact has no counterpart.
