# Gap review, distilled set

## Summary

- `gap-pay-by-invoice-decided-on-billing-live-answer.md`: checkout decides pay-by-invoice on billing's dunning stage read live through billing's open host service; no Scope asks whether that answer still holds at commit.
- `gap-payload-admin-reads-fulfillment-stock-table.md`: catalog's config shows fulfillment's stock by querying fulfillment's table in the shared Postgres; no Scope reaches config that reads a system's records.
- `gap-invoice-vat-rate-decided-in-service.md`: billing's service maps tax class to VAT rate inline; no Scope places a business rule that is not about a record's shape.
- `gap-bank-transfer-applied-on-every-poll.md`: billing applies polled bank transfers again on every overlapping poll; TX-5 holds only for delivered messages.
- `gap-unmatched-bank-transfer-dropped.md`: a transfer that matches no invoice is dropped by an early return; no Scope asks a business rule to decide what follows.
- `gap-health-probe-imports-ready-made-pool.md`: `/health` imports a ready-made pool instance; no Scope says how a probe reaches the store, and ASM-4 shuts the courier.
- `gap-trace-context-crosses-outbox.md`: the outbox and bus carry request id and trace context across systems; no Scope reaches what crosses besides the transaction.
- `gap-instrumentation-imported-after-assembly.md`: an entry point loads assembly before auto-instrumentation; no Scope orders what a process loads first.

## Findings

### gap-pay-by-invoice-decided-on-billing-live-answer.md

```yaml
breaches: []
satisfies: []
situation: checkout offers pay-by-invoice, not to a customer billing has put into dunning; shop calls billing's open host service in-process
finding: gap
```

# Checkout refuses pay-by-invoice by billing's live answer, then commits on it

```ts
// shop/service/place-order.ts
export const createPlaceOrder = ({ billing, orders, outbox, transaction }: Deps): PlaceOrder =>
  async ({ customerId, lines, payment }) => {
    if (payment === "invoice") {
      const { stage } = await billing.dunningStageOf({ customerId })     // driven port onto billing's open host service (TX-12)
      if (!mayPayByInvoice(stage)) return { refused: "in-dunning" }       // shop's domain
    }
    return transaction.run(async (tx) => {                                // billing's answer is not in this transaction (P16)
      const order = placeOrder({ customerId, lines, payment })
      await orders.save(order, tx)
      await outbox.write(orderPlaced(order), tx)                          // paid by invoice: billing invoices, fulfillment ships
      return { orderId: order.id }
    })
  }
```

The scheduled dunning run raises the customer to `reminder` between billing's answer and shop's
commit. The order commits on invoice, and fulfillment ships to a customer in dunning. The code
decided that an answer from another system, read before the transaction, still holds when the
order commits. Kept as a replica, the same lag would fall under TX-27; read live, it falls under no
Scope.

- TX-24, *Scope:* "a use case decides by what this system has stored, other than a replica, and the
  decision has to hold when the use case commits". The dunning stage is stored by billing, not shop.
- TX-27, *Scope:* "a use case decides by a replica." Shop keeps nothing: the answer is not "a copy
  of another system's data, kept under the owner's ids" (glossary: Replica).
- TX-12, *Scope:* "a use case of this system reads data another system owns." It holds, and the
  code meets it: billing's open host service. Its Statement says where to read, not whether the
  read still holds at commit.
- TX-30, *Scope:* "this system holds a tentative operation, or waits on another system's answer."
  It holds for an answer that does not come. Here the answer came, and went stale.
- SVC-2, *Scope:* "a use case decides by what this system has stored". Billing's stage is not this
  system's.

### gap-payload-admin-reads-fulfillment-stock-table.md

```yaml
breaches: []
satisfies: []
situation: editors see each product's stock in Payload's admin, read-only; fulfillment owns it
finding: gap
```

# Catalog's config reads fulfillment's stock table for a read-only field

```ts
// catalog/collections/products.ts — catalog's config
fields: [
  {
    name: "stock", type: "number", virtual: true,
    admin: { readOnly: true },
    hooks: {
      afterRead: [
        async ({ siblingData, req }) => {
          const { rows } = await req.payload.db.drizzle.execute(
            sql`select available from stock where sku = ${siblingData.sku}`,    // fulfillment's table, in the shared Postgres
          )
          return rows[0]?.available ?? 0
        },
      ],
    },
  },
]
```

