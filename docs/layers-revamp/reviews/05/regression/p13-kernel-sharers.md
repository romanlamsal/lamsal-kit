Base 89f239e, head 3c3960c.

Changed: P13 Statement s3, "but a shared kernel" → "but a shared kernel that each of its downstream systems shares". "its" reads as the published language's (the kernel has no downstream); its downstream systems are, per call or message (glossary: Upstream, Downstream), those that call its open host service, handle its events, send it the commands it takes.

## Previous regression

- NB-1: resolved — Fresh A catalog's published module reaching `MoneySchema` now breaches P13 s3: fulfillment handles `catalog.ProductRevised.v1` and shares no kernel (Fresh A "Shared kernel": shop, payment, billing, catalog).
- GSC-3: unchanged (resolved), narrowed — a published language may still carry the kernel's `Money`, now only where every downstream of it shares the kernel; Impl shop's `OrderPlacedV1` then hangs on fulfillment's and backoffice's domain imports, which the build does not show.

## Checklist

- R05-7: out of scope — P13's MAY and P2 Why untouched; the change is the kernel clause only.
- R05-22: unchanged — P13 s1 untouched; the split (is Payload, through a hook, another system's code?) now also decides s3 for Impl `StockLevelV1` (`Sku`): if Payload/catalog is fulfillment's downstream for `stockLevel`, it is external, shares no kernel, and the module breaches; if `StockField` is only fulfillment's own adapter, no downstream, complies.
- R05-26: out of scope — P3 untouched; s3 now asks who shares a kernel, not what it holds.
- R05-27: out of scope — "nor be generated from the rest of it" untouched; Impl catalog (external) reaches no kernel (N12).
- R05-31: unchanged — "shares" is the glossary's (Shared kernel: "share as code", "each importing it into its domain"); no new word.
- R05-32: out of scope — P13 s2 untouched; for a command s3's downstream is its sender (glossary: Upstream "takes the commands the other sends"): shop for Impl `RefundPaymentV1`, Fresh A `RefundCardPayment`, a sharer in both.
- Others: out of scope — P13 s3 only.

## Examples in the affected set

- p13-ok-saga-3-payment-events-in-published-language: holds — P13 s3: payment's published `Money` reaches shop (`recordPaymentOutcome`, `startPayment` caller, command sender) and billing (`onPaymentRefunded`), both importing the kernel into their domains (shop `order-payment.ts`, billing `vat.ts`).
- p13-ok-command-declared-by-receiver: holds — P13 s2, s3: `RefundPaymentV1`'s `Money` in payment's published language, whose downstreams shop and billing share the kernel.

## Previous builds

### Impl (`@teeladen/kernel`, subpaths `/money`, `/sku`; sharers not listed, layout only permits domain imports)

- payment `published/index.ts` (`Money`): downstreams shop, billing; sharers. Complies, unchanged.
- shop `OrderPlacedV1` (`Money`, `Sku`): handlers fulfillment, billing, backoffice. Billing shares (`vat.ts`). Fulfillment's domain excerpts (`reservation.ts`, `article.ts`) show no kernel import; backoffice's domain is not shown, its handler sums lines in an adapter. Complies only if both import the kernel into their domains; at 89f239e it complied. Undecided from the build. Fulfillment importing `/sku` only: Newly broken 2.
- fulfillment `StockLevelV1` (`Sku`): hangs on R05-22; and on backoffice, which handles `ShipmentChanged` of the same published language: Newly broken 1.
- Backoffice is the system added later (N6): adding its `OrderPlacedV1` handler, with no kernel in its domain, turns shop's unchanged published module into a breach; cured on either side (backoffice's domain imports the kernel, or shop's published language declares its own amount, a contract change P14 versions).

### Fresh A (`@teashop/kernel`: shop, payment, billing, catalog domains and published languages)

- catalog `ProductRevised.v1` (`price`): downstreams shop, fulfillment; fulfillment shares none: breach, was complies. NB-1's fix. Complies once catalog declares its own price shape (Fresh B D34) or fulfillment's domain imports the kernel.
- shop `OrderPlaced`/`OrderPaid` (`unitGross`, `total`) → billing; payment (`CardPayments.open`, `RefundCardPayment`, `CancelCardPayment`, `CardPaymentSucceeded`, `RefundCompleted`) → shop, billing; billing → shop: all sharers, comply, unchanged. Fulfillment's published language reaches no kernel.

### Fresh B (`@tea/kernel-money`: shop, billing)

- D34: every published language declares its own `MoneyV1` and imports only `zod`; the kernel clause is not reached. Complies, unchanged.

### Watch items

- External downstream: an external system shares no kernel (glossary: "several systems of this codebase"), so a published language any external system reads may carry no kernel value. Only Impl `StockLevelV1` comes near (R05-22).
- Sharers differing per value: the Statement does not say what one shared kernel is, package or module (Newly broken 2).
- Decidable from code: downstreams are the importers of the published language through the offer (P13 s1 confines them there, so the import graph lists them) plus external callers, which no import shows; "shares" by the domain's kernel import; "agree on together" not at all. Not decidable from the published module alone: a breach appears with no diff to it (backoffice above). Handler filtering (Assumptions: the codebase's) changes nothing: whoever parses with the schema imports it.

