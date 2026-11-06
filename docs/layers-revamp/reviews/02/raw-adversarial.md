# Adversarial review, raw set

## Summary

- `dom-1-breach-cart-fingerprint-imports-node-crypto.md`, DOM-1: `node:crypto` is "a library that computes from its arguments", so the domain imports it and the browser's checkout form fails to load.
- `sys-14-breach-money-reads-currency-from-process-env.md`, SYS-14: `Money` imports only zod and reads `process.env` with no import, so every importer runs it, the browser included.
- `svc-6-breach-transaction-port-typed-by-drizzle-transaction.md`, SVC-6: ports declared in the service layer take the common library's Drizzle transaction type, which puts the store's name into every service signature.
- `svc-3-breach-checkout-clears-cart-through-driven-port.md`, SVC-3 and DVN-4: checkout reaches the clear-cart use case through a driven port whose adapter forwards to that service, so a second transaction commits on its own.
- `svc-4-breach-cart-repository-appends-line-unversioned.md`, SVC-4 and TX-24: the write goes through the Cart repository as a line insert, the aggregate is never saved whole, and two concurrent adds both commit.
- `svc-7-breach-service-queries-through-sql-port.md`, SVC-7: the "port of its system" is a generic `Sql` port, so the service holds table names and its test needs the store.
- `drv-8-breach-server-action-saves-through-courier-repository.md`, DRV-8 and SVC-7: a server action reads shop's repository from the courier, typed inline, and cancels an order outside any use case.
- `drv-1-breach-checkout-action-asks-for-client-secret-after-placing.md`, DRV-1: one acting call followed by an answering call that can fail leaves the adapter to decide what happens when the first succeeded and the second failed.
- `drv-6-breach-server-action-memoizes-courier-read.md`, DRV-6: the courier is read when the action runs, but only the first time, so the first instance is held for the life of the process.
- `drv-7-breach-refund-conflict-published-as-refusal.md`, DRV-7: a retryable save conflict is committed as a refusal, the use case "succeeds", and the handler acknowledges a refund that never happens.
- `asm-3-breach-payment-deadline-in-process-time-zone.md`, ASM-3: a domain function reads the process time zone, so the payment deadline depends on which process placed the order.
- `asm-5-breach-relay-names-outbox-tables.md`, ASM-5: the relay imports no system but lists their outbox tables by name, so every new system changes the library.
- `tx-2-breach-stock-repository-mirrors-stock-into-payload.md`, TX-2 and TX-1: the stock repository runs its own store's calls in the transaction, then writes Payload, a second store, which commits on its own.
- `tx-23-breach-cancel-saves-again-after-conflict.md`, TX-23 and SVC-2: the first save fails as required, and the service reloads and saves its stale decision onto the fresh order.
- `tx-25-breach-dunning-port-takes-database-client.md`, TX-25: billing's port takes a `Database`, and shop hands in its transaction, which is one.
- `tx-22-breach-book-shipment-marks-and-books-in-one-attempt.md`, TX-22: the booking goes through the outbox, but the use case it calls decides and books in one attempt.
- `tx-31-breach-3pl-booking-keyed-by-resent-message-id.md`, TX-31: the key is the message id, and a re-sent `BookShipment` carries a new one, so the 3PL books twice.
- `tx-28-breach-hook-records-private-message-handler-confirms-nothing.md`, TX-28: the hook's use case only writes a private message, and its handler revalidates without any confirmation.
- `tx-30-breach-overdue-payment-abandoned-without-asking-stripe.md`, TX-30: a business rule decides that an unanswered payment is abandoned, without asking Stripe whether the card was charged.
- `tx-21-breach-in-memory-bus-relay-marks-on-handover.md`, TX-20 and TX-21: an in-memory bus keeps and redelivers until acknowledgement, and the relay marks the message as handed once the bus has it, so a crash loses it.
- `tx-7-breach-order-placed-gains-optional-paid-by-invoice.md`, TX-7: an optional field keeps both directions readable, while old handlers ignore it and the order is never invoiced or shipped.
- `tx-17-breach-order-placed-split-per-consumer.md`, TX-17: shop names no system but publishes one event per consumer, so it changes whenever a consumer starts listening.
- `tx-33-breach-billing-handles-payments-private-refund-request.md`, TX-33: billing subscribes to payment's private refund request, which is not a published command, and issues a credit note for a refund that never happens.
- `sys-2-breach-published-status-generated-from-domain.md`, SYS-2: the published language imports nothing, but tooling copies the domain enum into it on every build.
- `tst-5-breach-adapter-test-pushes-schema-from-adapter-tables.md`, TST-5: the test uses real Postgres, but builds its tables from the adapter's own definitions instead of the migrations.
- `tst-6-breach-contract-suite-skips-stale-save.md`, TST-6: one contract suite runs against both, but leaves out the stale save, so the real adapter breaks TX-23 unnoticed.

## Findings

### dom-1-breach-cart-fingerprint-imports-node-crypto.md

```yaml
breaches: [DOM-1]
satisfies: [DOM-3]
situation: shop's checkout; the checkout form in the browser parses the cart with shop's domain schema
finding: adversarial
```

# Shop's cart module imports `node:crypto` to fingerprint the cart

```ts
// shop/domain/cart.ts
import { createHash } from "node:crypto"                       // takes a string, returns a digest: computes from its arguments
import { z } from "zod"
import { skuSchema } from "@teeladen/shared-kernel/sku"

export const cartLineSchema = z.object({ sku: skuSchema, quantity: z.number().int().positive() })
export const cartSchema = z.object({ id: z.string(), lines: z.array(cartLineSchema) })
export type Cart = z.infer<typeof cartSchema>

// business rule: checkout refuses a cart that changed since the customer last saw it
export const fingerprint = (cart: Cart): string =>
  createHash("sha256").update(JSON.stringify(cart.lines)).digest("hex")

// app/checkout/checkout-form.tsx: "use client", parses the cart in the browser
import { cartSchema } from "@teeladen/shop/domain/cart"         // loads node:crypto into the browser bundle
```

The Statement met: "The import MUST be one of: another domain module, a shared kernel, the published
language of an upstream this system conforms to, a library that computes from its arguments."
`createHash` reaches nothing outside the process and returns a value computed from what it is given.

The Why's harm: "`node:path` reaches nowhere outside the process and still breaks in a browser;
`Buffer`, `process`, `window` and the DOM are one runtime's. A domain that imports any of these loads
on one runtime, and whoever imports it elsewhere, a browser rendering a form from the schema, another
system's domain, gets a load error or the server's store client along with the model."

How: the Why tests a module with two questions, "does calling it reach outside the process, and does
it exist on every runtime?". The Statement's list asks only the first. `node:crypto` passes the list
and fails the second question, and the checkout form fails to load.

### sys-14-breach-money-reads-currency-from-process-env.md

```yaml
breaches: [SYS-14]
satisfies: [DOM-1]
situation: the shared kernel's Money, imported by every system's domain and by shop's checkout form
finding: adversarial
```

# `Money` reads its default currency from `process.env` with no import

```ts
// shared-kernel/money.ts
import { z } from "zod"                                         // the one import: a library that computes from its arguments

const defaultCurrency = process.env.SHOP_CURRENCY ?? "EUR"      // a global, not an import; runs at module load

export const moneySchema = z.object({
  cents: z.number().int(),
  currency: z.string().default(defaultCurrency),
})
export type Money = z.infer<typeof moneySchema>

// billing/domain/invoice-line.ts: passes DOM-1, since a shared kernel is on its list
import { moneySchema } from "@teeladen/shared-kernel/money"
```

