---
breaches: []
satisfies: [TX-12, ASM-2]
situation: shop's order detail page shows the invoice number billing issued
---

# Shop reads the invoice through a driven port that assembly binds to billing's open host service

```ts
// shop/service/ports/invoice-lookup.ts
import type { InvoiceSummary } from "@teeladen/billing/published"   // conformist: billing's type as is
export interface InvoiceLookup { byOrderId(orderId: OrderId): Promise<InvoiceSummary | null> }

// shop/service/get-order-detail.ts
export const createGetOrderDetail =
  ({ orders, invoices }: { orders: OrderRepository; invoices: InvoiceLookup }): GetOrderDetail =>
  async ({ orderId, customerId }) => {
    const order = await orders.byId(orderId)
    if (!order || order.customerId !== customerId) return null
    const invoice = await invoices.byOrderId(orderId)
    return toOrderDetail(order, invoice)
  }

// apps/web/assembly.ts
const billing = buildBillingOpenHostService({ db, transaction })
const shop = buildShopOpenHostService({
  db,
  transaction,
  invoices: { byOrderId: billing.getInvoiceByOrder },   // in-process today: a function call, no network
})
```

The invoice is billing's aggregate; shop asks billing for it through the one read billing offers on
purpose, `getInvoiceByOrder`, in billing's published language. Billing's rules decide what comes back: a
cancelled invoice is reported as such, a dunning stage means what billing says it means, and a change to
billing's tables changes nothing here. If billing moves out of process, assembly swaps the function for
an HTTP adapter behind the same `InvoiceLookup` port and the service does not change.