## Newly broken

### 1. p13-breach-kernel-refused-for-a-message-no-non-sharer-reads.md
```yaml
breaches: [P13]     # s3, the published language's downstreams taken whole
satisfies: [P12, P14]
situation: fulfillment's published StockLevel carries the kernel's Sku to shop, a sharer; backoffice, sharing no kernel, handles only ShipmentChanged, which carries no kernel value
finding: regression
```
```ts
// packages/fulfillment/src/published/index.ts
import { z } from "zod";
import { Sku } from "@teeladen/kernel/sku";          // shared by shop, billing, fulfillment
export const StockLevelV1 = z.object({ sku: Sku, onHand: z.number().int(), available: z.number().int() }); // shop calls stockLevel
export const ShipmentChangedV1 = z.object({ orderId: z.string().uuid(), state: z.enum(["booked", "shipped"]), shipmentVersion: z.number().int() });
```
```ts
// packages/backoffice/src/adapters/driving/handlers.ts — backoffice's domain imports no kernel
const m = ShipmentChangedV1.parse(e.payload);
```
"each of its downstream systems" is the published language's, not the message's: backoffice is downstream of fulfillment (for `ShipmentChanged`), so `Sku` is refused in `StockLevelV1`, which only shop reads. A change to `Sku` reaches no non-sharer; the P13 property holds. At 89f239e admitted.

### 2. p13-split-kernel-unit-package-or-module.md
```yaml
breaches: []        # reading A; [P13] under reading B
satisfies: [P1, P12, P14]
situation: one kernel package with /money and /sku; fulfillment's domain imports /sku only; shop's OrderPlaced carries Money and Sku to fulfillment
finding: regression
```
```ts
// packages/fulfillment/src/domain/reservation.ts
import { Sku } from "@teeladen/kernel/sku";          // no /money
// packages/shop/src/published/order-placed.ts
import { Money } from "@teeladen/kernel/money";
import { Sku } from "@teeladen/kernel/sku";
export const OrderPlacedV1 = z.object({ orderId: z.string().uuid(), lines: z.array(z.object({ sku: Sku, unitPriceGross: Money })) });
```
Reading A: the package is the shared kernel; fulfillment shares it, `Money` included: holds. Reading B: each module is a part of the domain model several systems share (glossary), fulfillment shares the `Sku` one, not the `Money` one: breach. At 89f239e no verdict hung on who shares a kernel; now one does, and the glossary does not fix the unit.

## Noticed

- A published language of a system that shares no kernel, reaching one: s3 is silent (the kernel is not of its system); only P13 s1's unsettled reading (kernel import as another system's domain) decides. Same at 89f239e.
- "agree on together" (glossary: Shared kernel) shows in no code; only the domain import does.