The Statement met: "The import MUST be one of: another module of the same published language or shared
kernel, a shared kernel, a library that computes from its arguments." The module imports zod, and
nothing else.

The Why's harm: "Both are imported where the rest of their system is not: a shared kernel into the
domain of every system that shares it, a published language into a downstream's adapters, into its
domain where it conforms (DOM-1), into a browser parsing a form. What they import, every importer
loads."

How: what the module reads at load time, every importer also runs. In the browser `process` is
undefined, and the checkout form throws `ReferenceError` at load. The server and the worker run with
different environments, so they parse the same stored `Money` with different default currencies. The
rule bounds imports, and a global read is not one.

### svc-6-breach-transaction-port-typed-by-drizzle-transaction.md

```yaml
breaches: [SVC-6]
satisfies: [SVC-1, SVC-7, TX-1, ASM-2]
situation: shop cancels an order
finding: adversarial
```

# Shop's ports take the common library's Drizzle transaction

```ts
// shop/service/ports/transactions.ts: driven port, declared in the service layer
import type { Transaction } from "@teeladen/common/postgres"   // the common library: Drizzle's PgTransaction, re-exported
export interface Transactions { run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> }

// shop/service/ports/order-repository.ts
import type { Transaction } from "@teeladen/common/postgres"
export interface OrderRepository {
  byId(id: string, tx: Transaction): Promise<Order>
  save(order: Order, tx: Transaction): Promise<void>
}

// shop/service/cancel-order.ts
export const createCancelOrder =
  ({ transactions, orders, outbox, clock }: Deps): CancelOrder =>
  ({ orderId, actor }) =>
    transactions.run(async (tx) => {                              // tx: a Drizzle client; tx.execute(sql`…`) compiles here
      const order = await orders.byId(orderId, tx)
      if (!canBeCancelledBy(order, actor, clock.now())) return { cancelled: false }
      await orders.save(cancel(order), tx)
      await outbox.write(orderCancelled(order), tx)
      return { cancelled: true }
    })
```

The Statement met: "The import MUST be one of: […] a port declared in its service layer, […] the common
library, […]". Every import is a port of shop's or the common library.

The Why's harm: "A service that knows the route that calls it, or the store client that saves for it,
changes whenever either changes, and a second way in, or a second store, means rewriting the use case."
Also: "A store client's type in a port's signature is the store's name in the service, one step
removed."

How: the common library is on the list and holds the Drizzle client factory, so its types are
importable. Every port signature carries `PgTransaction`. A fake `Transactions` has to make up a
Drizzle transaction, and moving shop to another store rewrites every service signature. Inside each
service, `tx` is a full store client.

### svc-3-breach-checkout-clears-cart-through-driven-port.md

```yaml
breaches: [SVC-3, DVN-4]
satisfies: [SVC-1, SVC-7, ASM-2, ASM-1]
situation: shop's checkout places the order and empties the cart
finding: adversarial
```

# Checkout clears the cart through a driven port whose adapter calls the clear-cart service

```ts
// shop/service/ports/cart-clearer.ts: driven port
export interface CartClearer { clear(cartId: string): Promise<void> }

// shop/service/checkout.ts
export const createCheckout =
  ({ transaction, carts, orders, outbox, cartClearer }: Deps): Checkout =>
  ({ cartId, customerId }) =>
    transaction.run(async (tx) => {
      const cart = await carts.byId(cartId, tx)
      const order = placeOrder(cart, customerId)
      await cartClearer.clear(cartId)                              // a driven port, not a service
      await orders.save(order, tx)                                 // fails: a concurrent change (TX-23)
      await outbox.write(orderPlaced(order), tx)
    })

// shop/adapters/forwarding-cart-clearer.ts: driven adapter; imports only the port it implements
import type { CartClearer } from "../service/ports/cart-clearer"
export const forwardingCartClearer =
  (clearCart: (input: { cartId: string }) => Promise<void>): CartClearer => ({   // typed inline: no import of the service
    clear: (cartId) => clearCart({ cartId }),
  })

// apps/server/assembly.ts
const clearCart = createClearCart({ transaction, carts })
const checkout = createCheckout({ transaction, carts, orders, outbox, cartClearer: forwardingCartClearer(clearCart) })
```

The Statements met: SVC-3, "It MUST NOT call that service". Checkout calls a driven port. DVN-4, "The
import MUST be one of: […] the port it implements, […]". The adapter imports only `CartClearer`.

The Why's harm. SVC-3: "A service called from another opens a transaction of its own, a second one,
with no rollback of its own: the outer one fails and the inner one's writes stay." DVN-4: "One that
calls a service has a use case inside it, in the layer meant to do nothing but talk to the outside".

How: `clearCart` commits in its own transaction. Checkout's save then fails and rolls back, and the
customer has no order and an empty cart. The call between the two services goes through a port and a
structural type, so neither import list sees it.

### svc-4-breach-cart-repository-appends-line-unversioned.md

```yaml
breaches: [SVC-4, TX-24]
satisfies: [SVC-2, TX-1, SVC-7, TX-23]
situation: a customer adds a tea to the cart twice at once (a double click, two tabs)
finding: adversarial
```

# The Cart repository inserts a line; the Cart is never saved whole

```ts
// shop/service/ports/cart-repository.ts
export interface CartRepository {
  byId(cartId: string, tx: Tx): Promise<Cart>
  addLine(cartId: string, line: CartLine, tx: Tx): Promise<void>                 // insert into cart_lines
  setQuantity(cartId: string, sku: Sku, quantity: number, tx: Tx): Promise<void> // update one cart_lines row
}

// shop/domain/cart.ts: business rule: one line per sku, at most 10 of a tea
export const addToCart = (cart: Cart, sku: Sku, quantity: number): CartChange => { /* append | increase | refused */ }

// shop/service/add-to-cart.ts
export const createAddToCart = ({ transaction, carts }: Deps): AddToCart =>
  ({ cartId, sku, quantity }) =>
    transaction.run(async (tx) => {
      const cart = await carts.byId(cartId, tx)
      const change = addToCart(cart, sku, quantity)                // the domain decides, in the call that acts
      if (change.kind === "refused") return change
      if (change.kind === "append") await carts.addLine(cartId, change.line, tx)
      else await carts.setQuantity(cartId, sku, change.quantity, tx)
      return change
    })
```

The Statements met. SVC-4: "The write MUST go through the aggregate's repository." TX-24: "The data
it decides by SHOULD belong to aggregates the use case saves". The use case decides by the Cart and
writes it through the Cart's repository. TX-23's Scope, "a repository saves an aggregate that was
loaded through it", does not hold for `addLine`, so it requires nothing.

The Why's harm. SVC-4: "A repository saves its aggregate whole (glossary: Aggregate). A write from the
service itself, an insert or update with a store client, lands beside the aggregate's writes with
nothing that keeps them whole". TX-24: "The aggregates a use case saves fail on a change."

How: both requests load a cart without the tea, the domain answers `append` both times, and both
inserts commit. The cart ends with two lines of one sku, 20 of a tea. The repository is the right
door, and its method writes a part of the aggregate, raising no version.

### svc-7-breach-service-queries-through-sql-port.md

```yaml
breaches: [SVC-7]
satisfies: [SVC-1, SVC-6, ASM-2, TX-1]
situation: the customer's account page lists their orders with line count and total
finding: adversarial
```