The config decided where catalog gets fulfillment's data: fulfillment's table, by name. When
fulfillment renames `available` or splits stock by warehouse, the admin breaks or shows a wrong
number, though fulfillment's open host service did not change. The rules reach the parts of an
external system's config that touch a system, but the Assumptions name only two such parts, and
reading is neither: "the parts of its configuration that touch the system: what may change the
system's records it keeps (SYS-12), how it tells the system of a change (TX-29)."

- TX-12, *Scope:* "a use case of this system reads data another system owns." Catalog's config is
  not a use case of a system of this codebase: "An external system sits outside the rules".
- SVC-7, *Scope:* "a service or a driving adapter reaches the outside". The field hook is catalog's
  config. It is no driving adapter of fulfillment's, since it calls no code of fulfillment's.
- SYS-12, *Scope:* "a record this system owns is kept by an external system." Fulfillment keeps
  stock in its own tables, not Payload's.
- TX-26, *Scope:* "a replica is written." Nothing is written: the field reads live.
- SYS-9, *Scope:* "code outside a system imports from it." Nothing is imported. The table name sits
  in an SQL string.

### gap-invoice-vat-rate-decided-in-service.md

```yaml
breaches: []
satisfies: []
situation: each invoice line needs its VAT rate, which follows from the tax class on the order's line: 7% for tea, 19% for accessories
finding: gap
```

# Billing's service decides the VAT rate inline

```ts
// billing/service/issue-invoice.ts — called by billing's handler of OrderPaid
export const createIssueInvoice = ({ transaction, handled, invoices }: Deps): IssueInvoice =>
  (event) =>
    transaction.run(async (tx) => {
      if (!(await handled.claim(event.id, tx))) return
      const lines = event.lines.map((line) => ({
        ...line,
        vatRate: line.taxClass === "tea" ? 7 : 19,                         // the VAT rule, in the service
      }))
      await invoices.save(newInvoice(event.orderId, lines), tx)
    })
```

The service decided the tax rule: which rate a tax class takes, and that any class not `tea` takes
19. The credit-note service needs the same rule and writes it again. When a third class arrives,
one of the two copies is missed (F2, F3). The glossary says a service "holds no business rule of its
own", and P2 says "A business rule lives in one place: the domain". But a glossary entry and a
property are not rules, and no rule's Scope holds for a business rule in general.

- DOM-3, *Scope:* "a business rule about the shape of a record: which fields it has, what each
  holds, which values a status takes." The line's schema can say `vatRate` is 7 or 19. Which rate
  a tax class takes is a rule about tax, not about shape.
- ASM-10, *Scope:* "a factory needs something the same in every instance, process and test: a
  domain function, a schema, a constant." It holds for the service's factory. Its Statement, "It
  SHOULD import it.", is silent on where the rule lives, and an inline literal imports nothing.
- SVC-2, *Scope:* "a use case decides by what this system has stored". The tax class arrives on
  shop's message. Billing has not stored it.
- TST-3, *Scope:* "a business rule is tested." It holds only once the rule is tested, and it asks
  for a call to a domain function the code does not have.
- TX-27, TX-30, TX-35: each Statement asks that "a business rule ... decide". Their Scopes are a
  replica, a wait, and a refusal. None of them is a VAT rate.

### gap-bank-transfer-applied-on-every-poll.md

```yaml
breaches: []
satisfies: []
situation: the bank API reports incoming transfers in the bank's terms; billing matches them to open invoices
finding: gap
```

# A scheduled task polls the bank's last 24 hours every ten minutes and applies each transfer again

```ts
// billing/service/import-bank-transfers.ts — called by a scheduled task every ten minutes
export const createImportBankTransfers = ({ bank, invoices, outbox, transaction, clock }: Deps): ImportBankTransfers =>
  async () => {
    const transfers = await bank.transfersSince(subHours(clock.now(), 24))   // driven port, billing's terms
    for (const transfer of transfers) {
      await transaction.run(async (tx) => {
        const invoice = await invoices.openByReference(transfer.reference, tx)
        if (!invoice) return
        const next = applyTransfer(invoice, transfer.amount)                   // domain: paid, or open with the rest due
        await invoices.save(next, tx)
        if (next.status === "paid") await outbox.write(invoicePaid(next), tx)
      })
    }
  }
```

