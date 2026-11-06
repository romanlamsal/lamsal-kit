# Adversarial review, distilled set

## Summary

- `dom-1-breach-order-typed-by-drizzle-row.md`: DOM-1, P1. The domain types Order as Drizzle's inferred row through a type-only import, which reaches nothing, so DOM-1's Scope never holds.
- `dom-3-breach-order-total-turns-net-in-place.md`: DOM-3, P14. `orders.total` changes from gross to net while the one schema line stays as it was; no rule covers what a stored field means across deploys.
- `dom-4-breach-pick-decided-on-reservation-snapshot.md`: DOM-4, P10. A Shipment holds a snapshot of its Reservation's `active` flag and decides picking by it after the Reservation was released.
- `dom-7-breach-dunning-grace-days-in-env.md`: DOM-7, P2. The domain states the rule with a parameter; the rule's number arrives as a configuration value (ASM-2) and differs per deployment.
- `svc-1-breach-gateway-port-in-stripe-terms.md`: SVC-1, P5. The driven port is declared in the service layer but in Stripe's types; no rule asks a driven port to speak the system's terms.
- `svc-3-breach-sibling-service-behind-driven-port.md`: SVC-3, P7. Checkout reaches its sibling `redeemVoucher` through a driven port that assembly wires to it; the sibling commits its own transaction.
- `svc-7-breach-drizzle-client-renamed-as-port.md`: SVC-7, P5. `interface ShopDb extends Database {}` in the service layer turns the store client into "a port of its system".
- `dvn-4-breach-repository-recalculates-on-save.md`: DVN-4, P4. The repository applies a domain function on save; the fake does not, so the use case answers differently by what serves the port.
- `drv-8-breach-server-action-picks-use-case-by-rule.md`: DRV-8, P4. A server action applies the wholesale rule to choose between two acting use cases; other callers skip the rule.
- `asm-7-breach-server-action-mails-through-common-mailer.md`: ASM-7, P8. The MAY lets a driving adapter send the confirmation mail through a ready-made common-library mailer after the commit; a stop in between loses it.
- `asm-3-breach-ambient-baggage-read-through-common-library.md`: ASM-3, P4. The service calls a common-library helper that reads OpenTelemetry baggage; the service "reads" no ambient value itself.
- `asm-5-breach-dashboard-in-common-library.md`: ASM-5, P11. The admin dashboard lives in the common library, is handed the pool by assembly, and joins three systems' tables.
- `tx-1-breach-shop-read-under-counter-lock.md`: TX-1, P15. Billing calls shop's open host service while its transaction holds the gapless counter lock; a slow shop stalls every invoice.
- `tx-2-breach-repository-spans-two-stores.md`: TX-2, P7. An Invoice repository writes rows in the transaction and the PDF to object storage; TX-2 binds only calls into "its store".
- `tx-23-breach-invoice-saved-from-form-never-loaded.md`: TX-23, P10. The use case saves a whole Invoice rebuilt from a form, never loaded, so no version check runs and a concurrent `paid` is overwritten.
- `tx-24-breach-reservation-oversells-stock.md`: TX-24, P10. TX-24 is a SHOULD; a codebase that deviates oversells stock, and P10 has no Except.
- `tx-25-breach-driving-port-takes-unit-of-work-id.md`: TX-25, P16. The open host service takes a string id of shop's unit of work; billing's transaction port opens a savepoint inside shop's transaction.
- `tx-22-breach-server-action-calls-answering-send-mail.md`: TX-22, P8. A use case that only sends mail changes nothing of the system, so it is answering, decides nothing and runs in no transaction; TX-22's Scope misses it.
- `tx-37-breach-reminder-mailed-after-payment.md`: TX-37, P17. TX-37 forbids looking at the cleared dunning stage, so a delayed reminder goes to a customer who has paid.
- `tx-31-breach-split-shipment-keyed-by-order-id.md`: TX-31, P17. The key is the same on every message asking for the change, and also on the message asking for the next parcel; the 3PL returns the first booking.
- `tx-30-breach-deadline-rule-extends-forever.md`: TX-30, P17. The business rule decides what happens on silence: wait another hour, forever.
- `tx-20-breach-relay-cursor-skips-late-commit.md`: TX-20, P8. A sequence-cursor outbox reader skips a message that commits after a later one; the relay never "reads" it, so TX-20's Scope never holds.
- `tx-5-breach-concurrent-redelivery-issues-two-invoices.md`: TX-5, P9. Check-then-insert is idempotent on a sequential repeat and double-invoices on a concurrent one (F5).
- `tx-5-breach-order-paid-means-two-things.md`: TX-5, P19. `OrderPaid` means "paid, now invoice and ship" in one flow and "invoice settled" in the other; idempotency per message id lets billing invoice twice, and no rule protects P19.
- `tx-19-breach-cancel-before-place-leaves-reservation.md`: TX-19, P18. Each use case is order-independent over its own messages; across the two, cancel-before-place leaves stock reserved.
- `tx-7-breach-unit-price-turns-net-schema-unchanged.md`: TX-7, P14. A message field changes meaning with no schema change, so TX-7's Scope ("the schema … changes") does not hold.
- `tx-17-breach-reserve-stock-published-as-event.md`: TX-17, P3. A command for fulfillment, labelled an event, carries fulfillment's rules computed in shop; it names no handler, and SYS-13 and TX-33 see no command.
- `tx-38-breach-sku-registration-retried-forever.md`: TX-38, P17. The 3PL refuses a sku for good; TX-38, DRV-7 and TX-21 together require redelivery forever.
- `tx-12-breach-checkout-asks-billing-synchronously.md`: TX-12, P15. TX-12 lets shop read billing's dunning stage from the open host service on every checkout, whether or not a rule needs it now.
- `tx-12-breach-shop-selects-billing-outbox.md`: TX-12, P13. Shop reads billing's "published events" straight from billing's outbox table.
- `tx-26-breach-replica-rederives-dunning-rule.md`: TX-26, P2. Shop's replica is written from billing's events, as asked, and shop's domain re-derives billing's dunning rule from it.
- `tx-27-breach-cart-snapshots-dunning-stage.md`: TX-27, P10. The pay-by-invoice decision rests on a weeks-old snapshot in Cart, not on a replica, so neither TX-27 nor TX-24 applies.
- `sys-2-breach-event-declared-in-domain-module.md`: SYS-2, P13. A published event is declared in a domain module; the declaring module "reaches" nothing, and fulfillment uses it through a type-only relative import.
- `sys-10-breach-port-type-inferred-from-service.md`: SYS-10, P13. The published port type is `ReturnType<typeof createX>` of the service; loading the path loads nothing, and the port changes whenever the service changes.
- `sys-12-breach-metabase-reads-shop-tables.md`: SYS-12, P11. An external system configured by this codebase reads three systems' tables; the rules cover only an external system's changes and its telling of them.
- `tst-6-breach-overview-order-unasserted.md`: TST-6, P4. The contract suite asserts only what the service's test relies on; the fake sorts and the real adapter does not, and the page shows rows[0].

## Findings

### DOM

### dom-1-breach-order-typed-by-drizzle-row.md
```yaml
breaches: []
satisfies: [DOM-1, DOM-7]
situation: shop marks an order paid
finding: adversarial
```
# Shop's domain takes its Order type from the Drizzle table
```ts
// shop/domain/order.ts — domain; its types come from the driven adapter's table
import type { InferSelectModel } from "drizzle-orm"
import type { orders } from "../drizzle/schema"            // erased at build: running this module reads nothing of it

export type Order = InferSelectModel<typeof orders>
// = { id: string; status: string; total: string; paidAt: Date | null; deletedAt: Date | null; updatedAt: Date }

export const markPaid = (order: Order, now: Date): Order =>
  order.status === "placed" && order.deletedAt === null
    ? { ...order, status: "paid", paidAt: now, updatedAt: now }
    : order
```
The glossary defines reach as "what running it reads or calls". Type-only imports are erased, so running
the module reads nothing past itself. DOM-1's Scope does not hold, and the rule says nothing. P1 fails: the
model takes the store's shape. `total` is a numeric string because Postgres returns `numeric` that way,
`deletedAt` is a soft-delete column, `status` is a bare `string`, and `updatedAt` is there for the adapter. A
migration changes the domain's types and the code that type-checks against them. The same erased import
gets past SVC-6, DRV-8, DVN-4, SYS-9 and SYS-14. Wording that would catch it: "What the domain imports or
names, at runtime or as a type, MUST be …", or a reach that includes the types a module names.

### dom-3-breach-order-total-turns-net-in-place.md
```yaml
breaches: []
satisfies: [DOM-3, DOM-7, TX-7]
situation: the customer's account page and refunds read an order's total
finding: adversarial
```
# `orders.total` changes from gross to net; its schema line does not change
```ts
// shop/domain/order.ts — identical in v41 and v42
export const orderSchema = z.object({
  id: z.string(), status: orderStatusSchema, lines: z.array(lineSchema),
  total: moneySchema,                     // v41 writes gross; v42 writes net and adds VAT where it is shown
})

// shop/domain/order.ts — v42 only
export const totalWithVat = (o: Order, vatRate: number): Money => percentOf(o.total, 100 + vatRate).amount
```
DOM-3 asks for one statement, as a schema in the domain, and there still is one, unchanged. TX-7, the
only rule about meaning across versions, covers messages and the ports of an open host service, not
records, and its Scope needs the schema to change. P14 fails. Every order v41 wrote holds a gross
total, v42 reads it as net, and the account page and refund amounts add VAT a second time (F4: records
outlive the code that wrote them). Wording that would catch it: a rule for records, "A stored field MUST
keep its meaning; a new meaning is a new field, and old records are migrated or read by the version that
wrote them".