# Shop declares a `Sql` port in its service layer and queries through it

```ts
// shop/service/ports/sql.ts: driven port, declared in shop's service layer (SVC-1)
export interface Sql {
  query<Row>(text: string, params: readonly unknown[]): Promise<Row[]>
}

// shop/service/order-overview.ts: answering use case
export const createOrderOverview =
  ({ sql }: { sql: Sql }): OrderOverview =>
  ({ customerId }) =>
    sql.query<OrderOverviewRow>(
      `select o.id as "orderId", o.status, count(l.id)::int as "lineCount", o.total
         from orders o left join order_lines l on l.order_id = o.id
        where o.customer_id = $1
        group by o.id`,
      [customerId],
    )

// shop/drizzle/sql.ts: driven adapter
export const pgSql = (pool: Pool): Sql => ({
  query: async (text, params) => (await pool.query(text, [...params])).rows,
})
```

The Statement met: "It MUST do so through a port of its system." `Sql` is declared in shop's service
layer and implemented by a driven adapter.

The Why's harm: "A service handed the store client and querying with it reads the store's records in
the store's terms, past the repository and the aggregate it loads whole; the store's name is in the
service, and its test needs the store."

How: the Why assumes that "a port of the system is declared in its service layer (SVC-1), in the
system's [terms]". Neither Statement requires the system's terms. The table and column names are in
the service, and a fake `Sql` would have to interpret SQL, so the test needs Postgres.

### drv-8-breach-server-action-saves-through-courier-repository.md

```yaml
breaches: [DRV-8, SVC-7]
satisfies: [DRV-3, DRV-6, ASM-4, DRV-1]
situation: shop cancels an order from a server action
finding: adversarial
```

# The server action reads shop's repository from the courier and cancels the order itself

```ts
// app/orders/[id]/actions.ts: server action (driving adapter), found and called by the framework
"use server"
import { courier } from "@teeladen/common/courier"                                // the common library
import { cancel, canBeCancelledBy, type Order } from "@teeladen/shop/domain"       // its system's domain

type Reach = {                                                                     // declared inline: no driven port imported
  transaction: { run<T>(work: (tx: unknown) => Promise<T>): Promise<T> }
  orders: { byId(id: string, tx: unknown): Promise<Order>; save(order: Order, tx: unknown): Promise<void> }
  clock: { now(): Date }
}

export async function cancelOrderAction(orderId: string, customerId: string) {
  const { transaction, orders, clock } = courier.read<Reach>()                     // read when it runs
  return transaction.run(async (tx) => {
    const order = await orders.byId(orderId, tx)                                   // shop's OrderRepository: a port of its system
    if (!canBeCancelledBy(order, { kind: "customer", customerId }, clock.now())) return { ok: false }
    await orders.save(cancel(order), tx)
    return { ok: true }
  })
}

// apps/server/assembly.ts
courier.fill({ ...shopServices, transaction, orders: drizzleOrders(db), clock })
```

The Statements met. DRV-8: "The import MUST be one of: the framework that calls it, a driving port of
its system, its system's domain, a shared kernel, its system's published language, the common library,
a library that computes from its arguments." SVC-7: "It MUST do so through a port of its system." The
repository is a port of shop's.

The Why's harm. DRV-8: "A driving adapter that skips the service and reaches a driven adapter, a
repository or the store reads state and decides by it, or writes outside any use case and outside the
transaction a service holds, and the business rules in the domain are bypassed for that one way in."
SVC-7: "a driving adapter reaches it through a driving port, and the service behind it does the rest."

How: the courier carries whatever assembly puts in it, and an inline type needs no import. No
`OrderCancelled` reaches the outbox, so fulfillment keeps the stock reserved for a cancelled order.
SVC-7 asks for "a port of its system", and a driven port is one.

### drv-1-breach-checkout-action-asks-for-client-secret-after-placing.md

```yaml
breaches: [DRV-1]
satisfies: [DRV-8, DRV-3, DRV-6, SVC-3]
situation: checkout must return a Stripe client_secret in the same request; payment creates it
finding: adversarial
```

# The checkout action places the order, then asks an answering use case for the client secret

```ts
// app/checkout/actions.ts: server action
"use server"
import { courier } from "@teeladen/common/courier"
import type { PlaceOrder, PaymentClientSecret } from "@teeladen/shop/service/ports/driving"   // driving ports of its system

export async function checkoutAction(input: CheckoutInput) {
  const { placeOrder, paymentClientSecret } = courier.read<{ placeOrder: PlaceOrder; paymentClientSecret: PaymentClientSecret }>()
  const { orderId } = await placeOrder(parseCheckout(input))           // the one acting call: commits, OrderPlaced in the outbox
  const { clientSecret } = await paymentClientSecret({ orderId })       // answers: shop writes nothing; payment creates the PaymentIntent
  return { orderId, clientSecret }
}
```

The Statement met: "It MUST make at most one acting call." `placeOrder` acts.
`paymentClientSecret` writes nothing of shop's and returns a value.

The Why's harm: "A driving adapter that makes two acting calls has a use case growing inside it: which
second call to make, and what to do when the first succeeded and the second fails, are a use case's
decisions, and here they sit in one way in, without a transaction, repeated or missing in the next way
in."

How: when payment is down, the order is placed and fulfillment reserves the stock, while the browser
gets an error and no secret. The customer checks out again and places a second order. Whether the
second call is acting or answering decides the case, and nothing defines "acting call" (see Notes).

### drv-6-breach-server-action-memoizes-courier-read.md

```yaml
breaches: [DRV-6]
satisfies: [DRV-3, DRV-8, ASM-4, DRV-1]
situation: shop's checkout server action
finding: adversarial
```

# The action reads the courier on its first run and keeps what it got

```ts
// app/checkout/actions.ts: server action
"use server"
import { courier } from "@teeladen/common/courier"
import type { PlaceOrder } from "@teeladen/shop/service/ports/driving"

let placeOrder: PlaceOrder | undefined

export async function checkoutAction(input: CheckoutInput) {
  placeOrder ??= courier.read<{ placeOrder: PlaceOrder }>().placeOrder    // read when it runs, the first time it runs
  return placeOrder(parseCheckout(input))
}
```

The Statement met: "It MUST read when it runs, not when its module loads."

The Why's harm: "The module loads when the framework discovers it, before or while assembly runs, so a
read at load time finds the courier empty, or holds the first instance for the life of the process. A
test that fills the courier with fakes changes nothing the adapter already holds."

How: the first run caches the instance in module state. A second test that fills the courier with
other fakes still calls the first test's `placeOrder`. A per-request courier serves every later request
from the first request's instance.

### drv-7-breach-refund-conflict-published-as-refusal.md

```yaml
breaches: [DRV-7]
satisfies: [TX-34, TX-23, TX-1, TX-5]
situation: payment refunds when shop asks, but not a disputed charge
finding: adversarial
```

# Payment commits a save conflict as a refusal, so the handler acknowledges