Each transfer comes back on every poll inside its 24 hours. A full payment closes the invoice, so
the next poll finds no open invoice for it. A short payment leaves the invoice open, so each later
poll subtracts it again until the invoice reads paid, and `InvoicePaid` goes out for money the
customer still owes. The code decided not to record which transfers it has applied. Billing calls
the bank (glossary, External system: "driven through its API"), so the bank's answer is no
delivered message, and no Scope asks that a repeat change nothing.

- TX-5, *Scope:* "a use case is called for a delivered message." A scheduled task's tick calls
  this use case, and the transfers are what the bank returns to billing's own call.
- TX-19: same Scope as TX-5, and it does not hold for the same reason.
- SVC-2, *Scope:* "a use case decides by what this system has stored: ... whether the order is still
  open." It holds for `openByReference`, and the code meets it. A short payment leaves the invoice
  open, so the check passes each time.
- TX-23 / TX-24 hold for the invoice's save. They stop a concurrent change, not a repeated one.
- DRV-1, *Scope:* "a driving adapter handles one call from its caller: a request, a message, a
  tick." It holds for the scheduled task and is met: one acting call per tick.

### gap-unmatched-bank-transfer-dropped.md

```yaml
breaches: []
satisfies: []
situation: some bank transfers match no open invoice: a wrong reference, an amount short
finding: gap
```

# A transfer with a wrong reference is dropped

```ts
// billing/service/import-bank-transfer.ts — one transfer, inside the scheduled import
(transfer) =>
  transaction.run(async (tx) => {
    if (await applied.has(transfer.bankRef, tx)) return
    await applied.add(transfer.bankRef, tx)
    const invoice = await invoices.openByReference(transfer.reference, tx)
    if (!invoice) return                                                       // matches none: nothing recorded
    await invoices.save(applyTransfer(invoice, transfer.amount), tx)
  })
```

The customer paid and typed the wrong reference. Billing marks the transfer applied and records
nothing else, so dunning keeps raising the stage of a customer who paid. The early return decided
that money matching no invoice is ignored. Where a payment comes for an order shop has cancelled,
TX-35 demands a business rule. Where a transfer comes for no invoice, no Scope does.

- TX-35, *Scope:* "a use case is called for an event that tells this system its part of work
  spanning systems cannot go on as it stands: a command it sent was refused, a payment came for an
  order it has cancelled." The transfer is no event delivered to billing, since billing polls for
  it. It also names no part of billing's work, because its reference matches nothing.
- TX-30, *Scope:* "this system holds a tentative operation, or waits on another system's answer."
  It holds for the open invoice that waits on the customer's payment, and dunning answers it for
  when that payment does not come. Here a payment came.
- SVC-2: its Scope holds for the lookup by reference, and its Statement places the check in the
  acting call. It is silent on what follows a miss.

### gap-health-probe-imports-ready-made-pool.md

```yaml
breaches: []
satisfies: []
situation: /health pings the database
finding: gap
```

# The health probe imports a ready-made pool at module load

```ts
// apps/server/app/health/route.ts — a probe, found and called by Next.js
import { pool } from "@teeladen/common/postgres"                 // a ready-made store client, built when the module loads

export async function GET() {
  await pool.query("select 1")
  return Response.json({ ok: true })
}
```

The probe decided how it reaches the store: a pool instance built at import, outside assembly, with
its own configuration read from the environment. The framework finds the probe, so assembly cannot
construct it. A driving adapter in that position reads the courier (DRV-3), but ASM-4 keeps the
courier from a probe. That leaves the module-level instance, and no Scope reaches it. In the
Assumptions, probes sit "outside the layers", not outside the rules.

- SVC-7, *Scope:* "a service or a driving adapter reaches the outside". A probe is neither. It is
  "Code a process runs to report on itself rather than on a system" (glossary: Probe).
- ASM-4, *Scope:* "code reads the courier." The Scope does not hold, since the probe does not read
  it. If the probe did read it, the Statement would forbid it: "It MUST be a driving adapter".
- ASM-2, *Scope:* "a factory needs a port's implementation, a store client". The route module is
  no factory, and nothing calls it with arguments.
- ASM-7, *Scope:* "plumbing of the common library whose output changes nothing the system does or
  returns: a logger, a tracer." A store client's output is what systems read and write, so the
  Scope does not hold, and the MAY does not apply.
- DRV-3 / DRV-6: their Scopes are driving adapters.

### gap-trace-context-crosses-outbox.md

```yaml
breaches: []
satisfies: []
situation: request id and trace context should cross system boundaries; the transaction must not
finding: gap
```

