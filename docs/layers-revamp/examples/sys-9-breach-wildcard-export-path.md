---
breaches: [SYS-9]
satisfies: []
situation: the admin dashboard joins orders, invoices and shipments; billing's package declares its export paths
finding: adversarial
---

# Every file is an export path

```ts
// packages/billing/package.json
// {
//     "name": "@teeladen/billing",
//     "exports": {
//         ".": "./src/index.ts",
//         "./build": "./src/build.ts",
//         "./testing": "./src/testing.ts",
//         "./*": "./src/*.ts"
//     }
// }

// apps/admin/app/dashboard/queries.ts  (another system)
import { invoices } from "@teeladen/billing/adapters/drizzle/schema"      // resolves through "./*"
import { createDrizzleInvoiceRepository } from "@teeladen/billing/adapters/drizzle/invoice-repository"
import { db } from "@teeladen/common/postgres"
import { gt } from "drizzle-orm"

export const dunningInvoices = async () =>
    db.select().from(invoices).where(gt(invoices.dunningStage, 0))

export const invoiceRepository = createDrizzleInvoiceRepository(db)
```

Both imports resolve through an entry of billing's `exports` map, so each is "from one of that system's export paths" and the Statement is satisfied; the linter that holds the boundary from import paths sees a declared path and passes. The Why's harm is the whole of it: the dashboard reaches billing's adapter folder, holds its file layout, and breaks when `schema.ts` splits. SYS-1 would refuse the wildcard entry for exporting what is not the offer, but SYS-9's Statement does not, and "one of that system's export paths, each naming one file" is the wording that denies the glob.