```ts
// payment/service/refund-payment.ts: called by payment's handler for shop's RefundPayment
export const createRefundPayment =
  ({ transaction, handled, payments, refunds, outbox }: Deps): RefundPayment =>
  (command) =>
    transaction.run(async (tx) => {
      if (!(await handled.claim(command.id, tx))) return
      const payment = await payments.byOrderId(command.orderId, tx)
      const decision = decideRefund(payment, command.amount)
      if (decision.refused) {
        await outbox.write(refundRefused(command.orderId, decision.reason), tx)
        return
      }
      try {
        await payments.save(withRefundPending(payment, command.amount), tx)   // fails: a Stripe webhook saved the payment meanwhile
      } catch (error) {
        if (!(error instanceof ConcurrentChange)) throw error
        await outbox.write(refundRefused(command.orderId, "busy"), tx)        // an outcome: commits, so the use case has succeeded
        return
      }
      const refund = newRefund(payment, command.amount)
      await refunds.save(refund, tx)
      await outbox.write(stripeRefundRequested(refund), tx)
    })

// payment/driving/handlers.ts
RefundPayment: async (message, ack) => { await refundPayment(message); await ack() }
```

The Statement met: "It MUST NOT acknowledge it unless the use case it calls has succeeded." The use
case writes and has committed: "one that writes succeeds when it has committed."

The Why's harm: "A queue client that acknowledges on receipt, or a handler that catches the use case's
error and returns, loses the message the moment the use case fails, and the change it tells of does not
reach this system."

How: the use case catches the failure itself and commits it, so the handler sees a success.
`RefundPayment` is acknowledged and the refund never happens. TX-34's Why says "A failure that a retry
may cure, […] is no refusal: the use case fails and the bus delivers again", and no Statement
requires it.

### asm-3-breach-payment-deadline-in-process-time-zone.md

```yaml
breaches: [ASM-3]
satisfies: [DOM-1, SVC-7]
situation: shop's Order holds the payment deadline
finding: adversarial
```

# Shop's domain computes the deadline in the process's time zone

```ts
// shop/domain/order.ts: imports zod and the shared kernel only
export const paymentDeadline = (placedAt: Date): Date => {
  const deadline = new Date(placedAt)
  deadline.setDate(deadline.getDate() + 1)
  deadline.setHours(23, 59, 59, 999)                 // end of the next day: local time, read from the process's TZ
  return deadline
}

// shop/service/place-order.ts: reads no ambient value itself
const now = clock.now()
const order = placeOrder(cart, { placedAt: now, deadline: paymentDeadline(now) })
```

The Statement met: "The value MUST NOT change how the use case acts or what it answers." The rule's
Scope is "a service, or a driven adapter a service calls, reads an ambient value". The service reads
none, and the domain function it calls does.

The Why's harm: "An ambient value is in no signature. A use case that acts by one, […] depends on
something no caller knows to supply: the second driving adapter forgets it, the test does not set it,
the handler runs outside the request where it was set, and the result changes without a trace."

How: the process's time zone is a per-process ambient value, an environment variable. During a rolling
deploy, the new image runs with no `TZ` set beside the old one set to Europe/Berlin. Orders placed in
the same second get deadlines an hour or two apart, and the deadline task cancels some early. The
domain is outside the Scope, and DOM-1 does not catch it because no import is involved.

### asm-5-breach-relay-names-outbox-tables.md

```yaml
breaches: [ASM-5]
satisfies: [ASM-6, ASM-2, TX-20]
situation: the common library's outbox relay
finding: adversarial
```

# The relay imports no system and lists their outbox tables by name

```ts
// common/messaging/relay.ts
import type { Pool } from "pg"                                        // a store client: not a system's module

const outboxes = ["shop_outbox", "payment_outbox", "billing_outbox", "fulfillment_outbox"] as const

export const createRelay = ({ pool, bus }: { pool: Pool; bus: Bus }) => ({
  async tick() {
    for (const table of outboxes) {
      const { rows } = await pool.query<OutboxRow>(
        `select id, type, payload from ${table} where handed_at is null order by id limit 100`)
      for (const row of rows) {
        await bus.hand(row)
        await pool.query(`update ${table} set handed_at = now() where id = $1`, [row.id])
      }
    }
  },
})
```

The Statement met: "It MUST NOT be a system's module." The only import is `pg`.

The Why's harm: "One that imports a system knows it, and a new system means a change to the library: a
relay that imports a system knows its outbox readers, a bus that imports a system knows its handlers."

How: the relay knows every system by its table name instead of by an import. A new system, or catalog's
outbox, which is a Payload collection in another shape, means editing the common library. Nothing
requires the relay to read through outbox readers.

### tx-2-breach-stock-repository-mirrors-stock-into-payload.md

```yaml
breaches: [TX-2, TX-1]
satisfies: [SVC-4, DVN-4, SYS-12, TX-23]
situation: fulfillment reserves stock on OrderPlaced; editors see each product's stock in Payload's admin, read-only
finding: adversarial
```

# Fulfillment's stock repository writes Payload beside its own transaction

```ts
// fulfillment/drizzle/stock-repository.ts: driven adapter
import type { Payload } from "payload"                                  // the external system's package (DVN-4)

export const drizzleStockRepository = (payload: Payload): StockRepository => ({
  bySkus: (skus, tx) => tx.select().from(stocks).where(inArray(stocks.sku, skus)),
  async save(stock, tx) {
    const saved = await tx.update(stocks)                               // its store: inside the transaction it is handed
      .set({ available: stock.available, version: stock.version + 1 })
      .where(and(eq(stocks.sku, stock.sku), eq(stocks.version, stock.version)))
      .returning({ sku: stocks.sku })
    if (saved.length === 0) throw new ConcurrentChange(stock.sku)
    await payload.update({                                              // Payload's store: its own transaction
      collection: "products",
      where: { sku: { equals: stock.sku } },
      data: { stock: stock.available },
    })
  },
})

// fulfillment/service/reserve-stock.ts: one order, several skus
for (const stock of reserved) await stocks.save(stock, tx)              // the second sku's save fails: rollback
```

The Statements met. TX-2: "Each call it makes into its store MUST run inside that transaction." Every
call into fulfillment's Postgres store runs in `tx`. TX-1: "Its service MUST run it in one
transaction: open it, hand it to each call into its store, commit it."

The Why's harm. TX-2: "A write outside it, through the global client or a transaction the adapter opens
itself, commits on its own: a failure between the writes leaves the use case half done, and the
transaction's rollback leaves this write in place." TX-1: "One acting use case is one transaction,
several aggregates included: the order placed and the cart cleared land or fail together."

How: Payload's Local API commits on its own client, so it is a second store under the glossary ("two
stores until they do"). The second sku's conflict rolls back the reservation, while Payload already
shows the first sku's stock as reserved. Both Statements bind "its store", and the write goes to
another one. TX-1's Why says "a write to a second store goes to a handler through the outbox", and
neither Statement requires it.

### tx-23-breach-cancel-saves-again-after-conflict.md

```yaml
breaches: [TX-23, SVC-2]
satisfies: [TX-1, TX-6, SVC-4, TX-24]
situation: shop's payment and its deadline arrive together
finding: adversarial
```

# The deadline's cancel catches the failed save, reloads, and saves its decision again

```ts
// shop/service/cancel-overdue-order.ts: called by shop's deadline task
export const createCancelOverdueOrder =
  ({ transaction, orders, outbox, clock }: Deps): CancelOverdueOrder =>
  ({ orderId }) =>
    transaction.run(async (tx) => {
      const order = await orders.byId(orderId, tx)
      if (!isOverdue(order, clock.now())) return                       // the decision, in the call that acts
      const cancelled = cancel(order)
      try {
        await orders.save(cancelled, tx)                                // fails: mark-paid committed meanwhile (TX-23)
      } catch (error) {
        if (!(error instanceof ConcurrentChange)) throw error
        const fresh = await orders.byId(orderId, tx)                    // READ COMMITTED: sees the paid order, new version
        await orders.save({ ...fresh, status: cancelled.status, cancelledAt: cancelled.cancelledAt }, tx)   // saves: nothing changed since this load
      }
      await outbox.write(orderCancelled(cancelled), tx)
    })
```