# The outbox carries request id and trace context; the bus restores them around the handler

```ts
// common/outbox/drizzle-outbox.ts — common library
write: (message, tx) => {
  const headers: Record<string, string> = { requestId: requestContext.get()?.requestId ?? message.id }
  propagation.inject(context.active(), headers)                               // traceparent of the request that wrote it
  return tx.insert(outbox).values({ id: message.id, type: message.type, payload: message, headers })
}

// common/bus/bus.ts — common library
const deliver = (row: OutboxRow, handler: Handler) =>
  context.with(propagation.extract(ROOT_CONTEXT, row.headers), () =>
    requestContext.run({ requestId: row.headers.requestId }, () => handler(row.payload)))
```

The code decided three things: what a message carries besides its payload, that the bus sets
per-request ambient values for the handler, and from where. Without it, the handler runs in an
empty context, and "OpenTelemetry ... returns a no-op span when it is empty". The fixture's sentence
has two halves. Rules place the second half, the transaction. No Scope reaches the first.

- ASM-9, *Scope:* "a transaction." It covers the half that must not cross, and only that half.
- TX-25, *Scope:* "a system declares a driving port." It keeps the transaction from crossing an
  in-process call. It says nothing of request id or trace.
- ASM-3, *Scope:* "a service, or a driven adapter a service calls, reads an ambient value". It holds
  for the outbox adapter's read, and its Statement is met. It does not reach whether the value
  crosses, or who sets it on the receiving side. The bus is common library, not a driven adapter a
  service calls.
- TX-7, *Scope:* "the schema of a message changes". It holds once `headers` is added, and asks only
  that old and new code read each other.
- TX-31 / TX-32 name what a message carries in their Scopes: a key, a version. Neither covers a
  trace.

### gap-instrumentation-imported-after-assembly.md

```yaml
breaches: []
satisfies: []
situation: auto-instrumentation must load before any other import
finding: gap
```

# The worker's entry point loads assembly before instrumentation

```ts
// apps/worker/main.ts — the worker's entry point, its own assembly
import { buildAssembly } from "./assembly"           // loads fulfillment, drizzle, pg, the relay
import "./instrumentation"                           // registers OTel auto-instrumentation: pg and http already loaded, left unpatched

await buildAssembly(process.env).start()
```

The entry point decided what loads first. Here it decided wrongly, and every span of the worker's
database and HTTP calls is missing. The process has an assembly, as ASM-1 asks. No Scope orders
what loads before it.

- ASM-1, *Scope:* "a process." It holds. Its Statement, "It MUST have one assembly.", is silent on
  load order.
- ASM-7, *Scope:* plumbing such as "a logger, a tracer". It permits importing a ready-made tracer.
  It is a permission, not an order.
- ASM-8, *Scope:* "the courier." It orders filling before reading for the courier only.
- DRV-6, *Scope:* "a driving adapter reads from a courier." It is about load time, but only for
  courier reads.

## Coverage

