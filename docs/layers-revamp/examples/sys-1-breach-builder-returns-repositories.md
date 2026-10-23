---
breaches: [SYS-1]
satisfies: [SYS-9]
situation: the admin dashboard needs orders, invoices and shipments; shop's build path exports its system builder
finding: adversarial
---

# The system builder is on the export path, and returns the repositories with the open host service

```ts
// packages/shop/build.ts  (export path: system builders, as SYS-1 lists)
export { buildShop } from "./builders/open-host-service"

// packages/shop/builders/open-host-service.ts
export const buildShop = ({ tx, db, catalog, billing, payment }: ShopDeps) => {
    const orders = createDrizzleOrderRepository(db)
    const carts = createDrizzleCartRepository(db)
    const outbox = createDrizzleShopOutbox(db)
    return {
        openHostService: { placeOrder: createPlaceOrder({ tx, orders, carts, outbox }), checkout: createCheckout({ /* ... */ }) },
        handlers: buildShopHandlers({ /* ... */ }),
        repositories: { orders, carts },            // "for the dashboard and for tests, so nobody re-wires them"
    }
}

// apps/admin/app/dashboard/page.tsx  (another system; imports from shop's export path only, SYS-9)
import { buildShop } from "@teeladen/shop/build"
const { repositories } = buildShop(deps)
const openOrders = await repositories.orders.findByStatus("placed")
```

The path exports a system builder and nothing else, so what it exports is "the system's offer" as the Statement lists it, and the dashboard's import is from an export path. The Why's harm arrives through the builder's return value: the dashboard holds shop's `OrderRepository`, a driven port, so shop changes its repository by changing its downstream, and the dashboard reads shop's store past every rule in shop's services. The glossary says a builder "returns implementations of what that part offers"; the Statement would hold if it said "its system builders, returning its open host service, handlers and outbox readers and nothing of its inside".