The Statements met. TX-23: "The save MUST fail where the aggregate has changed in the store since it was
loaded." The first save fails, and the second saves an aggregate unchanged since its own load. SVC-2:
"The service that acts MUST enforce the decision itself, in the call that acts."

The Why's harm. TX-23: "The order ends in whichever state saved last, `OrderPaid` and `OrderCancelled`
are both out, and fulfillment ships an order it released. The later save wrote over the earlier one by
a decision whose state no longer held." SVC-2: "where what it loaded changes before the commit, its
save fails and the act with it."

How: each Statement binds one save and one check. Neither requires the act to fail with the save, or
the decision to be made again on what is saved.

### tx-25-breach-dunning-port-takes-database-client.md

```yaml
breaches: [TX-25]
satisfies: [SVC-1, SVC-6, SVC-7, TX-12, ASM-9]
situation: shop's checkout offers pay-by-invoice, not to a customer in dunning, and calls billing's open host service in-process
finding: adversarial
```

# Billing's port takes a `Database`; shop hands in its transaction

```ts
// billing/service/ports/driving/dunning-stage-of.ts: driving port of billing's open host service
import type { Database } from "@teeladen/common/postgres"
export type DunningStageOf = (input: { customerId: string }, db: Database) => Promise<{ stage: DunningStage }>

// billing/service/dunning-stage-of.ts: answering use case
export const createDunningStageOf = ({ dunnings }: Deps): DunningStageOf =>
  async ({ customerId }, db) => ({ stage: (await dunnings.byCustomer(customerId, db)).stage })

// shop/billing/dunning-gateway.ts: shop's driven adapter, typed by billing's port type
import type { DunningStageOf } from "@teeladen/billing"
export const billingDunningGateway = (dunningStageOf: DunningStageOf): DunningGateway => ({
  stageOf: async (customerId, tx) => (await dunningStageOf({ customerId }, tx)).stage,   // a PgTransaction is a PgDatabase
})
```

The Statement met: "It MUST NOT take a transaction." The port declares a database client.

The Why's harm: "The caller of an open host service's port is another system: its transaction handed
in runs the upstream's reads in the downstream's, one transaction across two systems' data, the
upstream's store bound to whatever the downstream opened, and a port that stops working once the
upstream runs in its own process."

How: Drizzle's transaction is assignable to its database type. Shop passes its argument transaction,
so ASM-9 holds, and billing's reads run in shop's checkout transaction. Moving billing out of process
breaks the port's signature.

### tx-22-breach-book-shipment-marks-and-books-in-one-attempt.md

```yaml
breaches: [TX-22]
satisfies: [TX-31, TX-1, TX-23]
situation: fulfillment books a shipment with the 3PL; OrderCancelled can arrive meanwhile
finding: adversarial
```

# The use case called for `BookShipment` decides, books and marks in one attempt

```ts
// fulfillment/service/book-shipment.ts: called by fulfillment's handler of its private BookShipment
export const createBookShipment =
  ({ transaction, reservations, warehouse }: Deps): BookShipment =>
  ({ shipmentId, orderId }) =>
    transaction.run(async (tx) => {
      const reservation = await reservations.byOrderId(orderId, tx)
      if (reservation.status !== "reserved") return                                     // released meanwhile: decides again
      const booking = await warehouse.book(toBooking(reservation), { idempotencyKey: shipmentId })
      await reservations.save(markShipped(reservation, booking.ref), tx)               // fails: the release saved first (TX-23)
    })
```

The Statement met: "The change MUST go through this system's outbox, on behalf of its owner." The
deciding use case wrote `BookShipment`, and this use case, called by its handler, makes the change.

The Why's harm: "A use case that marks the reservation and books the 3PL in one attempt decides again
on redelivery, the order cancelled meanwhile, while the booking stands."

How: the 3PL books, and the save loses to `OrderCancelled`'s release and rolls back. On redelivery the
reservation is released and the use case returns, while the parcel ships. The Why says the use case
the handler calls "makes the change and decides nothing", and the Statement does not require it.

### tx-31-breach-3pl-booking-keyed-by-resent-message-id.md

```yaml
breaches: [TX-31]
satisfies: [TX-22, TX-30, TX-6]
situation: fulfillment books a shipment with the 3PL
finding: adversarial
```

# The key is the message id; a reconciliation re-sends `BookShipment` with a new one

```ts
// fulfillment/service/rebook-unbooked-shipments.ts: scheduled task; business rule: unbooked after an hour, book again
export const createRebookUnbooked =
  ({ transaction, shipments, outbox, clock }: Deps): RebookUnbooked =>
  () =>
    transaction.run(async (tx) => {
      for (const shipment of await shipments.unbookedSince(hourBefore(clock.now()), tx))
        await outbox.write(bookShipment(shipment), tx)                                // a new message, a new id
    })

// fulfillment/service/book-shipment.ts: called by the handler of fulfillment's private BookShipment
export const createBookShipment =
  ({ warehouse, shipments, transaction }: Deps): BookShipment =>
  async (message) => {
    const booking = await warehouse.book(toBooking(message), { idempotencyKey: message.id })   // a key the message carries
    await transaction.run((tx) => shipments.recordBooking(message.shipmentId, booking.ref, tx))
  }
```

The Statement met: "It SHOULD pass a key the message carries." The Why also blesses the message id:
"The key is the same on every delivery where it comes from the message, its id or the id of what it is
about, the shipment, the refund".

The Why's harm: "Redelivery repeats the call: the external system acted, and the handler failed or its
process died before it acknowledged."

How: the first booking succeeds at the 3PL, then recording it fails while the store is down, and the bus
parks the message. After an hour the task writes a second `BookShipment` with a new id, and the 3PL
books a second parcel. The external system acts twice for one shipment. The message id deduplicates
deliveries of one message, not two messages about the same shipment.

### tx-28-breach-hook-records-private-message-handler-confirms-nothing.md

```yaml
breaches: [TX-28]
satisfies: [TX-25, TX-6, TX-30, DRV-3]
situation: an editor saves a product in Payload's admin; an afterChange hook calls shop to revalidate the cached product page
finding: adversarial
```

# The hook's use case only records a private message; its handler revalidates at once

```ts
// shop/payload/hooks/product-changed.ts: shop's hook, in catalog's config; runs inside the editor's save
export const productChanged =
  (courier: Courier<ShopServices>): CollectionAfterChangeHook<ProductDoc> =>
  async ({ doc }) => {
    await courier.read().requestPageRevalidation({ productId: doc.id, slug: doc.slug })
    return doc
  }

// shop/service/request-page-revalidation.ts: records a private message, nothing else
export const createRequestPageRevalidation =
  ({ outbox, transaction }: Deps): RequestPageRevalidation =>
  (input) => transaction.run((tx) => outbox.write(revalidateProductPage(input), tx))

// shop/service/revalidate-product-page.ts: called by shop's handler of RevalidateProductPage
export const createRevalidateProductPage =
  ({ pages, clock }: Deps): RevalidateProductPage =>
  async ({ slug, writtenAt }) => {
    if (givesUpWaiting(writtenAt, clock.now())) return            // shop's rule for a confirmation that does not come
    await pages.revalidate(`/products/${slug}`)                   // confirms nothing: no read of catalog's committed state
  }
```