| situation | rules whose Scope holds |
| --- | --- |
| **Systems** | |
| catalog: external system (Payload), owns the product, Payload's tables | TX-12, TX-28, TX-29 at its edges. Its own tables, layers and transactions: none (Assumptions: "An external system sits outside the rules") |
| shop: Cart, Order in shared Postgres via Drizzle | SVC-4, TX-1, TX-2, TX-23, SVC-7, DVN-4, DOM-3, DOM-4, SVC-1 |
| payment: Payment, Refund in shared Postgres | SVC-4, TX-1, TX-2, TX-23, SVC-7, DVN-4, DOM-3 |
| billing: Invoice, dunning stage, gapless invoice numbers | SVC-4, TX-1, TX-23, TX-24 (number counter decided by and saved with the use case), DOM-3 |
| fulfillment: Stock, Reservation, Shipment; own worker process | SVC-4, TX-1, TX-23, TX-24, ASM-1, ASM-8 |
| common library: pino logger | ASM-7, ASM-5, ASM-6 |
| common library: OTel tracer exporting to Jaeger | ASM-7, ASM-3 |
| common library: outbox relay and bus | TX-20, TX-21, ASM-5, ASM-6 |
| common library: Drizzle client factory | ASM-2, ASM-5, ASM-6 |
| common library: unit of work ambient in `AsyncLocalStorage` | ASM-9, TX-1, TX-2 |
| shared kernel: `Money`, `Sku` | SYS-14, DOM-1, SVC-6, DRV-8, DVN-4, TX-7 |
| external systems: Stripe, 3PL, bank API | SVC-7, DVN-4, TX-22, TX-31, TST-5, TST-6, TST-12 |
| mail provider (shop, billing) | SVC-7, TX-22, TX-31, TX-6 |
| **catalog edge cases** | |
| editors set copy, price, sku, tax class; rules in Payload's collection config; `req.user` from Payload's auth | none (Assumptions: "even where this codebase writes its configuration") |
| afterChange hooks call shop's services | TX-28, TX-29, TX-25, DRV-1, DRV-3, DRV-6, DRV-7 (where the hook is a message handler), TX-22 (page cache) |
| beforeChange asks shop how many open orders carry a sku, refuses | TX-28, DRV-1, DRV-3, SVC-7. Catalog's veto: none (Assumptions). See Notes |
| shop reads product, price, tax class through the Local API | TX-12, SVC-7, DVN-4, SVC-6 |
| Payload's own transactions; hook may run inside one; Payload can write to its own collection for the relay | TX-28, TX-29, TX-25, TX-20, ASM-9 |
| editors see each product's stock read-only; fulfillment owns it | none → `gap-payload-admin-reads-fulfillment-stock-table.md` |
| config ↔ hooks ↔ services ↔ Payload cycle | DRV-3, DRV-6, ASM-4, ASM-8 |
| **shop edge cases** | |
| checkout returns Stripe `client_secret` in the same request | SVC-7, TX-25, TX-30, TX-3 (see Notes), DRV-1 |
| pay-by-invoice, not to a customer in dunning, kept as a replica | TX-26, TX-27, TX-32, TX-19, TX-5 |
| pay-by-invoice, decided by billing's live answer | TX-12, TX-30. Whether the answer holds at commit: none → `gap-pay-by-invoice-decided-on-billing-live-answer.md` |
| checkout copies price, sku, tax class from catalog | TX-12, DOM-3 (glossary: Snapshot) |
| order-confirmation mail once the order commits | TX-22, TX-6, TX-5, TX-31 |
| calls billing's OHS in-process while holding its ambient transaction | ASM-9, TX-25, TX-1, TX-3 (if it changes billing's data), TX-12 (if it reads) |
| **payment edge cases** | |
| Stripe behind an anti-corruption layer | DVN-4, SVC-7, SVC-6. Conformist vs ACL: none (Assumptions: "a repository's ADRs decide") |
| creates PaymentIntent on checkout's call, returns `client_secret` | SVC-7, TX-30 (tentative operation), TX-22 (see Notes), DVN-4 |
| webhooks at least once, out of order, Stripe's terms | TX-5, TX-19, DRV-7, DRV-1 |
| Stripe stops resending after three days | TX-30 |
| refunds when shop asks; not a disputed charge | TX-33, TX-34, TX-22, TX-31, TX-5, SVC-2, TX-24 |
| **billing edge cases** | |
| invoice on `OrderPaid`, or on `OrderPlaced` for pay-by-invoice | TX-5, TX-19, DRV-7, SVC-2, TX-24, TX-12 |
| VAT rate from tax class: 7% / 19% | ASM-10 only (Statement silent on placement). Rule placement: none → `gap-invoice-vat-rate-decided-in-service.md` |
| bank API reports transfers in the bank's terms; billing matches | SVC-7, DVN-4, SVC-2, TX-24, TX-23, DRV-1. Repeat on poll: none → `gap-bank-transfer-applied-on-every-poll.md` |
| transfers that match none: wrong reference, amount short | SVC-2 (lookup only). What follows: none → `gap-unmatched-bank-transfer-dropped.md` |
| scheduled dunning; stage rises, clears on payment | DRV-1, SVC-7 (clock), TX-32, TX-6, TX-23, TX-24, TX-22 (reminder mail), TX-30 |
| credit note for each refund | TX-33, TX-17, TX-5, TX-24 |
| **fulfillment edge cases** | |
| reserves on `OrderPlaced`, releases on `OrderCancelled` | TX-5, TX-19, DRV-7, SVC-2, TX-24, TX-35 (stock short) |
| `OrderPaid`/`OrderCancelled` before `OrderPlaced`; dropped cancel | TX-19, TX-21, DRV-7, TX-5 |
| 3PL webhooks in the 3PL's terms | TX-5, TX-19, DRV-7, TX-32 (if fulfillment republishes shipment status) |
| registers each new sku in the 3PL's article master | TX-22, TX-31, TX-29, TX-19 (booking before registration) |
| worker has its own entry point and assembly | ASM-1, ASM-8. Load order: none → `gap-instrumentation-imported-after-assembly.md` |
| **common library edge cases** | |
| OTel ambient context, no-op span when empty | ASM-3, ASM-7 |
| auto-instrumentation loads before any other import | none → `gap-instrumentation-imported-after-assembly.md` |
| request id and trace context cross system boundaries | ASM-3 (read only). Crossing: none → `gap-trace-context-crosses-outbox.md` |
| the transaction must not cross | ASM-9, TX-25 |
| **checkout saga** | |
| 1. place order, publish `OrderPlaced`; fulfillment reserves | SVC-4, TX-1, TX-6, TX-17, TX-5, TX-19, SVC-2, TX-24, TX-35 |
| 2. shop calls payment; returns `client_secret` | SVC-7, TX-25, TX-30, TX-3 |
| 3. Stripe's webhook; payment publishes `PaymentSucceeded`/`PaymentFailed` | TX-5, TX-19, TX-6, TX-17, DRV-7 |
| 4. shop marks paid, publishes `OrderPaid`; billing invoices, fulfillment ships | TX-5, TX-19, TX-6, TX-23, TX-22, TX-31 |
| 5. deadline on Order; on `PaymentFailed` or deadline, cancel, publish `OrderCancelled`; release | TX-30, DRV-1, SVC-7 (clock), TX-23, TX-6, TX-19 |
| 6. pay-by-invoice: invoice and ship on `OrderPlaced`; `InvoicePaid` → `OrderPaid` already acted on | TX-19, SVC-2, TX-24, TX-30, TX-6 |
| 7. payment succeeds after the deadline cancelled; money back | TX-35, TX-3, SYS-13, TX-33, TX-34 |
| **cross-cutting reads** | |
| admin dashboard joins orders, invoices, shipments | TX-12, TX-26, SVC-7 |
| a Payload edit revalidates the cached shop page | TX-28, TX-29, TX-30, TX-22 |
| `/health` pings the database | none → `gap-health-probe-imports-ready-made-pool.md` |
| `/metrics` is scraped | ASM-7 |