### dom-4-breach-pick-decided-on-reservation-snapshot.md
```yaml
breaches: []
satisfies: [DOM-4, TX-24, TX-23, SVC-2, TX-1]
situation: fulfillment reserves stock on OrderPlaced and releases it on OrderCancelled; warehouse staff pick a shipment
finding: adversarial
```
# Shipment decides picking by its snapshot of the Reservation
```ts
// fulfillment/domain/shipment.ts
export const shipmentSchema = z.object({
  id: z.string(), orderId: z.string(), status: z.enum(["planned", "picked"]),
  reservation: z.object({                          // snapshot, copied when the shipment is planned (DOM-4)
    reservationId: z.string(), active: z.boolean(),
    lines: z.array(z.object({ sku: skuSchema, quantity: z.number().int().positive() })),
  }),
})
export const pick = (s: Shipment): Shipment => {
  if (s.status !== "planned" || !s.reservation.active) throw new NotPickable(s.id)
  return { ...s, status: "picked" }
}

// fulfillment/service/pick-shipment.ts — called by the warehouse tool's server action
export const createPickShipment = ({ transaction, shipments }: Deps): PickShipment =>
  ({ shipmentId }) => transaction.run(async (tx) => {
    const shipment = await shipments.byId(shipmentId, tx)
    await shipments.save(pick(shipment), tx)       // the data it decides by belongs to Shipment, which it saves
  })
```
DOM-4 is satisfied: the Shipment holds the Reservation as a snapshot. TX-24 is satisfied: the data the use
case decides by belongs to Shipment, which it saves. TX-23 finds Shipment unchanged since it was loaded.
In between, `OrderCancelled` released the Reservation, so the stock went back and the parcel is picked
for a dead order. P10 fails: the use case commits on a read (`active`) that no longer holds, and no
business rule accepts the lag. Unlike a replica (TX-27), nothing asks one to. Wording that would catch
it: "A decision that has to hold at commit MUST NOT rest on a snapshot of a value another aggregate
still changes", or TX-24 counting a snapshot's data as its source aggregate's.

### dom-7-breach-dunning-grace-days-in-env.md
```yaml
breaches: []
satisfies: [DOM-7, ASM-2, ASM-3, TST-3]
situation: scheduled dunning runs over unpaid invoices
finding: adversarial
```
# The dunning rule is stated once; its number lives in the deployment
```ts
// billing/domain/dunning.ts — the rule, stated once
export const nextStage = (d: CustomerDunning, oldestOverdueDays: number, graceDays: number): Stage =>
  oldestOverdueDays > graceDays ? raise(d.stage) : d.stage

// billing/service/run-dunning.ts — the factory receives a configuration value from its caller (ASM-2)
export const createRunDunning = ({ transaction, dunnings, invoices, clock, graceDays }: Deps): RunDunning => …

// apps/worker/assembly.ts
const billing = buildBilling({ db, graceDays: Number(process.env.DUNNING_GRACE_DAYS) })   // 14; 30 on the B2B deployment
```
DOM-7 is satisfied: the rule "raise past the grace period" is stated once, in the domain. ASM-2 goes
further and requires the factory to receive a configuration value from its caller, and the value is not
ambient (ASM-3). P2 fails: "remind after 14 days" is a business rule, and its substance lives in an env
file that ops change without a code review. A domain test proves the comparison, not the rule (TST-3).
P3 fails as well: the grace period changes with the dunning policy, yet sits apart from it. Wording that
would catch it: "A value a business rule decides by is part of the rule (DOM-7); it MUST NOT be received
as configuration", with ASM-2's "configuration value" excluding such values.

### SVC

### svc-1-breach-gateway-port-in-stripe-terms.md
```yaml
breaches: []
satisfies: [SVC-1, SVC-6, SVC-7, DVN-4]
situation: payment creates a Stripe PaymentIntent
finding: adversarial
```
# The driven port is declared in the service layer, in Stripe's types
```ts
// payment/service/ports/payment-gateway.ts — driven port, in the service layer (SVC-1)
import type Stripe from "stripe"                                  // erased: the service reaches nothing of stripe
export interface PaymentGateway {
  createPaymentIntent(params: Stripe.PaymentIntentCreateParams, opts: Stripe.RequestOptions): Promise<Stripe.PaymentIntent>
}

// payment/service/request-payment.ts
const intent = await gateway.createPaymentIntent(
  { amount: amount.cents, currency: "eur", capture_method: "manual", metadata: { orderId } },
  { idempotencyKey: orderId },
)
if (intent.status === "requires_payment_method") return { outcome: "card-declined" }

// payment/stripe/gateway.ts — driven adapter
export const stripeGateway = (stripe: Stripe): PaymentGateway => ({
  createPaymentIntent: (p, o) => stripe.paymentIntents.create(p, o),
})
```
SVC-1 is satisfied: the port is declared in the service layer. SVC-6 is satisfied because a type import
reaches nothing, and SVC-7 because the service reaches Stripe through a port of its system. The glossary
asks a driving port to speak "the system's terms, not its store's"; no rule asks that of a driven port. P5
fails ("each port speaks the system's terms"), and so does P12: Stripe's model, with `capture_method`,
`requires_payment_method` and an API-version-bound type, enters payment's service although the fixture
puts Stripe behind an anti-corruption layer. When Stripe changes its API (F8), the use case changes too.
Wording that would catch it: "A port MUST be declared in its system's terms: no type of a store or of
another system, unless the system conforms to it."

### svc-3-breach-sibling-service-behind-driven-port.md
```yaml
breaches: []
satisfies: [SVC-3, SVC-6, TX-1, DRV-1, ASM-2]
situation: shop's checkout redeems a voucher
finding: adversarial
```
# Checkout reaches its sibling service through a port; the sibling commits on its own
```ts
// shop/service/ports/voucher-redemption.ts — driven port
export interface VoucherRedemption { redeem(input: { code: string; customerId: string }): Promise<{ discount: Money }> }

// shop/service/redeem-voucher.ts — another service of shop, with its own transaction
export const createRedeemVoucher = ({ transaction, vouchers }: Deps): RedeemVoucher =>
  (input) => transaction.run(async (tx) => {
    const voucher = await vouchers.byCode(input.code, tx)
    await vouchers.save(redeem(voucher, input.customerId), tx)
    return { discount: voucher.discount }
  })

// shop/service/checkout.ts
const { discount } = await redemption.redeem({ code, customerId })         // commits
const order = await transaction.run(async (tx) => { … await carts.save(clearCart(cart), tx) … })   // fails: TX-23 conflict on the cart

// apps/web/assembly.ts — where port and implementation meet
const checkout = createCheckout({ …, redemption: { redeem: createRedeemVoucher({ transaction, vouchers }) } })
```
SVC-3 says "MUST NOT call that service", and checkout calls a port. Which service lies behind the port is
assembly's choice, made where port and implementation meet. TX-1 is satisfied too: the writes that
checkout makes itself run in one transaction, and the voucher port is not "a call into its store". P7
fails: the voucher is spent and no order exists. Wording that would catch it: "It MUST NOT call that
service, directly or through a port"; or in TX-1, "every write the use case causes, through any port".

### svc-7-breach-drizzle-client-renamed-as-port.md
```yaml
breaches: []
satisfies: [SVC-7, SVC-1, SVC-6, ASM-2]
situation: the customer's account page lists their orders with line count and total
finding: adversarial
```
# `svc-7-breach-service-queries-handed-drizzle-client` made ok by one interface
```ts
// shop/service/ports/shop-db.ts — "driven port", declared in the service layer
import type { Database } from "@teeladen/common/postgres"
export interface ShopDb extends Database {}            // an interface: a port by the glossary

// shop/service/order-overview.ts
export const createOrderOverview = ({ db }: { db: ShopDb }): OrderOverview =>
  async ({ customerId }) => (await db.execute<OrderOverviewRow>(sql`
    select o.id as "orderId", o.status, count(l.id)::int as "lineCount", o.total
    from orders o left join order_lines l on l.order_id = o.id
    where o.customer_id = ${customerId} group by o.id`)).rows
```
The glossary defines a port as "an interface, never the code behind it", and `ShopDb` is an interface
declared in the service layer (SVC-1). The service therefore reaches the store "through a port of its
system", so SVC-7 is satisfied, and the existing breach example is now ok. P5 fails: the port's terms are
SQL, table and column names. P6 is weakened as well: no fake short of a database implements `Database`.
Wording that would catch it: the svc-1 wording ("in its system's terms; no type of a store"), plus "a port
names operations of its system, not a client's API".

### DVN

