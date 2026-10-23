---
breaches: []
satisfies: [SYS-3, SYS-5, TX-12, DOM-5]
situation: shop calls billing's open host service in-process
---

# Shop reads the invoice through a driven port assembly fills with billing's service

```ts
// packages/shop/domain/ports/invoices.ts — driven port, in the domain
import type { Invoice } from "@teeladen/billing"
export interface Invoices {
  forOrder(orderId: string): Promise<Invoice | null>
}

// packages/shop/service/order-details.ts
export type OrderDetails = (input: { orderId: string }) => Promise<{ order: Order; invoice: Invoice | null }>

export const createOrderDetails =
  (orders: OrderRepository, invoices: Invoices): OrderDetails =>
  async ({ orderId }) => {
    const order = await orders.byId(orderId)
    if (!order) throw new OrderNotFound(orderId)
    return { order, invoice: await invoices.forOrder(orderId) }
  }

// apps/server/assembly.ts — in-process today
const billing = buildBillingOpenHostService({ db })
const shop = buildShopOpenHostService({ db, payload, invoices: { forOrder: (orderId) => billing.invoiceForOrder({ orderId }) } })
// billing out of process tomorrow: invoices: httpInvoices(fetch, config.billingUrl)
```

`Invoices` is shop's driven port; today assembly implements it with billing's service in one line, and moving billing to its own process adds an HTTP adapter and changes that one line. `createOrderDetails` and shop's domain do not know which. The read goes through billing's open host service (TX-12), and shop's test hands `createOrderDetails` a fake `Invoices` with no billing running. The port returns billing's `Invoice` untranslated: shop conforms to billing (SYS-5), and the published language import in the domain is what DOM-1 allows.
