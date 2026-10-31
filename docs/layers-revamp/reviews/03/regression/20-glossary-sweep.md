Base 7eeb049, head 8937ad5.

# Regression, issue 20 (glossary sweep), 7eeb049..8937ad5

Judged on Scope and Statement as they stand after the diff, glossary as it stands. Statement or
Scope changed: TX-1, TX-28, TX-30, SYS-1, SYS-9; P5's Except. Terms changed: System, Use case,
Reach, Pure, Idempotent, Tentative operation, Offer, External system, System builder, Common
library; added Configuration value; removed Settle.

## Checklist

- R03-1: resolved — Reach now reaches "through a port ... as the port, not as the code behind it", so a service calling its repository and an adapter calling its driving port reach what SVC-6 and DRV-8 list.
- R03-2: resolved — TX-28 now allows "recording the external system's change as pending"; the private message asking for revalidation is that record and meets TX-22.
- R03-3: resolved — Tentative operation now "gives nothing until it is confirmed, by the requester or by whoever else", so an unconfirmed PaymentIntent is one and TX-36's MAY lifts TX-3 and TX-22.
- R03-4: resolved — Idempotent now counts "its system's records"; a mail is no Record, so the keyless mail handler meets TX-5 without a claim and TX-37 is not engaged (rule no longer holds for it).
- R03-5: unchanged — SYS-2, DOM-1, DOM-7 untouched; Reach's "typed by" makes SYS-2 stricter, not looser.
- R03-6: resolved — under Reach's port clause the adapter reaches the driving port, not the service, so SVC-2's line on DRV-8 is true.
- R03-7: unchanged — TX-37's Relies-on line on TX-31 still drops "that takes an idempotency key".
- R03-8: unchanged — `sys-1-ok`, `svc-1-ok`, `sys-10-ok` still put non-open-host-service port types on a path code outside imports, `drv-3-ok`'s key path is imported by assembly; `sys-12-ok` and `drv-6-ok` now leave SYS-1's Scope ("for code of this codebase outside it": Payload, or shop's own code by role).
- R03-9: unchanged — Pure keeps "hands its caller nothing the caller did not pass"; `randomUUID()` in the domain still fails it.
- R03-10: unchanged — Outside and SVC-7 untouched; `new Date()` in a driving adapter still reaches the operating system through no port.
- R03-11: unchanged — System builder now builds "its system's own" from configuration, which clears `asm-2-ok-assembly-hands-upstreams-to-builder` and `asm-8-ok`; ASM-2 still catches the adapter factories in `tst-8-ok` and `asm-7-ok` (`fetchImpl = fetch`) and `asm-1-ok`'s global `fetch`.
- R03-12: unchanged — SYS-9's Scope still holds for assembly (code of this codebase outside the system); importing `createPayloadCatalog` and building fulfillment's repositories remain past the offer.
- R03-13: unchanged — TX-1's "each call it makes into its store" still covers the service's own load before `begin`.
- R03-14: out of scope — SVC-4, Aggregate, Repository untouched.
- R03-15: unchanged — `asm-3-ok-actor-through-driving-port` commits a price, `asm-3-ok-hook-passes-editor` publishes, both beyond "recording the external system's change as pending" (TX-28); `tx-28-ok-after-change-hook-records-revalidation-request` now complies.
- R03-16: unchanged — TX-37 untouched; TX-30's widened Scope still has the handler's use case decide by `givesUpWaiting`.
- R03-17: unchanged — TX-22, TX-36 Statements untouched; a Checkout Session stays a tentative operation; the two Scope failures stand.
- R03-18: out of scope — ASM-3, TX-15, DOM-1, DOM-4 Scopes and TX-1's "writes" untouched.
- R03-19: unchanged — SYS-2 untouched; published schemas in the domain still are the domain.
- R03-20: unchanged — under Idempotent's "its system's records" each named file still throws differently or writes a second record or message.
- R03-21: out of scope — TX-19 untouched.
- R03-22: out of scope — TX-23 untouched.
- R03-23: unchanged — `tx-12-ok` and `sys-14-ok` untouched; `tx-28-ok-before-change-hook-vetoes-sku-change`'s contested part resolved by External system ("business rules its configuration holds are its own").
- R03-24: resolved — the common library's `Transactions` is an interface (Port), reached "as the port", on SVC-6's list; SVC-7's Scope ("reaches the outside") no longer holds for it. See Newly broken N3 for what the same clause lets through.
- R03-25: unchanged — SVC-6's list untouched.
- R03-26: unchanged — TX-30 widened by "confirmation", but `tx-22-ok-payment-requests-checkout-session` was already in Scope; TX-24 and TX-32 untouched.
- R03-27: out of scope — fixture facts.
- R03-28: resolved — System: "a module is of the system whose layer or offer it belongs to, wherever the repository keeps it".
- R03-29: resolved — System builder: "takes configuration and what the process holds once, builds its system's own from them".
- R03-30: unchanged — Outside untouched; Pure keeps the handing clause; no list names a clock.
- R03-31: resolved — External system makes the sku veto in catalog's config catalog's own rule; "open order" untouched.
- R03-32: out of scope — nothing on `PaymentFailed` changed.
- R03-33: unchanged — Assumptions' list untouched; External system's rewording does not close it.
- R03-34: unchanged — Store untouched; TX-1's "it makes" removes one consequence (billing's read in shop's transaction), not the reading.
- R03-35: out of scope — P10, TX-27 untouched.
- R03-36: unchanged — SYS-1, SYS-9, Offer add "code of this codebase" without saying whether configuration this codebase writes for an external system is such code.
- R03-37: resolved — Settle removed; only "acknowledge" remains (DRV-7, TX-21).
- R03-38: out of scope — "decides" untouched.
- R03-39: out of scope — fixture.
- R03-40: resolved — Tentative operation counts confirmation "by whoever else the other system takes the confirmation from".
- R03-41: out of scope — ASM-3 says "reads", untouched.
- R03-42: resolved — Idempotent: "its system's records".
- R03-43: resolved — Pure: "every runtime of the language" makes zod pure and `node:crypto` not; Common library now "of this codebase", excluding zod; who mints ids in a published builder untouched.
- R03-44: out of scope — Probe, courier rules untouched.
- R03-45: out of scope — Conformist untouched.
- R03-46: out of scope — test words untouched.
- R03-47: unchanged — TX-37 and its `handled.claim` question untouched; TX-28's carve-out reworded only.
- R03-48: out of scope — TX-38 untouched.
- R03-49: out of scope — Store untouched.
- R03-50: unchanged — External system still has its configuration hold business rules, now its own; C4 open on purpose.
- R03-51: resolved — Offer: "the driving port types of its open host service and their fakes".
- R03-52: resolved — Pure: "every runtime of the language".
- R03-53: unchanged — Pure's handing clause kept; the reading stands.
- R03-54: out of scope — P9, Message untouched.
- R03-55: out of scope — P15 untouched.
- R03-56: unchanged — P8 untouched; new Tentative operation ("gives nothing until confirmed") keeps the reading.
- R03-57: out of scope — P17 untouched.
- R03-58: resolved — P5's Except now names "the outside reached through code of the common library", output-neutral, so under the new Common library it excepts something.
- R03-59: unchanged — C8 stays a choice (TX-36 now admits the intent either side of the commit); C9, C1–C6 untouched.

## Examples in the affected set

- asm-1-ok-fulfillment-worker-one-assembly: holds — builders receive config and `tx` (System builder); the factory default `fetch` is asm-7's (R03-11).
- asm-2-breach-adapter-builds-payload: breach — ASM-2: the adapter builds its Payload instance.
- asm-2-breach-builder-fetches-payload-and-builds-billing: breach — ASM-2: builder builds billing and fetches Payload instead of receiving them.
- asm-2-breach-container-handed-to-builder: breach — ASM-2's Statement still met word for word (adversarial); unchanged.
- asm-2-breach-ready-made-store-client: breach — ASM-2.
- asm-2-breach-shop-service-builds-billing: breach — ASM-2; SYS-9 still met (export path).
- asm-2-breach-stripe-client-as-ready-made-plumbing: breach — ASM-2; ASM-7's Scope fails.
- asm-2-ok-assembly-hands-upstreams-to-builder: breach — SYS-1/SYS-9 (assembly imports `createPayloadCatalog`, R03-12) unchanged; its ASM-2 flag cleared by System builder.
- asm-2-ok-handler-receives-service: breach — SYS-9: assembly builds fulfillment's repositories (R03-12), unchanged.
- asm-2-ok-payload-adapter-takes-instance: holds — rules met; fixture break only (R03-27).
- asm-2-ok-shop-reads-invoice-through-driven-port: holds — SVC-6: conformist import of billing's type.
- asm-3-ok-trace-context-crosses-bus-in-envelope: holds — DVN-4 lists the outside the tracer reaches.
- asm-4-breach-driven-adapter-reads-courier: breach — ASM-4, ASM-2.
- asm-5-breach-relay-imports-system-readers: breach — ASM-5, ASM-6, ASM-2.
- asm-5-ok-relay-receives-outbox-readers: holds — ASM-5.
- asm-7-ok-logger-and-tracer-imported-ready-made: breach — ASM-2, `fetchImpl = fetch` (R03-11), unchanged.
- asm-9-ok-transaction-handed-as-argument: breach — TX-1 (load before `begin`, a call it makes into its store), SVC-4 (`carts.clear`); unchanged.
- dom-1-breach-domain-imports-common-tracing-module: breach — DOM-1 lists no common library; transitively `node:async_hooks`, not pure.
- dom-1-breach-order-id-from-node-crypto: breach — DOM-1: `node:crypto` loads on one runtime of the language.
- dom-1-breach-order-number-hash-from-node-crypto: breach — DOM-1, same.
- dom-1-breach-order-type-from-drizzle-table: breach — DOM-1: reaches the driven adapter's table, now also by type.
- dom-1-ok-order-schema-imports: breach — SYS-2: the domain module is the published language (R03-19), unchanged; DOM-1 holds.
- drv-1-breach-callback-in-acting-call: breach — DRV-1's Statement still met by the one call (adversarial); `requestPayment` is acting either way.
- drv-1-breach-invoice-batch-in-one-transaction: breach — DRV-1, TX-1.
- drv-1-ok-session-through-answering-service: breach — SVC-7, `new Date()` (R03-10), unchanged.
- drv-8-breach-adapter-reads-repository-to-check-owner: breach — DRV-8: a driven port, reached as the port, is not on its list.
- drv-8-breach-mailer-subscribed-to-bus-in-assembly: breach — DRV-8 holds; its listed TX-5 no longer does: under "its system's records" a doubled mail changes no record (loosened as intended, issue 15's gap).
- drv-8-breach-server-action-updates-order-table: breach — DRV-8.
- dvn-4-ok-payload-adapter-imports-external-package: holds — DVN-4: Payload and catalog's generated types are the outside, also as types.
- svc-1-ok-driven-ports-in-service-layer: holds — SVC-1, SVC-6.
- svc-2-breach-loaded-order-passed-through-port: breach — SVC-2's Statement still met (adversarial), unchanged.
- svc-2-breach-server-action-checks-before-cancel: breach — SVC-2, DRV-1.
- svc-2-ok-cancel-order-decides-itself: breach — TX-1 (R03-13), TX-5 (R03-20), unchanged.
- svc-3-breach-clear-cart-service-behind-driven-port: breach — SVC-3's "call" untouched; adversarial, unchanged.
- svc-3-breach-place-order-calls-clear-cart: breach — SVC-3, TX-1.
- svc-3-ok-place-order-writes-cart-itself: breach — TX-1 (R03-13); DRV-8: the handler reaches the `MailSender` driven port; unchanged.
- svc-4-breach-mark-paid-updates-column: breach — SVC-4, SVC-6, now also by `NodePgDatabase` type.
- svc-4-breach-second-repository-patches-order-status: breach — SVC-4's Statement still met (adversarial), unchanged.
- svc-4-ok-mark-paid-through-repository: breach — TX-1 (R03-13), unchanged.
- svc-6-breach-drizzle-transaction-in-port: breach — SVC-6, now by "typed by" too; SVC-7.
- svc-6-ok-opaque-transaction: holds — R03-24 cleared by Reach's port clause; fixture break (R03-27) aside.
- svc-6-ok-place-order-dependencies: holds — rules met; fixture break (R03-27) aside.
- svc-7-breach-server-action-raw-sql-through-common-pool: breach — SVC-7 holds; its `satisfies: [DRV-8]` no longer does: transitively `pool` reaches Postgres, which DRV-8 does not list.
- svc-7-breach-service-queries-handed-drizzle-client: breach — SVC-7 holds only while `Database`, the client's own type, is no port (N3); its `satisfies: [SVC-6]` no longer does: transitively it reaches Postgres.
- svc-7-ok-order-overview-through-query-port: holds — SVC-7; TX-1's Scope fails (R03-18).
- svc-7-ok-payment-reaches-stripe-through-gateway-port: holds — SVC-7, DVN-4, TX-5.
- sys-13-ok-checkout-process-sends-receivers-commands: breach — TX-5 (R03-20), unchanged.
- sys-14-breach-money-imports-common-logger: breach — SYS-14.
- sys-14-ok-money-returns-remainder: breach — DOM-7 (R03-23), unchanged; SYS-14, DOM-1 hold.
- sys-1-breach-builder-returns-repositories: breach — SYS-1 now by Statement: returning repositories, `buildShop` is no System builder ("returns ... driving ports, handlers, outbox readers"), so not of the offer.
- sys-1-breach-private-message-exported: breach — SYS-1, SYS-2.
- sys-1-breach-shop-exports-order-repository: breach — SYS-1, TX-12; SYS-9 still met.
- sys-1-breach-wildcard-export-path: breach — SYS-1.
- sys-1-ok-shop-export-paths: breach — SYS-1 (R03-8) unchanged; and now `buildShopHooks` on `build.ts` is no System builder (N1).
- sys-1-ok-shop-hooks-via-builder: breach — newly broken: SYS-1, `buildShopHooks` returns a hook, none of what System builder now says a builder returns (N1).
- sys-9-breach-dashboard-imports-drizzle-tables: breach — SYS-9, TX-12.
- sys-9-ok-billing-imports-from-export-path: holds — SYS-9.
- tx-12-breach-order-detail-joins-invoices-table: breach — TX-12, SYS-9.
- tx-12-breach-query-port-on-billing-open-host-service: breach — TX-12's Statement still met (adversarial), unchanged.
- tx-12-ok-invoice-number-through-billing-port: breach — DOM-7 (R03-23), unchanged.
- tx-15-breach-stats-written-after-commit-without-message: breach — TX-15.
- tx-15-ok-customer-stats-follow-order-paid-by-message: scope fails — TX-15 (R03-18), unchanged.
- tx-1-breach-cart-cleared-after-order-committed: breach — TX-1.
- tx-1-breach-order-saved-without-transaction: breach — TX-1.
- tx-1-breach-repository-reads-ambient-unit-of-work: breach — TX-1 (not handed to each call it makes), ASM-9.
- tx-1-ok-one-invoice-transaction-per-message: holds — TX-1, DRV-1, TX-5, TX-6; fixture break (R03-27) aside.
- tx-1-ok-place-order-service-holds-transaction: breach — SVC-4, `carts.clear` (R03-14), unchanged.
- tx-1-ok-refund-and-payment-in-one-transaction: breach — TX-5 (R03-20), unchanged.
- tx-22-breach-claim-rolled-back-after-3pl-call: breach — TX-22 holds; its listed TX-5 no longer does: the doubled consignment is no record of fulfillment's (intended).
- tx-22-ok-order-confirmation-mail-through-outbox: breach — DOM-1/Pure `randomUUID()` (R03-9), SVC-4 (R03-14), unchanged.
- tx-22-ok-payment-requests-checkout-session: holds — via TX-36 (R03-17, R03-26 unchanged); its "answers" comment is now an acting use case (Use case), no rule turns on it.
- tx-28-breach-after-change-hook-revalidates-page: breach — TX-28: revalidating and publishing go beyond recording the change as pending.
- tx-28-ok-after-change-hook-records-revalidation-request: breach — TX-29 (listed); TX-28 now met, TX-30 met via "confirmation"; TX-37 (R03-16) unchanged.
- tx-28-ok-before-change-hook-vetoes-sku-change: holds — TX-28; DOM-7 contest cleared by External system.
- tx-29-ok-catalog-writes-product-changed-in-payload-transaction: holds — TX-29, TX-22.
- tx-2-breach-order-lines-loop-on-db-not-tx: breach — TX-2.
- tx-2-ok-reservation-lines-written-in-handed-transaction: breach — TX-23 (R03-22), unchanged.
- tx-30-breach-payment-pending-until-webhook: breach — TX-30.
- tx-30-ok-payment-asks-stripe-at-deadline: breach — TX-1 (R03-13), unchanged.
- tx-32-breach-dunning-stage-changed-without-version: breach — TX-32, TX-19.
- tx-32-ok-dunning-stage-changed-carries-version: holds — TX-32, TX-19, TX-5.
- tx-33-breach-billing-handles-refund-payment: breach — TX-33.
- tx-33-ok-billing-handles-payment-refunded: breach — TX-19/TX-38 (R03-48, dist), unchanged.
- tx-34-breach-refund-refusal-thrown: breach — TX-34.
- tx-34-ok-refund-refusal-published: breach — TX-24 SHOULD (R03-26), unchanged.
- tx-35-breach-late-payment-dropped: breach — TX-35.
- tx-35-ok-late-payment-refunded: breach — SVC-6 (R03-25), unchanged.
- tx-3-breach-mark-paid-calls-billing-in-transaction: breach — TX-3.
- tx-3-ok-checkout-requests-checkout-session: scope fails — TX-3 (R03-17), unchanged.
- tx-5-ok-fulfillment-claims-message-id-and-records-early-cancel: holds — TX-5, TX-19, TX-1.
- tx-5-ok-stripe-webhook-claims-event-id: holds — TX-5, TX-6.
- tx-6-breach-order-placed-written-after-commit: breach — TX-6.
- tx-6-ok-payment-succeeded-written-with-payment: breach — TX-19 (R03-21), unchanged.

Breach files flipped to ok: 0. Two lose a listed TX-5 breach (drv-8 mailer, tx-22 claim): loosened rule, intended by the Decision (Idempotent, "its system's records"). One ok file flipped to breach: sys-1-ok-shop-hooks-via-builder (N1).

## Previous builds

**Reach** (transitive, "typed by", port clause)
- raw, shop "Services" (`service/checkout.ts` and the rest) and "Driving adapters" (`next/checkout-route.ts`): calls to `TransactionPort`, repositories and `checkout` now reach the ports; the cannot-comply on SVC-6/DRV-8 is gone. Same in every system of both builds.
- dist, common library `postgres/transaction.ts`: `TransactionPort.run` hands `Tx = PgTransaction<...>`; every service typed by it (shop `builder.ts` deps, `service/checkout.ts`) now reaches Drizzle's type: SVC-6 breach, as `svc-6-breach-drizzle-transaction-in-port`. Intended (Decision: `import type` is a reach).
- raw, shop "Driving adapters" `next/checkout-route.ts`: typed by `ShopCourier`, declared in `builders/slot.ts` (assembly's part), not on DRV-8's list; now a breach on the letter.
- raw, common library `src/drizzle.ts`/`Transaction`: services typed by the opaque class only; unchanged.

**Pure** ("every runtime of the language")
- raw, payment `adapters/driving/next/stripe-webhook-route.ts`: `node:crypto` (`createHmac`, `timingSafeEqual`) is no longer pure code of no system: DRV-8 breach, newly broken (N2). Raw fulfillment's `http/threepl-hook.ts` `signedBy3pl` likewise if it uses `node:crypto` (body not shown).

**Offer, SYS-1, SYS-9, System, System builder**
- raw, shop "Builders and export paths": `buildShopRoutes` (route), `buildShopCatalogHooks` (hook) on `build.ts`, which assembly imports; payment `buildPaymentRoutes`; backoffice `buildBackofficePages`; fulfillment `buildFulfillment` returns `hooks.threePl`. None returns only driving port implementations, handlers, outbox readers: no System builder, so not of the offer. Newly broken (N1). `schedules` entries carry a driving port implementation in `run`; borderline.
- dist, "Systems" `packages/shop/builder.ts`: `buildShopCatalogHooks` returns a hook; `buildShop` returns `scheduled`; `buildPayment` returns `hooks`; `buildFulfillmentQueries` returns `stock.hooks`; `buildFulfillment` returns `hooks.tplWebhook`, `scheduled`. Same, N1.
- raw/dist route files under `apps/web/app/...`: now the system's code by role (System); no verdict changes, `build.ts`/`./builder` stay in SYS-1's Scope through assembly.
- raw/dist assembly builds Stripe and Resend clients and hands them in: against System builder's "builds its system's own", but no rule turns on it (ASM-2 met).

**Idempotent** ("its system's records")
- dist, finding `tx-37-breach-order-confirmation-mail-without-key` (`service/send-order-confirmation.ts`): now complies with TX-5 without a claim.
- raw, shop `service/revalidate-pages.ts`, `send-order-confirmation.ts`: complied, still do.

**Tentative operation**
- dist, finding `tx-36-breach-checkout-payment-intent-in-request` (`payment/service/open-payment.ts`, shop `service/checkout.ts`): an unconfirmed PaymentIntent is one; TX-36 lifts TX-3, TX-22: now complies.
- raw, payment `service/request-payment.ts`: already read as tentative; now backed by the glossary.

**TX-1** ("each call it makes into its store")
- raw, shop `service/checkout.ts`: `d.dunning.of` (billing's open host service, same Postgres) inside the transaction without `tx`: now complies (raw N11 consequence gone).
- dist, shop `service/checkout.ts`: `d.carts.byId(cartId)` before the transaction still breaches.

**TX-28, TX-30**
- dist, finding `tx-28-breach-pre-commit-hook-cannot-ask-for-revalidation`: a hook's use case writing a private request now records the change as pending: TX-28 and TX-22 both met.
- raw/dist catalog `products.ts` veto hooks answer only: unchanged. No build holds a pending hook change, so TX-30's widening changes nothing.

**Use case (acting)**: raw `revalidatePages`, `sendOrderConfirmation`, `cancelPaymentIntent`; dist `revalidateProductPage`, `sendOrderConfirmation` are now acting; each is a handler's only call: DRV-1 unchanged.

**External system, Common library, Configuration value, Settle, P5**: catalog's rules in both builds' `products.ts` are catalog's own; both `common` packages stay common library; builders and probes unchanged under Configuration value; no code used Settle. No verdict changes.

## Newly broken

### N1 — System builder × SYS-1: a builder that returns a hook is no system builder

```yaml
breaches: [SYS-1]
satisfies: [ASM-4, DRV-3, DRV-6]
situation: Payload's config needs shop's afterChange hook; shop's builder on its build path returns it
finding: regression
```

```ts
// packages/shop/build.ts — export path; assembly imports it
export { buildShopHooks } from "./builders/hooks"
export { buildShopOpenHostService } from "./builders/open-host-service"

// packages/shop/builders/hooks.ts
export const buildShopHooks = (courier: Courier<ShopServices>) => ({
  productsAfterChange: [productChanged(courier)],    // a hook: a driving adapter Payload calls
})

// apps/server/assembly.ts
const hooks = buildShopHooks(courier)
const payload = await getPayload({ config: payloadConfig({ products: productsCollection({ afterChange: hooks.productsAfterChange }) }) })
```

System builder now returns "what assembly hands on: implementations of the system's driving ports,
its handlers and its outbox readers". A hook is none of these, nor is a route or a scheduled task,
though assembly hands each on. `buildShopHooks` is then no system builder, and `build.ts` exports
what is not of the offer (SYS-1). Before, a builder returned "implementations" without a list.
Hits `sys-1-ok-shop-hooks-via-builder`, `sys-1-ok-shop-export-paths`, both builds' hook and route
builders.

### N2 — Pure × DRV-8: a Node built-in in a Node-only driving adapter

```yaml
breaches: [DRV-8]
satisfies: [DRV-1, DRV-6, DRV-7]
situation: payment's Stripe webhook route verifies the signature before its one acting call
finding: regression
```

```ts
// packages/payment/src/adapters/driving/next/stripe-webhook-route.ts — runs in the Node web process only
import { createHmac, timingSafeEqual } from "node:crypto"

export const createStripeWebhookRoute = (slot: Slot<PaymentCourier>) => async (request: Request): Promise<Response> => {
  const { recordStripeOutcome, webhookSecret } = slot.read()
  const body = await request.text()
  const { t, v1 } = parseStripeSignature(request.headers.get("stripe-signature"))
  const expected = createHmac("sha256", webhookSecret).update(`${t}.${body}`).digest()
  if (!timingSafeEqual(expected, Buffer.from(v1, "hex"))) return new Response(null, { status: 400 })
  await recordStripeOutcome(toPaymentTerms(JSON.parse(body)))
  return new Response(null, { status: 200 })
}
```

DRV-8 admits "pure code of no system". Pure now requires loading "on every runtime of the language";
`node:crypto` loads on Node only, so the route reaches what DRV-8 does not list, though it reaches
nothing outside the process. The raw Implementer read "every runtime" as the runtimes the code runs
on, and the route passed. SVC-6's and DVN-4's "pure code of no system" narrow the same way.

### N3 — Reach × SVC-7: the outside through a common-library interface

```yaml
breaches: [SVC-7]
satisfies: [SVC-6, ASM-2]
situation: the customer's account page lists their orders; the service queries through a common-library SQL interface
finding: regression
```

```ts
// packages/common/src/sql.ts — common library
export interface Sql { query<R>(text: string, params: readonly unknown[]): Promise<R[]> }
export const createPgSql = (pool: Pool): Sql => ({ query: async (text, params) => (await pool.query(text, [...params])).rows })

// packages/shop/src/service/order-overview.ts
import type { Sql } from "@teeladen/common/sql"
export const createOrderOverview = ({ sql }: { sql: Sql }): OrderOverview => ({ customerId }) =>
  sql.query<OrderOverviewRow>(
    `select o.id, o.status, count(l.id) as "lineCount" from orders o
     left join order_lines l on l.order_id = o.id where o.customer_id = $1 group by o.id`, [customerId])

// apps/web/assembly.ts
const shop = buildShop({ sql: createPgSql(pool) /* … */ })
```

Reach: "what it reaches through a port it reaches as the port, not as the code behind it". `Sql`
is an interface (Port), the common library's, on SVC-6's list. The service reaches it, not Postgres,
so SVC-7's Scope ("reaches the outside") fails and its "a port of its system" binds nothing. Under
the transitive reading review 03 applied, the service reached Postgres through `createPgSql` and
breached SVC-7. The same clause resolves R03-24.

## Noticed

- Decision lets a service take the clock and ids "through a port or the common library"; a ready-made common-library clock is no port, reaches the operating system transitively, and neither SVC-6 nor ASM-7 (output changes how the use case acts) admits it.
- DRV-8 lists no outside entry: a hook verifying a signature with the external system's SDK (`stripe.webhooks.constructEvent`) passes only as "what calls it".