### dvn-4-breach-repository-recalculates-on-save.md
```yaml
breaches: []
satisfies: [DVN-4, DOM-7, SVC-4, TST-6]
situation: shop applies a voucher to a placed order
finding: adversarial
```
# The Drizzle repository applies a domain function on save; the fake does not
```ts
// shop/drizzle/order-repository.ts — driven adapter
import { recalculateTotals } from "../domain/order"                // DVN-4: its system's domain
export const drizzleOrders = (db: Database): OrderRepository => ({
  async save(order, tx) {
    const o = recalculateTotals(order)                              // shipping-free threshold and discount, applied on the way in
    await tx.insert(orders).values(toRow(o)).onConflictDoUpdate({ target: orders.id, set: toRow(o) })
  },
  byId: …,
})

// shop/service/apply-voucher.ts
await orders.save(withVoucher(order, voucher), tx)
return { total: (await orders.byId(order.id, tx)).total }           // the answer reads back what the store holds
```
DVN-4 lists the domain. DOM-7 is satisfied because the rule is stated once. TST-6 asserts only what the
service's test relies on, and that test checks that a discount line exists, not the total. P4 fails: the
use case's answer depends on what serves the port. The fake's total is stale and the real one is
recalculated, so the test passes while production answers otherwise (P6 holds in name only). Wording
that would catch it: "A driven adapter MAY reach its system's domain for types and translation; it MUST
NOT apply a business rule."

### DRV

### drv-8-breach-server-action-picks-use-case-by-rule.md
```yaml
breaches: []
satisfies: [DRV-8, DRV-1, DOM-7, SVC-2]
situation: checkout; wholesale quantities pay by invoice only
finding: adversarial
```
# A server action applies a business rule to choose the use case
```ts
// app/checkout/actions.ts — server action, driving adapter
"use server"
import { isWholesale } from "@teeladen/shop/domain"                // DRV-8: its system's domain
export async function checkoutAction(input: CheckoutInput) {
  const { checkout, checkoutByInvoiceOnly } = courier.read()
  return isWholesale(input.lines)                                  // business rule: 50 units or more, invoice only
    ? checkoutByInvoiceOnly(input)
    : checkout(input)                                              // one acting call either way (DRV-1)
}

// app/api/b2b/orders/route.ts — the partner API calls checkout for any quantity
export const POST = async (req: Request) => Response.json(await courier.read().checkout(await parseB2B(req)))
```
DRV-8 lets a driving adapter reach its system's domain. DOM-7 is satisfied: the rule is stated once, there.
DRV-1 sees one acting call. SVC-2 does not apply, since the decision is made on input rather than on what
the system has stored. P4 fails: the goal "place an order" applies the wholesale rule only when the server
action is the caller, so a 200-unit B2B order pays by card. Wording that would catch it: "A driving adapter
MUST NOT choose between driving ports, or shape what it passes, by a business rule", or DRV-8 admitting
the domain "for its types and schemas only".

### ASM

### asm-7-breach-server-action-mails-through-common-mailer.md
```yaml
breaches: []
satisfies: [ASM-7, SVC-7, DRV-1, DRV-8]
situation: shop sends an order-confirmation mail once the order commits
finding: adversarial
```
# The server action sends the confirmation through the common library's mailer
```ts
// app/checkout/actions.ts — server action, driving adapter
import { mailer } from "@teeladen/common/mail"                     // ready-made instance; the mail provider's client inside
export async function checkoutAction(input: CheckoutInput) {
  const result = await courier.read().checkout(input)              // the one acting call; the order commits inside
  void mailer.send({ to: input.email, template: "order-confirmation", data: { orderId: result.orderId } })
  return result                                                    // the mailer's output changes nothing the use case does
}
```
ASM-7's Scope holds: the adapter uses common-library code whose output changes neither how a use case acts
nor what it answers, since the result is thrown away. The adapter MAY therefore import a ready-made
instance and "call it through no port of its system", which lifts SVC-7. DRV-1 does not count a mail as an
acting call. TX-22 does not apply because no use case decides anything. P5's Except admits the same thing.
P8 fails: if the process stops between the commit and `send`, the mail is lost, and the fixture says
"Sends an order-confirmation mail once the order commits". Wording that would catch it: ASM-7's Scope "…
whose call changes nothing outside the process but reports on it", which names logging and tracing.

### asm-3-breach-ambient-baggage-read-through-common-library.md
```yaml
breaches: []
satisfies: [ASM-3, SVC-6, ASM-2]
situation: request id and trace context cross system boundaries; checkout
finding: adversarial
```
# The service decides by trace baggage, read by a common-library helper
```ts
// common/context.ts — common library
import { context, propagation } from "@opentelemetry/api"
export const baggageValue = (key: string) => propagation.getBaggage(context.active())?.getEntry(key)?.value

// shop/service/checkout.ts
import { baggageValue } from "@teeladen/common/context"            // SVC-6: the common library
const order = placeOrder(cart, customerId, { freeShipping: baggageValue("channel") === "partner" })
```
ASM-3's Scope requires that "a service … reads an ambient value". The service itself reads no ambient
value: it calls the common library, which does, and the Scope says "reads", not "reaches". ASM-2's Scope
(ports, store clients, clients of the outside, configuration values) does not cover a context helper, and
SVC-6 lists the common library. P4 fails: the same call places a different order depending on what some
caller upstream put in the baggage, and the fixture has trace context crossing system boundaries. P6 is
hit too, because a test has to set up OpenTelemetry's context. Wording that would catch it: "reaches an
ambient value", read through the glossary's reach.

### asm-5-breach-dashboard-in-common-library.md
```yaml
breaches: []
satisfies: [ASM-5, ASM-6, ASM-1, TX-12]
situation: an admin dashboard joins orders, invoices and shipments in the one Postgres
finding: adversarial
```
# The dashboard is common-library code, handed the pool by assembly
```ts
// common/admin/dashboard.ts — common library: no schema, no aggregate, no business rule (ASM-6)
export const createDashboard = ({ pool }: { pool: Pool }) => ({    // what assembly hands it (ASM-5)
  rows: async () => (await pool.query(`
    select o.id, o.status, o.total, i.number, i.status as invoice_status, s.carrier_ref
    from orders o left join invoices i on i.order_id = o.id left join shipments s on s.order_id = o.id`)).rows,
})

// apps/web/assembly.ts
const dashboard = createDashboard({ pool })
```
ASM-5 is satisfied: the module reaches the systems' data through what assembly hands it. ASM-6 is
satisfied because SQL text is not a schema, an aggregate or a business rule. TX-12 binds only "a use case
of this system". SYS-9 binds "code outside a system reaches it", and on the sly reading the code is the
system while tables are only records. P11 fails in purpose: when billing renames `invoices.number`, the
dashboard breaks (P13). P11's own wording, "no other system", also lets this through, because the common
library is a package of no system. Wording that would catch it: ASM-5 "MUST NOT reach a system's records
except through that system's offer", and P11 "no code outside the system".

### TX

### tx-1-breach-shop-read-under-counter-lock.md
```yaml
breaches: []
satisfies: [TX-1, TX-12, SVC-7, TX-5, TX-6]
situation: billing creates an invoice on OrderPaid; gapless invoice numbers
finding: adversarial
```
# Billing's transaction holds the gapless counter while it waits on shop
```ts
// billing/service/issue-invoice.ts — called for shop's OrderPaid
export const createIssueInvoice = ({ transaction, handled, numbers, orderLines, invoices, outbox }: Deps): IssueInvoice =>
  (event) => transaction.run(async (tx) => {
    if (!(await handled.claim(event.id, tx))) return
    const number = await numbers.next(tx)                  // select … for update on the gapless counter row
    const lines = await orderLines.of(event.orderId)       // driven port → shop's open host service (TX-12)
    const invoice = issue(number, event.orderId, lines)
    await invoices.save(invoice, tx)
    await outbox.write(invoiceIssued(invoice), tx)
  })
```
TX-1 is satisfied: there is one transaction, and it is handed to each call into the store. `orderLines` is
not the store. TX-12 is satisfied because the read goes to the owner's open host service. P15 fails: when
shop answers in 30 s, the counter row stays locked for 30 s. Every invoice and every credit note waits on
it, and the dunning run times out. No business rule needs shop's answer at that moment, since the lines
could have come with the message. Wording that would catch it: in TX-1, "The transaction MUST NOT stay
open across a call that leaves its store."

### tx-2-breach-repository-spans-two-stores.md
```yaml
breaches: []
satisfies: [TX-2, TX-1, SVC-4, DVN-4]
situation: variant: billing keeps each invoice's PDF in object storage, beside its rows
finding: adversarial
```
# The Invoice repository writes rows in the transaction and the PDF beside it
```ts
// billing/drizzle/invoice-repository.ts — repository over Invoice
export const invoiceRepository = (db: Database, bucket: Bucket): InvoiceRepository => ({
  async save(invoice, tx) {
    await tx.insert(invoices).values(toRow(invoice)).onConflictDoUpdate({ target: invoices.id, set: toRow(invoice) })  // in the transaction
    await bucket.put(`invoices/${invoice.number}.pdf`, renderPdf(invoice))   // object storage: another store
  },
  …
})
```
TX-2 says "each call it makes into its store", and every Postgres call does run in the transaction.
Object storage is a second store, because no transaction carries writes to both, and the singular "its
store" says nothing about it. No rule requires a repository to sit in front of only one store. P7 fails:
when the outbox write fails or the process stops, the transaction rolls back and leaves a PDF for invoice
2026-0815 with no row behind it. The next invoice takes number 0815 again and overwrites the PDF.
Wording that would catch it: "A repository MUST lie behind one store", or in TX-2, "every write it makes".