## Notes

- File names: the convention `<rule>-<ok|breach>-<slug>.md` has no slot for a finding without a
  rule. I used `gap-<slug>.md`.
- Bank API, polled or pushed: "The bank API reports incoming transfers in the bank's terms." I read
  it by the glossary's "It is driven through its API and driving through its hooks": billing polls.
  If the bank calls a hook instead, TX-5 holds and `gap-bank-transfer-applied-on-every-poll.md` is
  no gap.
- Instrumentation order: the Assumptions exclude "library, framework and file-naming conventions,
  which are the stack document's". OTel's load order may count as a library convention. If it
  does, `gap-instrumentation-imported-after-assembly.md` is placed, not a gap.
- Trace context: no property asks for it, and the world's "Out of scope: throughput and load,
  security, user interfaces." does not exclude it. I could not decide whether rules are meant to
  reach it.
- External config that reads: I could not decide whether the colon in "the parts of its
  configuration that touch the system: what may change the system's records it keeps (SYS-12), how
  it tells the system of a change (TX-29)" lists every case or only examples. The stock finding
  rests on it being every case.
- VAT: DOM-3's "what each holds" may be read to cover a schema tying `vatRate` to `taxClass`. I read
  it as shape only.
- sku veto race: shop's checkout can read the old sku from catalog and commit while catalog's
  beforeChange counts zero open orders and commits the change. TX-28 holds for shop's hook and is
  met. The broken rule is catalog's: "the parts of its configuration that touch the system" do not
  name it. Shop's line keeps the sku as a snapshot. No snippet of shop's code shows the gap, so I
  report none.
- Checkout's synchronous call to payment: TX-3 holds ("changes data another system of this
  codebase owns") against "Checkout must return a Stripe `client_secret` in the same request". That
  is a conflict, not a gap. For payment's PaymentIntent, TX-22 depends on whether it is a tentative
  operation, which "changes nothing it asks for".
- Seen in passing, outside this role: `svc-7-ok-payment-reaches-stripe-through-gateway-port.md`'s
  hook takes `Stripe`, the external system's package, which DRV-8's list does not name.