The Statement met: "The use case it calls MUST NOT change this system beyond recording a tentative
operation." The use case the hook calls writes one private message. The Why names "a private message
for a handler that checks the external system's committed state" as a tentative operation, and the
handler is a different use case, outside this Scope.

The Why's harm: "The external system has not committed when it calls: its change can still roll back
after the hook returns […]. A change there that takes the external change as done, a record updated, a
page revalidated, a published event, stands for a change a rollback undoes."

How: shop's transaction commits at once, and the relay hands the message on within milliseconds, while
Payload's save is still running. The page rebuilds from the old price and stays stale until its next
revalidation. Whether the message is tentative depends on its handler, and the Statement judges only
the hook's use case.

### tx-30-breach-overdue-payment-abandoned-without-asking-stripe.md

```yaml
breaches: [TX-30]
satisfies: [TX-1, TX-6, SVC-7, DRV-1]
situation: Stripe stops resending a webhook after three days
finding: adversarial
```

# Payment's rule abandons an unanswered payment without asking Stripe

```ts
// payment/domain/payment.ts: business rule: an hour without Stripe's answer, the payment is abandoned
export const whenAnswerOverdue = (p: Payment, now: Date): Payment =>
  p.status === "pending" && new Date(p.answerDueBy) < now ? { ...p, status: "abandoned" } : p

// payment/service/abandon-overdue-payments.ts: called by a scheduled task, one use case over the batch
export const createAbandonOverduePayments =
  ({ transaction, payments, outbox, clock }: Deps): AbandonOverduePayments =>
  () =>
    transaction.run(async (tx) => {
      for (const payment of await payments.overdue(clock.now(), tx)) {
        const next = whenAnswerOverdue(payment, clock.now())
        await payments.save(next, tx)
        await outbox.write(paymentFailed(next), tx)                     // shop cancels the order on it
      }
    })
```

The Statement met: "A business rule of this system MUST decide what happens when the confirmation or
answer does not come." A rule in payment's domain decides.

The Why's harm: "Waiting decides nothing, and what it leaves is a state a customer finds: payment still
pending for a webhook Stripe stopped sending, while the card was charged".

How: the webhook endpoint is down while Stripe charges the card. The rule marks the payment abandoned,
shop cancels the order, and fulfillment releases the stock, while the money stays at Stripe. The Why
offers "accepting the state as it stands" only for "a PaymentIntent nobody confirmed and that changes
nothing". The Statement accepts any rule, including one that assumes nobody confirmed without asking.

### tx-21-breach-in-memory-bus-relay-marks-on-handover.md

```yaml
breaches: [TX-20, TX-21]
satisfies: [DRV-7, TX-5, ASM-5]
situation: the common library's relay and bus; fulfillment's worker reserves stock on OrderPlaced
finding: adversarial
```

# The bus keeps messages in memory; the relay marks a message once the bus has it

```ts
// common/messaging/bus.ts
export const createBus = ({ handlers }: { handlers: Handler[] }): Bus => {
  const pending: Message[] = []                                         // kept until a handler acknowledges
  setInterval(async () => {
    for (const message of [...pending]) {
      try {
        await Promise.all(handlers.filter((h) => h.accepts(message)).map((h) => h.handle(message)))
        pending.splice(pending.indexOf(message), 1)                     // acknowledged: dropped
      } catch { /* stays pending: delivered again on the next tick */ }
    }
  }, 500)
  return { hand: async (message) => { pending.push(message) } }         // resolves once the bus has it
}

// common/messaging/relay.ts
for (const message of await reader.unhanded()) {
  await bus.hand(message)                                               // handed: at least once
  await reader.markHanded(message.id)                                   // marked after the bus has it
}
```

The Statements met. TX-20: "It MUST hand it to the bus at least once." The relay marks only after
`hand` resolves. TX-21: "It MUST keep the message, and deliver it again, until the handler acknowledges
it."

The Why's harm. TX-20: "A relay that marks the message before the bus has it loses it when the process
dies between the two, and the change it tells of reaches nobody." TX-21: "A handler fails, a process
dies mid-message, a store is briefly down. Delivered once, the message is lost with the attempt".

How: the worker is deployed while `OrderPlaced` waits in `pending`. The message is marked in the
outbox, the bus's memory is gone, and the stock is never reserved. Neither Statement says the bus keeps
the message where a stop of the process does not reach it.

### tx-7-breach-order-placed-gains-optional-paid-by-invoice.md

```yaml
breaches: [TX-7]
satisfies: [SYS-2, TX-6, DRV-7]
situation: checkout also offers pay-by-invoice; OrderPlaced says so; billing invoices it and fulfillment ships it on that message
finding: adversarial
```

# Pay-by-invoice ships as an optional field on `OrderPlaced`

```ts
// shop/published/messages.ts: the change that ships pay-by-invoice
export const orderPlacedSchema = z.object({
  id: z.string().uuid(), type: z.literal("OrderPlaced"), orderId: z.string(),
  lines: z.array(orderPlacedLineSchema),
  paidByInvoice: z.boolean().optional(),               // added: optional, so old readers parse it and new readers parse old ones
})

// billing/driving/handlers.ts: old code, still running in a worker not yet restarted
export const buildBillingHandlers = ({ issueInvoice }: BillingServices) => ({
  OrderPaid: async (message: OrderPaid) => { await issueInvoice(message) },   // invoices on OrderPaid only
})
// fulfillment, old code: reserves on OrderPlaced, ships on OrderPaid
```

The Statement met: "The change MUST keep what old code writes readable by new code, and what new code
writes readable by old code, each field keeping its meaning." Every field keeps its meaning, and the
Why agrees: "An optional field added or removed keeps both directions".

The Why's harm: "A handler still on old code, in a process not yet restarted, reads one written by new
code."

How: new shop places an invoice order, and an old worker handles `OrderPlaced`. Old billing has no
handler for it, and old fulfillment reserves and waits for `OrderPaid`. Both acknowledge. Shop sends no
`OrderPaid` until `InvoicePaid`, and no invoice exists to be paid, so nothing is invoiced, nothing
ships, and shop's deadline does not apply. Each field keeps its meaning, while the message as a whole
no longer does.

### tx-17-breach-order-placed-split-per-consumer.md

```yaml
breaches: [TX-17]
satisfies: [TX-6, SYS-2, TX-32]
situation: shop places the order; billing invoices, fulfillment reserves
finding: adversarial
```

# Shop publishes one `OrderPlaced` per consumer, naming none

```ts
// shop/published/messages.ts
export const orderPlacedForInvoicingSchema = z.object({
  id: z.string().uuid(), type: z.literal("OrderPlacedForInvoicing"), orderId: z.string(),
  lines: z.array(z.object({ sku: skuSchema, unitPrice: moneySchema, taxClass: z.enum(["tea", "accessory"]) })),
})
export const orderPlacedForReservationSchema = z.object({
  id: z.string().uuid(), type: z.literal("OrderPlacedForReservation"), orderId: z.string(),
  lines: z.array(z.object({ sku: skuSchema, quantity: z.number().int().positive() })),
})

// shop/service/place-order.ts
await outbox.write(orderPlacedForInvoicing(order), tx)
await outbox.write(orderPlacedForReservation(order), tx)
```

The Statement met: "Its code MUST NOT name a system that handles it." No system is named.

The Why's harm: "A publisher that names its handlers changes whenever a system starts or stops
listening, and imports what it names, so the dependency runs from upstream to downstream, against the
one the published language establishes."

