---
breaches: []
satisfies: []
situation: `/health` pings the database; `/metrics` is scraped
finding: gap
---

# Two route handlers of no system, one holding the store client

```ts
// apps/web/app/health/route.ts — Next.js route handler; belongs to no system
import { sql } from "drizzle-orm"
import { db } from "@teeladen/common/postgres"              // the store client, ready-made

export async function GET() {
  try {
    await db.execute(sql`select 1`)
    return Response.json({ status: "ok", database: "up" })
  } catch {
    return Response.json({ status: "degraded", database: "down" }, { status: 503 })
  }
}

// apps/web/app/metrics/route.ts
import { register, collectDefaultMetrics } from "prom-client"
collectDefaultMetrics()                                      // runs at module load

export async function GET() {
  return new Response(await register.metrics(), { headers: { "content-type": register.contentType } })
}
```

Both are driving-side code the framework constructs, but neither adapts a caller to a driving
port: no system offers "is the database up" as a use case, so under the glossary neither is a
driving adapter, and the Scopes that would bite begin with one or with a system: ARR-1 ("code of
one layer of a system"), DRV-1, DRV-3, ASM-4. ASM-2's Scope names factories, and a route handler
is none; ASM-7 permits a ready-made logger and tracer, not a store client, and
`asm-2-breach-ready-made-store-client.md` calls that client a breach when an adapter imports it.
`collectDefaultMetrics()` at module load is what DRV-6 forbids for courier reads, which this is
not. A reader wants ruled whether operability code sits outside the layers like assembly, may
hold the store client directly, and reaches what assembly produced through the courier or is a
part of assembly itself.
