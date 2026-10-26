---
breaches: []
satisfies: [TX-32, TX-19, TX-5]
situation: billing's dunning stage rises with each reminder and clears once the customer pays; shop keeps a replica for pay-by-invoice
---

# `DunningStageChanged` carries the version of the customer's dunning record

```ts
// billing/published/messages.ts
export const dunningStageChangedSchema = z.object({
  id: z.string().uuid(), type: z.literal("DunningStageChanged"),
  customerId: z.string(),
  stage: z.enum(["none", "reminder", "second-reminder", "collection"]),
  version: z.number().int().positive(),             // the CustomerDunning aggregate's version after the change
})

// billing/service/clear-dunning.ts (inside transaction.run)
const next = clear(dunning)                         // domain: version + 1
await dunnings.save(next, tx)                       // fails if another change saved first (TX-23)
await outbox.write(dunningStageChanged(next), tx)   // carries next.version

// shop/domain/dunning-replica.ts
export const applyStageChange = (current: DunningReplica | undefined, m: DunningStageChanged) =>
  current && current.version >= m.version ? current : { customerId: m.customerId, stage: m.stage, version: m.version }
```

Billing raises the version in the transaction that changes the stage, and the save that compares it
fails for a concurrent change, so two messages never carry the same version. Shop keeps the higher:
`none` at version 4 arrives first and stays, `reminder` at version 3 arrives after and is dropped.