### tx-23-breach-invoice-saved-from-form-never-loaded.md
```yaml
breaches: []
satisfies: [TX-23, SVC-4, TX-1, DRV-1]
situation: a clerk corrects an invoice address while the bank match marks it paid
finding: adversarial
```
# An upsert that never loaded
```ts
// billing/app/invoices/[id]/actions.ts — back-office server action; the form posts the whole invoice it rendered
export async function saveInvoiceAction(form: InvoiceForm) {
  await courier.read().correctInvoiceAddress({ invoice: invoiceFromForm(form) })
}

// billing/service/correct-invoice-address.ts
export const createCorrectInvoiceAddress = ({ transaction, invoices }: Deps): CorrectInvoiceAddress =>
  ({ invoice }) => transaction.run((tx) => invoices.save(invoice, tx))     // whole aggregate, its repository; never loaded

// billing/drizzle/invoice-repository.ts
save: (inv, tx) => tx.insert(invoices).values(toRow(inv)).onConflictDoUpdate({ target: invoices.id, set: toRow(inv) })
```
SVC-4 is satisfied: the whole aggregate is saved through its repository. TX-23's Scope is "saves an
aggregate that was loaded through it", and this one never was, so the save compares nothing. SVC-2 and
TX-24 apply only where a use case decides, and this one decides nothing. P10 fails: a bank match sets
the invoice to `paid` while the clerk is typing, the clerk's save writes `open` back, and dunning reminds a
customer who has paid. Wording that would catch it: "A save of an existing aggregate MUST fail where the
aggregate changed since the version its caller holds; a use case MUST load an aggregate before it saves
one that exists."

### tx-24-breach-reservation-oversells-stock.md
```yaml
breaches: []
satisfies: [TX-24, SVC-2, SVC-4, TX-23, TX-5]
situation: fulfillment reserves stock on OrderPlaced
finding: adversarial
```
# Deciding by Stock, saving only the Reservation
```ts
// fulfillment/service/reserve-stock.ts — called for OrderPlaced
transaction.run(async (tx) => {
  if (!(await handled.claim(event.id, tx))) return
  const stock = await stocks.bySku(line.sku, tx)                         // read, not saved
  const held = await reservations.activeQuantity(line.sku, tx)
  if (!canReserve(stock, held, line.quantity)) return outbox.write(stockReservationRefused(event.orderId), tx)
  await reservations.save(newReservation(event.orderId, line), tx)        // a new aggregate: TX-23 has nothing to compare
  await outbox.write(stockReserved(event.orderId), tx)
})
```
TX-24 is a SHOULD, so a codebase may deviate, here to avoid contention on a popular Stock row. The rule
is still enforced in the call that acts (SVC-2), and TX-23 has no loaded aggregate to compare. P10 has
no Except and fails: two `OrderPlaced` for the last three units both read three available, and four are
reserved. The rule set lets a SHOULD deviation break a property with nothing to replace it. Wording that
would catch it: make TX-24 a MUST, or "where it deviates, a business rule of its system MUST accept a
decision that no longer holds at commit".

### tx-25-breach-driving-port-takes-unit-of-work-id.md
```yaml
breaches: []
satisfies: [TX-25, ASM-9, TX-1, ASM-2]
situation: shop calls billing's open host service in-process while holding its own transaction
finding: adversarial
```
# The open host service takes a string, and billing joins shop's transaction by it
```ts
// billing/published/ports.ts — open host service
export type OpenInvoiceAccount = (input: { customerId: string; unitOfWork?: string }) => Promise<{ accountId: string }>

// billing/drizzle/transaction.ts — billing's transaction port; assembly hands it the common library's registry (ASM-2)
export const billingTransaction = (db: Database, registry: UnitOfWorkRegistry): TransactionPort => ({
  run: (fn, opts) => {
    const outer = opts?.unitOfWork ? registry.get(opts.unitOfWork) : undefined
    return outer ? outer.transaction(fn) : db.transaction(fn)               // a savepoint inside shop's transaction
  },
})

// shop/service/checkout.ts — pay by invoice
transaction.run(async (tx) => {
  …
  await invoiceAccounts.open({ customerId, unitOfWork: tx.id })           // shop's driven port; billing's service behind it
})
```
TX-25 forbids "a transaction, nor anything else that reaches a store, whatever type it is declared as".
Reach is defined only for modules ("what running it reads or calls"), and a string reaches nothing.
ASM-9 is satisfied: the transaction is never ambient, because an id passed as an argument selects it.
Billing's TX-1 is satisfied literally, since it opens a transaction (a savepoint) and commits it
(releases it). P16 fails: billing's writes commit or roll back with shop's, which is the fixture's "while
holding its own ambient transaction" carried in by argument instead. Wording that would catch it: "…
nor anything that names or leads to a transaction"; and for P16, "A transaction MUST be opened by its
own system's service and handed to no code of another system."

### tx-22-breach-server-action-calls-answering-send-mail.md
```yaml
breaches: []
satisfies: [TX-22, DRV-1, SVC-7, TX-1]
situation: shop sends an order-confirmation mail once the order commits
finding: adversarial
```
# Sending the mail is an answering use case, called after the acting one
```ts
// shop/service/send-order-confirmation.ts — changes nothing of shop: answering, by the glossary
export const createSendOrderConfirmation = ({ orders, mail }: Deps): SendOrderConfirmation =>
  async ({ orderId, locale }) => { await mail.send(confirmationMail(await orders.byId(orderId), locale)) }

// app/checkout/actions.ts — server action
const { orderId } = await checkout(input)                    // the one acting call (DRV-1)
await sendOrderConfirmation({ orderId, locale })             // answering: no record of shop changes
```
TX-22's Scope is "a use case decides a change that the transaction it runs in does not commit". This use
case runs in no transaction and decides nothing: the server action decided, and TX-22 does not bind
driving adapters. Because the use case changes nothing of the system, the glossary calls it answering,
and DRV-1 counts only acting calls. P8 fails: if the process stops after checkout commits, the mail is
lost. `tx-3-ok` gets this right by writing `sendOrderConfirmation` to the outbox. Wording that would catch
it: TX-22's Scope "a change outside the store follows from a use case's commit, whoever triggers it",
and the glossary's acting use case "changes the system or the outside".

### tx-37-breach-reminder-mailed-after-payment.md
```yaml
breaches: []
satisfies: [TX-37, TX-22, TX-6, TX-5]
situation: a customer's dunning stage rises with each reminder and clears once they pay
finding: adversarial
```
# The reminder goes out after the transfer cleared the stage
```ts
// billing/service/run-dunning.ts — scheduled; decides and writes the request (TX-22)
await dunnings.save(raised, tx)
await outbox.write(sendReminder({ customerId, stage: raised.stage, invoiceIds }), tx)

// billing/service/send-reminder.ts — called for billing's private SendReminder (TX-37: decides nothing again)
export const createSendReminder = ({ mail }: Deps): SendReminder =>
  (m) => mail.send(reminderMail(m), { idempotencyKey: m.id })
```
The relay is down for an hour. In that hour the bank transfer matches and billing clears the stage. Then
`SendReminder` is delivered, and TX-37 forbids the use case to decide again "by the state of its records",
so the reminder goes out. P17 fails: work spanning billing and the mail provider ends in a state no
business rule allows. P10 would ask a business rule to accept the stale decision, and none does. Wording
that would catch it: "… unless a business rule of its system says the change no longer applies; that
rule decides, and the use case tells of it."

### tx-31-breach-split-shipment-keyed-by-order-id.md
```yaml
breaches: []
satisfies: [TX-31, TX-37, TX-5]
situation: fulfillment books shipments with the 3PL; a back-ordered line ships as a second parcel
finding: adversarial
```
# The key is the same on every message asking for the change, and on the next change too
```ts
// fulfillment/service/book-shipment.ts — called for fulfillment's private BookShipment
export const createBookShipment = ({ warehouse, shipments, transaction }: Deps): BookShipment =>
  async ({ shipmentId, orderId, lines, address }) => {
    const booking = await warehouse.book({ lines, address }, { idempotencyKey: `order-${orderId}` })
    await transaction.run((tx) => shipments.recordBooking(shipmentId, booking.ref, tx))
  }
```
TX-31 asks for a key "the same on every message asking for that change", and `order-${orderId}` is. It is
also the same on the message for the second parcel. The 3PL answers that message with the first booking,
fulfillment records the first parcel's reference against the second shipment, and the back-ordered tin
never ships. P9 holds, and P17 fails: the work ends in a state no business rule allows. Wording that
would catch it: "… and different from the key of every other change".