How: each event is shaped for one consumer's use. When the 3PL article master or a dashboard wants the
order, shop adds a third event and a third outbox write. Shop changes whenever a system starts
listening, with no system named.

### tx-33-breach-billing-handles-payments-private-refund-request.md

```yaml
breaches: [TX-33]
satisfies: [TX-17, SYS-9, TX-5]
situation: billing issues a credit note for each refund; payment refunds when shop asks, but Stripe may still fail the refund
finding: adversarial
```

# Billing subscribes to payment's private `StripeRefundRequested`

```ts
// apps/worker/assembly.ts
bus.subscribe("StripeRefundRequested", payment.handlers.StripeRefundRequested)   // payment's private message (TX-22)
bus.subscribe("StripeRefundRequested", billing.handlers.RefundRequested)         // billing listens in

// billing/driving/refund-requested.ts: billing's own schema of the message; nothing imported from payment
const refundRequestedSchema = z.object({
  id: z.string().uuid(), type: z.literal("StripeRefundRequested"), orderId: z.string(), amount: moneySchema,
})
export const refundRequestedHandler = (issueCreditNote: IssueCreditNote) =>
  async (raw: unknown) => { await issueCreditNote(refundRequestedSchema.parse(raw)) }
```

The Statement met: "It MUST be a handler of the system whose published language declares the command."
The Scope, "a handler is subscribed to a published command", does not hold, because the message is
private. The rule says nothing.

The Why's harm: "Another system's handler that acts on it acts on a request as if it were done: billing,
subscribed to payment's `RefundPayment`, issues a credit note for a refund payment refused on a disputed
charge." Also: "a second system's handler breaks where the receiver changes it."

How: Stripe refuses the refund and payment records the failure, while billing has already issued the
credit note and spent a gapless number. When payment renames a field of its private message, billing's
parse fails, with no contract to tell it. A private message is "meant only for the system that wrote
it" (glossary), and no Statement keeps another system's handler off one.

### sys-2-breach-published-status-generated-from-domain.md

```yaml
breaches: [SYS-2]
satisfies: [SYS-14, SYS-10]
situation: shop's published OrderPlaced and OrderCancelled carry the order's status
finding: adversarial
```

# Tooling copies the domain's status enum into the published language on every build

```ts
// tools/generate-published.ts: tooling: runs in no process of the deployed application
import { orderStatusSchema } from "../shop/domain/order"
import { writeFileSync } from "node:fs"

writeFileSync(
  "shop/published/order-status.generated.ts",
  `import { z } from "zod"\nexport const orderStatusSchema = z.enum(${JSON.stringify(orderStatusSchema.options)})\n`,
)

// shop/published/order-status.generated.ts: what the published language holds; imports zod only
import { z } from "zod"
export const orderStatusSchema = z.enum(["open", "paid", "cancelled"])
```

The Statement met: "The modules that declare it MUST NOT import the domain." The published module
imports zod. Tooling "sits outside the layers and the rules" (Assumptions).

The Why's harm: "A published language that re-exports the domain's schemas, picks from them, extends
them or re-uses a domain enum is the domain: every refactoring of the model is a change to the contract,
and the contract then keeps both directions readable for changes nobody made to it."

How: shop adds `awaiting-invoice` to its domain, the build regenerates the contract, and billing's and
fulfillment's parsers reject the new value. The rule's own Why says "Any of these needs the import, so a
linter holds the rule". A generator needs no import.

### tst-5-breach-adapter-test-pushes-schema-from-adapter-tables.md

```yaml
breaches: [TST-5]
satisfies: [TST-6, TST-8]
situation: shop's Drizzle order repository
finding: adversarial
```

# The repository's integration test builds the tables from the adapter's own definitions

```ts
// shop/test/drizzle/order-repository.test.ts: integration test
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import { pushSchema } from "drizzle-kit/api"
import * as tables from "../../src/drizzle/tables"                       // the adapter's idea of the store

let container: StartedPostgreSqlContainer
let db: Database

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16").start()
  db = createDatabase(container.getConnectionUri())
  await (await pushSchema(tables, db)).apply()                          // not shop/migrations/*.sql, which production runs
})

it("should load the order it saved", async () => {
  // given
  const orders = drizzleOrderRepository(db)
  // when
  await db.transaction((tx) => orders.save(anOrder({ status: "awaiting-invoice" }), tx))
  // then
  expect(await db.transaction((tx) => orders.byId(anOrder().id, tx))).toEqual(anOrder({ status: "awaiting-invoice" }))
})
```

The Statement met: "The test MUST NOT replace what the adapter talks to with a double." It talks to
real Postgres in a container.

The Why's harm: "A test of one against a double of that thing passes when the double agrees with the
adapter's idea of it, which is exactly what is in doubt."

How: production's migration has a check constraint on `status` without `awaiting-invoice`, and the
table definitions do not. The test passes against a database the adapter shaped itself, and production
fails on insert. Real software arranged by the adapter's idea of the store acts as a double.

### tst-6-breach-contract-suite-skips-stale-save.md

```yaml
breaches: [TST-6]
satisfies: [TST-4, TST-8]
situation: shop's payment and its deadline arrive together; the service's tests stand on the fake OrderRepository
finding: adversarial
```

# One contract suite for `OrderRepository`, with no stale save in it

```ts
// shop/test/service/ports/order-repository.contract.ts: run against the fake by default, the real adapter by flag
export const orderRepositoryContract = (make: () => Promise<{ orders: OrderRepository; transaction: Transaction }>) => {
  it("should load the order it saved", async () => { /* given, when, then */ })
  it("should return null for an unknown id", async () => { /* given, when, then */ })
  // no case: save of an order loaded before another save committed
}

// shop/test/fakes/order-repository.ts: the fake compares versions, as TX-23 asks
save: async (order) => { if (store.get(order.id)?.version !== order.version) throw new ConcurrentChange(order.id); /* … */ }

// shop/src/drizzle/order-repository.ts: the real adapter forgot the version in its where clause
save: (order, tx) => tx.update(orders).set(toRow(order)).where(eq(orders.id, order.id))
```

The Statement met: "One contract suite MUST be written against the port and run against both."

The Why's harm: "The service tests stand on the fake; the run against the fake is what stops it from
drifting into a fiction that passes while production breaks."

How: the service test "cancel fails when payment saved first" passes on the fake. In production the
later save wins, and `OrderPaid` and `OrderCancelled` are both published. The suite is one and runs
against both, and what it leaves out, the fake and the real adapter are free to differ on.

## Rules that held

