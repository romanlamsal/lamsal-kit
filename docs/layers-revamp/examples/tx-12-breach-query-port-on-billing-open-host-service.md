---
breaches: [TX-12]
satisfies: [SYS-3, SYS-9]
situation: shop's order detail page shows the invoice number billing issued
finding: adversarial
---

# Billing's open host service offers a `findInvoices(where)` port; shop reads its rows through it

```ts
// billing/service/find-invoices.ts  (a driving port billing offers; its type is on the export path)
export type FindInvoices = (where: SQL) => Promise<InvoiceRow[]>      // "flexible: downstreams know what they need"
export const createFindInvoices = ({ db }: { db: NodePgDatabase }): FindInvoices =>
    (where) => db.select().from(invoices).where(where)

// billing/index.ts
export { invoices } from "./adapters/drizzle/schema"                   // so callers can build the condition
export type { FindInvoices } from "./service/find-invoices"

// shop/domain/ports/invoice-lookup.ts  (shop's driven port, implemented by billing's service in-process, SYS-3)
export interface InvoiceLookup { find(where: SQL): Promise<InvoiceRow[]> }

// shop/service/order-details.ts
import { invoices } from "@teeladen/billing"                            // export path, SYS-9
const rows = await invoiceLookup.find(and(eq(invoices.orderId, orderId), eq(invoices.status, "issued")))
const invoiceNumber = rows[0]?.number ?? null
```

Shop reads billing's data through billing's open host service, through a driven port of its own, from billing's export path: TX-12, SYS-3 and SYS-9 are each satisfied word for word. The harm in TX-12's Why is all there: shop's query names billing's table and columns, so moving `dunning_stage` to another table or renaming `status` breaks shop's page at runtime, and billing's rule for which of two invoices is the current one is never asked, because the port asks a question in storage terms and billing answers with rows. "Through a driving port of the owner's that names the question in the owner's published language, not a query over its records" is the wording; SYS-1 lets the rows out as "driving port types", and nothing says a driving port must ask a question.