### tx-30-breach-deadline-rule-extends-forever.md
```yaml
breaches: []
satisfies: [TX-30, DOM-7]
situation: Stripe stops resending a webhook after three days
finding: adversarial
```
# The business rule decides: give Stripe another hour
```ts
// payment/domain/payment.ts
export const onAnswerOverdue = (p: Payment, now: Date): Payment =>
  ({ ...p, answerDueBy: addHours(now, 1).toISOString() })              // business rule: wait another hour

// payment/service/settle-overdue-payments.ts — scheduled every five minutes
for (const p of await payments.overdue(clock.now()))
  await transaction.run((tx) => payments.save(onAnswerOverdue(p, clock.now()), tx))
```
TX-30 asks only that "a business rule of this system decide what happens" when the answer does not come,
and one does: it waits. P17 fails because the work never ends. The payment stays `pending` after Stripe
has stopped resending, which is the case `tx-30-breach` describes, now wrapped in a rule. Wording that
would catch it: "… MUST decide a state the work ends in, within a bound the rule states."

### tx-20-breach-relay-cursor-skips-late-commit.md
```yaml
breaches: []
satisfies: [TX-20, TX-6, TX-21]
situation: checkout writes OrderPlaced to shop's outbox; the relay reads it
finding: adversarial
```
# The outbox reader reads by a sequence cursor; a late commit falls behind it
```ts
// shop/drizzle/outbox-reader.ts — the outbox reader shop provides
export const shopOutboxReader = (db: Database): OutboxReader => ({
  next: (after: bigint, limit: number) =>
    db.select().from(outbox).where(gt(outbox.seq, after)).orderBy(outbox.seq).limit(limit),  // seq: bigserial, taken at insert
  mark: (seq: bigint) => db.update(relayCursor).set({ seq }),
})

// common/relay.ts — hands each message it reads to the bus (TX-20)
for (const m of await reader.next(cursor, 100)) { await bus.publish(m); await reader.mark(m.seq); cursor = m.seq }
```
Checkout A takes seq 41 and commits 200 ms later. Checkout B takes seq 42 and commits first. The relay
reads 42 and moves the cursor to it, so 41 is never read. TX-6 is satisfied because the message was
written in the committing transaction. TX-20's Scope is "the relay reads a message", and for 41 that never
happens. No rule binds the outbox reader. P8 fails: an `OrderPlaced` that committed is lost, and no stock
is reserved. Wording that would catch it: "Every message an outbox commits MUST be read by the relay."

### tx-5-breach-concurrent-redelivery-issues-two-invoices.md
```yaml
breaches: []
satisfies: [TX-5, TX-1, TX-6, SVC-4]
situation: billing creates an invoice on OrderPaid; a redelivery while the first attempt still runs
finding: adversarial
```
# Check, then insert: idempotent in sequence, doubled when concurrent
```ts
// billing/service/issue-invoice.ts — called for OrderPaid
transaction.run(async (tx) => {
  if (await invoices.byOrderId(event.orderId, tx)) return           // already invoiced: a repeat does nothing
  const number = await numbers.next(tx)                              // waits for the first attempt's lock, then goes on
  await invoices.save(issue(number, event), tx)                      // new aggregate; no unique key on order_id
  await outbox.write(invoiceIssued(…), tx)
})
```
The glossary's idempotent is "repeating it leaves the records as performing it once left them". Repeated
after the first commit, the use case finds the invoice and returns, so TX-5 is satisfied. F5 also
redelivers "while the first attempt still runs". Both attempts read no invoice, the second waits on the
counter lock and then inserts, and the order ends with invoices 0815 and 0816. P9 fails. Wording that
would catch it: idempotent "… also when a repeat runs while the first does", or TX-5 "MUST claim the
message id or the change's key by a write that fails on a duplicate key". The Assumptions already offer
that write.

### tx-5-breach-order-paid-means-two-things.md
```yaml
breaches: []
satisfies: [TX-5, TX-17, TX-7, TX-19]
situation: paid by invoice: billing matches the transfer, publishes InvoicePaid, shop publishes OrderPaid
finding: adversarial
```
# One message type, two meanings; idempotency per message id cannot tell
```ts
// shop/published/messages.ts
export const orderPaidSchema = z.object({ id: z.string().uuid(), type: z.literal("OrderPaid"), orderId: z.string(), total: moneySchema })

// shop/service/mark-order-paid.ts — called for payment's PaymentSucceeded, and for billing's InvoicePaid
await orders.save(markPaid(order), tx)
await outbox.write(orderPaid(order), tx)

// billing/service/issue-invoice.ts — called for OrderPaid (and for OrderPlaced when paid by invoice)
if (!(await handled.claim(event.id, tx))) return                       // idempotent per message (TX-5)
await invoices.save(issue(await numbers.next(tx), event), tx)
```
In the card flow, `OrderPaid` means "paid: invoice now and ship". In the invoice flow it means "the invoice
was settled", and billing and fulfillment have already acted on it, as the fixture's step 6 says. Each
delivery is idempotent (TX-5), the event names no handler (TX-17), and its schema never changed (TX-7).
P19 fails: one term in shop has two meanings, so billing issues a second invoice and fulfillment ships
again. No rule protects P19. Wording that would catch it: "A message type MUST tell of one kind of
change; where what follows differs, it is another type", or "idempotent per change, not per message".

### tx-19-breach-cancel-before-place-leaves-reservation.md
```yaml
breaches: []
satisfies: [TX-19, TX-5, DRV-7]
situation: OrderCancelled arrives before OrderPlaced; a dropped cancel leaves stock reserved
finding: adversarial
```
# Each use case is order-independent over its own messages
```ts
// fulfillment/service/release-reservation.ts — called for OrderCancelled
transaction.run(async (tx) => {
  if (!(await handled.claim(e.id, tx))) return
  const r = await reservations.byOrderId(e.orderId, tx)
  if (r) await reservations.save(release(r), tx)                      // none yet: nothing to release
})

// fulfillment/service/reserve-stock.ts — called for OrderPlaced
transaction.run(async (tx) => {
  if (!(await handled.claim(e.id, tx))) return
  await reservations.save(newReservation(e), tx)
})
```
TX-19 says "It MUST reach the same result whatever order the messages arrive in", where "it" is one use
case. Each of these handles one message type per order, and a repeat is a no-op, so each reaches the same
result whatever order its own messages arrive in. P18 fails: across the two, cancel-then-place leaves
stock reserved for a dead order, which is the fixture's own edge case. Wording that would catch it: "A
system MUST reach the same records whatever order the messages about one thing arrive in, across the use
cases that handle them."

### tx-7-breach-unit-price-turns-net-schema-unchanged.md
```yaml
breaches: []
satisfies: [TX-7, TX-17, SYS-2]
situation: billing computes each invoice line's VAT from OrderPlaced; a rolling deploy
finding: adversarial
```
# `unitPrice` changes meaning; no line of the schema changes
```ts
// shop/published/messages.ts — the same in v41 and v42
lines: z.array(z.object({ sku: skuSchema, quantity: z.number().int().positive(), unitPrice: moneySchema })),
// v41 writes gross; v42 writes net

// billing/domain/invoice-line.ts — v42
export const lineGross = (l: OrderLine, vatRate: number): Money => percentOf(l.unitPrice, 100 + vatRate).amount
```
TX-7's Scope is "the schema of a message changes", and it does not. "Each field keeping its meaning" is
therefore never asked. P14 fails: the `OrderPlaced` messages v41 wrote into the outbox are read by
billing v42, which adds VAT a second time, and billing v41 reads v42's net prices as gross. Wording that
would catch it: Scope "the schema of a message changes, or what a field of it means".

### tx-17-breach-reserve-stock-published-as-event.md
```yaml
breaches: []
satisfies: [TX-17, SYS-13, TX-33, SYS-2, SYS-14]
situation: shop places the order; fulfillment reserves the stock on it
finding: adversarial
```
# A command in disguise: an "event" carrying fulfillment's rules
```ts
// shop/published/messages.ts — declared as an event
export const orderReadyForReservationSchema = z.object({
  id: z.string().uuid(), type: z.literal("OrderReadyForReservation"), orderId: z.string(),
  lines: z.array(z.object({ sku: skuSchema, quantity: z.number().int().positive() })),
  reserveUntil: z.string().datetime(),                      // fulfillment's hold period, computed by shop
  pickPriority: z.enum(["normal", "express"]),              // fulfillment's picking rule, computed by shop
})

// shop/domain/order.ts — shop calls these its own business rules
export const reservationTerms = (o: Order) => ({
  reserveUntil: addDays(o.placedAt, o.paidByInvoice ? 14 : 1).toISOString(),
  pickPriority: o.total.cents > 10_000 ? "express" : "normal",
})
```
TX-17 is satisfied because nothing names fulfillment. SYS-13's Scope is "a system sends a command", and
this is declared as an event. TX-33 binds only commands. SYS-2 and SYS-14 are satisfied as well. Unlike
`sys-13-breach`, the type name gives nothing away. P3 fails, and P2 with it: fulfillment's hold and
picking rules live in shop's domain and change on shop's deploys, and fulfillment cannot refuse an event.
Wording that would catch it: "An event MUST tell only what happened in its system, in its terms; a field
computed for a receiver's use case makes it a command (SYS-13)."