- DOM-3: a second statement of a shape breaks the letter. Building without parsing states nothing again, so no harm in its Why's sense could be shown.
- DOM-4: holding the other's whole record breaks the letter. A "snapshot" written back to the other's records is caught by SVC-4.
- SVC-1: wherever a port is declared outside the service layer, the letter breaks. A port sharing a module with a service is in Notes.
- DRV-3: every way to reach what it calls without the courier imports a service or an adapter, which DRV-8 catches.
- ASM-1: two store clients from one assembly go to different systems' stores, which is no harm the Why names that I could show.
- ASM-2: building in place, or exporting a ready-made instance, breaks the letter, SYS-1 or DRV-8.
- ASM-10: a SHOULD with "nothing breaks" in its Why, so there was no harm to bring about.
- ASM-7: a permission. Behavior read from telemetry leaves its Scope, and ASM-3 then applies.
- ASM-4: every reader that is not a driving adapter breaks the letter.
- ASM-8: filling by anything but assembly breaks the letter, and a system builder counts as assembly.
- ASM-9: a transaction kept in an adapter's field is no longer handed "to each call", which breaks TX-1.
- ASM-6: every model-shaped thing in the library is a schema, an aggregate or a business rule.
- TX-15: a SHOULD whose Why says "nothing ends up wrong".
- TX-29: a message written outside Payload's `req` is not "that message", which breaks the letter.
- TX-35: a written rule that accepts the state is allowed by its Why, so no half that no rule allows remained.
- TX-6: a message outside the transaction breaks the letter. The relay reads committed writes only (Assumptions).
- TX-5: a check-then-insert claim is not idempotent under overlap, which breaks the letter.
- TX-19: parking an early cancel until it is dropped breaks "the same result whatever order".
- TX-32: a version borrowed from another thing is not "a version of what it tells of".
- TX-34: committing a non-refusal as a refusal satisfies it, but the harm that results is DRV-7's (see its finding).
- TX-12: every way into another system's store that I tried is a read not mediated by its open host service.
- TX-26: a push answered to a subscription is not "what the owner returns".
- TX-27: a business rule that accepts is what the Statement asks for.
- SYS-1: a builder returning a repository got past it, but TX-12 or TX-3 caught every use I tried.
- SYS-9: re-exporting the inside through an export path breaks SYS-1.
- SYS-10: type-only port exports load nothing, and SYS-14 bounds the rest.
- SYS-13: a sender-shaped command declared by the receiver is the receiver's own choice.
- SYS-12: code in catalog's config is named among "its own ways in".
- TST-3, TST-10, TST-4, TST-8, TST-12, TST-11, TST-7: a SHOULD with no MUST-level harm, or (TST-8) a flag that is the remedy itself.

## Relies-on findings

- **SVC-2**, line "DRV-8: a driving adapter reaches its system through driving ports, importing no
  driven port, driven adapter or service of it." DRV-8's Scope and Statement: "a driving adapter imports
  a module" / "The import MUST be one of: the framework that calls it, a driving port of its system,
  its system's domain, a shared kernel, its system's published language, the common library, a library
  that computes from its arguments." Beyond them: "reaches its system through driving ports". DRV-8
  bounds imports, not what the adapter reaches. A driving adapter can reach a repository through the
  courier (drv-8 finding above), or the store through the common library's pool (the svc-7 breach
  example says "Every import is on DRV-8's list").
- **SVC-4**, line "TX-2: a driven adapter that writes to a store writes inside the transaction it is
  handed." TX-2's Scope and Statement: "a driven adapter is handed a transaction" / "Each call it makes
  into its store MUST run inside that transaction." Beyond them: "a store", any store. TX-2 binds only
  "its store", and a write to a second store is outside it (tx-2 finding above).
- **SVC-4**, line "DRV-8: a driving adapter imports a driving port of its system, and no repository."
  DRV-8's Statement allows a driving port and does not require one. Beyond it: "imports a driving port".
  The "no repository" half holds by the closed list.
- **TX-22**, line "TX-6: a message about a change commits in the transaction that commits the change."
  TX-6's Scope and Statement: "a use case writes a message about a change it makes" / "It MUST write the
  message in the transaction that commits the change." Beyond them: any message about any change.
  TX-22's message is about a change the use case does not make ("The use case that decides the change
  writes a message instead of making it"), so TX-6's Scope does not hold. TX-28's Why says so itself:
  "TX-6 binds a message to a change the use case makes". TX-1, each call into its store in one
  transaction, is what holds the message to the decision.
- **TX-3**, same TX-6 line. TX-3's message asks the owner for a change this use case does not make
  ("this system at most asks for it"). The same excess as above.
- **TX-15**, same TX-6 line. The message carries "each write it does not rely on" to a handler, a write
  this use case does not make. The same excess as above.
- **TX-22**, line "TX-31: a use case called for a message passes the external system a key the message
  carries, where the external system takes one." TX-31's Statement: "It SHOULD pass a key the message
  carries." Beyond it: the line states a default as a guarantee and drops "by default", as SVC-2's
  TX-24 line and SVC-4's TST-4 line write it.
- **TST-6**, line "TST-4: a service's test hands it fakes for its driven ports." TST-4's Statement:
  "The test SHOULD hand it fakes for its driven ports." Beyond it: "by default" is missing (compare
  SVC-4's line "TST-4: by default, a service's test hands it fakes for its driven ports.").

## Notes

- DRV-7 lines in TX-15, TX-3, TX-22, TX-31, TX-35, TX-34 and TX-21 read "a handler acknowledges a message
  once the use case it calls has succeeded, not before". DRV-7's Statement is "It MUST NOT acknowledge it
  unless the use case it calls has succeeded": it forbids an early acknowledgement and requires none
  after success. I could not decide whether "once" claims that the acknowledgement happens. TX-34's Why
  depends on it ("it has succeeded, and the handler acknowledges").
- "acting call" (DRV-1) is not in the glossary. The glossary has "Each use case either acts or answers",
  without saying which a use case is when it writes nothing of its own system but makes another system
  write. The drv-1 finding hangs on that.
- "tentative operation" (TX-28): glossary, "It changes nothing it asks for: its confirmation does."
  Whether a private message is one depends on its handler, a use case outside TX-28's Scope. The tx-28
  finding hangs on that.
- ASM-3's Scope, "a service, or a driven adapter a service calls, reads an ambient value": I could not
  decide whether a domain function the service calls counts as the service reading. If it does, the
  asm-3 finding breaks the letter and is no adversarial finding.
- TX-33's Scope, "a handler is subscribed to a published command": the tx-33 finding escapes the Scope
  rather than meeting the Statement inside it. The harm happens either way.
- DRV-8 finding and TX-1: TX-1's Scope is "a use case writes" and its Statement "Its service MUST run
  it". I could not decide whether a server action's cancel, with no service behind it, is "a use case"
  under the glossary ("One goal a caller can reach through the system"). If it is, TX-1 breaks by its
  letter.
- DOM-1's "a library that computes from its arguments": I could not decide whether a runtime's built-in
  module (`node:crypto`) is "a library". The dom-1 finding assumes it is.
- No Statement places a business rule in the domain except DOM-3's, for shapes. The glossary says the
  service "holds no business rule of its own", and SVC-2's Why says the service "asks the domain's
  specification, which decides". An inline `if (stock.available < quantity)` in a service meets SVC-2's
  Statement, "The service that acts MUST enforce the decision itself". I found no Why whose harm it
  causes beyond P2's, so it is not a finding.
- Owner and TX-3: the glossary makes the owner "The system whose business rules decide what a record
  holds". If billing offers `SetDunningStage` and its use case only saves, shop's rule decides the stage
  and shop becomes its owner by definition, so TX-3's Scope no longer holds. The fixture says billing
  owns it. Whether the fixture's ownership or the definition wins decides whether this is a finding.
- SVC-1: a port declared in the service layer in the same module as a service ("One home for both lets
  the import lists of each layer be checked by path") can be imported by a driven adapter as a type and
  passes a path-based check. DVN-4 lists "the port it implements", and a type-only import of that module
  does not decide it. I could not show the Why's harm, a domain changing when a use case is added, so
  it is not a finding.
- SYS-10 relies on SVC-1 and SYS-2, while what keeps a published-language module from importing a
  service or an adapter of its system is SYS-14, which SYS-10 does not name. A missing line, so not a
  Relies-on finding as the task defines one.