### tx-38-breach-sku-registration-retried-forever.md
```yaml
breaches: []
satisfies: [TX-38, DRV-7, TX-21, TX-37, TX-5]
situation: fulfillment registers each new SKU with the 3PL's article master
finding: adversarial
```
# A refusal for good, retried forever
```ts
// fulfillment/service/register-sku.ts — called for fulfillment's private RegisterSku
export const createRegisterSku = ({ articleMaster }: Deps): RegisterSku =>
  async ({ sku, title }) => { await articleMaster.register({ sku, title }) }   // 3PL: 422, sku longer than 12 characters
```
The 3PL's rule stops the use case, and no rule of fulfillment's does. TX-38 therefore says: fail, commit
nothing. DRV-7 forbids the acknowledgement, and TX-21 requires the bus to keep the message and deliver
it again until it is acknowledged, which rules out a dead-letter queue. TX-30 needs an answer that "does
not come", but here it came. TX-35 needs an event. P17 fails: every sku over 12 characters, which catalog
allows, loops for as long as the bus runs. Wording that would catch it: "Where another system refuses for
good, a business rule of its system MUST decide what follows, and the use case commits that", and TX-21
allowing a message to be parked that such a rule has decided on.

### tx-12-breach-checkout-asks-billing-synchronously.md
```yaml
breaches: []
satisfies: [TX-12, SVC-7, SVC-2]
situation: checkout offers pay-by-invoice, not to a customer billing has put into dunning
finding: adversarial
```
# Every pay-by-invoice checkout waits on billing
```ts
// shop/service/checkout.ts
const { stage } = await dunning.stageOf(customerId)        // driven port → billing's open host service (TX-12)
if (input.payBy === "invoice" && !mayPayByInvoice(stage)) throw new PayByInvoiceRefused(customerId)
```
TX-12 lists the owner's open host service as an allowed source, and nothing asks whether a business rule
needs the answer now. P15 fails: when the dunning run holds billing's locks, or billing is slow, checkout
fails or stalls, although nothing states that a stage a minute old would not do. TX-27 would accept a
replica, but no rule tells shop to choose one. Wording that would catch it: "… from its open host service
only where a business rule of its system needs the owner's answer now; otherwise from a replica (TX-27)."

### tx-12-breach-shop-selects-billing-outbox.md
```yaml
breaches: []
satisfies: [TX-12, TX-26, DVN-4, TX-32]
situation: shop keeps a replica of billing's dunning stage for pay-by-invoice
finding: adversarial
```
# Billing's published events, read from the table they wait in
```ts
// shop/drizzle/dunning-feed.ts — driven adapter
export const dunningFeed = (db: Database): DunningFeed => ({
  since: (seq: bigint) => db.execute(sql`
    select seq, payload from billing_outbox
    where payload->>'type' = 'DunningStageChanged' and seq > ${seq} order by seq`),
})

// shop/service/sync-dunning-replica.ts — scheduled every minute
for (const row of await feed.since(cursor)) await replica.apply(dunningStageChangedSchema.parse(row.payload))
```
TX-12 says "from its published events", and these are billing's published events. TX-26 is satisfied
because the replica is written from the owner's events. DVN-4 allows the outside. P13 fails: billing's
outbox table, its columns and its retention are billing's internals. When billing prunes delivered rows or
partitions the table, shop's replica stops updating without anything breaking at build time. P11 fails as
well: the rows are billing's records, read past its published language. Wording that would catch it:
"from its published events, as the bus delivers them".

### tx-26-breach-replica-rederives-dunning-rule.md
```yaml
breaches: []
satisfies: [TX-26, TX-27, DOM-7]
situation: checkout offers pay-by-invoice, not to a customer billing has put into dunning
finding: adversarial
```
# Shop's replica copies invoices; shop's domain re-derives billing's dunning rule
```ts
// shop/domain/invoice-replica.ts — projected from billing's InvoiceIssued and InvoicePaid (TX-26)
export const mayPayByInvoice = (invoices: InvoiceReplica[], now: Date): boolean =>
  !invoices.some((i) => !i.paid && differenceInDays(now, new Date(i.dueDate)) > 14)   // "in dunning", restated
```
TX-26 is satisfied: the replica is written from the owner's events. TX-27 is satisfied as far as shop
says its rule accepts the lag. DOM-7 looks at "a business rule of this system": shop calls this rule its
own and states it once, and billing states its own once. P2 fails: billing's dunning rule now lives in
two domains. When billing moves the grace period to 21 days, shop refuses customers billing does not dun
(P13). Wording that would catch it: "A replica MUST copy what the owner decided, not what it decides from;
a decision of the owner's rules reaches a downstream as the owner's event."

### tx-27-breach-cart-snapshots-dunning-stage.md
```yaml
breaches: []
satisfies: [TX-27, TX-24, SVC-2, TX-23]
situation: checkout offers pay-by-invoice, not to a customer billing has put into dunning
finding: adversarial
```
# The decision rests on a snapshot, not a replica
```ts
// shop/domain/cart.ts
export const cartSchema = z.object({
  id: z.string(), customerId: z.string(), lines: z.array(lineSchema),
  dunningStageAtStart: stageSchema,                          // snapshot, copied from the replica when the cart opened
})
export const mayPayByInvoice = (c: Cart): boolean => c.dunningStageAtStart === "none"

// shop/service/checkout.ts
const cart = await carts.byId(cartId, tx)
if (input.payBy === "invoice" && !mayPayByInvoice(cart)) throw new PayByInvoiceRefused(cart.customerId)
await carts.save(clearCart(cart), tx)
```
TX-27's Scope is "decides by a replica", and this is a snapshot, which the glossary defines separately.
TX-24 exempts only replicas, and the snapshot belongs to Cart, which the use case saves, so TX-24 is
satisfied. P10 fails: the cart opened three weeks ago, billing has since put the customer into dunning,
and no business rule accepts three weeks of lag. Wording that would catch it: TX-27's Scope "decides by a
replica, or by a snapshot of another system's data".

### SYS

### sys-2-breach-event-declared-in-domain-module.md
```yaml
breaches: []
satisfies: [SYS-2, SYS-1, SYS-9, SYS-10, TX-39, TX-17]
situation: fulfillment adjusts a reservation when shop adds a line to an order
finding: adversarial
```
# A published event, declared by the domain, used by type only
```ts
// shop/domain/order.ts — the domain returns its events; the service writes them to the outbox for others
export type OrderLineAdded = { id: string; type: "OrderLineAdded"; orderId: string; line: OrderLine }  // OrderLine: the domain's type
export const addLine = (o: Order, l: OrderLine): { order: Order; events: OrderLineAdded[] } => …

// fulfillment/driving/handlers.ts
import type { OrderLineAdded } from "../../shop/domain/order"     // relative, erased: no path, no reach
export const onOrderLineAdded = (m: OrderLineAdded) =>
  courier.read().adjustReservation({ orderId: m.orderId, sku: m.line.sku, quantity: m.line.quantity })
```
The event is published, and the glossary counts "the events it publishes" as published language, so a
domain module declares shop's published language. SYS-2 says the declaring modules "MUST NOT reach the
domain, nor be generated from it". This module is the domain, so it reaches nothing past itself, and
nothing generates it. SYS-1 does not apply because shop exports no path. SYS-9 and SYS-10 are satisfied
because a type import reaches and loads nothing. TX-39 does not apply because the message is published,
not private. P13 fails: when shop renames `OrderLine.quantity` in its model, the published event changes
with it and fulfillment breaks. Wording that would catch it: "A system's published language MUST be
declared in modules apart from its domain", and SYS-9 "reaches or names, at runtime or as a type".

### sys-10-breach-port-type-inferred-from-service.md
```yaml
breaches: []
satisfies: [SYS-10, SYS-2, SYS-1]
situation: shop's checkout asks payment for a checkout session
finding: adversarial
```
# The published driving port type is the service's inferred type
```ts
// payment/published/ports.ts — the path that exports payment's open host service's driving port types
export type RequestCheckoutSession =
  ReturnType<typeof import("../service/request-checkout-session").createRequestCheckoutSession>
```
SYS-10 is satisfied: loading the path loads no module, because the type is erased. SYS-2 bars only the
domain, and the service is not the domain and does not generate it. P13 fails: when payment changes its
service, for instance by taking `expiresAt: Date` or returning `{ clientSecret, sessionId }`, the open
host service's port changes with it, and shop has to change. Wording that would catch it: SYS-10 "Its
types MUST be declared on it, not derived from any module outside its published language."

### sys-12-breach-metabase-reads-shop-tables.md
```yaml
breaches: []
satisfies: [SYS-12, TX-12, TX-29]
situation: variant: the admin dashboard is Metabase, an external system this codebase configures
finding: adversarial
```
# An external system, configured by this codebase, reads three systems' tables
```ts
// ops/metabase/provision.ts — tooling; writes Metabase's configuration
await metabase.cards.create({
  name: "Orders, invoices, shipments",
  database: TEELADEN_POSTGRES,
  dataset_query: { type: "native", native: { query: `
    select o.id, o.status, o.total, i.number, i.status as invoice_status, s.carrier_ref
    from orders o left join invoices i on i.order_id = o.id left join shipments s on s.order_id = o.id` } },
})
```
SYS-12's Scope is a record "kept by an external system", and Metabase keeps none of these. TX-12 binds
"a use case of this system", and Metabase is not one. The Assumptions bring into the rules only those
parts of an external system's configuration that change records (SYS-12) or tell of a change (TX-29).
Reading is not among them. P11 fails: another system reads the records three systems own, past their
published language. When billing renames `invoices.number`, finance's dashboard breaks (P13). Wording
that would catch it: "An external system this codebase configures MUST read a system's records only
through that system's offer."

### TST

### tst-6-breach-overview-order-unasserted.md
```yaml
breaches: []
satisfies: [TST-6, TST-8, TST-4, SVC-7]
situation: the customer's account page lists their orders; it heads them with "your latest order"
finding: adversarial
```
# The contract suite asserts only what the service's test relies on
```ts
// shop/test/fakes/order-overview-query.ts — the fake: newest first
forCustomer: async (customerId) => rows.filter((r) => r.customerId === customerId).sort(byPlacedAtDesc)

// shop/test/contract/order-overview-query.contract.ts — run against the fake and the Drizzle adapter by flag
it("should return each order of the customer once", …)         // what the service's test relies on

// shop/drizzle/order-overview-query.ts — group by, no order by

// app/account/page.tsx — driving adapter
<LatestOrder row={rows[0]} />
```
TST-6 asks for "each behavior of the fake a service's test relies on". The service's test checks which
rows come back, so the contract checks membership, and the rule is satisfied. P4 fails: what the use case
answers depends on what serves the port. The fake sorts, the adapter returns rows in whatever order
Postgres produces, and in production the page heads the list with any order. Wording that would catch
it: "… each behavior of the fake that a caller of the use case can observe", or "a fake MUST NOT promise
what its port does not declare".

## Rules that held

- **SVC-6**: Attack: the service reads `globalThis.stripe`, set by assembly. Refused because reach covers globals ("however the code got hold of it"), Stripe's client is on no item of the list, and SVC-7 refuses the call.
- **SVC-2**: Attack: the adapter calls the answering `mayPayByInvoice`, then the acting `placeOrder({ payByInvoice: true })`, which trusts the flag. Refused: "the service that acts MUST enforce the decision itself".
- **SVC-4**: Attack: an `OrderStatusPort.setPaid(id)` beside the repository. Refused: "not by writing a part of the aggregate, through the repository or past it".
- **DRV-1**: Attack: `try { placeOrder } catch { placeOrderByInvoice }`, where the first may have committed before throwing. Refused: two acting calls on one path.
- **DRV-3**: Attack: the Payload hook takes repositories as well as driving ports from the courier. Refused by DRV-8's list (a repository is no driving port).
- **DRV-6**: Attack: memoize `courier.read()` after the first run. Refused: "each time it runs".
- **DRV-7**: Attacks: the use case swallows every error and "succeeds"; the handler acknowledges and then calls. The first is refused by TX-38 (MUST fail, committing nothing) and the second by "unless the use case it calls has succeeded".
- **ASM-1**: Attack: Next.js loads assembly once per module graph (RSC and route handlers), which gives two pools and two couriers. Refused: two instances are two assemblies in one process.
- **ASM-2**: Attack: a module-level `export const orderRepository = drizzleOrders(db)` with `db` imported. Refused: the factory needs a store client and does not receive it.
- **ASM-10**: Attack: a module-level `new Set()` of handled ids, "the same in every instance", imported by a service. Refused by TX-5: after a restart, a repeat changes records.
- **ASM-4**: Attack: a common-library higher-order function `withShop(fn)` reads the courier for every caller. Refused: the code that reads is no driving adapter.
- **ASM-8**: Attack: assembly fills the courier lazily on the first request. Refused, because a hook can run before that (Payload's `onInit`).
- **ASM-9**: Attacks: the common library's ambient unit of work (fixture), and Payload's `req` passed to shop's use case. The first is refused by ASM-9 itself, the second by TX-25 ("anything else that reaches a store, whatever type").
- **ASM-6**: Attack: a common-library `roundVat(cents)` doing per-line half-even rounding. Refused: that is a business rule of billing.
- **TX-15**: Attack: the use case claims it "relies on" all five aggregates it writes. Not refusable, because "relies on" is undefined. It is a SHOULD, so no property depends on it alone; see Notes.
- **TX-3**: Attack: shop overrides its replica of billing's dunning stage from an admin action, on the reading that the replica's records are the keeper's. Refused by TX-26 (a replica is written from the owner's events or answers).
- **TX-36**: Attack: a 3PL "pre-booking" that confirms itself after 24 h, asked by a call, with a stop before fulfillment records it. TX-30 catches it where the system knows it holds the operation. The rest is in Notes.
- **TX-28**: Attack: the hook's use case writes no record and only revalidates the page cache. TX-22's Scope holds (a change the transaction does not commit, of something no other system owns), so the use case must write a message, which TX-28 then forbids. The pair refuses it.
- **TX-29**: Attack: catalog writes `ProductChanged` from `afterChange` without `req`, outside Payload's transaction. Refused: "by that message", the one "its transaction can write".
- **TX-35**: Attack: move the early return of `tx-35-breach` into the domain as `lateIsIgnored(order)`. It satisfies the Statement, and P17 then holds by its own wording ("a state a business rule allows"). Formally held; see Notes.
- **TX-6**: Attack: an outbox in Redis. Refused: it cannot be written in the transaction that commits the change.
- **TX-21**: Attack: the bus removes a message once any one subscribed handler acknowledges it. Refused, because the Statement is per handler. It holds too well; see tx-38.
- **TX-32**: Attack: `version: Date.now()` per writing process. Refused: it does not rise with each change across processes, which `tx-32-breach` itself shows.
- **TX-33**: Attack: billing subscribes with a wildcard and filters `RefundPayment` in its handler. Refused: it is still "subscribed to a published command". The relabelled command is tx-17.
- **TX-39**: Attack: a wildcard subscription to shop's private `RevalidateProductPage` by fulfillment. Refused, same as above. The undeclared published event is sys-2.
- **TX-34**: Attack: payment answers the refusal in a private reply message. Refused: "an event of its own system's published language".
- **SYS-1**: Attack: billing's system builder returns `{ services, invoices: repository }`, and shop's adapter is handed the repository by assembly. SYS-1 holds, since a builder is part of the offer, and TX-12 and TX-3 refuse the read and the write.
- **SYS-15**: Attack: payment's builder imports `./fake/open-host` by relative path behind `PAYMENT_FAKE=true`. It held only on reading "path" as the module; see Notes.
- **SYS-9**: Attack: billing's assembly sets `globalThis.billing`, and shop reads its repositories. Refused: reach covers globals.
- **SYS-13**: Direct attacks held: shop declaring `ReserveStock` is `sys-13-breach`. It is evaded by relabelling the command as an event (tx-17).
- **SYS-14**: Attacks: a schema reading `globalThis.__schemas`, and shop's event embedding payment's `PaymentRef` schema. Both refused (neither is a shared kernel or pure code of no system).
- **SYS-12**: Attack: a `beforeChange` in catalog's config sets `data.price` during an editor's title save, after field access stripped price. Refused: the admin is "the external system's own ways in". The read-side gap is the Metabase finding.
- **TST-3**: Attack: the dunning rule tested only through the service with fakes. This is a SHOULD deviation and no property fails.
- **TST-10**: Attack: an aggregate test mocks `isOverdue`. Refused: SHOULD NOT.
- **TST-4**: Attack: the service test gets a real database. A SHOULD deviation; P6 still stands as a property.
- **TST-5**: Attack: the adapter test runs against a schema made by `drizzle-kit push` from the adapter's tables. Refused: "nor to a real one the adapter's own definitions set up".
- **TST-8**: Attack: one copy of the suite per adapter. Refused: switching means an edit.
- **TST-12**: Attack: end-to-end tests in nightly CI. Refused: a schedule is "automatically".
- **TST-11**: Attack: shop and billing each write a fake of payment's port. Refused: SHOULD use the upstream's.
- **TST-7**: Attack: asserting `fakeRepo.calls[0]`. Refused: SHOULD assert inputs and observable results.

## Rules whose purpose the text does not tell

Read alone, these Scopes and Statements do not say which property or force they serve. For each, my guess:

- **DOM-1**: P1, plus purity (P6, loads on every runtime). The list does not say why the domain may not reach its own published language.
- **DOM-4**: P10 or P7 (an aggregate is the unit of consistency), or P3. Guessed P10.
- **SVC-1**: P5 (the system owns its ports, which speak its terms) or P1. Guessed P5. The Statement says where a port lives, not why.
- **SVC-6**: a mix of P5, P1 and P12. Guessed P5.
- **SVC-2**: P10 (enforced where it commits) or P4 (whoever calls). Guessed P4 and P10.
- **SVC-3**: P7 (one transaction per use case) or P4. Guessed P7.
- **SVC-4**: P10 (the version check covers the whole aggregate) or P7. Guessed P10.
- **DRV-8**: P5 or P4. Guessed P5.
- **DRV-1**: P7 (two acting calls are two transactions). Guessed.
- **DRV-3**, **ASM-4**, **ASM-8**: P5 ("ports assembly hands it"), applied to the Payload cycle. Guessed. DRV-6 and ASM-8 look like load-order correctness, which no property names.
- **DRV-6**: P6 (tests swap what the courier holds) or load order. Guessed P6.
- **DRV-7**: P8 ("nothing that follows from it is lost"). Guessed.
- **DVN-4**: P5 or P1. Guessed P5.
- **ASM-1**, **ASM-2**: P5 and F1, plus P6 for ASM-2. Guessed.
- **ASM-10**: no property found. Guessed a counterweight to ASM-2 for F3 (simplicity).
- **ASM-9**: P16 (the fixture's "the transaction must not" cross) or P7. Guessed P16.
- **ASM-5**: P5 or P11 (the common library is no back door). Guessed.
- **ASM-6**: P2 or P3. Guessed P2.
- **TX-25**: P16, or P5 (the driving port's "system's terms, not its store's"). Guessed P16.
- **TX-15**: P10 (contention) or P15. Guessed P10. "Relies on" is undefined.
- **TX-3**: P11 or P16. Guessed P11.
- **TX-22**: P8 or P7. Guessed P8.
- **TX-37**: P8 (the committed decision is the fact) or P10. Guessed P8. It works against P17 in tx-37.
- **TX-36** (MAY): P15 (checkout needs the client secret now). Guessed.
- **TX-31**: P9, which covers only this system's records, or P17. Guessed P17.
- **TX-28**, **TX-29**: P8. Guessed.
- **TX-34**: P17 (the sender learns, the work ends). Guessed.
- **TX-38**: P8 or P9 (a stop is no outcome). Guessed P8. It works against P17.
- **TX-26**: P11 or P14. Guessed P11.
- **TX-17**, **TX-33**, **TX-39**, **SYS-13**: P13 and P3 (choreography decoupling). Guessed.
- **SYS-1**, **SYS-9**: P13 or P11. Guessed P13.
- **SYS-10**, **SYS-14**: "loads on every runtime" (Pure), so P6 or browser bundles; no property names it. Guessed P13 and P6.
- **SYS-15**: no property found. Guessed keeping fakes out of production, which is P4 at most.
- **TST-3**, **TST-10**: P2 or F3. Guessed.
- **TST-5**: F1 (the adapter against what production runs) or P14. Guessed F1.
- **TST-8**, **TST-12**, **TST-11**, **TST-7**: no property found. Guessed F3 for TST-7 and TST-8, P13 for TST-11, and none for TST-12.

The text does tell the purpose of: DOM-3 and DOM-7 (P2), SVC-7 (P5), ASM-3 (P4), ASM-7 (P5's Except, worded alike), TX-1 and TX-2 (P7), TX-23, TX-24 and TX-27 (P10), TX-6, TX-20 and TX-21 (P8), TX-5 (P9), TX-19 and TX-32 (P18), TX-7 (P14), TX-12 and SYS-12 (P11), SYS-2 (P13), TX-30 and TX-35 (P17), TST-4 (P6) and TST-6 (P4).

Properties that no rule protects outright: P19 (tx-5-breach-order-paid-means-two-things) and P15 (tx-12, tx-1). P12 depends only on what the reach lists allow, and type imports get past them (svc-1).

## Notes

- **N1.** ASM-7, a MAY, does not name the rule it lifts. I took it to lift ASM-2 ("instead of receiving one from its caller") and SVC-7 ("through no port of its system"). SVC-6, DRV-8 and DVN-4 already list the common library. Its wording mirrors P5's Except, which leaves P6 and P8 unexcepted (asm-7).
- **N2.** TX-36, a MAY, does not name the rule it lifts. I took it to lift TX-22 ("not make the change itself") and, when the tentative operation is asked of a system of this codebase, TX-3. It says nothing on whether the call comes before or after the commit (`tx-3-ok` asks after). It also covers an operation that confirms itself on silence, which the glossary's "its confirmation gives it" does not foresee. TX-30 catches that only where the system recorded what it holds.
- **N3.** I read reach as runtime only ("what running it reads or calls"). Type-only imports, `import("…")` types and inline structural copies reach nothing. This drives dom-1, svc-1, svc-7, sys-2 and sys-10. Every list rule (DOM-1, SVC-6, DRV-8, DVN-4, SYS-9, SYS-14) has the same gap.
- **N4.** ASM-3 says "reads", not "reaches". I took it literally, so a value read inside a common-library call is not read by the service (asm-3).
- **N5.** In TX-19, "the messages" I took to mean the messages the one use case is called for (tx-19).
- **N6.** I took the glossary's idempotent to mean repetition in sequence; it does not mention F5's concurrent redelivery (tx-5).
- **N7.** In TX-22, "decides" I took to exclude a use case that is told by its caller what to do (tx-22). The glossary's acting and answering split counts only changes to the system, so `tx-22-ok`'s `requestCheckoutSession` and any mail-sending use case are answering, and DRV-1 does not count them.
- **N8.** In TX-25, "reaches" is defined only for modules. A value such as an id or a number reaches nothing by that definition, and Payload's `req.transactionID` is one (tx-25).
- **N9.** In TX-2, "its store" is singular. Nothing requires a repository or port to sit in front of one store (tx-2).
- **N10.** The glossary defines the common library as "a package of no system that every system may import". That also describes zod and date-fns. DOM-1 does not list the common library, so I read npm packages as "pure code of no system" where they are pure, and "the common library" as the workspace package only.
- **N11.** In ASM-6, it is unclear whether "of any system" binds only "business rule" or also "schema". Read the first way, the relay's message-envelope schema breaches it.
- **N12.** ASM-5, read literally, also covers a service handing `orderId` to the logger (system data, handed by the service rather than by assembly). I read it as covering what the module reaches on its own initiative.
- **N13.** Words left undefined: "relies on" (TX-15); "output" (ASM-7, P5); "cannot" (DRV-3, ASM-4: who judges that assembly cannot construct the adapter); "this system" in TX-28 (records only, or also a page cache); "the real thing" in TST-5 for Stripe (test mode is end-to-end, so per TST-12 it never runs automatically).
- **N14.** `tx-28-ok-after-change-hook-records-revalidation-request` claims TX-28, yet its hook's use case records a private message. That is not a tentative operation, which the glossary defines as "a request to another system". Read literally, TX-28 refuses the ok example.
- **N15.** TX-29 is a SHOULD, yet its Examples list `tx-28-ok-…` as a "breach". The same file is filed as an ok of TX-28 and a breach of TX-29. That is 30 references to 29 paths.
- **N16.** `tx-30-ok-payment-asks-stripe-at-deadline` runs one transaction per overdue payment inside one use case, which conflicts with TX-1's "one transaction". It reads `payments.overdue(clock.now())` without handing the transaction to that call into the store (TX-1). Its SQL behind `overdue` restates the domain's `isOverdue`, which conflicts with DOM-7's "stated once". DRV-1 pushes a scheduled task to make a single acting call, so batches end up inside one use case. TX-1 then forces them into one transaction, which the example avoids.
- **N17.** `tx-35-ok-late-payment-refunded` imports `refundPayment` from `@teeladen/payment/published` in shop's service. SVC-6 lists another system's published language only for "an upstream its system conforms to", and nothing says shop conforms to payment. `sys-13-ok` states its conformity explicitly; this example does not. Under an anti-corruption layer, a service cannot build another system's command at all. Only a driven adapter can, through "the outside" of DVN-4.
- **N18.** The reach lists look over-restrictive. DOM-1 omits the system's own published language, so a domain cannot return its own events. DVN-4 omits it too, which affects an outbox adapter that parses. SYS-14 forbids a published language from reaching another system's published language.
- **N19.** TX-21 ("until the handler acknowledges it") forbids dead-lettering. `tx-34-breach` describes the bus parking after five tries as given. Together with TX-38 and DRV-7, a refusal for good loops forever (tx-38).
- **N20.** In SYS-15, "path" can be read as the export path rather than the module behind it. A builder importing the fake's module by relative path then satisfies it.
- **N21.** TX-35 and TX-27: any domain function counts as "a business rule", so a renamed early return or a comment "lag accepted" satisfies them. P17 and P10 then hold by their own wording.
- **N22.** P11 and P5 speak of systems and the outside. The common library and tooling are neither, so neither property covers them (asm-5).
- **N23.** P9 covers only "record of this system". A double booking at the 3PL (`tx-31-breach`) breaks no property except P17, and TX-31 is a SHOULD.
- **N24.** Fixture sentences these findings rely on: "OrderPaid, which billing and fulfillment have already acted on" (tx-5 P19); "OrderCancelled can arrive before OrderPlaced; a dropped cancel leaves stock reserved" (tx-19); "Calls billing's open host service in-process while holding its own ambient transaction" (tx-25); "Sends an order-confirmation mail once the order commits" (asm-7, tx-22); "An admin dashboard joins orders, invoices and shipments" (asm-5, sys-12); "Request id and trace context should cross system boundaries" (asm-3); "fulfillment registers each new SKU there" (tx-38); "Not to a customer billing has put into dunning" (tx-12, tx-26, tx-27); "a customer's dunning stage rises with each reminder and clears once they pay" (tx-37, dom-7); "gapless invoice numbers" (tx-1, tx-5).
- **N25.** Variants not in the fixture: invoice PDFs in object storage (tx-2), Metabase (sys-12), wholesale and vouchers (drv-8, svc-3, dvn-4), split shipments (tx-31), and a warehouse picking tool (dom-4).
- **N26.** Missing paths: none. All 29 example paths exist and were read.
